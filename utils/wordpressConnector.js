/**
 * WordPress连接管理器
 * 自动检测并选择最佳的API连接方法（REST API 或 XML-RPC）
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

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
   */
  async downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
      const url = new URL(imageUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'WordPress-Connector/1.0'
        },
        timeout: 30000
      }, (res) => {
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
   * 发起REST API请求
   */
  async makeRestRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
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
   * 发起XML-RPC请求
   */
  async xmlrpcCall(method, params = []) {
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
   * 验证文章的特色图片设置
   */
  async verifyFeaturedImage(postId) {
    try {
      if (this.preferredMethod === 'rest') {
        const result = await this.makeRestRequest(`/wp/v2/posts/${postId}`, 'GET');
        if (result.success) {
          const post = JSON.parse(result.data);
          return {
            success: true,
            featuredMediaId: post.featured_media,
            hasImage: post.featured_media > 0
          };
        }
      } else {
        // 使用 XML-RPC 获取文章信息
        const xmlContent = this.buildXMLRequest('wp.getPost', [
          this.config.wordpress.username,
          this.config.wordpress.password,
          postId
        ]);
        
        const result = await this.makeRequest('/xmlrpc.php', 'POST', xmlContent, {
          'Content-Type': 'text/xml'
        });
        
        if (result.statusCode === 200) {
          // 简单检查响应中是否包含 featured_image
          const hasImage = result.data.includes('<name>featured_image</name>');
          return {
            success: true,
            hasImage,
            method: 'xmlrpc'
          };
        }
      }
      return { success: false };
    } catch (error) {
      console.warn('验证特色图片失败:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WordPressConnector;
