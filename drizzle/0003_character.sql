CREATE TABLE `character` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`alignment` text,
	`appearance` text,
	`personality` text,
	`ideal` text,
	`bond` text,
	`flaw` text,
	`backstory` text,
	`level` integer DEFAULT 1 NOT NULL,
	`race_id` integer NOT NULL,
	`subrace_id` integer,
	`class_id` integer NOT NULL,
	`subclass_id` integer,
	`background_id` integer NOT NULL,
	`custom_background_name` text,
	`custom_background_feature` text,
	`ability_method` text NOT NULL,
	`str` integer NOT NULL,
	`dex` integer NOT NULL,
	`con` integer NOT NULL,
	`int` integer NOT NULL,
	`wis` integer NOT NULL,
	`cha` integer NOT NULL,
	`ability_rolls` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`race_id`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subrace_id`) REFERENCES `subrace`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subclass_id`) REFERENCES `subclass`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`background_id`) REFERENCES `background`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "character_level_check" CHECK(level BETWEEN 1 AND 20),
	CONSTRAINT "character_alignment_check" CHECK(alignment IS NULL OR alignment IN ('lawful-good', 'neutral-good', 'chaotic-good', 'lawful-neutral', 'neutral', 'chaotic-neutral', 'lawful-evil', 'neutral-evil', 'chaotic-evil')),
	CONSTRAINT "character_ability_method_check" CHECK(ability_method IS NULL OR ability_method IN ('standard-array', 'point-buy', 'roll')),
	CONSTRAINT "character_str_check" CHECK("str" BETWEEN 1 AND 30),
	CONSTRAINT "character_dex_check" CHECK("dex" BETWEEN 1 AND 30),
	CONSTRAINT "character_con_check" CHECK("con" BETWEEN 1 AND 30),
	CONSTRAINT "character_int_check" CHECK("int" BETWEEN 1 AND 30),
	CONSTRAINT "character_wis_check" CHECK("wis" BETWEEN 1 AND 30),
	CONSTRAINT "character_cha_check" CHECK("cha" BETWEEN 1 AND 30)
);
--> statement-breakpoint
CREATE TABLE `character_choice` (
	`character_id` text NOT NULL,
	`choice_key` text NOT NULL,
	`option_slug` text NOT NULL,
	PRIMARY KEY(`character_id`, `choice_key`, `option_slug`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_choice_character_idx` ON `character_choice` (`character_id`);--> statement-breakpoint
CREATE TABLE `character_equipment` (
	`character_id` text NOT NULL,
	`choice_key` text NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`character_id`, `choice_key`, `item_id`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "character_equipment_quantity_check" CHECK(quantity >= 1)
);
--> statement-breakpoint
CREATE TABLE `character_skill` (
	`character_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`character_id`, `skill_id`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "character_skill_source_check" CHECK(source IS NULL OR source IN ('class', 'race', 'background'))
);
--> statement-breakpoint
CREATE TABLE `character_spell` (
	`character_id` text NOT NULL,
	`spell_id` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`character_id`, `spell_id`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spell_id`) REFERENCES `spell`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "character_spell_source_check" CHECK(source IS NULL OR source IN ('class', 'race', 'background'))
);
