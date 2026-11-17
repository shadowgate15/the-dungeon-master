CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_one_open_per_campaign` ON `session` (`campaign_id`) WHERE ended_at IS NULL;--> statement-breakpoint
CREATE TABLE `session_event` (
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
	CONSTRAINT "session_event_role_check" CHECK(role IS NULL OR role IN ('player', 'director', 'narrator', 'npc', 'code')),
	CONSTRAINT "session_event_kind_check" CHECK(kind IS NULL OR kind IN ('player-action', 'narration', 'npc-line', 'roll-requested', 'roll-resolved', 'scene-changed', 'mode-changed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_event_session_seq` ON `session_event` (`session_id`,`seq`);--> statement-breakpoint
CREATE TABLE `session_scene` (
	`session_id` text PRIMARY KEY NOT NULL,
	`location_name` text NOT NULL,
	`location_description` text NOT NULL,
	`exits` text NOT NULL,
	`objects` text NOT NULL,
	`npcs` text NOT NULL,
	`mode` text NOT NULL,
	`dialogue_npc_id` text,
	`pending_roll` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "session_scene_mode_check" CHECK(mode IS NULL OR mode IN ('exploration', 'dialogue'))
);
