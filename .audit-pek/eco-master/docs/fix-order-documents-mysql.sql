-- Hotfix: MySQL row size limit on order_documents
-- Run on server before restarting eco-app:
--   docker exec -i eco-mysql mysql -ueco -pecopass eco < fix-order-documents-mysql.sql

-- Add missing columns as TEXT (safe if already exist — ignore duplicate column error)
ALTER TABLE order_documents ADD COLUMN staff_comment TEXT NULL;
ALTER TABLE order_documents ADD COLUMN client_comment TEXT NULL;

-- Shrink row size: convert large VARCHAR columns to TEXT/LONGTEXT
ALTER TABLE order_documents MODIFY file_url TEXT;
ALTER TABLE order_documents MODIFY staff_comment TEXT;
ALTER TABLE order_documents MODIFY client_comment TEXT;
ALTER TABLE order_documents MODIFY signed_cms LONGTEXT;

-- contracts table (same issue with signed CMS data)
ALTER TABLE contracts MODIFY signed_cms LONGTEXT;
