#!/usr/bin/env node
/**
 * 清理已发布文章正文中的三类爬虫残留：
 *   1. 末尾的「来源链接: ...」段落
 *   2. 末尾的「发布时间: ...」段落
 *   3. 开头与标题重复的段落
 *
 * 数据通道：WordPressConnector 自动选择 REST / XML-RPC。
 *   - REST 可用时走 context=edit 取 raw
 *   - REST Basic Auth 失效（如 JWT 插件被停用）时自动降级 XML-RPC 的 wp.getPosts / wp.editPost
 *     （XML-RPC 直接返回 raw 的 post_content，写回即原文，不会引入额外 HTML）
 *
 * 用法：
 *   node scripts/cleanup-post-content.js --dry-run          # 只统计，不修改
 *   node scripts/cleanup-post-content.js --dry-run --pages=3
 *   node scripts/cleanup-post-content.js                    # 全量执行
 */

const fs = require('fs');
const path = require('path');
const WordPressConnector = require('../src/wordpress/wordpressConnector');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/api-keys.local.json'), 'utf8'));
const creds = config.wordpress['remote-aliyun'];

const BASE_URL = 'http://www.i0086.ie';
const PER_PAGE = 100;
const CONCURRENCY = 12;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const pagesArg = args.find(a => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : Infinity;

/** 去掉标签、HTML 实体和所有空白，用于比较 */
function normalize(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

const SOURCE_RE = /^\s*来源链接\s*[:：]/;
const DATE_RE = /^\s*发布时间\s*[:：]/;

/**
 * 清理一段 raw 内容。
 * @returns {{cleaned: string, removed: string[], changed: boolean}}
 */
function cleanContent(raw, title) {
  if (!raw || !raw.trim()) return { cleaned: raw, removed: [], changed: false };

  const removed = [];
  const isHtml = /<p[\s>]/i.test(raw);

  if (isHtml) {
    // HTML 内容：按 <p>...</p> 处理
    let html = raw;
    // 1. 移除末尾的来源链接/发布时间段落
    html = html.replace(/<p[^>]*>\s*来源链接\s*[:：][\s\S]*?<\/p>/gi, m => { removed.push(m); return ''; });
    html = html.replace(/<p[^>]*>\s*发布时间\s*[:：][\s\S]*?<\/p>/gi, m => { removed.push(m); return ''; });
    // 2. 移除开头与标题重复的段落
    const firstMatch = html.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstMatch) {
      const firstText = normalize(firstMatch[1]);
      const titleText = normalize(title);
      if (firstText && titleText && (firstText === titleText ||
          (firstText.startsWith(titleText) && firstText.length - titleText.length < 10))) {
        removed.push(firstMatch[0]);
        html = html.slice(firstMatch[0].length);
      }
    }
    const cleaned = html.replace(/\n{3,}/g, '\n\n').trim();
    return { cleaned, removed, changed: removed.length > 0 };
  }

  // 纯文本内容：按空行分段
  let parts = raw.replace(/\r\n/g, '\n').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

  // 1. 移除末尾的来源链接/发布时间段落
  while (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (SOURCE_RE.test(last) || DATE_RE.test(last)) {
      removed.push(parts.pop());
    } else {
      break;
    }
  }

  // 2. 移除开头与标题重复的段落
  if (parts.length > 1) {
    const firstText = normalize(parts[0]);
    const titleText = normalize(title);
    if (firstText && titleText && (firstText === titleText ||
        (firstText.startsWith(titleText) && firstText.length - titleText.length < 10))) {
      removed.push(parts.shift());
    }
  }

  const cleaned = parts.join('\n\n').trim();
  return { cleaned, removed, changed: removed.length > 0 };
}

async function run() {
  const connector = new WordPressConnector({
    baseUrl: BASE_URL,
    username: creds.username,
    password: creds.password
  });

  const method = await connector.detectBestMethod();
  console.log(`[CHANNEL] ${method === 'rest' ? 'REST API' : 'XML-RPC'}`);

  const total = await connector.getPostsTotal('publish');
  const totalPages = total ? Math.ceil(total / PER_PAGE) : Infinity;
  const limit = Math.min(totalPages, MAX_PAGES);
  console.log(`[START] 共 ${total ?? '未知'} 篇，处理 ${Number.isFinite(limit) ? limit : '按需'} 页${DRY_RUN ? '（DRY RUN，不写入）' : ''}`);

  let scanned = 0, changed = 0, updated = 0, failed = 0;
  let titleDup = 0, srcRemoved = 0, dateRemoved = 0;

  for (let page = 1; page <= limit; page++) {
    let posts;
    try {
      posts = await connector.getPostsRaw({
        offset: (page - 1) * PER_PAGE,
        number: PER_PAGE,
        status: 'publish'
      });
    } catch (e) {
      console.log(`[ERROR] page ${page}: ${e.message}`);
      failed += PER_PAGE;
      continue;
    }

    if (!posts.length) {
      console.log(`[DONE] 第 ${page} 页无数据，提前结束`);
      break;
    }

    const tasks = [];
    for (const post of posts) {
      scanned++;
      const title = post.title || '';
      const raw = post.content || '';
      const { cleaned, removed, changed: didChange } = cleanContent(raw, title);
      if (!didChange) continue;
      changed++;
      removed.forEach(r => {
        if (SOURCE_RE.test(r.replace(/<[^>]+>/g, ''))) srcRemoved++;
        else if (DATE_RE.test(r.replace(/<[^>]+>/g, ''))) dateRemoved++;
        else titleDup++;
      });
      tasks.push({ id: post.id, cleaned });
    }

    if (!DRY_RUN && tasks.length) {
      let idx = 0;
      async function worker() {
        while (idx < tasks.length) {
          const t = tasks[idx++];
          try {
            await connector.updatePost(t.id, { content: t.cleaned });
            updated++;
          } catch (e) {
            failed++;
            console.log(`[ERROR] post ${t.id}: ${e.message.substring(0, 100)}`);
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }

    console.log(`[PROGRESS] page ${page}/${Number.isFinite(limit) ? limit : '?'} | scanned=${scanned} changed=${changed} updated=${updated} failed=${failed}`);
  }

  console.log(`\n[DONE] 扫描 ${scanned} | 需清理 ${changed} | 已更新 ${updated} | 失败 ${failed}`);
  console.log(`        移除：重复标题 ${titleDup} | 来源链接 ${srcRemoved} | 发布时间 ${dateRemoved}`);
  if (DRY_RUN) console.log('        （DRY RUN，未写入任何修改）');
}

run().catch(e => { console.error('[FATAL]', e); process.exit(1); });
