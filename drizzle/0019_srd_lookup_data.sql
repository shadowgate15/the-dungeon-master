CREATE TABLE `condition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `condition_slug_unique` ON `condition` (`slug`);--> statement-breakpoint
CREATE TABLE `magic_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	`rarity` text NOT NULL,
	`variant_of_id` integer,
	`description` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`variant_of_id`) REFERENCES `magic_item`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_item_slug_unique` ON `magic_item` (`slug`);--> statement-breakpoint
CREATE TABLE `monster` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`size` text NOT NULL,
	`type` text NOT NULL,
	`subtype` text,
	`alignment` text NOT NULL,
	`armor_class` text NOT NULL,
	`hit_points` integer NOT NULL,
	`hit_dice` text NOT NULL,
	`hit_points_roll` text NOT NULL,
	`speed` text NOT NULL,
	`str` integer NOT NULL,
	`dex` integer NOT NULL,
	`con` integer NOT NULL,
	`int` integer NOT NULL,
	`wis` integer NOT NULL,
	`cha` integer NOT NULL,
	`damage_vulnerabilities` text NOT NULL,
	`damage_resistances` text NOT NULL,
	`damage_immunities` text NOT NULL,
	`senses` text NOT NULL,
	`languages` text NOT NULL,
	`challenge_rating` real NOT NULL,
	`proficiency_bonus` integer NOT NULL,
	`xp` integer NOT NULL,
	`special_abilities` text NOT NULL,
	`actions` text NOT NULL,
	`legendary_actions` text NOT NULL,
	`reactions` text NOT NULL,
	`forms` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monster_slug_unique` ON `monster` (`slug`);--> statement-breakpoint
CREATE INDEX `monster_challenge_rating_idx` ON `monster` (`challenge_rating`);--> statement-breakpoint
CREATE TABLE `monster_condition_immunity` (
	`monster_id` integer NOT NULL,
	`condition_id` integer NOT NULL,
	PRIMARY KEY(`monster_id`, `condition_id`),
	FOREIGN KEY (`monster_id`) REFERENCES `monster`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`condition_id`) REFERENCES `condition`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `monster_proficiency` (
	`monster_id` integer NOT NULL,
	`proficiency_id` integer NOT NULL,
	`position` integer NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`monster_id`, `proficiency_id`),
	FOREIGN KEY (`monster_id`) REFERENCES `monster`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proficiency_id`) REFERENCES `proficiency`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `rule_section` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`rule` text NOT NULL,
	`rule_name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_section_slug_unique` ON `rule_section` (`slug`);