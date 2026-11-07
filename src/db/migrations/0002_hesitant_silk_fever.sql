CREATE TABLE `contribution_days` (
	`date` text PRIMARY KEY NOT NULL,
	`level` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`date` integer NOT NULL,
	`head_sha` text NOT NULL,
	`additions` integer NOT NULL,
	`deletions` integer NOT NULL,
	`window` text NOT NULL,
	PRIMARY KEY(`repo`, `number`)
);
--> statement-breakpoint
ALTER TABLE `notes` ADD `scene` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `notes` SET `scene` = `id` % 20;