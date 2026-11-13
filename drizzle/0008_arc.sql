CREATE TABLE `arc` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`premise` text NOT NULL,
	`stakes` text NOT NULL,
	`resolution` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "arc_status_check" CHECK(status IS NULL OR status IN ('draft', 'accepted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arc_campaign_id_unique` ON `arc` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `arc_act` (
	`id` text PRIMARY KEY NOT NULL,
	`arc_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	FOREIGN KEY (`arc_id`) REFERENCES `arc`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `arc_act_arc` ON `arc_act` (`arc_id`,`position`);--> statement-breakpoint
CREATE TABLE `arc_beat` (
	`id` text PRIMARY KEY NOT NULL,
	`act_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`source_session_id` text,
	`source_turn_seq` integer,
	FOREIGN KEY (`act_id`) REFERENCES `arc_act`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "arc_beat_state_check" CHECK(state IS NULL OR state IN ('pending', 'reached', 'abandoned'))
);
--> statement-breakpoint
CREATE INDEX `arc_beat_act` ON `arc_beat` (`act_id`,`position`);