# Research: self-hosted fonts for a D&D look

Answers issue #51 (map #50). Facts only; the choice is made in the palette and typography prototype.

Researched 2026-11-02. Sizes are measured by downloading the files; versions and licenses come from the Fontsource API and npm registry, copyright lines from each font's `OFL.txt` in `google/fonts`.

## Summary

- Every candidate below is **OFL-1.1**, so bundling and self-hosting are permitted. The OFL forbids selling the font on its own and requires keeping the copyright and license notice with redistributed font files. Reserved Font Names block shipping a _modified_ font under the same name.
- All are on Fontsource (`@fontsource/*` static, `@fontsource-variable/*` variable), which ship woff2 files that Vite bundles. No network dependency at runtime.
- Latin-subset woff2 sizes are roughly 11-25 KB per static weight/style, and 26-51 KB per variable file.
- No candidate is a single "D&D font". The usual pairing is an inscriptional or uncial display face for headings plus a Garamond-like serif for body text.

## Display candidates (headings, titles)

Sizes are the `latin` subset woff2 at weight 400 unless noted.

| Family            | Weights / styles          | Latin woff2                                        | Subsets                      | Variable   | Character                                                   |
| ----------------- | ------------------------- | -------------------------------------------------- | ---------------------------- | ---------- | ----------------------------------------------------------- |
| Cinzel            | 400-900, normal           | 14.1 KB (400), 15.2 KB (700); VF 25.9 KB           | latin, latin-ext             | yes (wght) | Inspired by first-century Roman inscriptions (per its repo) |
| Cinzel Decorative | 400, 700, 900, normal     | 14.4 KB (400), 15.5 KB (700)                       | latin, latin-ext             | no         | Decorative companion to Cinzel                              |
| Uncial Antiqua    | 400, normal               | 19.9 KB                                            | latin, latin-ext             | no         | Uncial manuscript hand; strongly medieval                   |
| Metamorphous      | 400, normal               | 23.1 KB                                            | latin, latin-ext             | no         | Display serif with a fantasy flavour                        |
| Almendra          | 400, 700, normal + italic | 12.2 KB (400), 11.5 KB (700), 11.3 KB (400 italic) | latin, latin-ext             | no         | Calligraphic serif (Fontsource category: serif)             |
| IM Fell English   | 400, normal + italic      | 59.9 KB, 57.8 KB italic                            | latin only                   | no         | Digitization of 17th-century printing types; heavy files    |
| Texturina         | 100-900, normal + italic  | 21.1 KB; VF 51.1 KB                                | latin, latin-ext, vietnamese | yes (wght) | Blackletter-influenced serif                                |

Notes

- "Character" entries other than Cinzel's are short descriptors, not verified against a primary source.
- Pirata One (blackletter-ish, 400 only, OFL, latin and latin-ext) and Mate SC also exist on Fontsource under OFL-1.1; sizes not measured.
- Cinzel's repo does not state whether lowercase letters are real lowercase or small caps. Verify visually in the prototype.
- Cinzel Decorative's Fontsource latin range covers U+0000-00FF, curly punctuation (U+2000-206F), euro and a few others. Characters outside it fall back to the next font in the stack.

## Body / UI candidates (long text, panels)

| Family          | Weights / styles         | Latin woff2                                                                       | Subsets                                                                | Variable   | Character                                                         |
| --------------- | ------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| EB Garamond     | 400-800, normal + italic | 23.8 KB (400), 25.3 KB (700), 25.4 KB (400 italic); VF 44.3 KB, VF italic 47.9 KB | latin, latin-ext, vietnamese, cyrillic, cyrillic-ext, greek, greek-ext | yes (wght) | Classic Garamond revival; book-like                               |
| Crimson Pro     | 200-900, normal + italic | 18.3 KB (400), 18.7 KB (700), 19.1 KB (400 italic); VF 48.2 KB, VF italic 51.4 KB | latin, latin-ext, vietnamese                                           | yes (wght) | Old-style serif for long reading                                  |
| Lora            | 400-700, normal + italic | 21.1 KB (400), 21.0 KB (700), 22.8 KB (400 italic); VF 37.8 KB, VF italic 40.8 KB | latin, latin-ext, cyrillic, cyrillic-ext, vietnamese, math, symbols    | yes (wght) | Contemporary serif with calligraphic roots                        |
| Source Serif 4  | 200-900, normal + italic | 20.1 KB (400), 21.7 KB (700), 20.1 KB (400 italic); VF 50.9 KB, VF italic 51.6 KB | latin, latin-ext, vietnamese, cyrillic, cyrillic-ext, greek            | yes (wght) | Neutral transitional serif                                        |
| Inter (UI sans) | 100-900, normal + italic | 23.7 KB (400), 24.4 KB (700), 25.0 KB (400 italic); VF 48.3 KB, VF italic 51.8 KB | latin, latin-ext, vietnamese, cyrillic, cyrillic-ext, greek, greek-ext | yes (wght) | Screen-oriented sans for dense panels such as the character sheet |

"Character" entries for non-Cinzel families are a short descriptor, not verified against a primary source; weigh them by looking at specimens.

