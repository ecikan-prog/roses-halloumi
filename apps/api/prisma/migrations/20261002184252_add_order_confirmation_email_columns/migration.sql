-- Add confirmationEmailClaimedAt and confirmationEmailSentAt columns to Order table (idempotent)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Order' 
   AND COLUMN_NAME = 'confirmationEmailClaimedAt') = 0,
  'ALTER TABLE `Order` ADD COLUMN `confirmationEmailClaimedAt` DATETIME(3)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Order' 
   AND COLUMN_NAME = 'confirmationEmailSentAt') = 0,
  'ALTER TABLE `Order` ADD COLUMN `confirmationEmailSentAt` DATETIME(3)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for efficient email tracking queries (idempotent)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Order' 
   AND INDEX_NAME = 'Order_confirmationEmailClaimedAt_idx') = 0,
  'CREATE INDEX `Order_confirmationEmailClaimedAt_idx` ON `Order`(`confirmationEmailClaimedAt`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'Order' 
   AND INDEX_NAME = 'Order_confirmationEmailSentAt_idx') = 0,
  'CREATE INDEX `Order_confirmationEmailSentAt_idx` ON `Order`(`confirmationEmailSentAt`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
