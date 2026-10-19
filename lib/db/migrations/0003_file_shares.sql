CREATE TABLE `file_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`password_hash` text,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`last_download_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_shares_token_unique` ON `file_shares` (`token`);