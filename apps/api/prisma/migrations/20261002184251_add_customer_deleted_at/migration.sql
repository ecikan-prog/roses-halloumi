-- Add deletedAt column to Customer table for soft-delete support
ALTER TABLE `Customer` ADD COLUMN `deletedAt` DATETIME(3);

-- Create index for efficient filtering of non-deleted customers
CREATE INDEX `Customer_deletedAt_idx` ON `Customer`(`deletedAt`);
