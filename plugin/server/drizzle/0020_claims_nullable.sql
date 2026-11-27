-- A Claim is nullable: null = unclaimed. SQLite cannot drop NOT NULL in place, and a table rebuild
-- would cascade-delete every row that references `character`, so swap the column instead.
-- Existing rows keep their controlling player (the Host), which is how they stay Claimed.
ALTER TABLE `character` ADD `controlling_player_next` text;--> statement-breakpoint
UPDATE `character` SET `controlling_player_next` = `controlling_player`;--> statement-breakpoint
ALTER TABLE `character` DROP COLUMN `controlling_player`;--> statement-breakpoint
ALTER TABLE `character` RENAME COLUMN `controlling_player_next` TO `controlling_player`;--> statement-breakpoint
ALTER TABLE `character_draft` ADD `controlling_player_next` text;--> statement-breakpoint
UPDATE `character_draft` SET `controlling_player_next` = `controlling_player`;--> statement-breakpoint
ALTER TABLE `character_draft` DROP COLUMN `controlling_player`;--> statement-breakpoint
ALTER TABLE `character_draft` RENAME COLUMN `controlling_player_next` TO `controlling_player`;
