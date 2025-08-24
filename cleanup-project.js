#!/usr/bin/env node

/**
 * 项目清理脚本 - 删除空文件和无用文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 项目清理脚本');
console.log('================\n');

// 查找所有空文件
const findEmptyFiles = () => {
  try {
    const output = execSync(
      'find . -type f \\( -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.txt" \\) ! -path "./node_modules/*" ! -path "./.git/*" -empty',
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').filter(file => file);
  } catch (error) {
    return [];
  }
};

// 查找几乎为空的文件（少于3行）
const findNearlyEmptyFiles = () => {
  try {
    const output = execSync(
      'find . -type f \\( -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.txt" \\) ! -path "./node_modules/*" ! -path "./.git/*" | xargs wc -l | grep "^\\s*[0-2] " | grep -v "total$"',
      { encoding: 'utf8' }
    );
    return output.trim().split('\n')
      .filter(line => line && !line.includes('total'))
      .map(line => line.trim().split(/\s+/).slice(1).join(' '));
  } catch (error) {
    return [];
  }
};

const emptyFiles = findEmptyFiles();
const nearlyEmptyFiles = findNearlyEmptyFiles();

console.log(`📊 发现 ${emptyFiles.length} 个空文件:`);
emptyFiles.forEach(file => console.log(`   ${file}`));

console.log(`\n📊 发现 ${nearlyEmptyFiles.length} 个几乎为空的文件:`);
nearlyEmptyFiles.forEach(file => console.log(`   ${file}`));

console.log('\n🗑️  开始清理空文件...');

let deletedCount = 0;
emptyFiles.forEach(file => {
  try {
    fs.unlinkSync(file);
    console.log(`   ✅ 删除: ${file}`);
    deletedCount++;
  } catch (error) {
    console.log(`   ❌ 删除失败: ${file} - ${error.message}`);
  }
});

console.log(`\n🎯 清理完成! 删除了 ${deletedCount} 个空文件`);

// 检查是否有空目录
console.log('\n📁 检查空目录...');
try {
  const output = execSync('find . -type d -empty ! -path "./.git/*" ! -path "./node_modules/*"', { encoding: 'utf8' });
  const emptyDirs = output.trim().split('\n').filter(dir => dir);
  
  if (emptyDirs.length > 0) {
    console.log(`📊 发现 ${emptyDirs.length} 个空目录:`);
    emptyDirs.forEach(dir => console.log(`   ${dir}`));
    
    console.log('\n🗑️  删除空目录...');
    emptyDirs.forEach(dir => {
      try {
        fs.rmdirSync(dir);
        console.log(`   ✅ 删除目录: ${dir}`);
      } catch (error) {
        console.log(`   ❌ 删除目录失败: ${dir} - ${error.message}`);
      }
    });
  } else {
    console.log('✅ 未发现空目录');
  }
} catch (error) {
  console.log('📁 检查空目录时出错:', error.message);
}

console.log('\n✨ 项目清理完成!');
