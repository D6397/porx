-- 隧道代理管理系统 - 数据库初始化脚本
-- 版本: v1.2.0 (SSL集成版本)
-- 创建时间: 2024年12月
-- 
-- 此脚本包含完整的数据库结构，支持：
-- - 用户管理 (管理员和代理用户)
-- - 服务器管理 (完整CRUD操作)
-- - SSL证书管理 (一体化集成)
-- - 连接日志 (实时监控)

-- 创建数据库
CREATE DATABASE IF NOT EXISTS proxy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE proxy;

-- 管理员用户表
CREATE TABLE admin_users (
  id int PRIMARY KEY AUTO_INCREMENT,
  username varchar(50) UNIQUE NOT NULL,
  password varchar(255) NOT NULL,
  role enum('admin', 'viewer') DEFAULT 'admin',
  status enum('active', 'inactive') DEFAULT 'active',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT = '管理员用户表';

-- 代理用户表
CREATE TABLE proxy_users (
  id int PRIMARY KEY AUTO_INCREMENT,
  username varchar(50) UNIQUE NOT NULL,
  password varchar(255) NOT NULL,
  status enum('active', 'inactive') DEFAULT 'active',
  max_connections int DEFAULT 10,
  expire_date datetime,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT = '代理用户表';

-- 代理服务器表（含SSL证书管理）
CREATE TABLE proxy_servers (
  id int PRIMARY KEY AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  http_port int NOT NULL,
  https_port int,
  domain varchar(255),
  ssl_enabled boolean DEFAULT false,
  status enum('running', 'stopped') DEFAULT 'stopped',
  -- SSL证书管理字段 (v1.2.0新增)
  cert_file_name varchar(255) DEFAULT NULL COMMENT 'SSL证书文件名',
  key_file_name varchar(255) DEFAULT NULL COMMENT 'SSL私钥文件名',
  cert_path varchar(500) DEFAULT NULL COMMENT 'SSL证书文件路径',
  key_path varchar(500) DEFAULT NULL COMMENT 'SSL私钥文件路径',
  cert_expire_date datetime DEFAULT NULL COMMENT 'SSL证书过期时间',
  cert_uploaded_at timestamp DEFAULT NULL COMMENT 'SSL证书上传时间',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 索引
  INDEX idx_cert_expire (cert_expire_date),
  INDEX idx_ssl_enabled (ssl_enabled),
  INDEX idx_status (status)
) COMMENT = '代理服务器配置表（含SSL证书管理）';

-- 连接日志表
CREATE TABLE connection_logs (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  username varchar(50) NOT NULL,
  client_ip varchar(45) NOT NULL,
  target_host varchar(255) NOT NULL,
  action varchar(50) DEFAULT 'connect',
  session_id varchar(100),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action),
  INDEX idx_session_id (session_id)
) COMMENT = '连接日志表';

-- 插入默认管理员账号（密码：admin123）
INSERT INTO admin_users (username, password, role) VALUES 
('admin', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 'admin');

-- 插入测试代理用户（密码：admin123）
INSERT INTO proxy_users (username, password, max_connections) VALUES 
('test_user', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 10),
('demo_user', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 5);

-- 插入默认代理服务器配置
INSERT INTO proxy_servers (name, http_port, https_port, domain, ssl_enabled) VALUES 
('默认代理服务器', 8082, 8083, 'pox.aipor.cc', false);

-- 数据库初始化完成信息
SELECT '🎉==================================' as '';
SELECT '✅ 隧道代理管理系统数据库初始化完成！' as message;
SELECT '📂 数据库名称: proxy' as database_name;
SELECT '🔄 版本: v1.2.0 (SSL集成版本)' as version;
SELECT '' as '';
SELECT '📝 功能特性:' as '';
SELECT '  • 管理员用户管理 (admin_users)' as feature1;
SELECT '  • 代理用户管理 (proxy_users)' as feature2;
SELECT '  • 服务器管理 (proxy_servers)' as feature3;
SELECT '  • SSL证书一体化管理' as feature4;
SELECT '  • 连接日志监控 (connection_logs)' as feature5;
SELECT '' as '';
SELECT '🔑 默认账号信息:' as '';
SELECT '  管理员: admin / admin123' as admin_account;
SELECT '  测试用户: test_user / admin123' as test_user1;
SELECT '  测试用户: demo_user / admin123' as test_user2;
SELECT '' as '';
SELECT '🖥️  默认服务器配置:' as '';
SELECT '  名称: 默认代理服务器' as server_name;
SELECT '  HTTP端口: 8082' as http_port;
SELECT '  HTTPS端口: 8083' as https_port;
SELECT '  域名: pox.aipor.cc' as domain;
SELECT '' as '';
SELECT '🚀 下一步操作:' as '';
SELECT '  1. 启动服务器: npm start 或 npm run dev' as step1;
SELECT '  2. 访问管理界面: http://localhost:3000' as step2;
SELECT '  3. 使用admin/admin123登录' as step3;
SELECT '  4. 在服务器管理中上传SSL证书' as step4;
SELECT '🎉==================================' as ''; 