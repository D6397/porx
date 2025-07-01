-- SSL集成升级脚本 - 将SSL证书管理直接集成到代理服务器表
-- 执行前请备份数据库

USE proxy;

-- 为proxy_servers表添加SSL证书相关字段
ALTER TABLE proxy_servers 
ADD COLUMN cert_file_name varchar(255) DEFAULT NULL COMMENT 'SSL证书文件名',
ADD COLUMN key_file_name varchar(255) DEFAULT NULL COMMENT 'SSL私钥文件名',
ADD COLUMN cert_path varchar(500) DEFAULT NULL COMMENT 'SSL证书文件路径',
ADD COLUMN key_path varchar(500) DEFAULT NULL COMMENT 'SSL私钥文件路径',
ADD COLUMN cert_expire_date datetime DEFAULT NULL COMMENT 'SSL证书过期时间',
ADD COLUMN cert_uploaded_at timestamp DEFAULT NULL COMMENT 'SSL证书上传时间';

-- 创建索引提高查询性能
CREATE INDEX idx_cert_expire ON proxy_servers(cert_expire_date);
CREATE INDEX idx_ssl_enabled ON proxy_servers(ssl_enabled);

-- 更新表注释
ALTER TABLE proxy_servers COMMENT = '代理服务器配置表（含SSL证书管理）';

-- 输出升级完成信息
SELECT 'SSL集成升级完成！proxy_servers表已添加SSL证书字段' as message; 