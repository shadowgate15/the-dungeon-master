PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_arc_beat` (
	`id` text PRIMARY KEY NOT NULL,
	`act_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`act_id`) REFERENCES `arc_act`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_arc_beat`("id", "act_id", "position", "title", "description") SELECT "id", "act_id", "position", "title", "description" FROM `arc_beat`;--> statement-breakpoint
DROP TABLE `arc_beat`;--> statement-breakpoint
ALTER TABLE `__new_arc_beat` RENAME TO `arc_beat`;--> statement-breakpoint
CREATE INDEX `arc_beat_act` ON `arc_beat` (`act_id`,`position`);--> statement-breakpoint
DROP TABLE `npc_fact`;--> statement-breakpoint
DROP TABLE `disposition`;--> statement-breakpoint
DROP TABLE `npc`;--> statement-breakpoint
DROP TABLE `fact`;--> statement-breakpoint
DROP TABLE `event`;--> statement-breakpoint
DROP TABLE `faction`;--> statement-breakpoint
DROP TABLE `place`;--> statement-breakpoint
DROP TABLE `journal_marker`;--> statement-breakpoint
DROP TABLE `turn`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
