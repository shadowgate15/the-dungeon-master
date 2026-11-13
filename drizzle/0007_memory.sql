CREATE TABLE `disposition` (
	`npc_id` text NOT NULL,
	`character_id` text NOT NULL,
	`stance` text NOT NULL,
	`note` text,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`npc_id`, `character_id`),
	FOREIGN KEY (`npc_id`) REFERENCES `npc`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "disposition_stance_check" CHECK(stance IS NULL OR stance IN ('hostile', 'wary', 'neutral', 'friendly', 'allied'))
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`created_session_id` text NOT NULL,
	`created_seq` integer NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_campaign_idx` ON `event` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `fact` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`created_session_id` text NOT NULL,
	`created_seq` integer NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`world_changing` integer DEFAULT false NOT NULL,
	`superseded_by_id` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`superseded_by_id`) REFERENCES `fact`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fact_campaign_idx` ON `fact` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `faction` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`created_session_id` text NOT NULL,
	`created_seq` integer NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `faction_campaign_idx` ON `faction` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `npc` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`created_session_id` text NOT NULL,
	`created_seq` integer NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`role` text,
	`status` text DEFAULT 'alive' NOT NULL,
	`place_id` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "npc_status_check" CHECK(status IS NULL OR status IN ('alive', 'dead', 'missing', 'departed'))
);
--> statement-breakpoint
CREATE INDEX `npc_campaign_idx` ON `npc` (`campaign_id`);--> statement-breakpoint
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
	`created_session_id` text NOT NULL,
	`created_seq` integer NOT NULL,
	`changed_session_id` text NOT NULL,
	`changed_seq` integer NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `place_campaign_idx` ON `place` (`campaign_id`);--> statement-breakpoint
ALTER TABLE `session` ADD `memory_through_seq` integer DEFAULT 0 NOT NULL;