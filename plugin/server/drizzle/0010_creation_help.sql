CREATE TABLE `conversation_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author` text NOT NULL,
	`player` text,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campaign` ADD `dm_seed_fields` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign` ADD `begun_at` integer;--> statement-breakpoint
ALTER TABLE `character_draft` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `character_draft` ADD `dm_fields` text DEFAULT '[]' NOT NULL;