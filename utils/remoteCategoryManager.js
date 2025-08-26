/**
 * 远程分类信息获取模块
 * 动态获取不同API服务器的分类信息
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 分类信息缓存
 */
let categoryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取自定义API的分类信息
 */
const getCustomApiCategories = async (apiConfig) => {
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) {
    throw new Error('自定义API配置不完整');
  }

  const cacheKey = `custom_api_${apiConfig.baseUrl}`;
  const cached = categoryCache.get(cacheKey);
  
  // 检查缓存
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📂 使用缓存的自定义API分类信息 (${Object.keys(cached.data).length}个分类)`);
    return cached.data;
  }

  try {
    console.log(`📡 获取自定义API分类信息: ${apiConfig.baseUrl}`);
    
    const response = await axios.get(`${apiConfig.baseUrl}/api/categories`, {
      headers: {
        'Authorization': `Bearer ${apiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const categories = response.data;
    let categoryMapping = {};

    // 转换为映射格式
    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        if (cat.name && cat.id) {
          // 支持中英文名称映射
          categoryMapping[cat.name] = cat.id;
          if (cat.slug) categoryMapping[cat.slug] = cat.id;
          if (cat.nameEn) categoryMapping[cat.nameEn] = cat.id;
        }
      });
    } else if (typeof categories === 'object') {
      categoryMapping = categories;
    }

    // 缓存结果
    categoryCache.set(cacheKey, {
      data: categoryMapping,
      timestamp: Date.now()
    });

    console.log(`✅ 获取到 ${Object.keys(categoryMapping).length} 个自定义API分类`);
    return categoryMapping;

  } catch (error) {
    console.log(`❌ 获取自定义API分类失败: ${error.message}`);
    
    // 尝试使用本地备份
    try {
      const backupPath = path.resolve(__dirname, '../config/category-mapping.json');
      if (fs.existsSync(backupPath)) {
        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        console.log(`⚠️  使用本地备份分类映射 (${Object.keys(backup.customApiCategoryMapping || {}).length}个分类)`);
        return backup.customApiCategoryMapping || {};
      }
    } catch (backupError) {
      console.log(`❌ 本地备份也不可用: ${backupError.message}`);
    }
    
    return {};
  }
};

/**
 * 获取WordPress分类信息
 * @param {Object} wpConfig - WordPress配置
 * @param {Function} [categoryFetcher] - 可选的分类获取函数
 */
const getWordPressCategories = async (wpConfig, categoryFetcher = null) => {
  if (!wpConfig?.baseUrl) {
    throw new Error('WordPress配置不完整');
  }

  const cacheKey = `wp_${wpConfig.baseUrl}`;
  const cached = categoryCache.get(cacheKey);
  
  // 检查缓存
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📂 使用缓存的WordPress分类信息 (${cached.data.length}个分类)`);
    return cached.data;
  }

  try {
    console.log(`📡 获取WordPress分类信息: ${wpConfig.baseUrl}`);
    
    let categories = [];
    
    // 如果提供了自定义的分类获取函数，优先使用
    if (categoryFetcher && typeof categoryFetcher === 'function') {
      try {
        console.log(`   📎 使用自定义WordPress连接器获取分类`);
        categories = await categoryFetcher();
        console.log(`✅ 通过自定义连接器获取到 ${categories.length} 个WordPress分类`);
      } catch (error) {
        console.warn(`⚠️  自定义连接器获取分类失败: ${error.message}，尝试直接REST API`);
        // 如果自定义连接器失败，回退到直接REST API调用
        categories = await getWordPressCategoriesDirect(wpConfig);
      }
    } else {
      console.log(`   🔌 未提供自定义连接器，使用直接REST API调用`);
      // 使用直接REST API调用
      categories = await getWordPressCategoriesDirect(wpConfig);
    }

    // 缓存结果
    if (categories.length > 0) {
      categoryCache.set(cacheKey, {
        data: categories,
        timestamp: Date.now()
      });
    }

    return categories;

  } catch (error) {
    console.log(`❌ 获取WordPress分类失败: ${error.message}`);
    return [];
  }
};

/**
 * 直接通过REST API获取WordPress分类信息
 */
const getWordPressCategoriesDirect = async (wpConfig) => {
  const auth = wpConfig.username && wpConfig.password ? 
    { username: wpConfig.username, password: wpConfig.password } : {};

  const response = await axios.get(`${wpConfig.baseUrl}/wp-json/wp/v2/categories`, {
    auth: Object.keys(auth).length > 0 ? auth : undefined,
    params: {
      per_page: 100, // 获取更多分类
      hide_empty: false
    },
    timeout: 10000
  });

  const categories = response.data.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description || '',
    count: cat.count || 0,
    parent: cat.parent || 0
  }));

  console.log(`✅ 获取到 ${categories.length} 个WordPress分类`);
  return categories;
};

/**
 * 统一获取所有分类信息
 * @param {Object} config - 配置对象
 * @param {Function} [wordpressCategoryFetcher] - WordPress分类获取函数
 */
const getAllCategories = async (config, wordpressCategoryFetcher = null) => {
  const result = {
    customApi: {},
    wordpress: [],
    errors: []
  };

  // 获取自定义API分类
  if (config.api?.enabled && config.api?.baseUrl) {
    try {
      result.customApi = await getCustomApiCategories(config.api);
    } catch (error) {
      result.errors.push(`自定义API分类获取失败: ${error.message}`);
    }
  }

  // 获取WordPress分类
  if (config.wordpress?.enabled && config.wordpress?.baseUrl) {
    try {
      result.wordpress = await getWordPressCategories(config.wordpress, wordpressCategoryFetcher);
    } catch (error) {
      result.errors.push(`WordPress分类获取失败: ${error.message}`);
    }
  }

  return result;
};

/**
 * 清除分类信息缓存
 */
const clearCategoryCache = () => {
  categoryCache.clear();
  console.log('🗑️  分类信息缓存已清除');
};

/**
 * 获取缓存状态
 */
const getCacheStatus = () => {
  const status = {};
  for (const [key, value] of categoryCache.entries()) {
    const age = Date.now() - value.timestamp;
    const remaining = Math.max(0, CACHE_DURATION - age);
    status[key] = {
      age: Math.round(age / 1000),
      remaining: Math.round(remaining / 1000),
      expired: remaining <= 0
    };
  }
  return status;
};

/**
 * 保存分类信息到本地备份
 */
const saveCategoriesToBackup = async (customApiMapping, wordpressCategories) => {
  try {
    const backupData = {
      customApiCategoryMapping: customApiMapping || {},
      wordpressCategories: wordpressCategories || [],
      lastUpdated: new Date().toISOString(),
      note: "This is an auto-generated backup of remote category information"
    };

    const backupPath = path.resolve(__dirname, '../config/category-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`💾 分类信息已备份到: ${backupPath}`);
  } catch (error) {
    console.log(`❌ 保存分类备份失败: ${error.message}`);
  }
};

module.exports = {
  getCustomApiCategories,
  getWordPressCategories,
  getAllCategories,
  clearCategoryCache,
  getCacheStatus,
  saveCategoriesToBackup
};
