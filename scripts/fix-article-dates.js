/**
 * 批量修复已发布文章：移除开头被 AI 错误添加的日期
 *
 * 问题：AI 在重写新闻时会在正文开头添加日期（如"2024 年 7 月 18 日，"），
 *       但原文中并没有这个日期。
 *
 * 修复：遍历所有已发布文章，检查内容开头是否有日期模式，
 *       如果有则移除并更新文章。
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// WordPress 配置
const CONFIG = {
  baseUrl: 'http://8.208.23.37',
  username: 'i0086editor',
  password: 'nEww$$&b6o90cDDMD61p%AjX'
};

// 日期匹配正则（匹配开头的日期格式）
const DATE_PATTERNS = [
  /^\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*[，,\s]*/,  // 2024 年 7 月 18 日，
  /^\d{4}\s*年\s*\d{1,2}\s*月\s*[，,\s]*/,                  // 2024 年 6 月，
  /^\d{4}-\d{2}-\d{2}\s*[，,\s]*/,                          // 2024-07-18,
  /^\d{4}\/\d{2}\/\d{2}\s*[，,\s]*/                         // 2024/07/18,
];

/**
 * 清理内容开头的日期
 */
function cleanContentDate(content) {
  if (!content || typeof content !== 'string') {
    return { cleaned: content, changed: false };
  }

  let cleaned = content;
  let changed = false;

  DATE_PATTERNS.forEach(pattern => {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) {
      changed = true;
    }
  });

  return { cleaned, changed };
}

/**
 * 获取 WordPress 文章列表
 */
async function getPosts(page = 1, perPage = 100) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish`);
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
      timeout: 15000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const posts = JSON.parse(data);
            resolve(posts);
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
 * 更新 WordPress 文章
 */
async function updatePost(postId, content) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.baseUrl}/wp-json/wp/v2/posts/${postId}`);
    const client = url.protocol === 'https:' ? https : http;

    const authHeader = 'Basic ' + Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');

    const body = JSON.stringify({ content });

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
      timeout: 15000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const post = JSON.parse(data);
            resolve({ success: true, postId: post.id });
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
  console.log('🔧 开始批量修复文章开头的日期问题...\n');

  let totalFixed = 0;
  let totalScanned = 0;
  let page = 1;
  const perPage = 100;

  while (true) {
    console.log(`📄 获取第 ${page} 页文章...`);

    let posts;
    try {
      posts = await getPosts(page, perPage);
    } catch (error) {
      console.error(`❌ 获取文章失败：${error.message}`);
      break;
    }

    if (posts.length === 0) {
      console.log('✅ 所有文章已处理完毕');
      break;
    }

    console.log(`   找到 ${posts.length} 篇文章\n`);

    for (const post of posts) {
      totalScanned++;

      // 检查内容是否需要修复
      // WordPress API 返回的内容是 HTML 格式，需要先清理 HTML 标签再检查
      const rawContent = post.content?.rendered || post.content || '';

      // 移除 HTML 标签进行日期检查（但保留原文结构）
      const textContent = rawContent.replace(/<[^>]*>/g, '').trim();

      const { cleaned, changed } = cleanContentDate(textContent);

      if (changed) {
        console.log(`   📝 文章 ID ${post.id}: ${post.title?.rendered || post.title}`);
        console.log(`      修复前：${textContent.substring(0, 50)}...`);
        console.log(`      修复后：${cleaned.substring(0, 50)}...\n`);

        // 更新文章（只替换开头的日期，保留 HTML 结构）
        // 我们需要在原始 HTML 内容中找到并移除日期
        let fixedHtmlContent = rawContent;

        // 尝试在 HTML 中找到日期模式并移除
        for (const pattern of DATE_PATTERNS) {
          // 在 HTML 内容中匹配（考虑可能的 HTML 标签）
          const htmlPattern = new RegExp(
            pattern.source.replace(/^\\^/, '').replace('\\s*', '\\s*'),
            pattern.flags
          );
          fixedHtmlContent = fixedHtmlContent.replace(htmlPattern, '');
        }

        try {
          await updatePost(post.id, fixedHtmlContent);
          console.log(`      ✅ 更新成功\n`);
          totalFixed++;
        } catch (error) {
          console.error(`      ❌ 更新失败：${error.message}\n`);
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 500));
      }
    }

    page++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(` 修复完成统计：`);
  console.log(`   扫描文章：${totalScanned} 篇`);
  console.log(`   修复文章：${totalFixed} 篇`);
  console.log('='.repeat(60));
}

// 运行修复
fixArticles().catch(error => {
  console.error('❌ 修复过程出错:', error.message);
  process.exit(1);
});
