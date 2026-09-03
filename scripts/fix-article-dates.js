/**
 * 批量修复已发布文章：移除正文开头被 AI 错误添加的孤立日期（导语电头式日期）
 *
 * 只删除文章"第一个非空内容"开头的孤立日期段，例如：
 *   "2026年9月1日，贝尔法斯特消息。……"  →  "贝尔法斯特消息。……"
 *   "2024年6月，都柏林城市大学……"       →  "都柏林城市大学……"
 *   "2026年3月18日（星期三），……"        →  "……"
 *
 * 用 context=edit 读取 raw 内容（避免 rendered 转义污染存储），
 * 跳过开头 HTML 标签后匹配日期，仅删除日期段本身。
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');

// WordPress 配置
const CONFIG = {
  baseUrl: 'http://www.i0086.ie',
  username: 'i0086editor',
  password: 'nEww$$&b6o90cDDMD61p%AjX'
};

// 日期匹配正则：仅匹配"正文开头"的孤立日期段（body 已去除 HTML 前缀）
const DATE_PATTERNS = [
  // 2026年3月18日（星期三）， / 2026年3月18日(周三)，
  /^\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*[（(]\s*[星期周][^）)]*[）)]\s*[，,。、\s]*/,
  // 2026年9月1日， / 2026年9月1日。
  /^\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*[，,。、\s]+/,
  // 2024年6月， / 2024年6月。
  /^\d{4}\s*年\s*\d{1,2}\s*月\s*[，,。、\s]+/,
  // 2024-07-18, / 2024/07/18,
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*[，,。、\s]+/,
  // 2024年6月（无标点直接接正文），仅当后面不是日期续写时…… 保守起见不处理
];

/**
 * 删除正文开头的孤立日期。跳过开头的 HTML 标签 / 注释。
 * @param {string} htmlContent - 文章 raw HTML
 * @returns {{fixed:string, changed:boolean, deleted:string|null, previewBefore:string, previewAfter:string}}
 */
function cleanLeadingDate(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return { fixed: htmlContent, changed: false, deleted: null };
  }

  // 剥离开头 HTML 前缀（标签、注释、空白），保留前缀用于重组
  const m = htmlContent.match(/^((?:\s|<!--[\s\S]*?-->|<[^>]*>)*)/);
  const prefix = m ? m[1] : '';
  const body = htmlContent.slice(prefix.length);
  const originalBody = body;

  let newBody = originalBody;
  let deleted = null;
  let firstPass = true;

  for (const p of DATE_PATTERNS) {
    const mm = newBody.match(p);
    if (mm) {
      deleted = mm[0].trim();
      newBody = newBody.replace(p, '');
      if (firstPass) {
        // 只记录第一次命中的删除片段
      }
      firstPass = false;
      break; // 只删一段
    }
  }

  if (newBody === originalBody) {
    return { fixed: htmlContent, changed: false, deleted: null };
  }

  // 清理删除后正文开头可能残留的标点/空白（如"，"、"："、"、"）
  newBody = newBody.replace(/^[，,。、：:\s]+/, '');

  const fixed = prefix + newBody;
  return {
    fixed,
    changed: true,
    deleted,
    previewBefore: originalBody.substring(0, 45),
    previewAfter: newBody.substring(0, 45)
  };
}

/**
 * 获取 WordPress 文章列表（context=edit 取 raw 内容）
 */
async function getPosts(page = 1, perPage = 100) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish&context=edit&_fields=id,title,content,excerpt`);
    const client = url.protocol === 'https:' ? https : http;

    const authHeader = 'Basic ' + Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'NewsScraper-Fix/1.0'
      },
      timeout: 20000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('JSON 解析失败'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.end();
  });
}

/**
 * 更新 WordPress 文章（可同时更新 content 和 excerpt）
 */
async function updatePost(postId, fields) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.baseUrl}/wp-json/wp/v2/posts/${postId}`);
    const client = url.protocol === 'https:' ? https : http;

    const authHeader = 'Basic ' + Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');
    const body = JSON.stringify(fields);
    const headers = {
      'Authorization': authHeader,
      'User-Agent': 'NewsScraper-Fix/1.0',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers,
      timeout: 20000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ success: true, postId: JSON.parse(data).id });
          } catch (e) {
            resolve({ success: true, postId });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * 主函数：批量修复文章
 */
async function fixArticles() {
  const reportPath = `scripts/fix-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
  const reportLines = [];

  console.log('🔧 开始批量修复文章开头的孤立日期问题...');
  console.log(`   报告将写入: ${reportPath}\n`);

  let totalFixed = 0;
  let totalScanned = 0;
  let page = 1;
  const perPage = 100;

  while (true) {
    process.stdout.write(`   📄 读取第 ${page} 页...`);

    let posts;
    try {
      posts = await getPosts(page, perPage);
    } catch (error) {
      console.log(` ❌ 获取失败: ${error.message}`);
      break;
    }

    if (posts.length === 0) {
      console.log(' ✅ 完成');
      break;
    }

    process.stdout.write(` ${posts.length} 篇\n`);

    for (const post of posts) {
      totalScanned++;
      const rawContent = post.content?.raw || '';
      const rawExcerpt = post.excerpt?.raw || '';

      // 分别清理正文和摘要中的开头日期
      const c = cleanLeadingDate(rawContent);
      const e = rawExcerpt ? cleanLeadingDate(rawExcerpt) : { changed: false };

      if (c.changed || e.changed) {
        const fields = {};
        if (c.changed) fields.content = c.fixed;
        if (e.changed) fields.excerpt = e.fixed;

        const parts = [];
        if (c.changed) parts.push(`正文删除 "${c.deleted}"`);
        if (e.changed) parts.push(`摘要删除 "${e.deleted}"`);

        try {
          await updatePost(post.id, fields);
          totalFixed++;
          const line = `[修改] ID ${post.id} | ${parts.join('; ')}`;
          reportLines.push(line);
          console.log(`       [✓] ID ${post.id} ${parts.join('; ')}`);
        } catch (error) {
          reportLines.push(`[失败] ID ${post.id} | ${error.message}`);
          console.log(`       [✗] ID ${post.id} 更新失败: ${error.message}`);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }

    page++;
  }

  const summary = `\n${'='.repeat(60)}\n 修复统计:\n   扫描: ${totalScanned} 篇\n   修改: ${totalFixed} 篇\n${'='.repeat(60)}`;
  reportLines.push(summary);
  console.log(summary);

  try {
    fs.mkdirSync('scripts', { recursive: true });
    fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
    console.log(`   报告已保存: ${reportPath}`);
  } catch (e) {
    console.log(`   ⚠️ 报告保存失败: ${e.message}`);
  }
}

// 运行修复
fixArticles().catch(error => {
  console.error('❌ 修复过程出错:', error.message);
  process.exit(1);
});
