# 🚀 隧道代理管理系统

一个基于Web的隧道代理管理系统，提供完整的后台管理界面来管理代理用户、服务器配置、SSL证书和连接监控。

![](https://img.shields.io/badge/Node.js-18+-green)
![](https://img.shields.io/badge/MySQL-8.0+-blue)
![](https://img.shields.io/badge/Vue.js-3-brightgreen)
![](https://img.shields.io/badge/License-MIT-yellow)

## ✨ 主要特色

- 🔐 **一体化SSL管理** - 直接在服务器配置中上传和管理SSL证书
- 🖥️ **实时服务器监控** - 自动状态检测和进程管理
- 👥 **完善的用户系统** - 多角色权限管理和用户状态控制
- 📊 **数据可视化** - 实时统计和连接日志分析
- 🛡️ **安全防护** - JWT认证、文件验证、进程隔离
- 🤖 **零配置启动** - 自动数据库初始化，无需手动配置

## 🛠️ 技术栈

### 后端
- **Node.js** 18+ & **Express** 4.18.2
- **MySQL** 8.0 & **Sequelize** ORM
- **JWT** 认证 & **Bcrypt** 加密
- **PM2** 进程管理

### 前端
- **Vue.js** 3 & **Element Plus** UI
- **Axios** HTTP客户端
- 响应式设计，CDN引入方式

## 🚀 快速开始

### 1. 环境准备

```bash
# 确保已安装以下软件
Node.js 18+
MySQL 8.0
Git
```

### 2. 安装项目

```bash
# 克隆项目
git clone https://github.com/your-username/proxy-admin-system.git
cd proxy-admin-system

# 安装依赖
npm install
```

### 3. 数据库配置

在MySQL中创建数据库用户：
```sql
CREATE USER 'proxy'@'localhost' IDENTIFIED BY '12345';
GRANT ALL PRIVILEGES ON *.* TO 'proxy'@'localhost';
FLUSH PRIVILEGES;
```

### 4. 环境配置

复制并配置环境文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=proxy
DB_USER=proxy
DB_PASSWORD=12345

# JWT配置
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# PM2部署（推荐）
npm install -g pm2
pm2 start server/app.js --name proxy-admin
```

程序启动时会自动：
- 🔍 检查数据库连接
- 📦 自动创建数据库（如果不存在）
- 📋 自动创建表结构
- 👤 创建默认管理员账号

访问 http://localhost:3000 开始使用！

## 🔐 默认账号

### 管理员账号
- 用户名: `admin`
- 密码: `admin123`

### 测试代理用户
- 用户名: `test_user` / 密码: `admin123`
- 用户名: `demo_user` / 密码: `admin123`

## 📱 主要功能

### 🖥️ 服务器管理
- ✅ 完整的CRUD操作（创建、编辑、删除、查看）
- ✅ 多服务器配置支持
- ✅ 灵活的端口和域名配置
- ✅ SSL启用/禁用控制
- ✅ 服务器状态实时监控
- ✅ 启动/停止控制

### 🔐 SSL证书管理
- ✅ **一体化管理** - SSL证书直接集成到服务器配置中
- ✅ **多格式支持** - 支持.pem、.crt、.cer、.key、.txt等格式
- ✅ **可视化上传** - 拖拽上传界面
- ✅ **实时状态显示** - 证书状态一目了然
- ✅ **安全控制** - 运行中的服务器禁止SSL操作

### 👥 用户管理
- ✅ 代理用户增删改查
- ✅ 批量用户操作
- ✅ 用户状态管理
- ✅ 分页和搜索

### 📊 监控统计
- ✅ 实时用户统计
- ✅ 连接日志查询
- ✅ 系统监控面板
- ✅ 使用量分析

## 📁 项目结构

```
prox/
├── server/                    # 后端代码
│   ├── app.js                # 主应用程序
│   ├── models/               # 数据模型
│   ├── routes/               # API路由（模块化架构）
│   ├── middleware/           # 中间件
│   ├── config/               # 配置文件
│   ├── services/             # 业务服务
│   ├── proxy/                # 代理核心功能
│   └── utils/                # 工具函数
├── web/                      # 前端代码
│   ├── public/               # 静态文件
│   └── src/                  # 源代码（模块化）
├── scripts/                  # 数据库脚本
├── ssl/                      # SSL证书目录
├── logs/                     # 日志目录
└── uploads/                  # 上传文件目录
```

## 🔧 API接口

### 认证接口
```http
POST /api/auth/login          # 用户登录
GET  /api/auth/me             # 获取用户信息
```

### 服务器管理
```http
GET    /api/proxy/servers     # 获取服务器列表
POST   /api/proxy/servers     # 创建服务器
PUT    /api/proxy/servers/:id # 更新服务器
DELETE /api/proxy/servers/:id # 删除服务器
POST   /api/proxy/servers/:id/start # 启动服务器
POST   /api/proxy/servers/:id/stop  # 停止服务器
```

### SSL证书管理
```http
POST   /api/proxy/servers/:id/ssl-upload # 上传SSL证书
DELETE /api/proxy/servers/:id/ssl        # 删除SSL证书
```

## 🚀 部署指南

### 生产环境部署

```bash
# 使用PM2部署
npm install -g pm2
pm2 start server/app.js --name proxy-admin

# 设置开机自启
pm2 startup
pm2 save

# 使用Nginx反向代理（可选）
# 配置Nginx将请求转发到http://localhost:3000
```

### Docker部署

```bash
# 构建镜像
docker build -t proxy-admin .

# 运行容器
docker run -d -p 3000:3000 \
  -e DB_HOST=your_mysql_host \
  -e DB_PASSWORD=your_password \
  --name proxy-admin \
  proxy-admin
```

## 🛡️ 安全建议

1. **修改默认密码** - 首次部署后立即修改默认管理员密码
2. **JWT密钥** - 使用强随机JWT密钥
3. **数据库安全** - 使用强密码，限制网络访问
4. **HTTPS** - 生产环境使用HTTPS协议
5. **防火墙** - 配置适当的防火墙规则

## 🔍 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务状态
   - 验证连接参数
   - 确认防火墙设置

2. **端口占用**
   - 使用 `lsof -i :3000` 检查端口
   - 修改PORT环境变量
   - 重启相关服务

3. **登录密码错误**
   - 运行密码修复工具：`node fix-password.js`
   - 确认使用默认账号：admin / admin123

4. **SSL证书问题**
   - 检查证书文件格式
   - 确保服务器已停止再进行SSL操作
   - 检查ssl目录权限

## 📊 更新日志

### v1.2.0 - SSL集成版本
- 🆕 SSL证书一体化管理
- 🆕 可视化证书上传
- 🆕 数据库自动初始化
- 🔧 增强安全控制

### v1.1.2
- 🔧 修复进程残留问题
- 🔧 增强端口占用处理

### v1.1.0
- ✅ 完整的服务器管理功能
- ✅ 智能域名解析
- ✅ 进程安全管理

[查看完整更新日志](./项目说明文档.md#更新日志)

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 发起 Pull Request

## 📄 许可证

本项目使用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 [Issue](../../issues)
- 发起 [Discussion](../../discussions)

---

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！** 