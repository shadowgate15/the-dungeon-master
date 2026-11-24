CREATE TABLE `combat` (
	`id` text PRIMARY KEY NOT NULL,
	`round` integer DEFAULT 0 NOT NULL,
	`current` text,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `combatant` (
	`id` text PRIMARY KEY NOT NULL,
	`combat_id` text NOT NULL,
	`kind` text NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`joined` integer NOT NULL,
	`initiative` integer,
	`dex` integer NOT NULL,
	`surprised` integer DEFAULT false NOT NULL,
	`used` text NOT NULL,
	`stat_block` text,
	`hp` integer,
	`max_hp` integer,
	`conditions` text NOT NULL,
	FOREIGN KEY (`combat_id`) REFERENCES `combat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `combatant_combat_idx` ON `combatant` (`combat_id`);