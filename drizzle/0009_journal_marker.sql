CREATE TABLE `journal_marker` (
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `character_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
