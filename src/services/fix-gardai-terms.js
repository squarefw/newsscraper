#!/usr/bin/env node

/**
 * 修复 WordPress 文章中 Gardaí 的错误翻译
 * 将 "和平卫队" 替换为 "爱尔兰警方"（标题和正文都处理）
 *
 * 用法:
 *   node src/services/fix-gardai-terms.js
 *   node src/services/fix-gardai-terms.js --dry-run   # 只扫描不修改
 */

const axios = require('axios');

const config = {
  baseUrl: 'http://8.208.23.37',
  username: 'i0086editor',
  password: 'nEww$$&b6o90cDDMD61p%AjX'
};

const OLD_TERM = '和平卫队';
const NEW_TERM = '爱尔兰警方';
const wpUrl = `${config.baseUrl}/wp-json/wp/v2/posts`;
const auth = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');

async function getAllPosts() {
  const allPosts = [];
  let page = 1;
  while (true) {
    const res = await axios.get(wpUrl + `?per_page=100&page=${page}&_fields=id,title,content`, {
      headers: { 'Authorization': auth }
    });
    if (!res.data.length) break;
    allPosts.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return allPosts;
}

async function updatePost(postId, fields) {
  try {
    await axios.post(wpUrl + '/' + postId, fields, {
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
    });
    return true;
  } catch (err) {
    console.error(`   ❌ 更新失败 ${postId}: HTTP ${err.response?.status}`);
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`${dryRun ? '🔍 [DRY RUN] 扫描' : '🔧 修复'} Gardaí 术语 (${OLD_TERM} → ${NEW_TERM})`);

  console.log('📥 获取所有文章...');
  const posts = await getAllPosts();
  console.log(`   共 ${posts.length} 篇\n`);

  // 找出需要修复的文章
  const toFix = [];
  for (const post of posts) {
    const title = post.title?.rendered || '';
    const content = post.content?.rendered || '';
    const newTitle = title.includes(OLD_TERM) ? title.split(OLD_TERM).join(NEW_TERM) : null;
    const newContent = content.includes(OLD_TERM) ? content.split(OLD_TERM).join(NEW_TERM) : null;
    if (newTitle || newContent) {
      toFix.push({ id: post.id, title: newTitle, content: newContent });
    }
  }

  console.log(`找到 ${toFix.length} 篇需要修复的文章：`);
  for (const item of toFix) {
    const parts = [];
    if (item.title) parts.push('标题');
    if (item.content) parts.push('正文');
    const post = posts.find(p => p.id === item.id);
    console.log(`  ID:${item.id} (${parts.join('+')}) | ${(post?.title?.rendered || '').substring(0, 50)}`);
  }
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN 模式，未做任何修改。');
    return;
  }

  // 执行修复
  let success = 0;
  let failed = 0;
  for (const item of toFix) {
    process.stdout.write(`  更新 ID:${item.id} (${item.title ? '标题' : ''}${item.title && item.content ? '+' : ''}${item.content ? '正文' : ''})... `);
    const fields = {};
    if (item.title) fields.title = item.title;
    if (item.content) fields.content = item.content;
    const ok = await updatePost(item.id, fields);
    if (ok) { console.log('✅'); success++; } else { console.log('❌'); failed++; }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 完成: 成功 ${success} 篇, 失败 ${failed} 篇`);
}

if (require.main === module) {
  main().catch(e => { console.error('❌ 错误:', e.message); process.exit(1); });
}

module.exports = { main };
