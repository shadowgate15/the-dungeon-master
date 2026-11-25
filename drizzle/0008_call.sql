CREATE TABLE `call` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`text` text,
	`choices` text DEFAULT '[]' NOT NULL,
	`opened_by` integer,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `call_part` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`position` integer NOT NULL,
	`character_id` text,
	`player` text NOT NULL,
	`skill` text,
	`save` text,
	`tier` text,
	`dc` integer,
	`mode` text DEFAULT 'normal' NOT NULL,
	`reason` text,
	`result` text,
	`answer` text,
	`answered_at` integer,
	FOREIGN KEY (`call_id`) REFERENCES `call`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `call_part_call_idx` ON `call_part` (`call_id`);