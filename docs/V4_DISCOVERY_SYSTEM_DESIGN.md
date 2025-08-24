# 项目V4：新闻源AI自动发现与智能去重系统 - 综合设计文档

**版本**: 1.0
**日期**: 2024年8月6日

---

## 1. 引言

### 1.1 项目背景
当前 `NewsScraper` 系统是一个高效的内容处理与发布引擎，能够根据预设的URL列表完成新闻的提取、AI处理和WordPress发布。然而，其工作流依赖于手动提供URL列表，属于被动执行模式。为了实现更高程度的自动化和智能化，本项目旨在为其增加一个主动的、自动化的上游内容发现层。

### 1.2 项目目标
本项目的核心目标是构建一个“新闻源AI自动发现与智能去重系统”。该系统将能够：
1.  **主动监控**：自动监控指定的新闻源网站。
2.  **智能发现**：利用AI技术，根据关键词自动发现相关的新文章。
3.  **智能去重**：利用AI技术，与WordPress已有内容进行比对，防止重复发布。
4.  **无缝集成**：将筛选出的新文章链接无缝注入到现有的处理与发布流程中。

最终，实现从“新闻发现”到“内容发布”的全自动化闭环。

---

## 2. 功能需求 (Functional Requirements)

| 需求ID | 需求名称 | 详细描述 |
| :--- | :--- | :--- |
| **FR-01** | **可配置的新闻源监控** | 系统必须允许用户在中心配置文件（如 `config.remote-230.json`）中定义一个或多个新闻源。每个新闻源应包含其名称（如"BBC"）、列表页URL和一组相关的监控关键词（如"technology", "ireland"）。 |
| **FR-02** | **AI驱动的新闻链接发现** | 系统需要能够抓取FR-01中配置的新闻源列表页HTML。随后，调用AI模型分析该HTML，并根据链接文本和上下文，提取出所有与指定关键词高度相关的新闻文章的完整URL。 |
| **FR-03** | **AI驱动的内容去重** | 对于FR-02中发现的每一个新链接，系统必须执行去重检查。此过程包括：1) 提取新文章的标题。2) 获取WordPress网站最近发布的文章标题列表。3) 调用AI模型，判断新文章与已有文章是否报道同一核心事件。 |
| **FR-04** | **自动化任务队列生成** | 系统必须将所有通过FR-03去重检查的、确认是全新的新闻链接，写入到一个指定的文本文件（如 `examples/pending-urls.txt`）中。此文件将作为后续处理阶段的任务队列。 |
| **FR-05** | **与现有流程的无缝集成** | 在FR-04成功生成任务队列文件后，系统应能自动调用并执行现有的 `tools/production/batch-ai-push-enhanced.js` 脚本，并将其输入指向新生成的任务队列文件，以完成后续所有处理和发布工作。 |

---

## 3. 系统架构设计

### 3.1 总体架构与工作流
新系统将作为现有处理流程的上游模块存在。整体工作流如下：

```mermaid
graph TD
    A[启动 discover-and-queue.js] --> B{读取配置文件 (FR-01)};
    B --> C{遍历新闻源 (BBC, RTE...)};
    C --> D[获取新闻列表页HTML];
    D --> E[AI分析HTML, 发现相关链接 (FR-02)];
    E --> F{遍历发现的链接};
    F --> G[AI去重检查 (FR-03)];
    G -- 是重复 --> F;
    G -- 是新的 --> H[收集新链接];
    H --> F;
    F -- 完成遍历 --> I[将新链接写入 pending-urls.txt (FR-04)];
    I --> J[调用 batch-ai-push-enhanced.js (FR-05)];
    J --> K[处理新闻并发布到WordPress];
    K --> L[结束];
```

### 3.2 新增模块说明

1.  **主编排脚本: `tools/production/discover-and-queue.js`**
    *   **职责**: 作为新功能的入口和总指挥，负责调度整个“发现-去重-入队”流程。

2.  **新闻发现模块: `utils/sourceAnalyzer.js`**
    *   **职责**: 封装与AI交互以从HTML中发现相关新闻链接的逻辑。它将接收HTML内容和关键词，并返回一个干净的URL列表。

3.  **WordPress去重模块: `utils/wordpressDeduplicator.js`**
    *   **职责**: 封装与WordPress交互和AI比对去重的逻辑。它将接收一个待检测的URL，并返回一个布尔值（是否重复）。该模块应包含对WordPress文章列表的缓存机制，以优化性能。

---

## 4. 技术方案细节

### 4.1 配置文件设计
在 `config/config.remote-230.json` 文件中增加 `discovery` 配置段：

