CREATE TABLE `disposition` (
	`npc_id` text NOT NULL,
	`character_id` text NOT NULL,
	`stance` text DEFAULT 'neutral' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer,
	PRIMARY KEY(`npc_id`, `character_id`),
	FOREIGN KEY (`npc_id`) REFERENCES `npc`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "disposition_stance_check" CHECK(stance IS NULL OR stance IN ('hostile', 'wary', 'neutral', 'friendly', 'allied'))
);
--> statement-breakpoint
CREATE TABLE `fact` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`world_changing` integer DEFAULT false NOT NULL,
	`superseded_by_id` text,
	`created_session_id` text NOT NULL,
	`created_seq` integer,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer,
	`retired_at` integer,
	`retired_reason` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`superseded_by_id`) REFERENCES `fact`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fact_retired_check" CHECK((retired_at IS NULL) = (retired_reason IS NULL))
);
--> statement-breakpoint
CREATE INDEX `fact_campaign` ON `fact` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `memory_run` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`from_seq` integer NOT NULL,
	`to_seq` integer NOT NULL,
	`outcome` text NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`dropped` integer DEFAULT 0 NOT NULL,
	`dropped_items` text DEFAULT '[]' NOT NULL,
	`duration_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memory_run_kind_check" CHECK(kind IS NULL OR kind IN ('extraction', 'summary')),
	CONSTRAINT "memory_run_outcome_check" CHECK(outcome IS NULL OR outcome IN ('success', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `memory_run_session` ON `memory_run` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `npc` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`description` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'alive' NOT NULL,
	`place_id` text,
	`created_session_id` text NOT NULL,
	`created_seq` integer,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer,
	`retired_at` integer,
	`retired_reason` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "npc_status_check" CHECK(status IS NULL OR status IN ('alive', 'dead', 'missing', 'departed')),
	CONSTRAINT "npc_retired_check" CHECK((retired_at IS NULL) = (retired_reason IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `npc_campaign_name_key` ON `npc` (`campaign_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `npc_fact` (
	`npc_id` text NOT NULL,
	`fact_id` text NOT NULL,
	PRIMARY KEY(`npc_id`, `fact_id`),
	FOREIGN KEY (`npc_id`) REFERENCES `npc`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fact_id`) REFERENCES `fact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `place` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`created_session_id` text NOT NULL,
	`created_seq` integer,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer,
	`retired_at` integer,
	`retired_reason` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`world_id`) REFERENCES `world`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "place_retired_check" CHECK((retired_at IS NULL) = (retired_reason IS NULL))
);
--> statement-breakpoint
CREATE INDEX `place_campaign` ON `place` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `place_exit` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`name` text NOT NULL,
	`target_place_id` text,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_exit_place_name` ON `place_exit` (`place_id`,`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_arc_beat` (
	`id` text PRIMARY KEY NOT NULL,
	`act_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`state_session_id` text,
	`state_event_id` text,
	`state_changed_at` integer,
	FOREIGN KEY (`act_id`) REFERENCES `arc_act`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`state_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`state_event_id`) REFERENCES `session_event`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "arc_beat_state_check" CHECK(state IS NULL OR state IN ('pending', 'reached', 'abandoned'))
);
--> statement-breakpoint
INSERT INTO `__new_arc_beat`("id", "act_id", "position", "title", "description") SELECT "id", "act_id", "position", "title", "description" FROM `arc_beat`;--> statement-breakpoint
DROP TABLE `arc_beat`;--> statement-breakpoint
ALTER TABLE `__new_arc_beat` RENAME TO `arc_beat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `arc_beat_act` ON `arc_beat` (`act_id`,`position`);