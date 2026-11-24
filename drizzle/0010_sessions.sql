ALTER TABLE `session` ADD `bridge` text;--> statement-breakpoint
CREATE VIRTUAL TABLE `narration_search` USING fts5(`event_id` UNINDEXED, `text`, tokenize = 'porter unicode61');--> statement-breakpoint
INSERT INTO `narration_search` (`event_id`, `text`) SELECT `id`, json_extract(`data`, '$.text') FROM `event` WHERE `kind` = 'narration';
