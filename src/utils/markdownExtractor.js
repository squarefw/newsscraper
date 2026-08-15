const TurndownService = require('turndown');

class MarkdownExtractor {
    constructor() {
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
        
        // 自定义规则：移除脚本、样式、导航等无关元素
        this.turndownService.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 'aside']);
    }

    /**
     * 将HTML转换为Markdown
     * @param {string} html - 原始展示或片段
     * @param {string} selector - 可选的选择器，只转换特定部分
     * @returns {string} Markdown内容
     */
    convert(html) {
        if (!html) return '';
        try {
            return this.turndownService.turndown(html);
        } catch (error) {
            console.error('Markdown转换失败:', error.message);
            return html; // 失败则返回原HTML或文本
        }
    }
}

module.exports = new MarkdownExtractor();
