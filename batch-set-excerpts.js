// Batch set manual excerpts for all posts (extract first 200 chars from content)
const fs = require('fs');
const path = require('path');

const config = require('./config/api-keys.local.json');
const creds = config.wordpress['remote-aliyun'];
const auth = Buffer.from(creds.username + ':' + creds.password).toString('base64');

const BASE = 'http://www.i0086.ie/wp-json/wp/v2/posts';
const PER_PAGE = 100;
const CONCURRENCY = 20;
const EXCERPT_LENGTH = 60;

const headers = {
  'Authorization': 'Basic ' + auth,
  'Content-Type': 'application/json'
};

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

async function fetchPage(page) {
  const url = `${BASE}?per_page=${PER_PAGE}&page=${page}&context=edit&_fields=id,content,excerpt&orderby=date&order=desc`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`Fetch page ${page} failed: ${r.status}`);
  return r.json();
}

async function updatePost(id, excerpt) {
  const r = await fetch(`${BASE}/${id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ excerpt })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Update post ${id} failed: ${r.status} ${body.substring(0, 100)}`);
  }
  return r.json();
}

async function run() {
  // Get total count
  const first = await fetch(`${BASE}?per_page=1&_fields=id`, { headers });
  const total = parseInt(first.headers.get('x-wp-total'), 10);
  const totalPages = Math.ceil(total / PER_PAGE);
  console.log(`[START] Total posts: ${total}, pages: ${totalPages}`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let page = 1; page <= totalPages; page++) {
    let posts;
    try {
      posts = await fetchPage(page);
    } catch (e) {
      console.log(`[ERROR] ${e.message}`);
      failed += PER_PAGE;
      continue;
    }

    // Build the list of updates for this page（只更新需要变的）
    const tasks = [];
    for (const post of posts) {
      const rawContent = (post.content && (post.content.raw || post.content.rendered)) || '';
      const currentExcerpt = (post.excerpt && (post.excerpt.raw || post.excerpt.rendered) || '').replace(/<[^>]+>/g, '').trim();
      const desired = makeExcerpt(rawContent);
      if (currentExcerpt === desired) {
        skipped++;
        continue;
      }
      tasks.push({ id: post.id, excerpt: desired });
    }

    // Process with concurrency limit
    let index = 0;
    async function worker() {
      while (index < tasks.length) {
        const task = tasks[index++];
        try {
          await updatePost(task.id, task.excerpt);
          updated++;
        } catch (e) {
          failed++;
          console.log(`[ERROR] post ${task.id}: ${e.message.substring(0, 80)}`);
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(workers);

    console.log(`[PROGRESS] Page ${page}/${totalPages} done. updated=${updated} skipped=${skipped} failed=${failed}`);
  }

  console.log(`[DONE] updated=${updated} failed=${failed} skipped=${skipped}`);
}

run().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
