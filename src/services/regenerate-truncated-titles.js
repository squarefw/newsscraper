#!/usr/bin/env node

/**
 * 重新生成被截断的文章标题
 * 批量处理模式下标题被截断到60字符，此脚本用AI根据正文重新生成完整标题
 *
 * 用法:
 *   node src/services/regenerate-truncated-titles.js [--dry-run] [--limit N]
 */

const axios = require('axios');
const path = require('path');
const ConfigLoader = require('../config/loader');
const { MultiAIManager } = require('../ai/multiAIManager');

const WP = {
  baseUrl: 'http://8.208.23.37',
  username: 'i0086editor',
  password: 'nEww$$&b6o90cDDMD61p%AjX'
};
const wpUrl = `${WP.baseUrl}/wp-json/wp/v2/posts`;
const auth = 'Basic ' + Buffer.from(`${WP.username}:${WP.password}`).toString('base64');

const stripHtml = (h) => String(h || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8230;/g, '…')
  .replace(/[ \t]+/g, ' ').trim();

async function getAllPosts() {
  const allPosts = [];
  let page = 1;
  while (true) {
    const res = await axios.get(wpUrl + `?per_page=100&page=${page}&_fields=id,title,content,date`, {
      headers: { 'Authorization': auth }
    });
    if (!res.data.length) break;
    allPosts.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return allPosts;
}

async function updateTitle(postId, newTitle) {
  try {
    await axios.post(wpUrl + '/' + postId, { title: newTitle }, {
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
    });
    return true;
  } catch (err) {
    console.error(`   ❌ 更新失败 ${postId}: HTTP ${err.response?.status} ${err.response?.data?.message || ''}`);
    return false;
  }
}

const chunkBySize = (items, getText, maxChars = 15000) => {
  const batches = [];
  let cur = [];
  let size = 0;
  for (const it of items) {
    const s = (getText(it) || '').length;
    if (cur.length && size + s > maxChars) { batches.push(cur); cur = []; size = 0; }
    cur.push(it); size += s;
  }
  if (cur.length) batches.push(cur);
  return batches;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

  console.log(`${dryRun ? '🔍 [DRY RUN] 扫描' : '✍️  重新生成'}被截断的标题\n`);

  const posts = await getAllPosts();
  const truncated = posts.filter(p => {
    const t = (p.title?.rendered || '');
    return t.includes('&#8230;') || t.includes('…') || t.includes('...');
  }).slice(0, limit);

  // 提取标题纯文本（title 是 {rendered} 对象）
  const titleOf = (p) => {
    const t = p?.title;
    if (typeof t === 'string') return t;
    return (t?.rendered || t?.raw || '');
  };

  console.log(`被截断标题的文章: ${truncated.length} 篇\n`);

  if (dryRun) {
    truncated.slice(0, 30).forEach(p => console.log(`  ID:${p.id} | ${stripHtml(titleOf(p))}`));
    console.log('\n🔍 DRY RUN 模式，未做修改。');
    return;
  }

  // 加载 AI
  const configPath = path.resolve(__dirname, '../../', 'config/config.remote-aliyun.json');
  const configLoader = new ConfigLoader();
  const env = configLoader.inferEnvironment(configPath);
  const config = configLoader.loadConfig(configPath, env);
  const ai = new MultiAIManager(config);
  await ai.initialize();
  const engine = ai.getAgentForTask('custom_title_generate');
  console.log(`✅ AI 引擎: ${engine.name}\n`);

  // 分批生成标题
  const items = truncated.map(p => ({
    postId: p.id,
    title: stripHtml(titleOf(p)),
    content: stripHtml(p.content?.rendered || '').substring(0, 1500)
  }));

  const batches = chunkBySize(items, it => it.content);
  console.log(`分 ${batches.length} 批生成标题...\n`);

  let success = 0;
  let failed = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`📦 批次 ${b + 1}/${batches.length} (${batch.length} 篇)...`);

    const prompt = `你是一名资深新闻编辑。请根据以下每篇文章的正文内容，重新生成一个完整的中文新闻标题。

**要求：**
1. 标题必须完整，不能截断，不能使用省略号
2. 包含关键人物、地点、事件核心
3. 长度不限，但需简洁有力（通常15-40个中文字符）
4. 保留爱尔兰特色词汇的"中文 (英文)"格式，如"爱尔兰众议院 (Dáil Éireann)"、"爱尔兰警方 (Gardaí)"
5. 避免以"根据"、"关于"、"针对"等抽象词开头

**输出格式（严格JSON）：**
{"results":[{"postId": 文章ID, "title": "完整标题"}, ...]}

输入文章：
${JSON.stringify(batch.map(it => ({ postId: it.postId, title: it.title, content: it.content })))}`;

    try {
      const response = await engine.processContent(prompt, 'custom');
      let clean = response.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(clean);
      if (!parsed.results || !Array.isArray(parsed.results)) throw new Error('缺少 results 数组');

      for (const result of parsed.results) {
        if (!result.title || !result.postId) continue;
        const newTitle = result.title.replace(/\.\.\.|…$/, '').trim();
        process.stdout.write(`   ID:${result.postId} 标题更新... `);
        const ok = await updateTitle(result.postId, newTitle);
        if (ok) {
          console.log(`✅ "${newTitle.substring(0, 40)}..."`);
          success++;
        } else {
          failed++;
        }
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      console.error(`   ❌ 批次 ${b + 1} 失败: ${err.message}`);
      failed += batch.length;
    }
  }

  console.log(`\n📊 完成: 成功 ${success} 篇, 失败 ${failed} 篇`);
}

if (require.main === module) {
  main().catch(e => { console.error('❌ 错误:', e.message); process.exit(1); });
}

module.exports = { main };
