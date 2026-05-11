-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `provider` BOOLEAN NOT NULL DEFAULT false,
    `avatar_id` INTEGER NULL,
    `registered_by_provider_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `client_accounts_client_id_key`(`client_id`),
    UNIQUE INDEX `client_accounts_user_id_key`(`user_id`),
    INDEX `client_accounts_client_id_idx`(`client_id`),
    INDEX `client_accounts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `client_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `provider_clients_provider_id_idx`(`provider_id`),
    INDEX `provider_clients_client_id_idx`(`client_id`),
    UNIQUE INDEX `provider_clients_provider_id_client_id_key`(`provider_id`, `client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `files_path_key`(`path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `is_evaluation` BOOLEAN NOT NULL DEFAULT false,
    `requires_prior_evaluation` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_services_provider_id_idx`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_weekly_hours` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `weekday` INTEGER NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_weekly_hours_provider_id_weekday_idx`(`provider_id`, `weekday`),
    UNIQUE INDEX `provider_weekly_hours_provider_id_weekday_time_key`(`provider_id`, `weekday`, `time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_date_overrides` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `date_ymd` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_date_overrides_provider_id_date_ymd_idx`(`provider_id`, `date_ymd`),
    UNIQUE INDEX `provider_date_overrides_provider_id_date_ymd_time_key`(`provider_id`, `date_ymd`, `time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
    `status_updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` INTEGER NULL,
    `client_id` INTEGER NULL,
    `provider_id` INTEGER NULL,
    `guest_name` VARCHAR(191) NULL,
    `guest_phone` VARCHAR(191) NULL,
    `duration_minutes` INTEGER NULL,
    `provider_service_id` INTEGER NULL,
    `canceled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `appointments_provider_id_date_idx`(`provider_id`, `date`),
    INDEX `appointments_client_id_date_idx`(`client_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_claim_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token_hash` VARCHAR(191) NOT NULL,
    `client_id` INTEGER NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `client_claim_tokens_token_hash_key`(`token_hash`),
    INDEX `client_claim_tokens_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_client_clearances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER NOT NULL,
    `phone_normalized` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source_appointment_id` INTEGER NULL,

    INDEX `provider_client_clearances_provider_id_user_id_idx`(`provider_id`, `user_id`),
    UNIQUE INDEX `provider_client_clearances_provider_id_phone_normalized_key`(`provider_id`, `phone_normalized`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appointment_id` INTEGER NOT NULL,
    `notes` TEXT NOT NULL,
    `summary` TEXT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recorded_by_provider_id` INTEGER NULL,

    UNIQUE INDEX `appointment_records_appointment_id_key`(`appointment_id`),
    INDEX `appointment_records_recorded_by_provider_id_idx`(`recorded_by_provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_record_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `record_id` INTEGER NOT NULL,
    `file_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `caption` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `appointment_record_photos_record_id_idx`(`record_id`),
    INDEX `appointment_record_photos_file_id_idx`(`file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `user_id` INTEGER NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_key` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 5,
    `run_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_error` TEXT NULL,
    `locked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `jobs_status_run_at_idx`(`status`, `run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_avatar_id_fkey` FOREIGN KEY (`avatar_id`) REFERENCES `files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_registered_by_provider_id_fkey` FOREIGN KEY (`registered_by_provider_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_accounts` ADD CONSTRAINT `client_accounts_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_accounts` ADD CONSTRAINT `client_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_clients` ADD CONSTRAINT `provider_clients_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_clients` ADD CONSTRAINT `provider_clients_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_services` ADD CONSTRAINT `provider_services_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_weekly_hours` ADD CONSTRAINT `provider_weekly_hours_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_date_overrides` ADD CONSTRAINT `provider_date_overrides_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_provider_service_id_fkey` FOREIGN KEY (`provider_service_id`) REFERENCES `provider_services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_claim_tokens` ADD CONSTRAINT `client_claim_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_client_clearances` ADD CONSTRAINT `provider_client_clearances_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_client_clearances` ADD CONSTRAINT `provider_client_clearances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_client_clearances` ADD CONSTRAINT `provider_client_clearances_source_appointment_id_fkey` FOREIGN KEY (`source_appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_records` ADD CONSTRAINT `appointment_records_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_records` ADD CONSTRAINT `appointment_records_recorded_by_provider_id_fkey` FOREIGN KEY (`recorded_by_provider_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_record_photos` ADD CONSTRAINT `appointment_record_photos_record_id_fkey` FOREIGN KEY (`record_id`) REFERENCES `appointment_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_record_photos` ADD CONSTRAINT `appointment_record_photos_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

