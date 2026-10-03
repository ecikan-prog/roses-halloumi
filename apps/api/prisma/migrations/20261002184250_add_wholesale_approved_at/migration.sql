-- Add wholesaleApprovedAt column to Customer table (idempotent)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Customer' 
   AND COLUMN_NAME = 'wholesaleApprovedAt') = 0,
  'ALTER TABLE `Customer` ADD COLUMN `wholesaleApprovedAt` DATETIME(3)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
