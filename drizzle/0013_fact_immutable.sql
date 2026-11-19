-- A fact is immutable: it changes only by supersede (superseded_by_id) or retire.
CREATE TRIGGER `fact_immutable` BEFORE UPDATE OF `campaign_id`, `title`, `detail`, `world_changing` ON `fact`
WHEN OLD.`campaign_id` IS NOT NEW.`campaign_id` OR OLD.`title` IS NOT NEW.`title` OR OLD.`detail` IS NOT NEW.`detail` OR OLD.`world_changing` IS NOT NEW.`world_changing`
BEGIN
	SELECT RAISE(ABORT, 'a fact is immutable: supersede or retire it');
END;
