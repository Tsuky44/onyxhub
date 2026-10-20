ALTER TABLE `media_requests` ADD `requester_id` integer;--> statement-breakpoint
CREATE INDEX `media_requests_requester_id_idx` ON `media_requests` (`requester_id`);