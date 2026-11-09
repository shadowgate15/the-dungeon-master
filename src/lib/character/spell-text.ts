/** A spell description paragraph, with an optional run-in heading split off the front. */
export interface SpellLine {
  heading: string | null
  text: string
}

const RUN_IN_HEADING = /^\*\*\*(.+?)\*\*\*\s*(.*)$/s

/**
 * SRD descriptions are plain paragraphs, except a few (Command, Create or Destroy Water) that open
 * a paragraph with a `***Heading.***` run-in heading. Pure: no markdown library, no HTML.
 */
export function parseSpellLine(line: string): SpellLine {
  const m = RUN_IN_HEADING.exec(line)
  return m ? { heading: m[1], text: m[2] } : { heading: null, text: line }
}
