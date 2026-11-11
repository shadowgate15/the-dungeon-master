ALTER TABLE `session` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `session` ADD `summarized_through_seq` integer DEFAULT 0 NOT NULL;