-- 数据库升级脚本 v1.1.2
-- 更新 connection_logs 表结构以匹配程序实际使用的字段

USE proxy;

-- 检查当前表结构并备份数据
CREATE TABLE IF NOT EXISTS connection_logs_backup AS SELECT * FROM connection_logs;

-- 创建临时表用于数据迁移
DROP TABLE IF EXISTS connection_logs_new;
CREATE TABLE connection_logs_new (
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

-- 迁移现有数据
-- 如果username字段已存在，直接迁移
INSERT INTO connection_logs_new (username, client_ip, target_host, action, session_id, created_at)
SELECT 
  COALESCE(username, 'unknown') as username,
  COALESCE(client_ip, '0.0.0.0') as client_ip,
  COALESCE(target_host, 'unknown') as target_host,
  COALESCE(action, 
    CASE 
      WHEN status = 'success' THEN 'connect'
      WHEN status = 'failed' THEN 'error'
      ELSE 'connect'
    END) as action,
  session_id,
  created_at
FROM connection_logs;

-- 替换旧表
DROP TABLE connection_logs;
RENAME TABLE connection_logs_new TO connection_logs;

-- 显示升级结果
SELECT 
  COUNT(*) as migrated_records,
  'connection_logs 表结构升级完成，数据已迁移' as message
FROM connection_logs; 