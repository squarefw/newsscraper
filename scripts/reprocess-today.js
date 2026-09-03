#!/usr/bin/env node
/**
 * 重跑修复今天的文章：因批处理每批篇数过多导致 qwen max_tokens 输出被压缩，
 * 今天(9/3)发布的文章译文内容大幅缩水。此脚本：
 *   1. 从 WordPress 拉取今天发布的文章（ID + 来源URL）
 *   2. 重新抓取原文
 *   3. 逐篇/小批 翻译 + 重写（应用修复后的每批≤N篇限制）
 *   4. 更新已有 WordPress 文章内容（保留 ID、分类、状态、特色图）
 *
 * 用法: node src/scripts/reprocess-today.js <configPath> <YYYY-MM-DD>
 */

const fs = require('fs');
const path = require('path');
const ConfigLoader = require('../src/config/loader');
const WordPressConnector = require('../src/wordpress/wordpressConnector');
const aiProcessor = require('../src/ai/aiProcessor');
const { MultiAIManager } = require('../src/ai/multiAIManager');
const { extractNewsFromUrl } = require('../src/article/newsExtractor');

const configPath = process.argv[2] || 'config/config.remote-aliyun.json';
const targetDate = process.argv[3] || '2026-09-03';

async function main() {
  console.log('🔄 开始重跑修复文章...');
  console.log(`   目标日期: ${targetDate}`);
  console.log(`   配置文件: ${configPath}\n`);

  // 1. 加载配置
  const configLoader = new ConfigLoader();
  const config = configLoader.loadConfig(configPath, 'remote-aliyun');
  if (!config.wordpress || !config.wordpress.baseUrl) {
    throw new Error('WordPress配置不完整');
  }

  // 2. 初始化 WordPress 连接器
  console.log('🔗 初始化WordPress连接器...');
  const wpConnector = new WordPressConnector({
    baseUrl: config.wordpress.baseUrl,
    username: config.wordpress.username,
    password: config.wordpress.password
  });
  await wpConnector.detectBestMethod();
  console.log(`✅ 连接成功: ${wpConnector.preferredMethod}\n`);

  // 3. 从 WordPress 拉取今天发布的文章（含 content 用于提取来源URL）
  console.log('📥 获取当天已发布文章...');
  const todayPosts = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const result = await wpConnector.makeRestRequest(
      `posts?per_page=${perPage}&page=${page}&after=${targetDate}T00:00:00&before=${targetDate}T23:59:59&context=edit&status=publish&_fields=id,title,content,excerpt,status,categories`,
      'GET'
    );
    if (result.statusCode === 200) {
      const posts = JSON.parse(result.data);
      todayPosts.push(...posts);
      if (posts.length < perPage) break;
      page++;
    } else {
      break;
    }
  }
  console.log(`   今天共 ${todayPosts.length} 篇文章\n`);

  if (todayPosts.length === 0) {
    console.log('⚠️ 没有找到当天的文章');
    return;
  }

  // 4. 从每篇文章 content 中提取来源 URL
  const tasks = todayPosts.map(post => {
    const contentRaw = post.content?.raw || '';
    const m = contentRaw.match(/来源链接[:：]\s*[^(]*\((https?:\/\/[^)]+)\)/);
    return {
      postId: post.id,
      sourceUrl: m ? m[1] : null,
      title: post.title?.raw || '',
      currentContent: contentRaw,
      currentExcerpt: post.excerpt?.raw || '',
      categories: post.categories || []
    };
  });

  const withUrl = tasks.filter(t => t.sourceUrl);
  console.log(`   ✅ 有来源URL: ${withUrl.length}/${tasks.length}`);
  const noUrl = tasks.filter(t => !t.sourceUrl);
  if (noUrl.length > 0) {
    console.log(`   ⚠️ 无法提取来源URL的文章 (${noUrl.length}):`);
    noUrl.forEach(t => console.log(`      ID ${t.postId}: ${t.title.substring(0, 40)}`));
  }

  // 5. 重新抓取原文 + 处理
  console.log('\n📥 重新抓取原文...');
  const processed = [];

  for (let i = 0; i < withUrl.length; i++) {
    const task = withUrl[i];
    process.stdout.write(`   [${i + 1}/${withUrl.length}] 抓取 ${task.sourceUrl.substring(0, 55)}... `);
    try {
      const extracted = await extractNewsFromUrl(task.sourceUrl);
      if (!extracted.content || extracted.content.length < 100) {
        console.log(`❌ 正文过短(${extracted.content?.length || 0}字符)，跳过`);
        continue;
      }
      processed.push({
        postId: task.postId,
        url: task.sourceUrl,
        originalTitle: extracted.title || task.title,
        content: extracted.content,
        imageUrl: extracted.imageUrl || null,
        currentContent: task.currentContent
      });
      console.log(`✅ ${(extracted.content || '').length}字符`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`   成功抓取 ${processed.length}/${withUrl.length} 篇\n`);

  if (processed.length === 0) {
    console.log('⚠️ 没有成功抓取任何文章');
    return;
  }

  // 6. 初始化 AI 管理器
  console.log('🤖 初始化AI管理器...');
  const multiAIManager = new MultiAIManager(config);
  await multiAIManager.initialize();
  console.log('✅ AI管理器就绪\n');

  // 7. 分批处理：翻译 + 重写（aiProcessor 已应用每批≤4篇限制）
  console.log('🌐 步骤 2: 翻译...');
  const translationInput = processed.map(p => ({
    url: p.url,
    title: p.originalTitle,
    content: p.content
  }));
  const translated = await aiProcessor.translateArticlesBatch(multiAIManager, translationInput);
  console.log(`   翻译完成: ${translated.length} 篇\n`);

  console.log('✍️ 步骤 3: 重写+分类...');
  // 逐篇重写：避免某篇内容触发 qwen 审核(data_inspection_failed)导致整批中断，
  // 单篇被拦截只跳过该篇并记录，不影响其余文章。
  const rewritten = [];
  const rewriteSkipped = [];
  for (let idx = 0; idx < translated.length; idx++) {
    const t = translated[idx];
    const input = [{
      url: t.url,
      translatedTitle: t.translatedTitle,
      translatedContent: t.translatedContent,
      originalTitle: processed[idx]?.originalTitle || ''
    }];
    try {
      const res = await aiProcessor.rewriteAndCategorizeBatch(multiAIManager, input);
      if (res && res.length > 0) {
        rewritten.push(res[0]);
        process.stdout.write(`   [重写 ${idx + 1}/${translated.length}] ✅ ${(res[0].rewrittenTitle || '').substring(0, 30)}\n`);
      } else {
        rewriteSkipped.push({ url: t.url, reason: '空结果' });
        console.log(`   [重写 ${idx + 1}/${translated.length}] ⚠️ 空结果，跳过`);
      }
    } catch (err) {
      rewriteSkipped.push({ url: t.url, reason: err.message });
      console.log(`   [重写 ${idx + 1}/${translated.length}] ❌ 跳过(${err.message.substring(0, 60)})`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`   重写完成: ${rewritten.length} 篇${rewriteSkipped.length > 0 ? `, 跳过 ${rewriteSkipped.length} 篇` : ''}\n`);

  // 8. 映射分类 -> ID 并更新 WordPress
  console.log('🏷️ 获取WordPress分类...');
  const wpCategories = await wpConnector.getCategories();
  const resultMap = {};
  rewritten.forEach(r => { resultMap[r.url] = r; });

  console.log('\n📤 更新 WordPress 文章...');
  let successCount = 0;
  const FAILED = [];

  for (const item of processed) {
    const r = resultMap[item.url];
    if (!r) { FAILED.push({ postId: item.postId, reason: '无AI处理结果' }); continue; }

    // 分类 ID：保留原分类，如 AI 无法分类则维持现状
    let categoryId = null;
    const aiCategory = r.category || '';
    if (aiCategory && aiCategory !== '无法分类' && typeof aiProcessor.validateAndGetCategoryId === 'function') {
      try {
        categoryId = await aiProcessor.validateAndGetCategoryId(aiCategory, wpCategories, null);
      } catch (e) {
        categoryId = null;
      }
    }
    const keepCategories = item.categories && item.categories.length > 0 ? item.categories : [];
    const finalCategories = categoryId && !keepCategories.includes(categoryId) && categoryId !== null
      ? [...keepCategories, categoryId]
      : keepCategories;

    // 构建内容：重写正文 + 来源链接 + 发布时间
    const cleanTitle = (r.rewrittenTitle || '').trim();
    const cleanContent = (r.rewrittenContent || '').trim();
    const enhancedContent = cleanContent +
      `\n\n来源链接: ${item.originalTitle} (${item.url})` +
      `\n\n发布时间: ${new Date().toLocaleString('zh-CN')}`;

    // 摘要：沿用现有 excerpt（其内容来自原 AI 摘要，可能也偏短但已可用），或重算
    const stripForExcerpt = (str) => str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const autoExcerpt = stripForExcerpt(cleanContent).slice(0, 140);
    const newExcerpt = autoExcerpt;

    try {
      const body = JSON.stringify({
        title: cleanTitle,
        content: enhancedContent,
        excerpt: newExcerpt,
        categories: finalCategories,
        status: 'publish'
      });
      // WordPress REST：POST 到 posts/{id} = 更新
      const upd = await wpConnector.makeRestRequest(`posts/${item.postId}`, 'POST', body);
      if (upd.statusCode === 200) {
        const post = JSON.parse(upd.data);
        console.log(`   ✅ ID ${item.postId} 更新成功 (${cleanContent.length}字) | ${cleanTitle.substring(0, 30)}`);
        successCount++;
      } else {
        FAILED.push({ postId: item.postId, reason: `HTTP ${upd.statusCode}` });
        console.log(`   ❌ ID ${item.postId} 更新失败 HTTP ${upd.statusCode}`);
      }
    } catch (err) {
      FAILED.push({ postId: item.postId, reason: err.message });
      console.log(`   ❌ ID ${item.postId} 更新失败: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n' + '='.repeat(60));
  console.log(` ✅ 更新成功: ${successCount} 篇`);
  console.log(` ❌ 失败: ${FAILED.length} 篇`);
  if (FAILED.length > 0) {
    console.log(' 失败清单:');
    FAILED.forEach(f => console.log(`   - ID ${f.postId}: ${f.reason}`));
  }
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ 运行出错:', err.message);
  console.error(err.stack);
  process.exit(1);
});
