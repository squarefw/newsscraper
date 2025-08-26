#!/usr/bin/env node

/**
 * 阿里云生产环境新闻抓取系统
 * 
 * 功能：
 * 1. 自动发现新闻链接
 * 2. AI处理和翻译
 * 3. 推送到WordPress
 * 4. 增量抓取和去重
 * 5. 错误处理和重试
 * 
 * 使用方法：
 *   node run-aliyun-production.js
 *   
 * 环境变量：
 *   DRY_RUN=true     # 干运行模式，不实际推送到WordPress
 *   MAX_ARTICLES=10  # 最大处理文章数量
 *   SKIP_DISCOVERY=true # 跳过发现阶段，直接处理现有队列
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置常量
const CONFIG = {
  // 阿里云生产配置文件
  configFile: 'config/config.remote-aliyun.json',
  
  // 输出文件
  queueFile: 'examples/pending-urls.txt',
  logFile: 'logs/aliyun-production.log',
  
  // 运行参数
  maxArticles: parseInt(process.env.MAX_ARTICLES) || 20,
  dryRun: process.env.DRY_RUN === 'true',
  skipDiscovery: process.env.SKIP_DISCOVERY === 'true',
  
  // 超时设置（分钟）
  discoveryTimeout: 15,
  processingTimeout: 30,
  
  // 重试设置
  maxRetries: 3,
  retryDelay: 60000, // 1分钟
};

/**
 * 日志记录器
 */
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.ensureLogDir();
  }

  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logMessage);
    
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n', 'utf8');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  info(message) { this.log('INFO', message); }
  warn(message) { this.log('WARN', message); }
  error(message) { this.log('ERROR', message); }
  success(message) { this.log('SUCCESS', message); }
}

/**
 * 脚本执行器
 */
class ScriptRunner {
  constructor(scriptPath, args = [], options = {}) {
    this.scriptPath = scriptPath;
    this.args = args;
    this.options = {
      timeout: 30 * 60 * 1000, // 30分钟默认超时
      ...options
    };
  }

