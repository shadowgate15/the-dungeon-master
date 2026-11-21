-- The Scene's open Call (ADR 0005) replaces its pending roll. 0017 already cleared every pending
-- roll, so the column is renamed with nothing to convert.
ALTER TABLE `session_scene` RENAME COLUMN `pending_roll` TO `open_call`;
