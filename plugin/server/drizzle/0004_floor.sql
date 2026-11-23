CREATE TABLE `declaration` (
	`id` text PRIMARY KEY NOT NULL,
	`floor_id` text NOT NULL,
	`character_id` text NOT NULL,
	`player` text NOT NULL,
	`text` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`floor_id`) REFERENCES `floor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `declaration_floor_idx` ON `declaration` (`floor_id`);--> statement-breakpoint
CREATE TABLE `floor` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