```json
{
  // ... 现有 api, wordpress, ai 等配置
  
  "discovery": {
    "enabled": true,
    "outputUrlFile": "examples/pending-urls.txt",
    "sources": [
      {
        "name": "BBC News",
        "url": "https://www.bbc.com/news",
        "keywords": ["technology", "business", "science"]
      },
      {
        "name": "RTE",
        "url": "https://www.rte.ie/news/",
        "keywords": ["ireland", "dublin", "politics", "housing"]
      }
    ],
    "deduplication": {
      "enabled": true,
      "recentPostsCount": 50,
      "cacheDuration": 3600000
    }
  }
}
```

### 4.2 核心AI Prompt设计

#### 4.2.1 新闻发现Prompt (用于 `sourceAnalyzer.js`)
```
你是一个网页内容分析专家。这是新闻网站 {sourceName} 列表页的HTML代码。请仔细分析并找出所有指向独立新闻文章的链接。你的任务是只选择那些内容与以下任一关键词 {keywords} 高度相关的文章。请忽略导航栏、广告、页脚或“相关阅读”等非主要新闻链接。以JSON数组的格式返回所有符合条件的、完整的URL。如果链接是相对路径，请根据基础URL {baseUrl} 将其补全。

HTML内容:
```html
{html_content}
```
要求:
1. 严格只返回JSON数组格式，不要任何其他文字或解释。
2. 确保数组中的每个URL都是完整的、可直接访问的。
3. 如果找不到任何相关链接，必须返回一个空数组 `[]`。
```

#### 4.2.2 去重判断Prompt (用于 `wordpressDeduplicator.js`)
```
你是一位资深新闻编辑，需要判断一篇文章是否为重复报道。

新发现的文章标题: "{new_article_title}"

我们网站最近已发布的文章标题列表:
- "{wp_title_1}"
- "{wp_title_2}"
- ...

你的任务:
请判断这篇“新发现的文章”与“已发布的文章列表”中是否有任何一篇报道的是完全相同的核心事件或主题。例如，“都柏林房价上涨5%”和“爱尔兰首都房产价格持续攀升”应被视为重复。

请只回答 "YES" 或 "NO"。
```

---

## 5. 代码框架实现

以下是实现上述功能的核心代码框架。

### 5.1 主编排脚本: `tools/production/discover-and-queue.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

const { MultiAIManager } = require('../../utils/multiAIManager');
const { findRelevantLinks } = require('../../utils/sourceAnalyzer');
const { isDuplicate } = require('../../utils/wordpressDeduplicator');

const loadConfig = (configPath) => {
  try {
    console.log(`📋 加载配置文件: ${configPath}`);
    if (!fs.existsSync(configPath)) throw new Error(`配置文件不存在: ${configPath}`);
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`配置文件加载失败: ${error.message}`);
  }
};

