ALTER TABLE `call_part` ADD `hit_dice` text;--> statement-breakpoint
ALTER TABLE `character` ADD `levels_awarded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character_item` ADD `equipped` integer DEFAULT false NOT NULL;