CREATE TABLE `belief` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holder_character` text,
	`holder_npc` text,
	`kind` text NOT NULL,
	`fact_id` integer,
	`about` text,
	`field` text,
	`value` text,
	`claim` text,
	`text` text NOT NULL,
	`about_name` text,
	`source` text,
	`session_id` text,
	`event_id` integer,
	`learned_minute` integer NOT NULL,
	`replaced_by` integer,
	`retired_at` integer,
	`retired_reason` text,
	FOREIGN KEY (`holder_character`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "belief_one_holder_check" CHECK(("belief"."holder_character" IS NULL) <> ("belief"."holder_npc" IS NULL)),
	CONSTRAINT "belief_kind_check" CHECK(kind IN ('fact', 'entity', 'field', 'claim'))
);
--> statement-breakpoint
CREATE INDEX `belief_holder_character_idx` ON `belief` (`holder_character`);--> statement-breakpoint
CREATE INDEX `belief_holder_npc_idx` ON `belief` (`holder_npc`);--> statement-breakpoint
CREATE INDEX `belief_about_idx` ON `belief` (`about`);