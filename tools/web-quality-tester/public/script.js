// Globals
let config = null;
let extractedContent = null;
let currentResults = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed. Starting initialization.');
    init();
});

async function init() {
    console.log('Init function called.');
    setupEventListeners();
    try {
        await loadConfig();
        await loadDefaultUrl();
        showToast('欢迎使用AI质量测试器！', 'success');
        console.log('Initialization complete.');
    } catch (error) {
        console.error('Initialization failed:', error);
        showToast('初始化失败，请检查后台服务和配置', 'error');
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    console.log('Setting up event listeners.');
    // Processing buttons
    document.getElementById('process-btn').addEventListener('click', () => processContent('both'));
    document.getElementById('translate-only-btn').addEventListener('click', () => processContent('translate'));
    document.getElementById('rewrite-only-btn').addEventListener('click', () => processContent('rewrite'));

    // URL input validation
    document.getElementById('url-input').addEventListener('input', checkReadyToProcess);
    document.getElementById('url-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const processBtn = document.getElementById('process-btn');
            if (!processBtn.disabled) processBtn.click();
        }
    });

    // Utility buttons
    document.getElementById('reset-btn').addEventListener('click', resetInterface);
    document.getElementById('export-results').addEventListener('click', exportResults);
    document.getElementById('test-again').addEventListener('click', resetInterface); // Added listener

    // Auto-enable process buttons on engine selection
    document.getElementById('translate-engine').addEventListener('change', checkReadyToProcess);
    document.getElementById('rewrite-engine').addEventListener('change', checkReadyToProcess);
}

// --- Core Functions ---
async function loadConfig() {
    console.log('Fetching /api/config...');
    const response = await fetch('/api/config');
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Received config data:', result);

    if (result.success) {
        config = result.data;
        console.log('Config data assigned:', config);
        populateAIEngines();
        loadDefaultPrompts();
    } else {
        throw new Error(result.error || 'Failed to load config data.');
    }
}

async function loadDefaultUrl() {
    console.log('Fetching default URL...');
    const response = await fetch('/api/default-url');
    const result = await response.json();
    if (result.success && result.data.url) {
        document.getElementById('url-input').value = result.data.url;
        checkReadyToProcess();
        console.log('Default URL loaded.');
    }
}

function populateAIEngines() {
    console.log('Populating AI engines...');
    if (!config || !config.aiEngines || !Array.isArray(config.aiEngines)) {
        console.error('Cannot populate AI engines, config is invalid or missing aiEngines array.');
        showToast('AI引擎配置无效', 'error');
        return;
    }
    const translateSelect = document.getElementById('translate-engine');
    const rewriteSelect = document.getElementById('rewrite-engine');

    translateSelect.innerHTML = '<option value="">选择翻译引擎...</option>';
    rewriteSelect.innerHTML = '<option value="">选择重写引擎...</option>';

    config.aiEngines.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.id;
        option.textContent = `${engine.name} (${engine.model})`;
        translateSelect.appendChild(option.cloneNode(true));
        rewriteSelect.appendChild(option);
    });
    console.log('AI engines populated.');
}

function loadDefaultPrompts() {
    console.log('Loading default prompts...');
    if (!config || !config.prompts) {
        console.warn('No prompts found in config.');
        return;
    }
    
    console.log('Config prompts structure:', config.prompts);
    
    const translatePrompt = config.prompts.translate?.template || '';
    const rewritePrompt = config.prompts.rewrite?.template || '';

    console.log('Translate prompt length:', translatePrompt.length);
    console.log('Rewrite prompt length:', rewritePrompt.length);

    document.getElementById('translate-prompt').value = translatePrompt;
    document.getElementById('rewrite-prompt').value = rewritePrompt;
    console.log('Default prompts loaded successfully.');
}

