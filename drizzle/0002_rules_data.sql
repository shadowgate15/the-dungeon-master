CREATE TABLE `ability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ability_slug_unique` ON `ability` (`slug`);--> statement-breakpoint
CREATE TABLE `ability_score_method` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`app_authored` integer NOT NULL,
	`config` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ability_score_method_slug_unique` ON `ability_score_method` (`slug`);--> statement-breakpoint
CREATE TABLE `alignment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alignment_slug_unique` ON `alignment` (`slug`);--> statement-breakpoint
CREATE TABLE `background` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`app_authored` integer NOT NULL,
	`description` text,
	`feature_name` text,
	`feature_description` text,
	`starting_gold_quantity` real,
	`starting_gold_unit` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `background_slug_unique` ON `background` (`slug`);--> statement-breakpoint
CREATE TABLE `background_equipment` (
	`background_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`background_id`, `item_id`),
	FOREIGN KEY (`background_id`) REFERENCES `background`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `background_option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`background_id` integer NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`background_id`) REFERENCES `background`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `background_option_position_unique` ON `background_option` (`background_id`,`kind`,`position`);--> statement-breakpoint
CREATE TABLE `background_option_alignment` (
	`option_id` integer NOT NULL,
	`alignment_id` integer NOT NULL,
	PRIMARY KEY(`option_id`, `alignment_id`),
	FOREIGN KEY (`option_id`) REFERENCES `background_option`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alignment_id`) REFERENCES `alignment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `background_proficiency` (
	`background_id` integer NOT NULL,
	`proficiency_id` integer NOT NULL,
	PRIMARY KEY(`background_id`, `proficiency_id`),
	FOREIGN KEY (`background_id`) REFERENCES `background`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `choice_group` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_slug` text NOT NULL,
	`kind` text NOT NULL,
	`choose` integer NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `choice_group_key_unique` ON `choice_group` (`key`);--> statement-breakpoint
