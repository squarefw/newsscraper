#!/usr/bin/env node

/**
 * 文章清理脚本
 * 扫描所有已发布文章，清理：
 * 1. 死亡公告（中英文关键词预过滤）
 * 2. 重复文章（同一事件）
 * 3. 低质量/无意义（广告、碎片化、与爱尔兰/中国无关的纯国际新闻）
 *
 * 用法:
 *   node cleanup-published-posts.js [configPath]
 *   默认 configPath = config/config.remote-aliyun.json
 *
 * 输出:
 *   - 生成清理报告 cleanup-report-YYYY-MM-DD.json
 *   - 不直接删除，需要手动执行 cleanup-apply.js 应用删除
 */

const fs = require('fs');
const path = require('path');
const ConfigLoader = require('../config/loader');
const WordPressConnector = require('../wordpress/wordpressConnector');
const NewsArticleFilter = require('../article/newsArticleFilter');

// 死亡公告关键词预过滤（复用 newsArticleFilter.js 的逻辑）
const DEATH_NOTICE_KEYWORDS_EN = [
  '/obituaries/', '/obituary/', '/death-notice/', '/death_notice/',
  'rip.ie/death-notice', 'rip.ie/death_notice',
  '/funeral-notice/', '/funeral_notice/',
  'passed away peacefully', 'passed away surrounded',
  'passed away at the peace', 'died peacefully',
  'in his/her', 'in her/his',
  'is survived by', 'predeceased by', 'pre-deceased by',
  'deeply and sadly missed', 'will be sadly missed',
  'will be lovingly remembered', 'fondly remembered',
  'peacefully in the presence of', 'in the loving presence of',
  'at the peaceful presence of',
  'gone home to be with', 'called home to',
  'rest in peace', 'rip ', 'r.i.p.',
  'in memoriam', 'in loving memory of',
  'in sad and loving memory',
  'obituary:', 'obituary -',
  'death notice:', 'death notice -',
  'funeral notice:', 'funeral notice -',
  'funeral details:', 'funeral details -',
  'funeral mass will be', 'repose will be',
  'removal from', 'removal to',
  'requiescat in pace',
  'death-notices/', 'obituary-section'
];

const DEATH_NOTICE_KEYWORDS_ZH = [
  '死亡公告', '讣告', '讣闻',
  '沉痛悼念', '深切哀悼', '哀悼通知',
  '享年', '享寿', '享龄',
  '与世长辞', '千古', '驾鹤西去', '仙逝',
  '寿终正寝', '寿终内寝',
  '追悼会', '告别仪式', '遗体告别',
  '出殡', '安葬', '落葬',
  '治丧委员会', '灵堂',
  '谨定于', '兹定于', '谨遵',
  '兹有我', '不幸病逝', '因病医治无效',
  'rip.ie/death-notice', 'rip.ie/death_notice'
];

const checkDeathNotice = (title, content, url) => {
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const c = (content || '').substring(0, 1000).toLowerCase();
  const combined = `${t} ${u} ${c}`;

  for (const kw of DEATH_NOTICE_KEYWORDS_EN) {
    if (combined.includes(kw)) return { matched: true, keyword: kw, type: 'en' };
  }
  for (const kw of DEATH_NOTICE_KEYWORDS_ZH) {
    if (combined.includes(kw)) return { matched: true, keyword: kw, type: 'zh' };
  }
  return { matched: false };
};

// 去 HTML 标签
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

