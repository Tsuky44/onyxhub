CREATE TABLE `media_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_type` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`season_number` integer,
	`tvdb_id` integer,
	`title` text NOT NULL,
	`poster_path` text,
	`status` text NOT NULL,
	`requester` text NOT NULL,
	`batch_id` text NOT NULL,
	`requested_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_requests_media_idx` ON `media_requests` (`media_type`,`tmdb_id`);--> statement-breakpoint
CREATE INDEX `media_requests_tvdb_idx` ON `media_requests` (`tvdb_id`);--> statement-breakpoint
CREATE INDEX `media_requests_status_idx` ON `media_requests` (`status`);--> statement-breakpoint
CREATE INDEX `media_requests_requester_idx` ON `media_requests` (`requester`);--> statement-breakpoint
CREATE INDEX `media_requests_batch_idx` ON `media_requests` (`batch_id`);--> statement-breakpoint
CREATE INDEX `media_requests_requested_idx` ON `media_requests` (`requested_at`);--> statement-breakpoint
CREATE TABLE `watch_later` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_later_user_media_unique` ON `watch_later` (`user_id`,`media_type`,`tmdb_id`);