CREATE INDEX `choice_group_owner_idx` ON `choice_group` (`owner_type`,`owner_slug`);--> statement-breakpoint
CREATE TABLE `choice_option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `choice_group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `choice_option_position_unique` ON `choice_option` (`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `choice_option_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`option_id` integer NOT NULL,
	`position` integer NOT NULL,
	`item_type` text NOT NULL,
	`proficiency_id` integer,
	`language_id` integer,
	`ability_id` integer,
	`bonus` integer,
	`equipment_id` integer,
	`equipment_category_id` integer,
	`count` integer,
	`requires_proficiency_id` integer,
	FOREIGN KEY (`option_id`) REFERENCES `choice_option`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipment_category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`requires_proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "choice_option_item_type_check" CHECK(item_type IN ('proficiency', 'language', 'abilityBonus', 'equipment', 'equipmentCategory'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `choice_option_item_position_unique` ON `choice_option_item` (`option_id`,`position`);--> statement-breakpoint
CREATE TABLE `class_level` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`level` integer NOT NULL,
	`ability_score_bonuses` integer NOT NULL,
	`proficiency_bonus` integer NOT NULL,
	`cantrips_known` integer,
	`spells_known` integer,
	`slots_level_1` integer,
	`slots_level_2` integer,
	`slots_level_3` integer,
	`slots_level_4` integer,
	`slots_level_5` integer,
	`slots_level_6` integer,
	`slots_level_7` integer,
	`slots_level_8` integer,
	`slots_level_9` integer,
	`class_specific` text,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_level_class_level_unique` ON `class_level` (`class_id`,`level`);--> statement-breakpoint
CREATE TABLE `class_level_feature` (
	`class_level_id` integer NOT NULL,
	`feature_id` integer NOT NULL,
	PRIMARY KEY(`class_level_id`, `feature_id`),
	FOREIGN KEY (`class_level_id`) REFERENCES `class_level`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `class_proficiency` (
	`class_id` integer NOT NULL,
	`proficiency_id` integer NOT NULL,
	PRIMARY KEY(`class_id`, `proficiency_id`),
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `class_saving_throw` (
	`class_id` integer NOT NULL,
	`ability_id` integer NOT NULL,
	PRIMARY KEY(`class_id`, `ability_id`),
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `class_starting_equipment` (
	`class_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`class_id`, `item_id`),
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `class` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`hit_die` integer NOT NULL,
	`spellcasting_level` integer,
	`spellcasting_ability_id` integer,
	`spellcasting_info` text,
	FOREIGN KEY (`spellcasting_ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_slug_unique` ON `class` (`slug`);--> statement-breakpoint
CREATE TABLE `damage_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `damage_type_slug_unique` ON `damage_type` (`slug`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	`gear_category_id` integer,
	`description` text NOT NULL,
	`cost_quantity` real NOT NULL,
	`cost_unit` text NOT NULL,
	`weight` real,
	`weapon_category` text,
	`weapon_range` text,
	`category_range` text,
	`damage_dice` text,
	`damage_type_id` integer,
	`two_handed_damage_dice` text,
	`two_handed_damage_type_id` integer,
	`range_normal` integer,
	`range_long` integer,
	`throw_range_normal` integer,
	`throw_range_long` integer,
	`special` text NOT NULL,
	`armor_category` text,
	`armor_class_base` integer,
	`armor_class_dex_bonus` integer,
	`armor_class_max_bonus` integer,
	`str_minimum` integer,
	`stealth_disadvantage` integer,
	`tool_category` text,
	`vehicle_category` text,
	`speed_quantity` real,
	`speed_unit` text,
	`capacity` text,
	`quantity` integer,
	FOREIGN KEY (`category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`gear_category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`damage_type_id`) REFERENCES `damage_type`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`two_handed_damage_type_id`) REFERENCES `damage_type`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_slug_unique` ON `equipment` (`slug`);--> statement-breakpoint
CREATE TABLE `equipment_category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_category_slug_unique` ON `equipment_category` (`slug`);--> statement-breakpoint
CREATE TABLE `equipment_category_item` (
	`category_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	PRIMARY KEY(`category_id`, `equipment_id`),
	FOREIGN KEY (`category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `equipment_content` (
	`pack_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`pack_id`, `item_id`),
	FOREIGN KEY (`pack_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `equipment_weapon_property` (
	`equipment_id` integer NOT NULL,
	`property_id` integer NOT NULL,
	PRIMARY KEY(`equipment_id`, `property_id`),
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `weapon_property`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feature` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`class_id` integer NOT NULL,
	`subclass_id` integer,
	`level` integer NOT NULL,
	`description` text NOT NULL,
	`parent_id` integer,
	`reference` text,
	`specific` text,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subclass_id`) REFERENCES `subclass`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_id`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_slug_unique` ON `feature` (`slug`);--> statement-breakpoint
CREATE INDEX `feature_class_level_idx` ON `feature` (`class_id`,`level`);--> statement-breakpoint
CREATE TABLE `language` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`script` text,
	`typical_speakers` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `language_slug_unique` ON `language` (`slug`);--> statement-breakpoint
CREATE TABLE `magic_school` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_school_slug_unique` ON `magic_school` (`slug`);--> statement-breakpoint
CREATE TABLE `proficiency` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`reference_type` text,
	`reference_slug` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proficiency_slug_unique` ON `proficiency` (`slug`);--> statement-breakpoint
CREATE TABLE `race` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`speed` integer NOT NULL,
	`size` text NOT NULL,
	`size_description` text NOT NULL,
	`age` text NOT NULL,
	`alignment` text NOT NULL,
	`language_description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `race_slug_unique` ON `race` (`slug`);--> statement-breakpoint
CREATE TABLE `race_ability_bonus` (
	`race_id` integer NOT NULL,
	`ability_id` integer NOT NULL,
	`bonus` integer NOT NULL,
	PRIMARY KEY(`race_id`, `ability_id`),
	FOREIGN KEY (`race_id`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `race_language` (
	`race_id` integer NOT NULL,
	`language_id` integer NOT NULL,
	PRIMARY KEY(`race_id`, `language_id`),
	FOREIGN KEY (`race_id`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `race_trait` (
	`race_id` integer NOT NULL,
	`trait_id` integer NOT NULL,
	PRIMARY KEY(`race_id`, `trait_id`),
	FOREIGN KEY (`race_id`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trait_id`) REFERENCES `trait`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `rules_dataset` (
	`id` integer PRIMARY KEY NOT NULL,
	`dataset_version` text NOT NULL,
	`source_tag` text NOT NULL,
	`source_repository` text NOT NULL,
	`source_path` text NOT NULL,
	`source_license` text NOT NULL,
	`srd_version` text NOT NULL,
	`srd_license` text NOT NULL,
	`seeded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`ability_id` integer NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_slug_unique` ON `skill` (`slug`);--> statement-breakpoint
CREATE TABLE `spell` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL,
	`school_id` integer NOT NULL,
	`description` text NOT NULL,
	`higher_level` text NOT NULL,
	`range` text NOT NULL,
	`components` text NOT NULL,
	`material` text,
	`ritual` integer NOT NULL,
	`concentration` integer NOT NULL,
	`duration` text NOT NULL,
	`casting_time` text NOT NULL,
	`attack_type` text,
	`dc_ability_id` integer,
	`dc_success` text,
	`dc_description` text,
	`area_type` text,
	`area_size` integer,
	`damage` text,
	`heal_at_slot_level` text,
	FOREIGN KEY (`school_id`) REFERENCES `magic_school`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`dc_ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spell_slug_unique` ON `spell` (`slug`);--> statement-breakpoint
CREATE INDEX `spell_level_idx` ON `spell` (`level`);--> statement-breakpoint
CREATE TABLE `spell_class` (
	`spell_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	PRIMARY KEY(`spell_id`, `class_id`),
	FOREIGN KEY (`spell_id`) REFERENCES `spell`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `spell_class_class_idx` ON `spell_class` (`class_id`);--> statement-breakpoint
CREATE TABLE `subclass` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`class_id` integer NOT NULL,
	`flavor` text NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subclass_slug_unique` ON `subclass` (`slug`);--> statement-breakpoint
CREATE TABLE `subclass_level` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subclass_id` integer NOT NULL,
	`level` integer NOT NULL,
	`subclass_specific` text,
	FOREIGN KEY (`subclass_id`) REFERENCES `subclass`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subclass_level_subclass_level_unique` ON `subclass_level` (`subclass_id`,`level`);--> statement-breakpoint
CREATE TABLE `subclass_level_feature` (
	`subclass_level_id` integer NOT NULL,
	`feature_id` integer NOT NULL,
	PRIMARY KEY(`subclass_level_id`, `feature_id`),
	FOREIGN KEY (`subclass_level_id`) REFERENCES `subclass_level`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `feature`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `subclass_spell` (
	`subclass_id` integer NOT NULL,
	`spell_id` integer NOT NULL,
	`min_class_level` integer NOT NULL,
	PRIMARY KEY(`subclass_id`, `spell_id`),
	FOREIGN KEY (`subclass_id`) REFERENCES `subclass`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spell_id`) REFERENCES `spell`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `subrace` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`race_id` integer NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `race`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subrace_slug_unique` ON `subrace` (`slug`);--> statement-breakpoint
CREATE TABLE `subrace_ability_bonus` (
	`subrace_id` integer NOT NULL,
	`ability_id` integer NOT NULL,
	`bonus` integer NOT NULL,
	PRIMARY KEY(`subrace_id`, `ability_id`),
	FOREIGN KEY (`subrace_id`) REFERENCES `subrace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ability_id`) REFERENCES `ability`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `subrace_trait` (
	`subrace_id` integer NOT NULL,
	`trait_id` integer NOT NULL,
	PRIMARY KEY(`subrace_id`, `trait_id`),
	FOREIGN KEY (`subrace_id`) REFERENCES `subrace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trait_id`) REFERENCES `trait`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `trait` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`parent_id` integer,
	`specific` text,
	FOREIGN KEY (`parent_id`) REFERENCES `trait`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trait_slug_unique` ON `trait` (`slug`);--> statement-breakpoint
CREATE TABLE `trait_proficiency` (
	`trait_id` integer NOT NULL,
	`proficiency_id` integer NOT NULL,
	PRIMARY KEY(`trait_id`, `proficiency_id`),
	FOREIGN KEY (`trait_id`) REFERENCES `trait`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `weapon_property` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weapon_property_slug_unique` ON `weapon_property` (`slug`);