## Licenses (primary: `google/fonts` `ofl/<family>/OFL.txt`)

| Family            | Copyright line                                                | Reserved Font Name       |
| ----------------- | ------------------------------------------------------------- | ------------------------ |
| Cinzel            | 2020 The Cinzel Project Authors (github.com/NDISCOVER/Cinzel) | not shown in first lines |
| Cinzel Decorative | 2012 Natanael Gama                                            | "Cinzel"                 |
| Uncial Antiqua    | 2011 Brian J. Bonislawsky DBA Astigmatic                      | "Uncial Antiqua"         |
| Metamorphous      | 2011-2012 Sorkin Type Co                                      | "Metamorphous"           |
| Almendra          | 2011-2012 Ana Sanfelippo                                      | "Almendra"               |
| IM Fell English   | 2010 Igino Marini                                             | none shown               |
| Texturina         | 2020 The Texturina Project Authors                            | not shown                |
| EB Garamond       | 2017 The EB Garamond Project Authors                          | not shown                |
| Crimson Pro       | 2018 The Crimson Pro Project Authors                          | not shown                |
| Lora              | 2011 The Lora Project Authors                                 | "Lora"                   |
| Inter             | 2020 The Inter Project Authors                                | not shown                |
| Source Serif 4    | 2014 The Source Serif 4 Project Authors                       | not shown                |

Reserved Font Name only matters if the files are modified (e.g. subsetted via a tool that renames, or glyph edits). Fontsource's unmodified files are fine. If the project later subsets its own copies, check each OFL.txt in full before renaming.

## How to load in SvelteKit + Tailwind v4

Fontsource docs say to prefer the variable package when one exists, and the static package otherwise. Packages: `@fontsource-variable/<slug>` (v5.3.x for the families checked, all OFL-1.1) and `@fontsource/<slug>`. Fontsource's page gives no SvelteKit or Tailwind specifics; it only says bundlers like Vite handle CSS imports.

```sh
pnpm add @fontsource-variable/eb-garamond @fontsource/cinzel-decorative
```

Import once in the root layout or global CSS (Vite processes the package CSS and emits the woff2 files as hashed assets, so they ship with the build):

```css
/* src/app.css */
@import '@fontsource-variable/eb-garamond';
@import '@fontsource/cinzel-decorative/700.css';
@import 'tailwindcss';

@theme {
  --font-display: 'Cinzel Decorative', serif;
  --font-body: 'EB Garamond Variable', serif;
}
```

Facts used above

- Tailwind v4 defines families as `--font-*` variables inside `@theme`, generating `font-display` / `font-body` utilities (tailwindcss.com/docs/font-family).
- Tailwind's own docs show self-hosting with a manual `@font-face` and a file in `/fonts/`; that is the alternative to the npm packages. It needs the woff2 files committed under `static/`.
- Variable packages register the family as `<Name> Variable` (for example `EB Garamond Variable`). This naming is from memory of Fontsource's convention, not confirmed in the docs fetched; check the generated CSS in `node_modules/@fontsource-variable/*/index.css` before relying on it.
- Tailwind's docs put an external `@import url(...)` before `@import "tailwindcss"`. Whether package-path imports must also precede it was not checked; the snippet above follows that ordering to be safe.
- A static package needs one CSS import per weight/style (`400.css`, `700-italic.css`); the root import gives only the default weight, and normal does not include italic (Fontsource docs).
- Fontsource latin subset range for Cinzel Decorative is U+0000-00FF plus punctuation and a few symbols. Fontsource also ships `latin-ext` as a separate subset; the browser only downloads a subset if the page uses its code points.

## Rough payload for a plausible set

Not a recommendation; just arithmetic from the measurements above.

- Cinzel VF (25.9 KB) + EB Garamond VF normal and italic (44.3 + 47.9 KB) = about 118 KB.
- Cinzel Decorative 400 + 700 (29.9 KB) + Crimson Pro 400, 700, 400 italic (56.2 KB) = about 86 KB.
- Adding Inter VF for dense UI: +48.3 KB.

## Gaps

- Specimen look and glyph details (lowercase style, numerals, ligatures) were not verified; use the prototype.
- Pirata One and Mate SC sizes not measured.
- `<Name> Variable` family naming unverified against docs (see above).
- Sizes are for the `latin` subset only; `latin-ext` adds more per family but is only fetched when needed.

## Sources

- Fontsource API: https://api.fontsource.org/v1/fonts/{id} (license, weights, styles, subsets, unicode ranges)
- Fontsource install docs: https://fontsource.org/docs/getting-started/install
- npm registry: https://registry.npmjs.org/@fontsource-variable/{slug}/latest, https://registry.npmjs.org/@fontsource/cinzel-decorative/latest
- Font files measured from the Fontsource jsDelivr mirror: https://cdn.jsdelivr.net/fontsource/fonts/
- License texts: https://github.com/google/fonts/tree/main/ofl (OFL.txt per family)
- Cinzel repo: https://github.com/NDISCOVER/Cinzel
- Tailwind v4 font-family docs: https://tailwindcss.com/docs/font-family