function checkReadyToProcess() {
    const url = document.getElementById('url-input').value.trim();
    const translateEngine = document.getElementById('translate-engine').value;
    const rewriteEngine = document.getElementById('rewrite-engine').value;
    
    const isUrlValid = validateUrl(url);

    document.getElementById('process-btn').disabled = !(isUrlValid && translateEngine && rewriteEngine);
    document.getElementById('translate-only-btn').disabled = !(isUrlValid && translateEngine);
    document.getElementById('rewrite-only-btn').disabled = !(isUrlValid && rewriteEngine);
}

async function processContent(mode = 'both') {
    const url = document.getElementById('url-input').value.trim();
    if (!url || !validateUrl(url)) {
        showToast('请输入有效的URL', 'warning');
        return;
    }

    const translateEngine = document.getElementById('translate-engine').value;
    const rewriteEngine = document.getElementById('rewrite-engine').value;
    const translatePrompt = document.getElementById('translate-prompt').value.trim();
    const rewritePrompt = document.getElementById('rewrite-prompt').value.trim();

    if ((mode === 'both' || mode === 'translate') && !translateEngine) {
        showToast('请选择翻译AI引擎', 'warning');
        return;
    }
    if ((mode === 'both' || mode === 'rewrite') && !rewriteEngine) {
        showToast('请选择重写AI引擎', 'warning');
        return;
    }
    if ((mode === 'both' || mode === 'translate') && !translatePrompt) {
        showToast('请输入翻译提示词', 'warning');
        return;
    }
    if ((mode === 'both' || mode === 'rewrite') && !rewritePrompt) {
        showToast('请输入重写提示词', 'warning');
        return;
    }

    showProcessingStatus();
    showLoadingOverlay();

    try {
        document.getElementById('status-text').textContent = '正在提取网页内容...';
        const extractResponse = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const extractResult = await extractResponse.json();
        if (!extractResult.success) throw new Error(`内容提取失败: ${extractResult.error}`);
        
        extractedContent = extractResult.data;
        displayExtractedContent();

        const statusText = mode === 'translate' ? '正在翻译...' : 
                          mode === 'rewrite' ? '正在重写...' : '开始AI处理...';
        document.getElementById('status-text').textContent = statusText;
        
        const requestBody = {
            title: extractedContent.title,
            content: extractedContent.content,
            mode: mode
        };
        
        if (mode === 'both' || mode === 'translate') {
            requestBody.translateEngine = translateEngine;
            requestBody.translatePrompt = translatePrompt;
        }
        if (mode === 'both' || mode === 'rewrite') {
            requestBody.rewriteEngine = rewriteEngine;
            requestBody.rewritePrompt = rewritePrompt;
        }
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        if (result.success) {
            currentResults = result.data;
            displayResults();
            showToast('AI处理完成！', 'success');
        } else {
            throw new Error(result.error || 'AI处理失败');
        }
    } catch (error) {
        console.error('Processing error:', error);
        showToast(`处理失败: ${error.message}`, 'error');
    } finally {
        hideLoadingOverlay();
        document.getElementById('processing-section').style.display = 'none';
    }
}

// --- UI Display Functions ---
function showProcessingStatus() {
    document.getElementById('results-section').style.display = 'none';
    const processingSection = document.getElementById('processing-section');
    processingSection.style.display = 'block';
    document.getElementById('status-text').textContent = '准备开始...';
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    
    setTimeout(() => {
        progressFill.style.transition = 'width 2s ease-out';
        progressFill.style.width = '100%';
    }, 100);
}

function displayExtractedContent() {
    if (!extractedContent) return;
    const section = document.getElementById('extracted-content');
    section.style.display = 'block';
    document.getElementById('preview-title').textContent = extractedContent.title;
    document.getElementById('preview-content').textContent = extractedContent.content;
    document.getElementById('content-stats').textContent = `标题字数: ${countWords(extractedContent.title)}, 内容字数: ${countWords(extractedContent.content)}`;
}

