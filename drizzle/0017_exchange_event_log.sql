-- The Exchange replaces the Director pipeline (ADR 0005), changing the event kinds and roles.
-- Following ADR 0003's precedent the old Session events are wiped, not converted: the new table
-- starts empty, and everything that pointed into the old log is reset with it.
UPDATE `arc_beat` SET `state_event_id` = NULL;--> statement-breakpoint
UPDATE `session` SET `memory_through_seq` = 0, `summary` = NULL, `summary_through_seq` = 0;--> statement-breakpoint
UPDATE `session_scene` SET `pending_roll` = NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_event` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`npc_id` text,
	`data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "session_event_role_check" CHECK(role IS NULL OR role IN ('player', 'narrator', 'npc', 'code')),
	CONSTRAINT "session_event_kind_check" CHECK(kind IS NULL OR kind IN ('declaration', 'narration', 'npc-line', 'call-raised', 'call-answered', 'scene-changed', 'mode-changed'))
);
--> statement-breakpoint
DROP TABLE `session_event`;--> statement-breakpoint
ALTER TABLE `__new_session_event` RENAME TO `session_event`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_event_session_seq` ON `session_event` (`session_id`,`seq`);