CREATE TABLE `returned_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`player` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `campaign` ADD `clock_minute` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign` ADD `scene` text;