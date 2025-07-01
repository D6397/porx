// 数据库自动初始化工具
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

class DatabaseInitializer {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'proxy',
      password: process.env.DB_PASSWORD || '12345',
      database: process.env.DB_NAME || 'proxy'
    };
  }

  // 检查数据库连接
  async checkConnection() {
    try {
      const connection = await mysql.createConnection({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        user: this.dbConfig.user,
        password: this.dbConfig.password
      });
      await connection.end();
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      return false;
    }
  }

  // 检查数据库是否存在
  async checkDatabaseExists() {
    try {
      const connection = await mysql.createConnection({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        user: this.dbConfig.user,
        password: this.dbConfig.password
      });

      const [rows] = await connection.execute(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [this.dbConfig.database]
      );

      await connection.end();
      return rows.length > 0;
    } catch (error) {
      console.error('检查数据库存在性失败:', error.message);
      return false;
    }
  }

  // 检查表是否存在且结构正确
  async checkTablesExist() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      // 检查必要的表
      const requiredTables = ['admin_users', 'proxy_users', 'proxy_servers', 'connection_logs'];
      const existingTables = [];

      for (const table of requiredTables) {
        const [rows] = await connection.execute(
          'SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [this.dbConfig.database, table]
        );

        if (rows[0].count > 0) {
          existingTables.push(table);
        }
      }

      // 检查proxy_servers表是否有SSL字段（判断是否为v1.2.0结构）
      let hasSSLFields = false;
      if (existingTables.includes('proxy_servers')) {
        const [columns] = await connection.execute(
          'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = "proxy_servers" AND COLUMN_NAME = "cert_file_name"',
          [this.dbConfig.database]
        );
        hasSSLFields = columns.length > 0;
      }

      await connection.end();

      return {
        allTablesExist: existingTables.length === requiredTables.length,
        existingTables,
        missingTables: requiredTables.filter(table => !existingTables.includes(table)),
        hasSSLFields,
        needsUpgrade: existingTables.length === requiredTables.length && !hasSSLFields
      };
    } catch (error) {
      console.error('检查表结构失败:', error.message);
      return { allTablesExist: false, existingTables: [], missingTables: [], hasSSLFields: false, needsUpgrade: false };
    }
  }

  // 创建数据库
  async createDatabase() {
    try {
      const connection = await mysql.createConnection({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        user: this.dbConfig.user,
        password: this.dbConfig.password
      });

      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await connection.end();

      console.log(`✅ 数据库 "${this.dbConfig.database}" 创建成功`);
      return true;
    } catch (error) {
      console.error('创建数据库失败:', error.message);
      return false;
    }
  }

  // 创建表结构
  async createTables() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      // 管理员用户表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id int PRIMARY KEY AUTO_INCREMENT,
          username varchar(50) UNIQUE NOT NULL,
          password varchar(255) NOT NULL,
          role enum('admin', 'viewer') DEFAULT 'admin',
          status enum('active', 'inactive') DEFAULT 'active',
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) COMMENT = '管理员用户表'
      `);

      // 代理用户表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS proxy_users (
          id int PRIMARY KEY AUTO_INCREMENT,
          username varchar(50) UNIQUE NOT NULL,
          password varchar(255) NOT NULL,
          status enum('active', 'inactive') DEFAULT 'active',
          max_connections int DEFAULT 10,
          expire_date datetime,
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) COMMENT = '代理用户表'
      `);

      // 代理服务器表（含SSL证书管理）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS proxy_servers (
          id int PRIMARY KEY AUTO_INCREMENT,
          name varchar(100) NOT NULL,
          http_port int NOT NULL,
          https_port int,
          domain varchar(255),
          ssl_enabled boolean DEFAULT false,
          status enum('running', 'stopped') DEFAULT 'stopped',
          cert_file_name varchar(255) DEFAULT NULL COMMENT 'SSL证书文件名',
          key_file_name varchar(255) DEFAULT NULL COMMENT 'SSL私钥文件名',
          cert_path varchar(500) DEFAULT NULL COMMENT 'SSL证书文件路径',
          key_path varchar(500) DEFAULT NULL COMMENT 'SSL私钥文件路径',
          cert_expire_date datetime DEFAULT NULL COMMENT 'SSL证书过期时间',
          cert_uploaded_at timestamp DEFAULT NULL COMMENT 'SSL证书上传时间',
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_cert_expire (cert_expire_date),
          INDEX idx_ssl_enabled (ssl_enabled),
          INDEX idx_status (status)
        ) COMMENT = '代理服务器配置表（含SSL证书管理）'
      `);

      // 连接日志表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS connection_logs (
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
        ) COMMENT = '连接日志表'
      `);

      await connection.end();
      console.log('✅ 数据库表结构创建成功');
      return true;
    } catch (error) {
      console.error('创建表结构失败:', error.message);
      return false;
    }
  }

  // 插入初始数据
  async insertInitialData() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      // 检查是否已有管理员用户
      const [adminUsers] = await connection.execute('SELECT COUNT(*) as count FROM admin_users');
      if (adminUsers[0].count === 0) {
        // 动态生成密码哈希（密码：admin123）
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        await connection.execute(
          'INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)',
          ['admin', adminPasswordHash, 'admin']
        );
        console.log('✅ 默认管理员账号创建成功 (admin/admin123)');
      }

      // 检查是否已有测试用户
      const [proxyUsers] = await connection.execute('SELECT COUNT(*) as count FROM proxy_users');
      if (proxyUsers[0].count === 0) {
        // 动态生成密码哈希（密码：admin123）
        const proxyPasswordHash = await bcrypt.hash('admin123', 10);
        await connection.execute(`
          INSERT INTO proxy_users (username, password, max_connections) VALUES 
          ('test_user', ?, 10),
          ('demo_user', ?, 5)
        `, [proxyPasswordHash, proxyPasswordHash]);
        console.log('✅ 测试代理用户创建成功 (test_user, demo_user)');
      }

      // 检查是否已有默认服务器
      const [servers] = await connection.execute('SELECT COUNT(*) as count FROM proxy_servers');
      if (servers[0].count === 0) {
        // 插入默认代理服务器配置
        await connection.execute(
          'INSERT INTO proxy_servers (name, http_port, https_port, domain, ssl_enabled) VALUES (?, ?, ?, ?, ?)',
          ['默认代理服务器', 8082, 8083, 'localhost', false]
        );
        console.log('✅ 默认代理服务器配置创建成功');
      }

      await connection.end();
      return true;
    } catch (error) {
      console.error('插入初始数据失败:', error.message);
      return false;
    }
  }

  // 升级数据库结构（添加SSL字段）
  async upgradeToSSL() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      console.log('🔄 升级数据库到v1.2.0 (SSL集成版本)...');

      // 添加SSL证书相关字段
      const alterQueries = [
        'ALTER TABLE proxy_servers ADD COLUMN cert_file_name varchar(255) DEFAULT NULL COMMENT "SSL证书文件名"',
        'ALTER TABLE proxy_servers ADD COLUMN key_file_name varchar(255) DEFAULT NULL COMMENT "SSL私钥文件名"',
        'ALTER TABLE proxy_servers ADD COLUMN cert_path varchar(500) DEFAULT NULL COMMENT "SSL证书文件路径"',
        'ALTER TABLE proxy_servers ADD COLUMN key_path varchar(500) DEFAULT NULL COMMENT "SSL私钥文件路径"',
        'ALTER TABLE proxy_servers ADD COLUMN cert_expire_date datetime DEFAULT NULL COMMENT "SSL证书过期时间"',
        'ALTER TABLE proxy_servers ADD COLUMN cert_uploaded_at timestamp DEFAULT NULL COMMENT "SSL证书上传时间"'
      ];

      for (const query of alterQueries) {
        try {
          await connection.execute(query);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            // 字段已存在，跳过
            continue;
          } else {
            throw error;
          }
        }
      }

      // 创建索引
      const indexQueries = [
        'CREATE INDEX idx_cert_expire ON proxy_servers(cert_expire_date)',
        'CREATE INDEX idx_ssl_enabled ON proxy_servers(ssl_enabled)'
      ];

      for (const query of indexQueries) {
        try {
          await connection.execute(query);
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            // 索引已存在，跳过
            continue;
          } else {
            throw error;
          }
        }
      }

      // 更新表注释
      await connection.execute('ALTER TABLE proxy_servers COMMENT = "代理服务器配置表（含SSL证书管理）"');

      await connection.end();
      console.log('✅ 数据库升级到v1.2.0完成');
      return true;
    } catch (error) {
      console.error('数据库升级失败:', error.message);
      return false;
    }
  }

  // 完整的自动初始化流程
  async autoInit() {
    console.log('🔄 开始数据库自动初始化检查...');

    // 1. 检查数据库连接
    if (!(await this.checkConnection())) {
      console.error('❌ 数据库连接失败，请检查数据库配置');
      return false;
    }

    // 2. 检查数据库是否存在
    if (!(await this.checkDatabaseExists())) {
      console.log('📦 数据库不存在，正在创建...');
      if (!(await this.createDatabase())) {
        return false;
      }
    }

    // 3. 检查表结构
    const tableStatus = await this.checkTablesExist();
    
    if (!tableStatus.allTablesExist) {
      console.log('📋 数据库表不完整，正在创建...');
      console.log(`缺少表: ${tableStatus.missingTables.join(', ')}`);
      
      if (!(await this.createTables())) {
        return false;
      }

      // 插入初始数据
      if (!(await this.insertInitialData())) {
        return false;
      }
    } else if (tableStatus.needsUpgrade) {
      console.log('🔄 检测到旧版本数据库结构，正在升级...');
      if (!(await this.upgradeToSSL())) {
        return false;
      }
    } else {
      console.log('✅ 数据库结构正常');
    }

    console.log('🎉 数据库初始化完成！');
    console.log('📝 默认账号信息:');
    console.log('   管理员: admin / admin123');
    console.log('   测试用户: test_user / admin123');
    console.log('   测试用户: demo_user / admin123');
    
    return true;
  }
}

module.exports = DatabaseInitializer; 