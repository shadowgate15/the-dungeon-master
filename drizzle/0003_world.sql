CREATE TABLE `entity` (
	`handle` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`fields` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`merged_into` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "entity_type_check" CHECK(type IN ('npc', 'place', 'faction', 'topic'))
);
--> statement-breakpoint
CREATE TABLE `entity_alias` (
	`handle` text NOT NULL,
	`alias` text NOT NULL,
	PRIMARY KEY(`handle`, `alias`),
	FOREIGN KEY (`handle`) REFERENCES `entity`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`claim` text NOT NULL,
	`valid_from` integer,
	`valid_to` integer,
	`superseded_by` integer,
	`retired_at` integer,
	`retired_reason` text,
	`session_id` text,
	`event_id` integer,
	`recorded_minute` integer NOT NULL,
	FOREIGN KEY (`subject`) REFERENCES `entity`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fact_subject_idx` ON `fact` (`subject`);--> statement-breakpoint
CREATE TABLE `page_revision` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`handle` text NOT NULL,
	`text` text NOT NULL,
	`session_id` text,
	`event_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`handle`) REFERENCES `entity`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `page_revision_handle_idx` ON `page_revision` (`handle`);--> statement-breakpoint
CREATE TABLE `world_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_handle` text NOT NULL,
	`fact_id` integer,
	`to_handle` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_link_from_idx` ON `world_link` (`from_handle`);--> statement-breakpoint
CREATE INDEX `world_link_to_idx` ON `world_link` (`to_handle`);--> statement-breakpoint
CREATE VIRTUAL TABLE `world_search` USING fts5(`handle` UNINDEXED, `source` UNINDEXED, `text`, tokenize = 'porter unicode61');
