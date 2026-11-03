-- The previous campaign table was an id-only stub with no data worth keeping, so it is
-- dropped and recreated rather than copied (the stub has no name/premise/tone/length to copy).
DELETE FROM `world_campaign`;--> statement-breakpoint
DROP TABLE `campaign`;--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`premise` text NOT NULL,
	`tone` text NOT NULL,
	`length` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "campaign_tone_check" CHECK(tone IS NULL OR tone IN ('heroic', 'lighthearted', 'tense', 'dark', 'mysterious', 'epic')),
	CONSTRAINT "campaign_length_check" CHECK(length IS NULL OR length IN ('one-shot', 'short', 'medium', 'long'))
);
