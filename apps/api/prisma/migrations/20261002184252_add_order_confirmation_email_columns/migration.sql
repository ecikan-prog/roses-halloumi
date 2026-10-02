-- Add confirmationEmailClaimedAt and confirmationEmailSentAt columns to Order table
ALTER TABLE `Order` ADD COLUMN `confirmationEmailClaimedAt` DATETIME(3);
ALTER TABLE `Order` ADD COLUMN `confirmationEmailSentAt` DATETIME(3);

-- Create index for efficient email tracking queries
CREATE INDEX `Order_confirmationEmailClaimedAt_idx` ON `Order`(`confirmationEmailClaimedAt`);
CREATE INDEX `Order_confirmationEmailSentAt_idx` ON `Order`(`confirmationEmailSentAt`);
