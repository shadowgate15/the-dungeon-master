CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text,
	`minute` integer NOT NULL,
	`tool` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`data` text,
	`dm_only` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campaign` ADD `version` integer DEFAULT 1 NOT NULL;