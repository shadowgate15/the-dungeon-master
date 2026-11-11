CREATE TABLE `campaign_character` (
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `character_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_one_open_per_campaign` ON `session` (`campaign_id`) WHERE ended_at IS NULL;--> statement-breakpoint
CREATE TABLE `turn` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`author` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`roll_request` text,
	`roll_result` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "turn_author_check" CHECK(author IS NULL OR author IN ('dm', 'player')),
	CONSTRAINT "turn_kind_check" CHECK(kind IS NULL OR kind IN ('narration', 'action', 'roll_result'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turn_session_seq` ON `turn` (`session_id`,`seq`);