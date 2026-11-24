---
name: lint-review
description: How the DM reviews and fixes what lint found in the World. Load it when the lint tool returns, before doing anything else.
---

# Reviewing lint

`lint` checked the World and changed nothing. Fixing is your job, through the ordinary tools, so every fix is a logged event. Nothing here reaches the Player: never mention lint, findings or handles at the table.

## Findings

Work through `findings`. Open what a finding names before you write to it, and pass the version you read.

- **`near_duplicate`**: two Entities whose names are close. Open both. If they are the same thing, `merge` the newer or thinner one into the other. If they are truly different, leave them; a deliberate pair you split at `establish` with `distinct_from` is not reported.
- **`broken_link`**: a `[[link]]` in a Page (`in: "page"`) or a current Fact (`in` is its id) that names no Entity. If the Entity should exist, `establish` it and the link will resolve on the next edit. Otherwise reword the Page with `edit_page`, or replace the Fact with `add_fact(supersedes)`.
- **`restated_field`**: a current Fact that says what a typed field already owns. The field wins: `retire` the Fact (or `supersede` it with one that adds something the field does not hold).
- **`retired_fact_belief`**: a Holder still believes a retired Fact. If the Holder should now believe something true, `reveal` it to them with `replaces: [belief]`. If nothing true takes its place, leave it: the Holder still believes what they were told, and lint will keep reminding you until a `reveal` replaces it.
- **`retired_link`**: a Page links to a retired Entity. Patch the Page with `edit_page` so it no longer treats that Entity as present, or link to whatever replaced it.

## Changed Pages

`pages` holds each Page whose Entity changed since the last lint, beside its typed fields and version. Read each Page against its fields. Where they disagree (the Page calls someone alive whose status is dead, or puts them somewhere their whereabouts says they are not), the field is the truth: patch the Page with `edit_page`. Leave Pages that agree alone.

When every finding is fixed or deliberately left, you are done.
