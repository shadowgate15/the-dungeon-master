CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`premise` text,
	`genre_flavor` text,
	`scale` text,
	`magic_level` text,
	`tech_level` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "world_genre_flavor_check" CHECK(genre_flavor IS NULL OR genre_flavor IN ('high fantasy', 'dark fantasy', 'sword and sorcery', 'mythic', 'gothic horror', 'science fantasy', 'science fiction', 'post-apocalyptic')),
	CONSTRAINT "world_scale_check" CHECK(scale IS NULL OR scale IN ('single region', 'continent', 'multiple continents', 'planar')),
	CONSTRAINT "world_magic_level_check" CHECK(magic_level IS NULL OR magic_level IN ('none', 'low', 'moderate', 'high', 'ubiquitous')),
	CONSTRAINT "world_tech_level_check" CHECK(tech_level IS NULL OR tech_level IN ('stone age', 'ancient', 'medieval', 'renaissance', 'industrial', 'modern', 'futuristic'))
);
--> statement-breakpoint
CREATE TABLE `world_campaign` (
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	PRIMARY KEY(`world_id`, `campaign_id`),
	FOREIGN KEY (`world_id`) REFERENCES `world`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
