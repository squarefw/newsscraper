#!/usr/bin/env node
/**
 * 清理已发布文章正文中的三类爬虫残留：
 *   1. 末尾的「来源链接: ...」段落
 *   2. 末尾的「发布时间: ...」段落
 *   3. 开头与标题重复的段落
 *
 * 用法：
 *   node scripts/cleanup-post-content.js --dry-run          # 只统计，不修改
 *   node scripts/cleanup-post-content.js --dry-run --pages=3
 *   node scripts/cleanup-post-content.js                    # 全量执行
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/api-keys.local.json'), 'utf8'));
const creds = config.wordpress['remote-aliyun'];
const AUTH = Buffer.from(creds.username + ':' + creds.password).toString('base64');

const BASE = 'http://www.i0086.ie/wp-json/wp/v2/posts';
const PER_PAGE = 100;
const CONCURRENCY = 12;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const pagesArg = args.find(a => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : Infinity;

const headers = {
  'Authorization': 'Basic ' + AUTH,
  'Content-Type': 'application/json'
};

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

async function fetchPage(page) {
  const url = `${BASE}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&context=edit&_fields=id,title,content`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`Fetch page ${page} failed: ${r.status}`);
  return r.json();
}

async function updatePost(id, content) {
  const r = await fetch(`${BASE}/${id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Update ${id} failed: ${r.status} ${body.substring(0, 120)}`);
  }
  return r.json();
}

async function run() {
  const first = await fetch(`${BASE}?per_page=1&_fields=id`, { headers });
  const total = parseInt(first.headers.get('x-wp-total'), 10);
  const totalPages = Math.min(Math.ceil(total / PER_PAGE), MAX_PAGES);
  console.log(`[START] 共 ${total} 篇，处理 ${totalPages} 页${DRY_RUN ? '（DRY RUN，不写入）' : ''}`);

  let scanned = 0, changed = 0, updated = 0, failed = 0;
  let titleDup = 0, srcRemoved = 0, dateRemoved = 0;

  for (let page = 1; page <= totalPages; page++) {
    let posts;
    try {
      posts = await fetchPage(page);
    } catch (e) {
      console.log(`[ERROR] page ${page}: ${e.message}`);
      failed += PER_PAGE;
      continue;
    }

    const tasks = [];
    for (const post of posts) {
      scanned++;
      const title = (post.title && post.title.raw) || '';
      const raw = (post.content && post.content.raw) || '';
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
            await updatePost(t.id, t.cleaned);
            updated++;
          } catch (e) {
            failed++;
            console.log(`[ERROR] post ${t.id}: ${e.message.substring(0, 100)}`);
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }

    console.log(`[PROGRESS] page ${page}/${totalPages} | scanned=${scanned} changed=${changed} updated=${updated} failed=${failed}`);
  }

  console.log(`\n[DONE] 扫描 ${scanned} | 需清理 ${changed} | 已更新 ${updated} | 失败 ${failed}`);
  console.log(`        移除：重复标题 ${titleDup} | 来源链接 ${srcRemoved} | 发布时间 ${dateRemoved}`);
  if (DRY_RUN) console.log('        （DRY RUN，未写入任何修改）');
}

run().catch(e => { console.error('[FATAL]', e); process.exit(1); });
