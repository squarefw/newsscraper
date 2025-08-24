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
      const result = await this.makeRestRequest('categories?per_page=100');
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
        excerpt: postData.excerpt || ''
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
        xmlrpcPost.terms_names = {
          category: postData.categories
        };
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
  async makeRestRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.baseUrl}/wp-json/wp/v2/${endpoint}`);
      const client = url.protocol === 'https:' ? https : http;
      
      const authHeader = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'WordPress-Connector/1.0'
        },
        timeout: 15000
      };
      
      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
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
}

module.exports = WordPressConnector;
