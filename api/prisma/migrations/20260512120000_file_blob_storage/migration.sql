-- AlterTable
ALTER TABLE `files` MODIFY `path` VARCHAR(191) NULL,
ADD COLUMN `mime_type` VARCHAR(191) NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN `data` LONGBLOB NULL;
