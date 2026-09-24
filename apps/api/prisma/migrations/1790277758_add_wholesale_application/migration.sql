-- CreateTable WholesaleApplication
CREATE TABLE `WholesaleApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessName` VARCHAR(191) NOT NULL,
    `businessType` VARCHAR(191) NOT NULL,
    `nzbn` VARCHAR(191),
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191),
    `deliveryAddress` TEXT NOT NULL,
    `estimatedVolume` VARCHAR(191),
    `productsOfInterest` VARCHAR(191),
    `message` TEXT,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `customerId` INTEGER,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WholesaleApplication_email_idx`(`email`),
    INDEX `WholesaleApplication_status_idx`(`status`),
    INDEX `WholesaleApplication_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WholesaleApplication` ADD CONSTRAINT `WholesaleApplication_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
