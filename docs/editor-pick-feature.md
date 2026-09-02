# 编辑精选功能文档

## 功能概述

AI 每天从当天发布的文章中自动选出 1-5 篇作为"编辑精选"，在主页显眼位置展示，同时作为推送给中国新闻网（chinanews.com.cn）的候选内容。

## 业务背景

- i0086 网站与 chinanews.com.cn 合作，作为爱尔兰本地媒体推送当地新闻给他们
- "编辑精选"分类（tag_ID=205）是非排他标签，文章可以同时属于普通分类（如"社会民生"）+ "编辑精选"
- 目的：在主页突出展示最有价值的新闻，同时为手动推送到 chinanews.com.cn 做准备

## 选择标准

"编辑精选"必须同时满足两个维度：

1. **高新闻价值**
   - 时效性强
   - 当天最重要
   - 最吸引眼球

2. **适合推送给中国新闻网**
   - 中爱两国合作、交流、往来的新闻
   - 爱尔兰重大政策变化（影响在爱华人或中国投资者）
   - 爱尔兰社会热点事件（吸引中国读者兴趣）
   - 对中国读者有意义的爱尔兰新闻

## 数量控制

- 每天 1-5 篇，根据当天新闻质量浮动
- 不超过 5 篇

## 技术实现方案

### 方案设计

由于 `rewriteAndCategorizeBatch` 会分批处理文章（每批最多 12000 字符），每个 batch 的 AI 无法看到其他 batch 的文章，无法做全局比较。因此采用**两步方案**：

1. **步骤 1-3（现有流程）**：翻译 + 重写 + 分类（分多个 batch）
2. **步骤 3.5（新增）**：单独一次 AI 调用，从所有已处理文章中选出编辑精选
3. **步骤 4**：发布到 WordPress（给编辑精选文章额外添加分类 ID 205）

### 实现细节

#### 1. 新增 AI 函数 `selectEditorPicks`

位置：`src/ai/aiProcessor.js`

```javascript
/**
 * 从所有文章中选出编辑精选（1-5 篇）
 * @param {Object} multiAIManager - AI管理器
 * @param {Array} articles - 已处理的文章列表 [{url, rewrittenTitle, category, rewrittenContent}]
 * @returns {Array} 编辑精选文章的URL列表（最多5个）
 */
const selectEditorPicks = async (multiAIManager, articles) => {
  // 准备输入：标题 + 分类 + 摘要（前200字）
  const inputArticles = articles.map(article => ({
    url: article.url,
    title: article.rewrittenTitle,
    category: article.category,
    summary: (article.rewrittenContent || '').substring(0, 200)
  }));

  const prompt = `你是一名资深新闻编辑。请从以下文章中选出最值得作为"编辑精选"的文章。

**选择标准（必须同时满足）：**
1. 高新闻价值：时效性强、当天最重要、最吸引眼球
2. 适合推送给中国新闻网：中爱关系、爱尔兰重大政策、对中国读者有意义的爱尔兰新闻

**输出格式（严格遵循）：**
返回一个 JSON 对象：
\`\`\`json
{
  "editorPicks": ["url1", "url2", ...]  // 最多5个URL
}
\`\`\`

**要求：**
- 必须选出 1-5 篇（根据当天新闻质量决定）
- 如果当天没有够格的文章，可以返回空数组 []
- 只输出 JSON，不要其他说明文字

文章列表：
\`\`\`json
${JSON.stringify(inputArticles, null, 2)}
\`\`\``;

  try {
    const engine = multiAIManager.getAgentForTask('rewrite');
    const response = await engine.processContent(prompt, 'custom');
    
    // 解析 JSON
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    
    const parsed = JSON.parse(cleanResponse);
    const editorPicks = parsed.editorPicks || [];
    
    // 限制最多5篇
    if (editorPicks.length > 5) {
      console.log(`   ⚠️  AI选择了${editorPicks.length}篇编辑精选，截断为5篇`);
      return editorPicks.slice(0, 5);
    }
    
    return editorPicks;
  } catch (error) {
    console.error(`   ❌ 选择编辑精选失败: ${error.message}`);
    return [];
  }
};
```

#### 2. 修改 `batch-ai-push.js` 发布流程

位置：`src/services/batch-ai-push.js`，步骤 3 和步骤 4 之间

```javascript
// 步骤 3.5: 选择编辑精选
console.log('⭐ 步骤 3.5/4: 选择编辑精选...');
const editorPickUrls = await aiProcessor.selectEditorPicks(multiAIManager, processedArticles);
console.log(`   ✅ 选出 ${editorPickUrls.length} 篇编辑精选`);

// 给编辑精选文章标记
processedArticles.forEach(article => {
  if (editorPickUrls.includes(article.url)) {
    article.isEditorPick = true;
  }
});
```

#### 3. 修改发布逻辑

位置：`src/services/batch-ai-push.js`，发布循环里

```javascript
// 准备分类列表
const categories = [];
if (processedData.categoryId) {
  categories.push(processedData.categoryId);
}

// 如果是编辑精选，额外添加分类 ID 205
if (article.isEditorPick) {
  const editorPickCategoryId = 205;
  if (!categories.includes(editorPickCategoryId)) {
    categories.push(editorPickCategoryId);
    console.log(`   ⭐ 标记为编辑精选，添加分类ID: ${editorPickCategoryId}`);
  }
}
```

### 代码修改清单

| 文件 | 修改内容 |
|------|---------|
| `src/ai/aiProcessor.js` | 新增 `selectEditorPicks` 函数 |
| `src/services/batch-ai-push.js` | 步骤 3 后添加步骤 3.5（选择编辑精选）；发布循环里给编辑精选文章添加分类 ID 205 |

### 部署说明

- `src/` 改动需要重建镜像（`./simple-deploy.sh weifang@192.168.1.230`，约 5-8 分钟）
- 无需修改配置文件

### 验证方法

1. 检查日志输出：
   - `⭐ 步骤 3.5/4: 选择编辑精选...`
   - `✅ 选出 X 篇编辑精选`
   - `⭐ 标记为编辑精选，添加分类ID: 205`

2. 检查 WordPress 后台：
   - 文章列表里应该有几篇文章同时属于普通分类（如"社会民生"）+ "编辑精选"
   - "编辑精选"分类下应该能看到这些文章

3. 检查网站首页：
   - "编辑精选"板块应该展示这些文章

## 测试场景

### 场景 1：正常情况
- 27 篇文章，AI 选出 3-5 篇作为编辑精选
- 预期：这些文章同时有普通分类 + 编辑精选分类

### 场景 2：没有够格文章
- AI 认为当天没有符合标准的文章
- 预期：返回空数组，没有文章被标记为编辑精选

### 场景 3：超过5篇
- AI 错误地返回了超过 5 篇
- 预期：代码截断，只取前 5 篇

### 场景 4：AI 调用失败
- AI 返回格式错误或调用超时
- 预期：返回空数组，不影响正常发布流程

## 后续优化

1. **评分机制**：如果用户反馈选择不够准确，可以添加评分字段（1-10分），按评分排序
2. **手动调整**：提供后台界面，让编辑可以手动添加/移除"编辑精选"标记
3. **推送集成**：与 chinanews.com.cn 的推送接口集成，自动推送编辑精选文章
4. **历史追踪**：记录每天的编辑精选选择，便于回顾和优化选择标准

## 注意事项

- "编辑精选"分类 ID（205）是硬编码的，如果 WordPress 重建需要更新
- AI 选择是基于标题+摘要（前200字），不是全文，以节省 token
- 编辑精选选择不影响文章的发布状态（仍然是 publish，不是 draft）
