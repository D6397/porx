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
);

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
);

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
  INDEX idx_ssl_enabled (ssl_enabled)
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
);

-- 插入默认管理员账号（密码：admin123）
INSERT INTO admin_users (username, password, role) VALUES 
('admin', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 'admin');

-- 插入测试代理用户（密码：admin123）
INSERT INTO proxy_users (username, password, max_connections) VALUES 
('test_user', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 10),
('demo_user', '$2b$10$rQ8QWVgwKpCZqw.dJj7V8eG.ZJ9wKq1XKXqGHk4Vs9c0cNz0c9V8G', 5);

-- 插入默认代理服务器配置
INSERT INTO proxy_servers (name, http_port, https_port, domain) VALUES 
('默认代理服务器', 8082, 8083, 'pox.aipor.cc');

-- 数据库初始化完成
SELECT '✅ 数据库初始化完成！' as message;
SELECT '📝 包含功能: 用户管理、服务器管理、SSL证书管理、连接日志' as features;
SELECT '🔑 默认管理员账号: admin / admin123' as admin_info;
SELECT '👥 测试用户: test_user, demo_user (密码: admin123)' as test_users;
SELECT '🔄 版本: v1.2.0 (SSL集成版本)' as version;