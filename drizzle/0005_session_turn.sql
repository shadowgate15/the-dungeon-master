CREATE TABLE `activity_line` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text,
	`after_event` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`started_at` integer NOT NULL,
	`closed_at` integer,
	`summary` text,
	`threads` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_number_unique` ON `session` (`number`);--> statement-breakpoint
ALTER TABLE `campaign` ADD `awaiting_narration_since` integer;--> statement-breakpoint
ALTER TABLE `floor` ADD `done` text DEFAULT '[]' NOT NULL;