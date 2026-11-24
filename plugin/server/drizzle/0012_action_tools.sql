CREATE TABLE `npc_combat` (
	`handle` text PRIMARY KEY NOT NULL,
	`hp` integer NOT NULL,
	`max_hp` integer NOT NULL,
	`conditions` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `call_part` ADD `sequence` text;