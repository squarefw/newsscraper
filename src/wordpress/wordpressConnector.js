/**
 * WordPress连接管理器
 * 自动检测并选择最佳的API连接方法（REST API 或 XML-RPC）
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const xml2js = require('xml2js');

class WordPressConnector {
  constructor(config) {
    this.config = config;
    this.preferredMethod = null; // 'rest' 或 'xmlrpc'
    this.authCache = new Map();
  }

  /**
   * 自动检测最佳连接方法
   */
  async detectBestMethod() {
    console.log('🔍 检测WordPress最佳连接方法...');
    
    // 首先尝试REST API
    const restResult = await this.testRestAPI();
    if (restResult.success) {
      this.preferredMethod = 'rest';
      console.log('✅ 将使用REST API连接');
      return 'rest';
    }
    
    // 如果REST API失败，尝试XML-RPC
    const xmlrpcResult = await this.testXMLRPC();
    if (xmlrpcResult.success) {
      this.preferredMethod = 'xmlrpc';
      console.log('✅ 将使用XML-RPC连接（REST API不可用）');
      return 'xmlrpc';
    }
    
    console.log('❌ 无法建立WordPress连接');
    throw new Error('WordPress连接失败：REST API和XML-RPC都不可用');
  }

  /**
   * 测试REST API连接
   */
  async testRestAPI() {
    try {
      const result = await this.makeRestRequest('users/me');
      return {
        success: result.statusCode === 200,
        method: 'rest',
        statusCode: result.statusCode,
        data: result.data
      };
    } catch (error) {
      console.error('   ❌ REST API Test Error:', error);
      return {
        success: false,
        method: 'rest',
        error: error.message
      };
    }
  }

  /**
   * 测试XML-RPC连接
   */
  async testXMLRPC() {
    try {
      const result = await this.xmlrpcCall('wp.getProfile', [
        1,
        this.config.username,
        this.config.password
      ]);
      
      const success = result.statusCode === 200 && !result.data.includes('faultCode');
      return {
        success,
        method: 'xmlrpc',
        statusCode: result.statusCode,
        data: result.data
      };
    } catch (error) {
      console.error('   ❌ XML-RPC Test Error:', error);
      return {
        success: false,
        method: 'xmlrpc',
        error: error.message
      };
    }
  }

  /**
   * 获取分类列表
   */
  async getCategories() {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    if (this.preferredMethod === 'rest') {
      return this.getCategoriesRest();
    } else {
      return this.getCategoriesXMLRPC();
    }
  }

  /**
   * 通过REST API获取分类
   */
  async getCategoriesRest() {
    try {
      const result = await this.makeRestRequest('categories?per_page=100', 'GET');
      if (result.statusCode === 200) {
        const categories = JSON.parse(result.data);
        return categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: cat.count
        }));
      }
      throw new Error(`REST API获取分类失败: ${result.statusCode}`);
    } catch (error) {
      console.warn('REST API获取分类失败，尝试XML-RPC:', error.message);
      return this.getCategoriesXMLRPC();
    }
  }

  /**
   * 通过XML-RPC获取分类
   */
  async getCategoriesXMLRPC() {
    try {
      const result = await this.xmlrpcCall('wp.getTerms', [
        1, // blog_id
        this.config.username,
        this.config.password,
        'category'
      ]);

      if (result.statusCode === 200 && !result.data.includes('faultCode')) {
        // 解析XML-RPC响应中的分类信息
        const categories = this.parseXMLRPCCategories(result.data);
        return categories;
      }
      throw new Error('XML-RPC获取分类失败');
    } catch (error) {
      throw new Error(`获取分类失败: ${error.message}`);
    }
  }

  /**
   * 获取最近的文章列表
   * @param {number} count 获取文章数量，默认50
   * @returns {Promise<Array>} 文章列表
   */
  async getRecentPosts(count = 50) {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    if (this.preferredMethod === 'rest') {
      return this.getRecentPostsRest(count);
    } else {
      return this.getRecentPostsXMLRPC(count);
    }
  }

  /**
   * 通过REST API获取最近文章
   */
  async getRecentPostsRest(count) {
    try {
      const result = await this.makeRestRequest(`posts?per_page=${count}&_fields=id,title,date`, 'GET');
      if (result.statusCode === 200) {
        const posts = JSON.parse(result.data);
        return posts.map(post => ({
          id: post.id,
          title: post.title.rendered,
          date: post.date
        }));
      }
      throw new Error(`REST API获取文章失败: ${result.statusCode}`);
    } catch (error) {
      console.warn('REST API获取文章失败，尝试XML-RPC:', error.message);
      return this.getRecentPostsXMLRPC(count);
    }
  }

  /**
   * 通过XML-RPC获取最近文章
   */
  async getRecentPostsXMLRPC(count) {
    try {
      const result = await this.xmlrpcCall('wp.getPosts', [
        1, // blog_id
        this.config.username,
        this.config.password,
        {
          number: count,
          post_status: 'publish'
        }
      ]);

      if (result.statusCode === 200 && !result.data.includes('faultCode')) {
        // 解析XML-RPC响应中的文章信息
        const posts = this.parseXMLRPCPosts(result.data);
        return posts;
      }
      throw new Error('XML-RPC获取文章失败');
    } catch (error) {
      throw new Error(`获取文章失败: ${error.message}`);
    }
  }

  /**
   * 获取文章总数（用于分页计算）。
   * 优先匿名 REST（读取 x-wp-total 响应头），失败再试认证 REST；
   * 都不可用时返回 null，由调用方按“翻到空页”方式处理。
   * @param {string} status 文章状态，默认 publish
   * @returns {Promise<number|null>}
   */
  async getPostsTotal(status = 'publish') {
    // 1) 匿名 REST（REST Basic Auth 失效时匿名读取仍可用）
    for (const withAuth of [false, true]) {
      try {
        const res = await this.restCountRaw(status, withAuth);
        const total = parseInt(res.headers['x-wp-total'], 10);
        if (res.statusCode === 200 && !Number.isNaN(total)) {
          return total;
        }
      } catch (e) {
        // 尝试下一种方式
      }
    }
    return null;
  }

  /**
   * 只取文章总数用的轻量 REST 请求（per_page=1，读响应头）
   */
  async restCountRaw(status, withAuth) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.baseUrl}/wp-json/wp/v2/posts?per_page=1&status=${encodeURIComponent(status)}&_fields=id`);
      const client = url.protocol === 'https:' ? https : http;

      const headers = { 'User-Agent': 'WordPress-Connector/1.0' };
      if (withAuth) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      }

      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers,
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
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
   * 获取文章列表（含 raw 正文/摘要），按当前通道自动选择 REST 或 XML-RPC。
   * REST 走 context=edit 取 raw；XML-RPC 的 wp.getPosts 本身就返回 raw。
   * @param {{offset?:number, number?:number, status?:string}} opts
   * @returns {Promise<Array<{id:number, title:string, content:string, excerpt:string, status:string}>>}
   */
  async getPostsRaw({ offset = 0, number = 100, status = 'publish' } = {}) {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    if (this.preferredMethod === 'rest') {
      try {
        return await this.getPostsRawRest({ offset, number, status });
      } catch (error) {
        // REST 中途失效（如认证被收回）时降级到 XML-RPC
        console.warn(`⚠️ REST 获取文章失败，降级 XML-RPC: ${error.message}`);
        return this.getPostsRawXMLRPC({ offset, number, status });
      }
    }
    return this.getPostsRawXMLRPC({ offset, number, status });
  }

  /**
   * 通过 REST API 获取文章列表（context=edit，取 raw 字段）
   */
  async getPostsRawRest({ offset, number, status }) {
    const endpoint = `posts?per_page=${number}&offset=${offset}&status=${encodeURIComponent(status)}`
      + `&context=edit&_fields=id,title,content,excerpt,status&orderby=date&order=desc`;
    const result = await this.makeRestRequest(endpoint, 'GET');

    if (result.statusCode !== 200) {
      throw new Error(`REST 获取文章失败: HTTP ${result.statusCode} ${String(result.data).substring(0, 120)}`);
    }

    const posts = JSON.parse(result.data);
    return posts.map(post => ({
      id: post.id,
      title: (post.title && (post.title.raw || post.title.rendered)) || '',
      content: (post.content && (post.content.raw || post.content.rendered)) || '',
      excerpt: (post.excerpt && (post.excerpt.raw || post.excerpt.rendered)) || '',
      status: post.status || ''
    }));
  }

  /**
   * 通过 XML-RPC 获取文章列表（wp.getPosts 直接返回 raw 的 post_content / post_excerpt）
   */
  async getPostsRawXMLRPC({ offset, number, status }) {
    const result = await this.xmlrpcCall('wp.getPosts', [
      1, // blog_id
      this.config.username,
      this.config.password,
      {
        number,
        offset,
        post_status: status,
        orderby: 'post_date',
        order: 'DESC'
      }
    ]);

    if (result.statusCode !== 200) {
      throw new Error(`XML-RPC 获取文章失败: HTTP ${result.statusCode}`);
    }
    if (/<fault>/i.test(result.data)) {
      throw new Error(`XML-RPC 获取文章失败: ${this.extractXmlrpcFault(result.data)}`);
    }

    return this.parseXMLRPCPostStructs(result.data);
  }

  /**
   * 用 xml2js 解析 XML-RPC 的 post struct 数组（含 raw 正文/摘要）。
   * 注意：post struct 内含 terms / custom_fields 等嵌套 struct，正则解析会截断，
   * 因此这里走真正的 XML 解析。
   */
  async parseXMLRPCPostStructs(xmlData) {
    const parsed = await xml2js.parseStringPromise(xmlData, { explicitArray: true });
    const params = parsed && parsed.methodResponse && parsed.methodResponse.params;
    if (!params || !params[0] || !params[0].param || !params[0].param[0]) return [];

    const list = this.xmlValueToJs(params[0].param[0].value);
    if (!Array.isArray(list)) return [];

    return list.map(item => ({
      id: parseInt(item.post_id, 10),
      title: item.post_title || '',
      content: item.post_content || '',
      excerpt: item.post_excerpt || '',
      status: item.post_status || ''
    }));
  }

  /**
   * 解析 XML-RPC 返回的单个 struct（如 wp.getPost）
   * @returns {Promise<Object|null>}
   */
  async parseXMLRPCSingleStruct(xmlData) {
    const parsed = await xml2js.parseStringPromise(xmlData, { explicitArray: true });
    const params = parsed && parsed.methodResponse && parsed.methodResponse.params;
    if (!params || !params[0] || !params[0].param || !params[0].param[0]) return null;

    const value = this.xmlValueToJs(params[0].param[0].value);
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : null;
  }

  /**
   * 把 xml2js 解析出的 <value> 节点转换成原生 JS 值
   */
  xmlValueToJs(valueNode) {
    if (!valueNode) return '';
    const node = Array.isArray(valueNode) ? valueNode[0] : valueNode;
    if (!node || typeof node !== 'object') return '';

    const type = Object.keys(node)[0];
    const inner = node[type];

    switch (type) {
      case 'string':
        return inner ? String(inner[0]) : '';
      case 'int':
      case 'i4':
        return parseInt(inner[0], 10);
      case 'i8':
        return Number(inner[0]);
      case 'double':
        return parseFloat(inner[0]);
      case 'boolean':
        return String(inner[0]) === '1';
      case 'dateTime.iso8601':
        return String(inner[0]);
      case 'base64':
        return inner ? String(inner[0]) : '';
      case 'nil':
        return null;
      case 'array': {
        const data = inner && inner[0] && inner[0].data ? inner[0].data[0] : null;
        if (!data || !data.value) return [];
        return data.value.map(v => this.xmlValueToJs(v));
      }
      case 'struct': {
        const obj = {};
        const members = (inner && inner[0] && inner[0].member) || [];
        for (const m of members) {
          obj[m.name[0]] = this.xmlValueToJs(m.value);
        }
        return obj;
      }
      default:
        return inner ? String(inner[0]) : '';
    }
  }

  /**
   * 从 XML-RPC fault 响应中提取 faultString
   */
  extractXmlrpcFault(xmlData) {
    const m = String(xmlData).match(/<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i);
    return m ? m[1] : 'XML-RPC fault';
  }

  /**
   * 更新文章正文/摘要（按当前通道自动选择 REST 或 XML-RPC）。
   * 只更新传入的字段。
   * @param {number|string} postId
   * @param {{content?:string, excerpt?:string}} fields
   * @returns {Promise<{success:boolean, method:string, postId:*}>}
   */
  async updatePost(postId, { content, excerpt } = {}) {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    if (this.preferredMethod === 'rest') {
      try {
        return await this.updatePostRest(postId, { content, excerpt });
      } catch (error) {
        console.warn(`⚠️ REST 更新失败，降级 XML-RPC: ${error.message}`);
        return this.updatePostXMLRPC(postId, { content, excerpt });
      }
    }
    return this.updatePostXMLRPC(postId, { content, excerpt });
  }

  /**
   * 通过 REST API 更新文章
   */
  async updatePostRest(postId, { content, excerpt }) {
    const body = {};
    if (content !== undefined) body.content = content;
    if (excerpt !== undefined) body.excerpt = excerpt;

    const result = await this.makeRestRequest(`posts/${postId}`, 'POST', JSON.stringify(body));
    if (result.statusCode !== 200) {
      throw new Error(`REST 更新失败: HTTP ${result.statusCode} ${String(result.data).substring(0, 120)}`);
    }
    const post = JSON.parse(result.data);
    return { success: true, method: 'rest', postId: post.id };
  }

  /**
   * 通过 XML-RPC 更新文章（wp.editPost）
   */
  async updatePostXMLRPC(postId, { content, excerpt }) {
    const fields = {};
    if (content !== undefined) fields.post_content = content;
    if (excerpt !== undefined) fields.post_excerpt = excerpt;

    const result = await this.xmlrpcCall('wp.editPost', [
      1, // blog_id
      this.config.username,
      this.config.password,
      postId,
      fields
    ]);

    if (result.statusCode !== 200) {
      throw new Error(`XML-RPC 更新失败: HTTP ${result.statusCode}`);
    }
    if (/<fault>/i.test(result.data)) {
      throw new Error(`XML-RPC 更新失败: ${this.extractXmlrpcFault(result.data)}`);
    }
    return { success: true, method: 'xmlrpc', postId };
  }

  /**
   * 从URL上传图片到WordPress媒体库
   */
  async uploadImageFromUrl(imageUrl) {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    console.log(`📥 正在上传图片到WordPress: ${imageUrl}`);

    try {
      // 首先下载图片
      const imageData = await this.downloadImage(imageUrl);
      
      if (this.preferredMethod === 'rest') {
        return await this.uploadImageRest(imageData);
      } else {
        return await this.uploadImageXMLRPC(imageData);
      }
    } catch (error) {
      console.log(`   ❌ 图片上传失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 下载图片数据
   * 优化：1) 优先使用 HTTPS（避免 HTTP→HTTPS 的 301 重定向）
   *       2) 支持跟随 301/302/307/308 重定向（最多 5 次）
   */
  async downloadImage(imageUrl, redirectCount = 0) {
    const MAX_REDIRECTS = 5;

    return new Promise((resolve, reject) => {
      // 优先使用 HTTPS（很多网站的 HTTP 版本会通过 301 重定向到 HTTPS）
      if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
      }

      let url;
      try {
        url = new URL(imageUrl);
      } catch (e) {
        reject(new Error(`无效的图片URL: ${imageUrl}`));
        return;
      }
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000
      }, (res) => {
        // 处理重定向：301/302/307/308
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume(); // 消费响应体，释放连接
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error(`重定向次数超过上限(${MAX_REDIRECTS})`));
            return;
          }
          // 支持相对路径 Location
          let redirectUrl;
          try {
            redirectUrl = new URL(res.headers.location, imageUrl).toString();
          } catch (e) {
            reject(new Error(`无效的重定向URL: ${res.headers.location}`));
            return;
          }
          console.log(`   🔄 跟随重定向(${res.statusCode}): ${redirectUrl.substring(0, 80)}...`);
          this.downloadImage(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const imageBuffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'image/jpeg';

          // 从URL提取文件名并规范化
          let filename = url.pathname.split('/').pop() || 'image';

          // 移除无效字符，限制长度
          filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);

          // 确保有正确的扩展名
          if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const extension = contentType.includes('jpeg') ? '.jpg' :
                            contentType.includes('png') ? '.png' :
                            contentType.includes('gif') ? '.gif' :
                            contentType.includes('webp') ? '.webp' : '.jpg';
            filename += extension;
          }

          // 确保文件名不为空且不以点开头
          if (!filename || filename.startsWith('.')) {
            filename = 'featured_image.jpg';
          }

          console.log(`   🔍 图片信息: ${filename} (${contentType}, ${Math.round(imageBuffer.length/1024)}KB)`);

          resolve({
            buffer: imageBuffer,
            contentType,
            filename
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('下载图片超时'));
      });

      req.end();
    });
  }

  /**
   * 通过REST API上传图片
   */
  async uploadImageRest(imageData) {
    try {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${imageData.filename}"\r\n`),
        Buffer.from(`Content-Type: ${imageData.contentType}\r\n\r\n`),
        imageData.buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const result = await this.makeRestRequest('media', 'POST', body, {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      });
      
      if (result.statusCode === 201) {
        const media = JSON.parse(result.data);
        console.log(`   ✅ 图片上传成功，媒体ID: ${media.id}`);
        console.log(`   🔗 图片URL: ${media.source_url || media.guid?.rendered || '未知'}`);
        return {
          success: true,
          mediaId: media.id,
          url: media.source_url,
          method: 'rest'
        };
      }
      throw new Error(`REST API上传失败: ${result.statusCode}`);
    } catch (error) {
      console.warn('REST API上传失败，尝试XML-RPC:', error.message);
      return this.uploadImageXMLRPC(imageData);
    }
  }

  /**
   * 通过XML-RPC上传图片
   */
  async uploadImageXMLRPC(imageData) {
    try {
      const base64Data = imageData.buffer.toString('base64');
      
      const result = await this.xmlrpcCall('wp.uploadFile', [
        1, // blog_id
        this.config.username,
        this.config.password,
        {
          name: imageData.filename,
          type: imageData.contentType,
          bits: { __xmlrpc_base64: base64Data } // 特殊标记为base64数据
        }
      ]);

      if (result.statusCode === 200 && !result.data.includes('faultCode')) {
        // 解析XML-RPC响应获取媒体ID
        const idMatch = result.data.match(/<name>id<\/name><value><string>(\d+)<\/string>/);
        const urlMatch = result.data.match(/<name>url<\/name><value><string>([^<]+)<\/string>/);
        
        if (idMatch && urlMatch) {
          const mediaId = parseInt(idMatch[1]);
          const mediaUrl = urlMatch[1];
          console.log(`   ✅ 图片上传成功，媒体ID: ${mediaId}`);
          console.log(`   🔗 图片URL: ${mediaUrl}`);
          return {
            success: true,
            mediaId,
            url: mediaUrl,
            method: 'xmlrpc'
          };
        }
      }
      throw new Error('XML-RPC上传失败');
    } catch (error) {
      throw new Error(`上传图片失败: ${error.message}`);
    }
  }

  /**
   * 获取网站信息
   */
  async getSiteInfo() {
    try {
      if (!this.preferredMethod) {
        await this.detectBestMethod();
      }

      if (this.preferredMethod === 'rest') {
        const result = await this.makeRestRequest('');
        return {
          success: true,
          name: result.data?.name || 'WordPress Site',
          url: this.config.baseUrl,
          method: 'rest'
        };
      } else {
        const result = await this.xmlrpcCall('wp.getOptions', []);
        return {
          success: true,
          name: result.data?.blog_title || 'WordPress Site',
          url: this.config.baseUrl,
          method: 'xmlrpc'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发布文章
   */
  async publishPost(postData) {
    if (!this.preferredMethod) {
      await this.detectBestMethod();
    }

    if (this.preferredMethod === 'rest') {
      return this.publishPostRest(postData);
    } else {
      return this.publishPostXMLRPC(postData);
    }
  }

  /**
   * 通过REST API发布文章
   */
  async publishPostRest(postData) {
    try {
      const body = JSON.stringify({
        title: postData.title,
        content: postData.content,
        status: postData.status || 'draft',
        categories: postData.categories || [],
        excerpt: postData.excerpt || '',
        featured_media: postData.featuredMediaId || 0
      });

      const result = await this.makeRestRequest('posts', 'POST', body);
      
      if (result.statusCode === 201) {
        const post = JSON.parse(result.data);
        return {
          success: true,
          method: 'rest',
          postId: post.id,
          link: post.link,
          status: post.status
        };
      }
      throw new Error(`REST API发布失败: ${result.statusCode}`);
    } catch (error) {
      console.warn('REST API发布失败，尝试XML-RPC:', error.message);
      return this.publishPostXMLRPC(postData);
    }
  }

  /**
   * 通过XML-RPC发布文章
   */
  async publishPostXMLRPC(postData) {
    try {
      const xmlrpcPost = {
        post_title: postData.title,
        post_content: postData.content,
        post_status: postData.status || 'draft',
        post_type: 'post'
      };

      // 如果有分类，添加到文章数据中
      if (postData.categories && postData.categories.length > 0) {
        // 检查categories是ID还是名称
        if (typeof postData.categories[0] === 'number') {
          // 如果是数字，设置为分类ID
          xmlrpcPost.terms = {
            category: postData.categories
          };
        } else {
          // 如果是字符串，设置为分类名称
          xmlrpcPost.terms_names = {
            category: postData.categories
          };
        }
      }

      // 如果有特色图片，添加到文章数据中
      if (postData.featuredMediaId) {
        xmlrpcPost.post_thumbnail = postData.featuredMediaId;
      }

      const result = await this.xmlrpcCall('wp.newPost', [
        1, // blog_id
        this.config.username,
        this.config.password,
        xmlrpcPost
      ]);

      if (result.statusCode === 200 && !result.data.includes('faultCode')) {
        const postIdMatch = result.data.match(/<string>(\d+)<\/string>/);
        const postId = postIdMatch ? postIdMatch[1] : null;
        
        return {
          success: true,
          method: 'xmlrpc',
          postId,
          link: `${this.config.baseUrl}/?p=${postId}`,
          status: postData.status || 'draft'
        };
      }
      throw new Error('XML-RPC发布失败');
    } catch (error) {
      throw new Error(`发布文章失败: ${error.message}`);
    }
  }

  /**
   * 发起REST API请求 (带重试逻辑)
   */
  async makeRestRequest(endpoint, method = 'GET', body = null, customHeaders = {}, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const res = await this.makeRestRequestRaw(endpoint, method, body, customHeaders);
            // 只有 5xx 错误才重试，4xx (除429外) 通常是客户端问题
            if (res.statusCode >= 500 || res.statusCode === 429) {
                throw new Error(`HTTP ${res.statusCode}`);
            }
            return res;
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000;
                console.log(`   ⚠️ REST error (${error.message}), retrying in ${delay}ms... (${i+1}/${retries})`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
  }

  /**
   * 原始REST请求
   */
  async makeRestRequestRaw(endpoint, method = 'GET', body = null, customHeaders = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.baseUrl}/wp-json/wp/v2/${endpoint}`);
      const client = url.protocol === 'https:' ? https : http;
      
      const authHeader = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      const headers = {
        'Authorization': authHeader,
        'User-Agent': 'WordPress-Connector/1.0',
        ...customHeaders
      };

      // 只有当不是multipart/form-data时才设置Content-Type为application/json
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 15000
      };
      
      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body);
      }
      
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * 发起XML-RPC请求 (带重试逻辑)
   */
  async xmlrpcCall(method, params = [], retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await this.xmlrpcCallRaw(method, params);
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000;
                console.log(`   ⚠️ XML-RPC error, retrying in ${delay}ms... (${i+1}/${retries})`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
  }

  /**
   * 原始XML-RPC请求
   */
  async xmlrpcCallRaw(method, params = []) {
    return new Promise((resolve, reject) => {
      const xmlrpcUrl = `${this.config.baseUrl}/xmlrpc.php`;
      const url = new URL(xmlrpcUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(param => `<param><value>${this.formatXMLParam(param)}</value></param>`).join('')}
  </params>
</methodCall>`;

      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xmlRequest)
        },
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.write(xmlRequest);
      req.end();
    });
  }

  /**
   * 格式化XML-RPC参数
   */
  formatXMLParam(param) {
    if (typeof param === 'string') {
      return `<string>${this.escapeXml(param)}</string>`;
    } else if (typeof param === 'number') {
      return `<int>${param}</int>`;
    } else if (typeof param === 'boolean') {
      return `<boolean>${param ? '1' : '0'}</boolean>`;
    } else if (Array.isArray(param)) {
      return `<array><data>${param.map(item => `<value>${this.formatXMLParam(item)}</value>`).join('')}</data></array>`;
    } else if (typeof param === 'object') {
      // 检查是否是base64数据标记
      if (param && param.__xmlrpc_base64) {
        return `<base64>${param.__xmlrpc_base64}</base64>`;
      }
      const members = Object.entries(param).map(([key, value]) => 
        `<member><name>${this.escapeXml(key)}</name><value>${this.formatXMLParam(value)}</value></member>`
      ).join('');
      return `<struct>${members}</struct>`;
    }
    return `<string>${this.escapeXml(String(param))}</string>`;
  }

  /**
   * XML字符转义
   */
  escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 解析XML-RPC分类响应
   */
  parseXMLRPCCategories(xmlData) {
    const categories = [];
    
    // 匹配所有分类结构
    const categoryPattern = /<struct>(.*?)<\/struct>/gs;
    const matches = xmlData.match(categoryPattern);
    
    if (matches) {
      matches.forEach(match => {
        const termIdMatch = match.match(/<name>term_id<\/name><value><string>([^<]+)<\/string>/);
        const nameMatch = match.match(/<name>name<\/name><value><string>([^<]+)<\/string>/);
        const slugMatch = match.match(/<name>slug<\/name><value><string>([^<]+)<\/string>/);
        const countMatch = match.match(/<name>count<\/name><value><int>([^<]+)<\/int>/);
        
        if (termIdMatch && nameMatch) {
          categories.push({
            id: parseInt(termIdMatch[1]),
            name: nameMatch[1],
            slug: slugMatch ? slugMatch[1] : nameMatch[1],
            count: countMatch ? parseInt(countMatch[1]) : 0
          });
        }
      });
    }
    
    return categories;
  }

  /**
   * 解析XML-RPC文章数据
   */
  parseXMLRPCPosts(xmlData) {
    const posts = [];
    
    // 匹配所有文章结构
    const postPattern = /<struct>(.*?)<\/struct>/gs;
    const matches = xmlData.match(postPattern);
    
    if (matches) {
      matches.forEach(match => {
        const postIdMatch = match.match(/<name>post_id<\/name><value><string>([^<]+)<\/string>/);
        const titleMatch = match.match(/<name>post_title<\/name><value><string>([^<]+)<\/string>/);
        const dateMatch = match.match(/<name>post_date<\/name><value><dateTime\.iso8601>([^<]+)<\/dateTime\.iso8601>/);
        
        if (postIdMatch && titleMatch) {
          posts.push({
            id: postIdMatch[1],
            title: titleMatch[1],
            date: dateMatch ? dateMatch[1] : null
          });
        }
      });
    }
    
    return posts;
  }

  /**
   * 验证文章的特色图片设置
   */
  async verifyFeaturedImage(postId) {
    try {
      if (!this.preferredMethod) {
        await this.detectBestMethod();
      }

      if (this.preferredMethod === 'rest') {
        const result = await this.makeRestRequest(`posts/${postId}`, 'GET');
        if (result.statusCode === 200) {
          const post = JSON.parse(result.data);
          return {
            success: true,
            featuredMediaId: post.featured_media,
            hasImage: post.featured_media > 0,
            method: 'rest'
          };
        }
        return { success: false, error: `HTTP ${result.statusCode}` };
      }

      // 使用 XML-RPC 获取文章信息
      // 注意 wp.getPost 签名是 (blog_id, username, password, post_id, fields)，
      // 不能省略 blog_id，否则返回 fault「该 XML-RPC 方法需要更多参数」。
      const result = await this.xmlrpcCall('wp.getPost', [
        1, // blog_id
        this.config.username,
        this.config.password,
        postId
      ]);

      if (result.statusCode !== 200) {
        return { success: false, error: `HTTP ${result.statusCode}` };
      }
      if (/<fault>/i.test(result.data)) {
        return { success: false, error: this.extractXmlrpcFault(result.data) };
      }

      const post = await this.parseXMLRPCSingleStruct(result.data);
      if (!post) {
        return { success: false, error: '无法解析 wp.getPost 响应' };
      }

      // 有特色图时 post_thumbnail 是 struct（含 attachment_id），无图时是空数组
      const thumb = post.post_thumbnail;
      let featuredMediaId;
      if (Array.isArray(thumb)) {
        featuredMediaId = thumb[0] && thumb[0].attachment_id ? parseInt(thumb[0].attachment_id, 10) : undefined;
      } else if (thumb && typeof thumb === 'object') {
        featuredMediaId = thumb.attachment_id ? parseInt(thumb.attachment_id, 10) : undefined;
      }

      return {
        success: true,
        hasImage: !!featuredMediaId,
        featuredMediaId,
        method: 'xmlrpc'
      };
    } catch (error) {
      console.warn('验证特色图片失败:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WordPressConnector;
