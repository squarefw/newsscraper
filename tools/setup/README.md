# 设置和配置工具目录

这个目录包含了用于环境设置、配置和初始化的工具。

## 📋 文件列表

### 环境设置工具
- `setup-remote.js` - 远程服务器环境设置
- `setup-remote-wordpress.js` - WordPress远程环境设置

### WordPress配置工具
- `create-app-password.js` - 创建WordPress应用密码
- `wordpress-app-password-guide.js` - WordPress应用密码使用指南

### 权限管理工具
- `check-user-permissions.js` - 检查WordPress用户权限
- `fix-user-permissions.js` - 修复WordPress用户权限问题

### 故障排除工具
- `basic-auth-troubleshoot.js` - 基础认证问题故障排除

## 🚀 使用方法

### 首次环境设置
```bash
# 1. 设置远程环境
node tools/setup/setup-remote.js

# 2. 设置WordPress环境
node tools/setup/setup-remote-wordpress.js

# 3. 创建应用密码
node tools/setup/create-app-password.js
```

### 权限管理
```bash
# 检查用户权限
node tools/setup/check-user-permissions.js

# 修复权限问题
node tools/setup/fix-user-permissions.js
```

### 故障排除
```bash
# 排除认证问题
node tools/setup/basic-auth-troubleshoot.js

# 查看密码设置指南
node tools/setup/wordpress-app-password-guide.js
```

## 📋 设置流程

### 新环境部署流程
1. **环境准备**：运行 `setup-remote.js`
2. **WordPress配置**：运行 `setup-remote-wordpress.js`
3. **认证设置**：运行 `create-app-password.js`
4. **权限验证**：运行 `check-user-permissions.js`
5. **功能测试**：使用 `test/` 目录下的工具验证

### 故障排除流程
1. **权限检查**：运行 `check-user-permissions.js`
2. **认证诊断**：运行 `basic-auth-troubleshoot.js`
3. **权限修复**：运行 `fix-user-permissions.js`
4. **重新测试**：使用测试工具验证修复结果

## ⚠️ 注意事项

- **一次性设置**：大部分工具只需要在初始设置时运行一次
- **权限要求**：某些操作需要管理员权限
- **备份重要**：在修改权限前建议备份相关配置
- **测试验证**：设置完成后请使用测试工具验证功能

## 🔧 故障排除

常见问题和解决方案：

### 认证问题
- 运行 `basic-auth-troubleshoot.js` 诊断
- 检查应用密码是否正确设置
- 确认用户权限是否充足

### 权限问题
- 运行 `check-user-permissions.js` 检查当前权限
- 使用 `fix-user-permissions.js` 尝试自动修复
- 必要时联系管理员手动设置权限

### 连接问题
- 检查网络连接和防火墙设置
- 验证服务器地址和端口
- 确认SSL证书配置正确
