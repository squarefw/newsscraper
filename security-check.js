#!/usr/bin/env node

/**
 * Git提交前安全检查脚本
 * 检查是否有敏感数据会被意外提交
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 Git提交前安全检查');
console.log('====================\n');

// 敏感数据模式检查
const sensitivePatterns = [
  { pattern: /sk-[a-zA-Z0-9]{48,}/, name: 'OpenAI/类似API密钥' },
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/, name: 'GitHub Personal Access Token' },
  { pattern: /AIzaSy[a-zA-Z0-9_-]{33}/, name: 'Google API密钥' },
  { pattern: /"password":\s*"(?!FROM_API_KEYS_CONFIG|YOUR_)[^"]{3,}"/, name: '明文密码' },
  { pattern: /"apiKey":\s*"(?!FROM_API_KEYS_CONFIG|YOUR_|DISABLED_)[^"]{10,}"/, name: 'API密钥' },
];

// 检查将要提交的文件
try {
  console.log('📋 检查暂存区文件...');
  
  // 获取暂存区文件列表
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file && fs.existsSync(file));
  
  if (stagedFiles.length === 0) {
    console.log('⚠️  暂存区为空，检查所有跟踪文件...');
    
    // 如果暂存区为空，检查所有跟踪文件
    const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file && fs.existsSync(file));
    
    stagedFiles.push(...trackedFiles);
  }
  
  console.log(`📁 检查 ${stagedFiles.length} 个文件\n`);
  
  let hasIssues = false;
  
  for (const file of stagedFiles) {
    // 跳过二进制文件和特定类型文件
    if (file.match(/\.(jpg|jpeg|png|gif|pdf|zip|tar|gz|node_modules)/i)) {
      continue;
    }
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const { pattern, name } of sensitivePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.log(`❌ 发现敏感数据在 ${file}:`);
          console.log(`   类型: ${name}`);
          console.log(`   匹配: ${matches[0].substring(0, 20)}...`);
          hasIssues = true;
        }
      }
    } catch (error) {
      // 忽略无法读取的文件
    }
  }
  
  // 检查是否有被忽略的敏感文件意外进入暂存区
  console.log('🔍 检查敏感文件保护状态...');
  
  const sensitiveFiles = [
    'config/api-keys.local.json',
    'config/api-keys.private.json',
    '.env',
    '.env.local'
  ];
  
  for (const file of sensitiveFiles) {
    if (fs.existsSync(file)) {
      try {
        execSync(`git check-ignore ${file}`, { stdio: 'pipe' });
        console.log(`✅ ${file} 已被Git忽略`);
      } catch (error) {
        console.log(`❌ 警告: ${file} 存在但未被Git忽略！`);
        hasIssues = true;
      }
    }
  }
  
  // 最终检查结果
  console.log('\n🎯 安全检查结果:');
  if (hasIssues) {
    console.log('❌ 发现安全问题，请在提交前解决');
    console.log('\n建议操作:');
    console.log('1. 移除敏感数据并替换为占位符');
    console.log('2. 将敏感文件添加到.gitignore');
    console.log('3. 重新运行此检查');
    process.exit(1);
  } else {
    console.log('✅ 未发现敏感数据，可以安全提交');
  }
  
} catch (error) {
  console.error('❌ 检查过程出错:', error.message);
  process.exit(1);
}

console.log('\n🚀 安全检查通过，准备提交到GitHub');
