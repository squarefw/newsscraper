#!/usr/bin/env node

/**
 * 回填分类脚本
 * 将指定时间之后发布的、当前处于「未分类」(ID 1) 的文章，重新进行 AI 分类并更新 WordPress 分类。
 *
 * 背景：批处理模式发布时只返回了分类名称、未映射为分类ID，导致所有文章落到默认「未分类」。
 * 此脚本用于修复已发布的文章。
 *
 * 用法:
 *   node backfill-categories.js [configPath] [afterDate] [targetCatIds]
 *   默认 configPath = config/config.remote-aliyun.json
 *   默认 afterDate = 2026-08-15T00:00:00Z
 *   默认 targetCatIds = 1（处理「未分类」，可传逗号分隔的多个ID，如 150 处理「最新新闻」）
 */

const path = require('path');
const ConfigLoader = require('../config/loader');
const WordPressConnector = require('../wordpress/wordpressConnector');
const { validateAndGetCategoryId } = require('../ai/aiProcessor');

// 与批处理重写 prompt 一致的分类选项（映射到 WP 真实分类）
const CATEGORY_OPTIONS = ['政治时事', '经济', '科技', '体育', '娱乐', '社会', '国际', '犯罪', '生活', '都市新闻', '最新新闻', '热点新闻'];

// 去 HTML 标签和实体
const stripHtml = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'")
  .replace(/&#0?160;/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim();

// 按字符总量分批（避免单次 AI 输出超限）
const chunkBySize = (items, getText, maxChars = 12000) => {
  const batches = [];
  let cur = [];
  let size = 0;
  for (const it of items) {
    const s = (getText(it) || '').length;
    if (cur.length && size + s > maxChars) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += s;
  }
  if (cur.length) batches.push(cur);
  return batches;
};

async function main() {
  const args = process.argv.slice(2);
  let configPath = args[0] || 'config/config.remote-aliyun.json';
  let after = args[1] || '2026-08-15T00:00:00Z';
  if (!path.isAbsolute(configPath)) configPath = path.resolve(__dirname, '../../', configPath);

  console.log('🚀 开始回填文章分类');
  console.log('='.repeat(60));

  // 加载配置
  const configLoader = new ConfigLoader();
  const env = configLoader.inferEnvironment(configPath);
  const config = configLoader.loadConfig(configPath, env);
  console.log(`✅ 配置加载成功，环境: ${env}`);

  // WordPress 连接
  const wp = new WordPressConnector({
    baseUrl: config.wordpress.baseUrl,
    username: config.wordpress.username,
    password: config.wordpress.password
  });
  await wp.detectBestMethod();
  console.log(`✅ WordPress 连接: ${wp.preferredMethod.toUpperCase()}`);

  // 获取分类列表（一次性缓存）
  const wpCategories = await wp.getCategories();
  console.log(`✅ 获取到 ${wpCategories.length} 个 WP 分类`);

  // AI 管理器
  const { MultiAIManager } = require('../ai/multiAIManager');
  const ai = new MultiAIManager(config);
  await ai.initialize();
  const engine = ai.getAgentForTask('categorize');
  console.log(`✅ AI 分类引擎: ${engine.name}\n`);

  // 分页拉取 after 之后发布的文章
  const allPosts = [];
  let page = 1;
  while (page <= 5) {
    const res = await wp.makeRestRequest(
      `posts?after=${encodeURIComponent(after)}&per_page=100&page=${page}&_fields=id,date,title,content,categories`,
      'GET'
    );
    if (res.statusCode !== 200) break;
    const chunk = JSON.parse(res.data);
    if (!chunk.length) break;
    allPosts.push(...chunk);
    if (chunk.length < 100) break;
    page++;
  }
  console.log(`${after} 之后发布的文章: ${allPosts.length} 篇`);

  // 目标分类ID（默认「未分类」=1；也可指定如 150 处理「最新新闻」）
  const targetIds = (args[2] || '1').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  const toClassify = allPosts.filter(p => p.categories && p.categories.some(id => targetIds.includes(id)));
  console.log(`其中处于目标分类(${targetIds.join(',')}): ${toClassify.length} 篇`);
  if (toClassify.length === 0) {
    console.log('✅ 无需处理');
    return;
  }

  // 构建分类输入
  const items = toClassify.map(p => ({
    postId: p.id,
    title: stripHtml(p.title?.rendered || ''),
    content: stripHtml(p.content?.rendered || '').substring(0, 1200)
  }));

  // 分批 AI 分类
  const batches = chunkBySize(items, it => it.title + it.content);
  const classified = [];
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`\n📦 分类批次 ${b + 1}/${batches.length} (${batch.length}篇)...`);
    const prompt = `你是一名资深新闻编辑。请为以下每篇文章选择最合适的 1 个分类。

可选分类：${CATEGORY_OPTIONS.join('、')}

**输出格式（严格遵循）**：返回一个 JSON 对象，不要 markdown 标记，不要任何解释文字：
{"results":[{"postId": 文章ID数字, "category": "分类名称"}, ...]}

输入文章：
${JSON.stringify(batch.map(it => ({ postId: it.postId, title: it.title, content: it.content })))}`;

    try {
      const response = await engine.processContent(prompt, 'custom');
      let clean = response.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(clean);
      if (!parsed.results || !Array.isArray(parsed.results)) throw new Error('响应缺少 results 数组');
      classified.push(...parsed.results);
      console.log(`   ✅ 本批分类完成: ${parsed.results.length} 篇`);
    } catch (err) {
      console.error(`   ❌ 批次 ${b + 1} 分类失败: ${err.message}`);
    }
  }

  // 映射分类 ID 并更新 WordPress
  console.log('\n🏷️  映射分类 ID 并更新 WordPress...');
  let updated = 0;
  let failed = 0;
  for (const item of items) {
    const result = classified.find(c => String(c.postId) === String(item.postId));
    if (!result || !result.category) {
      console.log(`   ⚠️ 文章 ${item.postId} 无分类结果，跳过`);
      failed++;
      continue;
    }
    const catId = await validateAndGetCategoryId(
      result.category,
      wpCategories,
      config.wordpress?.categoryConstraints?.fallbackCategory || '未分类'
    );
    try {
      const upd = await wp.makeRestRequest(`posts/${item.postId}`, 'POST', JSON.stringify({ categories: [catId] }));
      if (upd.statusCode === 200) {
        console.log(`   ✅ 文章 ${item.postId} -> ${result.category} (ID ${catId})`);
        updated++;
      } else {
        console.log(`   ❌ 更新失败 ${item.postId}: HTTP ${upd.statusCode}`);
        failed++;
      }
    } catch (err) {
      console.log(`   ❌ 更新失败 ${item.postId}: ${err.message}`);
      failed++;
    }
    // 避免请求过快
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 回填完成: 成功 ${updated} 篇, 失败 ${failed} 篇`);
  console.log('✅ 完成');
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌ 回填失败:', e.message);
    process.exit(1);
  });
}

module.exports = { main };
