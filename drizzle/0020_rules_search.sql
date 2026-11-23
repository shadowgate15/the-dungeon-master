-- Full-text index over the SRD rules kinds a handle can name (spells, monsters, conditions, magic
-- items, rules sections). Derived data: seedRulesData rebuilds it from the rules tables.
CREATE VIRTUAL TABLE `rules_search` USING fts5(
	`handle` UNINDEXED,
	`kind` UNINDEXED,
	`name`,
	`body`,
	tokenize = 'porter unicode61 remove_diacritics 2'
);
