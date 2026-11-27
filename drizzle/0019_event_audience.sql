ALTER TABLE `activity_line` ADD `audience` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `call` ADD `audience` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `audience` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `summary_audience` text;--> statement-breakpoint
UPDATE `event` SET `audience` = (SELECT json_group_array(`c`.`id`) FROM `character` `c` WHERE `c`.`created_at` <= `event`.`created_at`);--> statement-breakpoint
UPDATE `activity_line` SET `audience` = (SELECT json_group_array(`c`.`id`) FROM `character` `c` WHERE `c`.`created_at` <= `activity_line`.`created_at`);--> statement-breakpoint
UPDATE `call` SET `audience` = (SELECT json_group_array(`c`.`id`) FROM `character` `c` WHERE `c`.`created_at` <= `call`.`created_at`);--> statement-breakpoint
UPDATE `session` SET `summary_audience` = (SELECT json_group_array(`c`.`id`) FROM `character` `c` WHERE `c`.`created_at` <= `session`.`closed_at`) WHERE `summary` IS NOT NULL;