// 按字符总量分批
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
  if (!path.isAbsolute(configPath)) configPath = path.resolve(__dirname, '../../', configPath);

  console.log('🧹 开始文章清理扫描');
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

  // 分页拉取所有文章
  console.log('\n📥 拉取所有已发布文章...');
  const allPosts = [];
  let page = 1;
  while (page <= 30) {
    const res = await wp.makeRestRequest(
      `posts?per_page=100&page=${page}&status=publish&_fields=id,date,title,content,categories,link`,
      'GET'
    );
    if (res.statusCode !== 200) {
      console.log(`⚠️ 拉取第 ${page} 页失败: HTTP ${res.statusCode}`);
      break;
    }
    const chunk = JSON.parse(res.data);
    if (!chunk.length) break;
    allPosts.push(...chunk);
    console.log(`   第 ${page} 页: ${chunk.length} 篇`);
    if (chunk.length < 100) break;
    page++;
  }
  console.log(`✅ 共拉取 ${allPosts.length} 篇文章\n`);

  // 获取分类名称映射
  const catsRes = await wp.makeRestRequest('categories?per_page=100&_fields=id,name', 'GET');
  const cats = JSON.parse(catsRes.data);
  const idToName = Object.fromEntries(cats.map(c => [c.id, c.name]));

  // 1. 死亡公告预过滤
  console.log('🔍 步骤 1/3: 死亡公告关键词预过滤...');
  const deathNotices = [];
  const afterDeathFilter = [];
  for (const post of allPosts) {
    const title = stripHtml(post.title?.rendered || '');
    const content = stripHtml(post.content?.rendered || '');
    const check = checkDeathNotice(title, content, post.link);
    if (check.matched) {
      deathNotices.push({
        postId: post.id,
        title: title.substring(0, 80),
        date: post.date,
        categories: post.categories.map(id => idToName[id] || id).join(','),
        reason: `死亡公告（匹配关键词: ${check.keyword}）`,
        type: 'death_notice'
      });
    } else {
      afterDeathFilter.push(post);
    }
  }
  console.log(`   死亡公告: ${deathNotices.length} 篇`);
  console.log(`   剩余待处理: ${afterDeathFilter.length} 篇\n`);

  if (afterDeathFilter.length === 0) {
    console.log('✅ 所有文章都是死亡公告，无需 AI 处理');
    const report = {
      scanTime: new Date().toISOString(),
      totalScanned: allPosts.length,
      toDelete: deathNotices,
      aiFiltered: [],
      duplicates: []
    };
    const reportPath = `cleanup-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 报告已保存: ${reportPath}`);
    return;
  }

  // 2. AI 批处理判断质量/重复
  console.log('🤖 步骤 2/3: AI 批处理判断质量/重复...');
  const { MultiAIManager } = require('../ai/multiAIManager');
  const ai = new MultiAIManager(config);
  await ai.initialize();
  const engine = ai.getAgentForTask('article_qualification');
  console.log(`✅ AI 引擎: ${engine.name}\n`);

  // 准备 AI 输入
  const aiInput = afterDeathFilter.map(post => ({
    postId: post.id,
    title: stripHtml(post.title?.rendered || ''),
    content: stripHtml(post.content?.rendered || '').substring(0, 10000),
    url: post.link
  }));

  // 分批
  const batches = chunkBySize(aiInput, it => it.title + it.content);
  console.log(`   分批: ${aiInput.length} 篇文章分 ${batches.length} 批\n`);

  const aiFiltered = [];
  const duplicates = [];

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`📦 批次 ${b + 1}/${batches.length} (${batch.length} 篇)...`);

    const prompt = `你是一名资深新闻主编。请为以下每篇文章判断：
1. 是否合格（与爱尔兰/中国相关的高质量新闻）
2. 是否重复（与同批次其他文章报道同一事件）

**合格标准**：
- ✅ 爱尔兰本土新闻、中爱关系新闻、含爱尔兰因素的国际新闻
- ✅ 具备 3 个以上核心事实的严肃报道
- ❌ 纯国际新闻（与爱尔兰/中国无关）
- ❌ 广告软文、碎片化内容、分类页/导航页

**重复标准**：
- ✅ 重复：报道同一具体事件（相同时间、地点、人物、核心事件）
- ❌ 不重复：相同主题但不同事件（如"A公司财报" vs "B公司财报"）

**输出格式（严格 JSON，不要 markdown 标记）**：
{
  "results": [
    {
      "postId": 文章ID,
      "qualified": true/false,
      "isDuplicate": true/false,
      "duplicateOf": 重复文章的ID或null,
      "reason": "判断理由"
    }
  ]
}

输入文章：
${JSON.stringify(batch.map(it => ({ postId: it.postId, title: it.title, content: it.content })))}`;

    try {
      const response = await engine.processContent(prompt, 'custom');
      let clean = response.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(clean);
      if (!parsed.results || !Array.isArray(parsed.results)) throw new Error('响应缺少 results 数组');

      for (const result of parsed.results) {
        const post = afterDeathFilter.find(p => p.id === result.postId);
        if (!post) continue;

        if (!result.qualified) {
          aiFiltered.push({
            postId: post.id,
            title: stripHtml(post.title?.rendered || '').substring(0, 80),
            date: post.date,
            categories: post.categories.map(id => idToName[id] || id).join(','),
            reason: result.reason || '不符合资格审查标准',
            type: 'low_quality'
          });
        } else if (result.isDuplicate) {
          duplicates.push({
            postId: post.id,
            title: stripHtml(post.title?.rendered || '').substring(0, 80),
            date: post.date,
            categories: post.categories.map(id => idToName[id] || id).join(','),
            reason: `与文章 ${result.duplicateOf} 重复`,
            type: 'duplicate',
            duplicateOf: result.duplicateOf
          });
        }
      }
      console.log(`   ✅ 本批完成`);
    } catch (err) {
      console.error(`   ❌ 批次 ${b + 1} 失败: ${err.message}`);
    }
  }

  // 3. 生成报告
  console.log('\n📊 步骤 3/3: 生成清理报告...');
  const toDelete = [...deathNotices, ...aiFiltered, ...duplicates];
  const report = {
    scanTime: new Date().toISOString(),
    totalScanned: allPosts.length,
    toDelete,
    summary: {
      deathNotices: deathNotices.length,
      aiFiltered: aiFiltered.length,
      duplicates: duplicates.length,
      totalToDelete: toDelete.length
    }
  };

  const reportPath = `cleanup-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ 报告已保存: ${reportPath}`);
  console.log('\n📋 清理摘要:');
  console.log(`   总扫描: ${allPosts.length} 篇`);
  console.log(`   死亡公告: ${deathNotices.length} 篇`);
  console.log(`   AI 过滤: ${aiFiltered.length} 篇`);
  console.log(`   重复: ${duplicates.length} 篇`);
  console.log(`   总计待删除: ${toDelete.length} 篇`);
  console.log('\n⚠️ 请查看报告并确认。确认无误后执行:');
  console.log(`   node src/services/cleanup-apply.js ${reportPath}`);
  console.log('✅ 完成');
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌ 清理失败:', e.message);
    process.exit(1);
  });
}

module.exports = { main };
