PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`summary` text,
	`summarized_through_seq` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_session`("id", "campaign_id", "character_id", "started_at", "ended_at", "summary", "summarized_through_seq") SELECT "id", "campaign_id", "character_id", "started_at", "ended_at", "summary", "summarized_through_seq" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_one_open_per_campaign` ON `session` (`campaign_id`) WHERE ended_at IS NULL;