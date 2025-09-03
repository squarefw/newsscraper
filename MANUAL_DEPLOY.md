# 手动部署指南

如果自动部署脚本遇到问题，可以按照以下步骤手动部署：

## 1. 准备服务器环境

```bash
# 连接到服务器
ssh root@192.168.1.230

# 安装 Docker（如果未安装）
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装 Docker Compose（如果未安装）
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 创建部署目录
mkdir -p /opt/newsscraper
```

## 2. 传输项目文件

在本地机器上：

```bash
# 创建部署包
cd /Users/weifang/Sites/i0086/site/newsscraper
tar --exclude='.git' --exclude='node_modules' --exclude='logs' --exclude='temp' --exclude='*.tar.gz' --exclude='.DS_Store' -czf newsscraper-deploy.tar.gz .

# 传输到服务器
scp newsscraper-deploy.tar.gz root@192.168.1.230:/opt/newsscraper/

# 清理本地文件
rm newsscraper-deploy.tar.gz
```

## 3. 在服务器上部署

```bash
# 连接到服务器
ssh root@192.168.1.230

# 进入部署目录
cd /opt/newsscraper

# 解压文件
tar -xzf newsscraper-deploy.tar.gz
rm newsscraper-deploy.tar.gz

# 创建必要目录
mkdir -p logs temp

# 编辑环境变量文件（重要！）
vi .env
# 填入正确的 WordPress 用户名密码和 API 密钥

# 构建镜像
docker build -t newsscraper:latest .

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs
```

## 4. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 检查日志
docker-compose logs -f

# 测试 Web 界面
curl http://localhost:3000

# 从外部访问
# 浏览器打开: http://192.168.1.230:3000
```

## 5. 常用管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新服务（重新构建）
docker-compose down
docker build -t newsscraper:latest .
docker-compose up -d

# 清理系统
docker system prune -f
```

## 6. 故障排除

### 容器无法启动
```bash
# 查看详细日志
docker-compose logs

# 检查配置文件
cat .env
cat docker-compose.yml

# 检查端口占用
netstat -tlnp | grep :3000
```

### WordPress 连接问题
```bash
# 测试 WordPress 连接
curl -I http://192.168.1.230:8080

# 检查配置
cat config/config.remote-230.json
```

### 权限问题
```bash
# 修复权限
chown -R root:root /opt/newsscraper
chmod -R 755 /opt/newsscraper
```
