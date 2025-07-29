ALTER TABLE `notes` ADD `x_percent` real NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `y_percent` real NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` DROP COLUMN `x`;--> statement-breakpoint
ALTER TABLE `notes` DROP COLUMN `y`;