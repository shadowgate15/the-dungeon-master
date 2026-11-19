-- The Scene now stores NPC row ids only (name, attitude and knowledge resolve live from World
-- memory). Old rows held embedded NPC objects keyed by name; there is no data recovery, so those
-- Scenes start with nobody present and any dialogue ends. The column type is unchanged.
UPDATE `session_scene` SET `npcs` = '[]', `mode` = 'exploration', `dialogue_npc_id` = NULL;
