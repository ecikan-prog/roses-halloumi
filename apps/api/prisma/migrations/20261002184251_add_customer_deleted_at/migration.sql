-- Add deletedAt column to Customer table for soft-delete support (idempotent)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Customer' 
   AND COLUMN_NAME = 'deletedAt') = 0,
  'ALTER TABLE `Customer` ADD COLUMN `deletedAt` DATETIME(3)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for efficient filtering of non-deleted customers (idempotent)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Customer' 
   AND INDEX_NAME = 'Customer_deletedAt_idx') = 0,
  'CREATE INDEX `Customer_deletedAt_idx` ON `Customer`(`deletedAt`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