const getPageHtml = async (url) => {
  try {
    console.log(`📡 正在访问新闻源: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsScraperBot/1.0; +http://example.com/bot)' },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    console.error(`❌ 访问新闻源失败: ${url}`, error.message);
    return null;
  }
};

async function main() {
  console.log('🚀 启动新闻发现与去重系统 V4');
  console.log('=============================================\n');

  try {
    const configPath = path.resolve(__dirname, '../../config/config.remote-230.json');
    const config = loadConfig(configPath);

    if (!config.discovery?.enabled) {
      console.log('🟡 新闻发现功能未在配置中启用，脚本退出。');
      return;
    }

    const multiAIManager = new MultiAIManager(config);
    const allNewLinks = new Set();

    for (const source of config.discovery.sources) {
      console.log(`\n🔍 开始处理新闻源: ${source.name}`);
      const pageHtml = await getPageHtml(source.url);
      if (!pageHtml) continue;

      const relevantLinks = await findRelevantLinks(pageHtml, source.keywords, source.url, multiAIManager);
      console.log(`   AI发现 ${relevantLinks.length} 个可能相关的链接。`);
      if (relevantLinks.length === 0) continue;

      if (config.discovery.deduplication?.enabled) {
        for (const link of relevantLinks) {
          process.stdout.write(`   - 正在检查链接: ${link.slice(0, 70)}... `);
          const duplicate = await isDuplicate(link, multiAIManager, config);
          if (duplicate) {
            process.stdout.write('[重复]\n');
          } else {
            process.stdout.write('[新的]\n');
            allNewLinks.add(link);
          }
        }
      } else {
        relevantLinks.forEach(link => allNewLinks.add(link));
      }
    }

    const finalLinks = Array.from(allNewLinks);
    if (finalLinks.length > 0) {
      const outputPath = path.resolve(__dirname, '../../', config.discovery.outputUrlFile);
      fs.writeFileSync(outputPath, finalLinks.join('\n'), 'utf8');
      console.log(`\n✅ 成功将 ${finalLinks.length} 个新链接写入到: ${outputPath}`);

      console.log('\n🚀 准备触发后续处理流程...');
      const command = `node tools/production/batch-ai-push-enhanced.js ${configPath} ${outputPath}`;
      console.log(`   执行命令: ${command}`);
      // 实际使用时可以取消注释 exec
    } else {
      console.log('\n🏁 本次运行未发现任何新的文章链接。');
    }
  } catch (error) {
    console.error('\n❌ 系统发生严重错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

### 5.2 新闻发现模块: `utils/sourceAnalyzer.js`

```javascript
const { URL } = require('url');

const buildDiscoveryPrompt = (html, keywords, baseUrl) => {
  const truncatedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').substring(0, 15000);
  return `你是一个新闻内容分析助手...如果链接是相对路径 (例如 /news/article/123)，请根据基础URL "${baseUrl}" 将其补全为完整URL...HTML内容:\n\`\`\`html\n${truncatedHtml}\n\`\`\``;
};

const findRelevantLinks = async (pageHtml, keywords, baseUrl, aiManager) => {
  const prompt = buildDiscoveryPrompt(pageHtml, keywords, baseUrl);
  const aiAgent = aiManager.getAgentForTask('summarize');
  const response = await aiAgent.processContent(prompt, 'custom');
  const links = JSON.parse(response);
  return Array.isArray(links) ? links : [];
};

module.exports = { findRelevantLinks };
```

### 5.3 WordPress去重模块: `utils/wordpressDeduplicator.js`

```javascript
const axios = require('axios');
const { extractNewsFromUrl } = require('../tools/production/batch-ai-push-enhanced');

let titleCache = null;
let cacheTimestamp = 0;

const getRecentWordPressTitles = async (config) => {
  const { deduplication, wordpress } = config.discovery;
  const now = Date.now();
  if (titleCache && (now - cacheTimestamp) < deduplication.cacheDuration) return titleCache;

  try {
    const response = await axios.get(`${wordpress.baseUrl}/wp-json/wp/v2/posts`, {
      params: { per_page: deduplication.recentPostsCount, _fields: 'title.rendered' },
      auth: { username: wordpress.username, password: wordpress.password },
      timeout: 10000
    });
    const titles = response.data.map(post => post.title.rendered);
    titleCache = titles;
    cacheTimestamp = now;
    return titles;
  } catch (error) {
    console.error('[去重] 获取WordPress标题失败:', error.message);
    return [];
  }
};

const buildDeduplicationPrompt = (newTitle, existingTitles) => {
  return `你是一位资深新闻编辑...新文章标题: "${newTitle}"...我们网站最近已发布的文章标题列表:\n- ${existingTitles.join('\n- ')}...请只回答 "YES" 或 "NO"。`;
};

const isDuplicate = async (articleUrl, aiManager, config) => {
  try {
    const existingTitles = await getRecentWordPressTitles(config);
    if (existingTitles.length === 0) return false;

    const { title: newTitle } = await extractNewsFromUrl(articleUrl);
    const prompt = buildDeduplicationPrompt(newTitle, existingTitles);
    const aiAgent = aiManager.getAgentForTask('categorize');
    const response = await aiAgent.processContent(prompt, 'custom');
    return response.trim().toUpperCase() === 'YES';
  } catch (error) {
    console.error(`[去重] 检查URL ${articleUrl} 时出错:`, error.message);
    return false;
  }
};

module.exports = { isDuplicate };
```

---

## 6. 实施计划 (Implementation Plan)

1.  **阶段一：基础建设与配置**
    *   在配置文件中添加 `discovery` 配置段。
    *   创建 `discover-and-queue.js` 的基本框架。
    *   增强 `utils/remoteCategoryManager.js` 或创建新模块，实现获取WordPress最新文章标题列表并支持缓存的功能。

2.  **阶段二：实现新闻发现功能**
    *   创建 `utils/sourceAnalyzer.js` 模块并实现 `findRelevantLinks` 函数。
    *   精心设计并反复测试“新闻发现Prompt”的准确性。
    *   在主脚本中集成此模块，并验证其能从目标网站正确抓取到链接。

3.  **阶段三：实现智能去重功能**
    *   创建 `utils/wordpressDeduplicator.js` 模块并实现 `isDuplicate` 函数。
    *   设计并测试“去重判断Prompt”的可靠性。
    *   在主脚本中集成此模块，并用已知重复和不重复的例子进行测试。

4.  **阶段四：整合、测试与自动化**
    *   完善 `discover-and-queue.js` 的主逻辑，将发现和去重流程串联起来。
    *   实现将最终URL列表写入文件的功能。
    *   添加通过Node.js的 `child_process` 自动调用现有处理脚本的逻辑，并进行完整的端到端测试。