  async run() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const child = spawn('node', [this.scriptPath, ...this.args], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      // 设置超时
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Script timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            code,
            stdout,
            stderr,
            duration,
            success: true
          });
        } else {
          reject(new Error(`Script exited with code ${code}. Duration: ${duration}ms`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}

/**
 * 阿里云生产环境管理器
 */
class AliyunProductionManager {
  constructor() {
    this.logger = new Logger(CONFIG.logFile);
    this.configPath = path.resolve(__dirname, CONFIG.configFile);
    this.queuePath = path.resolve(__dirname, CONFIG.queueFile);
  }

  /**
   * 验证环境和配置
   */
  validateEnvironment() {
    this.logger.info('🔍 验证阿里云生产环境...');

    // 检查配置文件
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`配置文件不存在: ${this.configPath}`);
    }

    // 检查必要目录
    const requiredDirs = ['examples', 'logs', 'temp'];
    requiredDirs.forEach(dir => {
      const dirPath = path.resolve(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.logger.info(`📁 创建目录: ${dir}`);
      }
    });

    // 检查Node.js版本
    const nodeVersion = process.version;
    this.logger.info(`📋 Node.js版本: ${nodeVersion}`);

    // 检查内存使用
    const memUsage = process.memoryUsage();
    this.logger.info(`💾 内存使用: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

    this.logger.success('✅ 环境验证通过');
  }

  /**
   * 执行新闻发现阶段
   */
  async runDiscovery() {
    if (CONFIG.skipDiscovery) {
      this.logger.info('⏭️ 跳过新闻发现阶段');
      return { skipped: true };
    }

    this.logger.info('🔍 开始新闻发现阶段...');

    const runner = new ScriptRunner(
      'tools/production/discover-and-queue.js',
      [this.configPath],
      { timeout: CONFIG.discoveryTimeout * 60 * 1000 }
    );

    try {
      const result = await runner.run();
      
      // 检查队列文件
      if (fs.existsSync(this.queuePath)) {
        const queueContent = fs.readFileSync(this.queuePath, 'utf8');
        const urlCount = queueContent.trim().split('\n').filter(line => line.trim()).length;
        this.logger.success(`✅ 发现阶段完成，发现 ${urlCount} 个新链接`);
        return { success: true, urlCount, duration: result.duration };
      } else {
        this.logger.warn('⚠️ 发现阶段完成，但没有生成队列文件');
        return { success: true, urlCount: 0, duration: result.duration };
      }
    } catch (error) {
      this.logger.error(`❌ 发现阶段失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 执行AI处理和推送阶段
   */
  async runProcessing() {
    this.logger.info('🤖 开始AI处理和推送阶段...');

    // 检查队列文件
    if (!fs.existsSync(this.queuePath)) {
      throw new Error('队列文件不存在，无法进行处理');
    }

    const queueContent = fs.readFileSync(this.queuePath, 'utf8');
    const urls = queueContent.trim().split('\n').filter(line => line.trim());
    
    if (urls.length === 0) {
      this.logger.info('📋 队列为空，无需处理');
      return { success: true, processed: 0 };
    }

    this.logger.info(`📋 队列中有 ${urls.length} 个链接待处理`);

    // 限制处理数量
    if (urls.length > CONFIG.maxArticles) {
      const limitedUrls = urls.slice(0, CONFIG.maxArticles);
      fs.writeFileSync(this.queuePath, limitedUrls.join('\n'), 'utf8');
      this.logger.info(`⚡ 限制处理数量为 ${CONFIG.maxArticles} 个链接`);
    }

    const args = [this.configPath, this.queuePath];
    
    // 干运行模式
    if (CONFIG.dryRun) {
      args.push('--dry-run');
      this.logger.info('🔍 启用干运行模式');
    }

    const runner = new ScriptRunner(
      'tools/production/batch-ai-push.js',
      args,
      { timeout: CONFIG.processingTimeout * 60 * 1000 }
    );

    try {
      const result = await runner.run();
      this.logger.success(`✅ 处理阶段完成，耗时: ${Math.round(result.duration / 1000)}秒`);
      return { success: true, duration: result.duration };
    } catch (error) {
      this.logger.error(`❌ 处理阶段失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 清理临时文件
   */
  cleanup() {
    this.logger.info('🧹 清理临时文件...');

    const tempFiles = [
      this.queuePath,
      'temp/execution-state.json',
      'examples/filter-report.txt'
    ];

    tempFiles.forEach(file => {
      const filePath = path.resolve(__dirname, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          this.logger.info(`🗑️ 删除临时文件: ${file}`);
        } catch (error) {
          this.logger.warn(`⚠️ 无法删除文件 ${file}: ${error.message}`);
        }
      }
    });
  }

  /**
   * 生成运行报告
   */
  generateReport(results) {
    this.logger.info('📊 生成运行报告...');

    const report = {
      timestamp: new Date().toISOString(),
      environment: 'aliyun-production',
      config: {
        maxArticles: CONFIG.maxArticles,
        dryRun: CONFIG.dryRun,
        skipDiscovery: CONFIG.skipDiscovery
      },
      results: results,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    };

    const reportPath = path.resolve(__dirname, 'logs/aliyun-production-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    this.logger.success(`📈 运行报告已保存: ${reportPath}`);
    return report;
  }

  /**
   * 主执行流程
   */
  async run() {
    const startTime = Date.now();
    let results = {
      discovery: null,
      processing: null,
      errors: []
    };

    try {
      this.logger.info('🚀 启动阿里云生产环境新闻抓取系统');
      this.logger.info('=' * 50);

      // 1. 验证环境
      this.validateEnvironment();

      // 2. 执行发现阶段
      if (!CONFIG.skipDiscovery) {
        try {
          results.discovery = await this.runDiscovery();
        } catch (error) {
          results.errors.push({
            stage: 'discovery',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          this.logger.warn('⚠️ 发现阶段失败，将尝试处理现有队列');
        }
      } else {
        this.logger.info('⏭️ 跳过发现阶段，直接处理现有队列');
      }

      // 3. 执行处理阶段
      try {
        results.processing = await this.runProcessing();
      } catch (error) {
        results.errors.push({
          stage: 'processing',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw error; // 处理失败是致命错误
      }

      // 4. 生成报告
      const totalDuration = Date.now() - startTime;
      results.totalDuration = totalDuration;
      
      this.generateReport(results);

      this.logger.success(`🎉 阿里云生产运行完成！总耗时: ${Math.round(totalDuration / 1000)}秒`);

      return results;

    } catch (error) {
      this.logger.error(`💥 阿里云生产运行失败: ${error.message}`);
      
      // 生成错误报告
      results.totalDuration = Date.now() - startTime;
      results.errors.push({
        stage: 'main',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      this.generateReport(results);
      
      throw error;
    } finally {
      // 5. 清理（可选）
      if (!CONFIG.dryRun && process.env.CLEANUP !== 'false') {
        this.cleanup();
      }
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const manager = new AliyunProductionManager();
  
  try {
    await manager.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 阿里云生产运行失败:', error.message);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，正在退出...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在退出...');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = AliyunProductionManager;
