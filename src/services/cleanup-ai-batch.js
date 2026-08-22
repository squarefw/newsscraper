#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ConfigLoader = require('../config/loader');
const WordPressConnector = require('../wordpress/wordpressConnector');
const { MultiAIManager } = require('../ai/multiAIManager');

const stripHtml = (h) => String(h||'').replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();

const chunkBySize = (items, getText, maxChars = 15000) => {
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
  const configPath = 'config/config.remote-aliyun.json';
  const configLoader = new ConfigLoader();
  const env = configLoader.inferEnvironment(configPath);
  const config = configLoader.loadConfig(configPath, env);

  const wp = new WordPressConnector({
    baseUrl: config.wordpress.baseUrl,
    username: config.wordpress.username,
    password: config.wordpress.password
  });
  await wp.detectBestMethod();

  const ai = new MultiAIManager(config);
  await ai.initialize();
  const engine = ai.getAgentForTask('article_qualification');

  const allPosts = JSON.parse(fs.readFileSync('/tmp/wp-remaining-posts.json', 'utf8'));
  console.log('开始 AI 批处理:', allPosts.length, '篇文章');

  const batches = chunkBySize(allPosts, it => it.title + it.content, 12000);
  console.log('分', batches.length, '批处理\n');

  const results = [];
  let batchNum = 0;

  for (const batch of batches) {
    batchNum++;
    console.log(`批次 ${batchNum}/${batches.length} (${batch.length} 篇)...`);

    const prompt = `你是一名资深新闻主编，负责爱尔兰华人门户网站的新闻质量管控。请对以下文章进行质量评估和去重判断。

**评估标准**：

1. **地域相关性**（核心）：
   - 合格：爱尔兰本土新闻、中爱关系、含爱尔兰因素的国际新闻
   - 不合格：纯国际新闻（与爱尔兰/中国无关）、泛泛的全球趋势

2. **内容质量**：
   - 合格：具备核心事实的严肃报道（事故、犯罪、政治、经济、社会、文化等）
   - 不合格：广告软文、碎片化内容、分类页/导航页、纯评论/观点无事实支撑

3. **重复判断**（同批次内）：
   - 标记与其他文章报道同一事件的为重复
   - 同一主题但不同事件不算重复（如"公司A财报" vs "公司B财报"）

**输出格式**（严格 JSON）：
{
  "results": [
    {
      "postId": 文章ID,
      "qualified": true/false,
      "isDuplicate": true/false,
      "duplicateOf": 重复文章的ID或null,
      "reason": "判断理由（简短）"
    }
  ]
}

文章列表：
${JSON.stringify(batch.map(it => ({postId: it.postId, title: it.title, content: it.content.substring(0, 800)})))}`;

    try {
      const response = await engine.processContent(prompt, 'custom');
      let clean = response.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');

      const parsed = JSON.parse(clean);
      if (parsed.results && Array.isArray(parsed.results)) {
        results.push(...parsed.results);
        console.log(`  ✅ 完成，${parsed.results.length} 篇已评估`);
      } else {
        console.log(`  ❌ 响应格式错误`);
      }
    } catch (err) {
      console.error(`  ❌ 批次失败: ${err.message}`);
    }

    // 避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  // 生成报告
  const toDelete = results.filter(r => !r.qualified || r.isDuplicate);
  const report = {
    scanTime: new Date().toISOString(),
    totalScanned: allPosts.length,
    aiEvaluated: results.length,
    toDelete: toDelete.map(r => {
      const post = allPosts.find(p => p.postId === r.postId);
      return {
        postId: r.postId,
        date: post?.date,
        title: post?.title?.substring(0, 80),
        categories: post?.categories,
        qualified: r.qualified,
        isDuplicate: r.isDuplicate,
        duplicateOf: r.duplicateOf,
        reason: r.reason
      };
    }),
    summary: {
      unqualified: results.filter(r => !r.qualified).length,
      duplicates: results.filter(r => r.isDuplicate).length,
      totalToDelete: toDelete.length
    }
  };

  const reportPath = `cleanup-report-ai-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n========================================');
  console.log(`AI 评估完成: ${results.length} 篇`);
  console.log(`待删除: ${toDelete.length} 篇`);
  console.log(`  - 不合格: ${report.summary.unqualified}`);
  console.log(`  - 重复: ${report.summary.duplicates}`);
  console.log(`报告已保存: ${reportPath}`);
  console.log('========================================');
  console.log('\n查看报告后，回复"确认删除"执行删除');
}

if (require.main === module) {
  main().catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
