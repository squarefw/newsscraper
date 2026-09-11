// Batch set manual excerpts for all posts (extract first 60 chars from content)
//
// 数据通道：WordPressConnector 自动选择 REST / XML-RPC。
//   - REST 可用时走 context=edit 取 raw
//   - REST Basic Auth 失效（如 JWT 插件被停用）时自动降级 XML-RPC 的 wp.getPosts
//     （XML-RPC 直接返回 raw 的 post_content / post_excerpt）
//
// 用法：
//   node batch-set-excerpts.js                # 全量执行
//   node batch-set-excerpts.js --dry-run      # 只统计，不写入
//   node batch-set-excerpts.js --pages=2      # 只处理前 2 页（每页 100 篇）
const fs = require('fs');
const path = require('path');
const WordPressConnector = require('./src/wordpress/wordpressConnector');

const config = require('./config/api-keys.local.json');
const creds = config.wordpress['remote-aliyun'];

const BASE_URL = 'http://www.i0086.ie';
const PER_PAGE = 100;
const CONCURRENCY = 20;
const EXCERPT_LENGTH = 60;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const pagesArg = args.find(a => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : Infinity;

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeExcerpt(content) {
  const text = stripHtml(content);
  if (text.length <= EXCERPT_LENGTH) return text;
  return text.substring(0, EXCERPT_LENGTH) + '...';
}

async function run() {
  const connector = new WordPressConnector({
    baseUrl: BASE_URL,
    username: creds.username,
    password: creds.password
  });

  const method = await connector.detectBestMethod();
  console.log(`[CHANNEL] ${method === 'rest' ? 'REST API' : 'XML-RPC'}${DRY_RUN ? '（DRY RUN，不写入）' : ''}`);

  // Get total count（失败时按“翻到空页”处理）
  const total = await connector.getPostsTotal('publish');
  const totalPages = total ? Math.ceil(total / PER_PAGE) : Infinity;
  const limit = Math.min(totalPages, MAX_PAGES);
  console.log(`[START] Total posts: ${total ?? '未知'}, pages: ${Number.isFinite(totalPages) ? totalPages : '按需'}`);

  let scanned = 0;
  let updated = 0;
  let changed = 0;
  let failed = 0;
  let skipped = 0;

  for (let page = 1; page <= limit; page++) {
    let posts;
    try {
      posts = await connector.getPostsRaw({
        offset: (page - 1) * PER_PAGE,
        number: PER_PAGE,
        status: 'publish'
      });
    } catch (e) {
      console.log(`[ERROR] ${e.message}`);
      failed += PER_PAGE;
      continue;
    }

    if (!posts.length) {
      console.log(`[DONE] 第 ${page} 页无数据，提前结束`);
      break;
    }

    // Build the list of updates for this page（只更新需要变的）
    const tasks = [];
    for (const post of posts) {
      scanned++;
      const rawContent = post.content || '';
      const currentExcerpt = (post.excerpt || '').replace(/<[^>]+>/g, '').trim();
      const desired = makeExcerpt(rawContent);
      if (currentExcerpt === desired) {
        skipped++;
        continue;
      }
      tasks.push({ id: post.id, excerpt: desired });
    }

    changed += tasks.length;

    if (!DRY_RUN && tasks.length) {
      let index = 0;
      async function worker() {
        while (index < tasks.length) {
          const task = tasks[index++];
          try {
            await connector.updatePost(task.id, { excerpt: task.excerpt });
            updated++;
          } catch (e) {
            failed++;
            console.log(`[ERROR] post ${task.id}: ${e.message.substring(0, 100)}`);
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }

    console.log(`[PROGRESS] Page ${page}/${Number.isFinite(limit) ? limit : '?'} done. scanned=${scanned} changed=${changed} updated=${updated} skipped=${skipped} failed=${failed}`);
  }

  console.log(`[DONE] scanned=${scanned} changed=${changed} updated=${updated} skipped=${skipped} failed=${failed}`);
  if (DRY_RUN) console.log('       （DRY RUN，未写入任何修改）');
}

run().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