function displayResults() {
    const section = document.getElementById('results-section');
    section.style.display = 'block';
    
    const mode = currentResults.mode;
    const hasTranslation = (mode === 'both' || mode === 'translate') && currentResults.processing.translate;
    const hasRewrite = (mode === 'both' || mode === 'rewrite') && currentResults.processing.rewrite;

    const translationCard = document.querySelector('.result-item:nth-child(1)');
    const rewriteCard = document.querySelector('.result-item:nth-child(2)');

    if (hasTranslation) {
        translationCard.style.display = 'block';
        const tResult = currentResults.processing.translate;
        document.getElementById('translation-result').innerHTML = formatResultText(tResult.result);
        document.getElementById('translation-stats').innerHTML = `<span>处理时间: ${tResult.timeMs}ms</span><span>字数: ${tResult.wordCount}</span>`;
    } else {
        translationCard.style.display = 'none';
    }

    if (hasRewrite) {
        rewriteCard.style.display = 'block';
        const rResult = currentResults.processing.rewrite;
        document.getElementById('rewrite-result').innerHTML = formatResultText(rResult.result);
        document.getElementById('rewrite-stats').innerHTML = `<span>处理时间: ${rResult.timeMs}ms</span><span>字数: ${rResult.wordCount}</span>`;
    } else {
        rewriteCard.style.display = 'none';
    }

    displaySummary();
    section.scrollIntoView({ behavior: 'smooth' });
}

function displaySummary() {
    const summary = document.getElementById('results-summary');
    const mode = currentResults.mode;
    const modeText = mode === 'both' ? '完整处理' : mode === 'translate' ? '仅翻译' : '仅重写';
    
    const summaryCards = [];
    summaryCards.push(createSummaryCard(`${currentResults.totalTimeMs}ms`, '总处理时间', '#667eea'));
    summaryCards.push(createSummaryCard(modeText, '处理模式', '#667eea'));
    
    if (currentResults.translateEngine) {
        summaryCards.push(createSummaryCard(currentResults.translateEngine, '翻译引擎', '#48bb78'));
    }
    if (currentResults.rewriteEngine) {
        summaryCards.push(createSummaryCard(currentResults.rewriteEngine, '重写引擎', '#ed8936'));
    }
    summaryCards.push(createSummaryCard(new Date(currentResults.timestamp).toLocaleTimeString(), '完成时间', '#9f7aea'));
    
    summary.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #2d3748;"><i class="fas fa-chart-bar"></i> 处理摘要</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            ${summaryCards.join('')}
        </div>
    `;
}

function createSummaryCard(value, label, color) {
    return `
        <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px;">
            <div style="font-size: 1.2rem; font-weight: 600; color: ${color};">${value}</div>
            <div style="color: #718096; font-size: 0.9rem;">${label}</div>
        </div>
    `;
}

function resetInterface() {
    extractedContent = null;
    currentResults = null;
    
    document.getElementById('url-input').value = '';
    document.getElementById('translate-engine').value = '';
    document.getElementById('rewrite-engine').value = '';
    
    document.getElementById('extracted-content').style.display = 'none';
    document.getElementById('processing-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    
    checkReadyToProcess();
    
    loadDefaultUrl();
    loadDefaultPrompts();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('界面已重置，可以开始新的测试', 'success');
}

function exportResults() {
    if (!currentResults) {
        showToast('没有可导出的结果', 'warning');
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentResults, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `ai-test-report-${new Date().toISOString().replace(/:/g, '-')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast('结果已导出为JSON文件', 'success');
}


// --- Utility Functions ---
function validateUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function countWords(text) {
    if (!text) return 0;
    const cleanText = text.trim();
    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (cleanText.match(/[a-zA-Z0-9]+/g) || []).length;
    return chineseChars + englishWords;
}

function formatResultText(text) {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
}

// --- Overlays and Toasts ---
function showLoadingOverlay() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoadingOverlay() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-exclamation-circle'
    };
    const icon = iconMap[type] || 'fa-info-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}
