# 贡献指南

感谢您对隧道代理管理系统的关注！我们欢迎任何形式的贡献。

## 🤝 如何贡献

### 报告问题

如果您发现了bug或有功能建议：

1. 在 [Issues](../../issues) 中搜索是否已有类似问题
2. 如果没有，请创建新的Issue
3. 提供尽可能详细的信息：
   - 问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（Node.js版本、操作系统等）
   - 相关日志或截图

### 提交代码

1. **Fork项目**
   ```bash
   # 点击GitHub页面上的Fork按钮
   ```

2. **克隆您的Fork**
   ```bash
   git clone https://github.com/your-username/proxy-admin-system.git
   cd proxy-admin-system
   ```

3. **创建功能分支**
   ```bash
   git checkout -b feature/amazing-feature
   # 或者修复bug：
   git checkout -b fix/issue-description
   ```

4. **设置开发环境**
   ```bash
   # 安装依赖
   npm install
   
   # 复制环境变量文件
   cp .env.example .env
   
   # 配置数据库连接
   # 编辑.env文件
   ```

5. **进行更改**
   - 编写代码
   - 添加测试（如果适用）
   - 更新文档（如果需要）

6. **测试您的更改**
   ```bash
   # 运行应用
   npm run dev
   
   # 运行测试
   npm test
   
   # 检查是否有安全漏洞
   npm audit
   ```

7. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加令人惊叹的功能"
   ```

8. **推送到您的Fork**
   ```bash
   git push origin feature/amazing-feature
   ```

9. **创建Pull Request**
   - 访问GitHub上的原项目
   - 点击"New Pull Request"
   - 填写PR描述模板

## 📝 代码规范

### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<类型>[可选范围]: <描述>

[可选正文]

[可选脚注]
```

**类型：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式修改
- `refactor`: 重构
- `test`: 添加测试
- `chore`: 维护性工作

**示例：**
```
feat(ssl): 添加SSL证书自动续期功能
fix(auth): 修复JWT token过期问题
docs(api): 更新API接口文档
```

### 代码风格

- 使用2个空格缩进
- 使用单引号字符串
- 函数和变量使用驼峰命名
- 类使用帕斯卡命名
- 文件名使用小写，用短横线分隔
- 添加有意义的注释

### JavaScript规范

```javascript
// 好的示例
const serverConfig = {
  name: 'proxy-server',
  port: 3000,
  ssl: {
    enabled: true,
    certPath: '/path/to/cert'
  }
};

function createProxyServer(config) {
  // 添加详细注释说明复杂逻辑
  if (!config.port) {
    throw new Error('Port is required');
  }
  
  return new ProxyServer(config);
}
```

## 🏗️ 项目结构

了解项目结构有助于您更好地贡献：

```
prox/
├── server/          # 后端代码
│   ├── models/      # 数据模型
│   ├── routes/      # API路由
│   ├── middleware/  # 中间件
│   └── services/    # 业务逻辑
├── web/            # 前端代码
│   ├── src/        # 源代码
│   └── public/     # 静态文件
├── scripts/        # 数据库脚本
└── docs/          # 文档
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "SSL"

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 编写测试

为新功能添加测试：

```javascript
// tests/ssl.test.js
describe('SSL证书管理', () => {
  it('应该能够上传SSL证书', async () => {
    const response = await request(app)
      .post('/api/proxy/servers/1/ssl-upload')
      .attach('cert', 'test-cert.pem')
      .expect(200);
      
    expect(response.body.success).toBe(true);
  });
});
```

## 📋 Pull Request检查清单

在提交PR之前，请确保：

- [ ] 代码遵循项目规范
- [ ] 添加了适当的测试
- [ ] 测试全部通过
- [ ] 更新了相关文档
- [ ] 提交信息格式正确
- [ ] 没有引入新的安全漏洞
- [ ] 功能在不同浏览器中正常工作

## 🚀 开发工作流

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 监听文件变化并自动重启
nodemon server/app.js
```

### 数据库操作

```bash
# 重置数据库（开发环境）
npm run db:reset

# 运行数据库迁移
npm run db:migrate

# 填充测试数据
npm run db:seed
```

## 🐛 调试指南

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 验证.env文件中的数据库配置

2. **端口冲突**
   - 使用`lsof -i :3000`检查端口占用
   - 修改环境变量中的端口设置

3. **依赖安装失败**
   - 清除npm缓存：`npm cache clean --force`
   - 删除node_modules重新安装

### 调试技巧

```bash
# 启用调试模式
DEBUG=app:* npm run dev

# 查看详细日志
tail -f logs/app.log

# 检查进程状态
ps aux | grep node
```

## 🎯 开发路线图

我们正在开发的功能：

- [ ] SSL证书自动续期
- [ ] 负载均衡支持
- [ ] API限流防护
- [ ] 多语言支持
- [ ] 移动端优化
- [ ] 实时性能监控

如果您想参与这些功能的开发，请查看相关Issues或创建新的讨论。

## 📞 联系方式

如果您有任何问题：

- 创建Issue：[GitHub Issues](../../issues)
- 参与讨论：[GitHub Discussions](../../discussions)

再次感谢您的贡献！ 🎉 