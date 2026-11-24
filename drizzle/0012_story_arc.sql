CREATE TABLE `act` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arc_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	FOREIGN KEY (`arc_id`) REFERENCES `arc`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `arc` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`premise` text NOT NULL,
	`stakes` text NOT NULL,
	`resolution` text NOT NULL,
	`state` text DEFAULT 'current' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	`end_reason` text,
	CONSTRAINT "arc_state" CHECK("arc"."state" IN ('current', 'concluded', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arc_one_current` ON `arc` (`state`) WHERE "arc"."state" = 'current';--> statement-breakpoint
CREATE TABLE `beat` (
	`handle` text PRIMARY KEY NOT NULL,
	`act_id` integer NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`resolved_at` integer,
	FOREIGN KEY (`act_id`) REFERENCES `act`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "beat_state" CHECK("beat"."state" IN ('pending', 'reached', 'abandoned'))
);
