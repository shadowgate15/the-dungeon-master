import { z } from 'zod'
import { ENTITY_TYPES } from '#lib/world/entity-types.ts'
import { createWorld } from '../world/world'
import { readTool, writeTool } from './contract'

/** Every World-layer event is DM-only: the World layer never reaches the Player. */
const dmOnly = true

const handle = z.string().min(1)
const minute = z.int().min(0).nullable()
const newFact = z.object({
  claim: z.string().trim().min(1),
  valid_from: minute.optional().describe('In-fiction minute; null = since before the Campaign')
})

/** The DM's record of what is true: Entities, their Pages and their Facts (ADR 0007). */
export const worldTools = [
  readTool({
    name: 'search',
    description:
      'Full-text search over World Entities: names, aliases, Pages and current Facts. Returns ranked handles with snippets. Retired Entities are left out. Use lookup for SRD rules content.',
    input: z.object({ query: z.string().min(1), type: z.enum(ENTITY_TYPES).optional() }),
    run: (ctx, { query, type }) => ({ results: createWorld(ctx).search(query, type) })
  }),

  readTool({
    name: 'open',
    description:
      'Open an Entity: typed fields, version, Page, current Facts (superseded and retired ones and every Page revision with history), links, backlinks and the count of Beliefs about it.',
    input: z.object({ handle, history: z.boolean().default(false) }),
    run: (ctx, { handle, history }) => createWorld(ctx).open(handle, history)
  }),

  writeTool({
    name: 'establish',
    description:
      'Establish a new NPC, Place, Faction or Topic. Refuses a name close to an existing Entity (returning the matches) unless you list them in distinct_from. [[Name]] links in the Page and Facts resolve to handles; unresolved ones come back with near-matches.',
    input: z.object({
      type: z.enum(ENTITY_TYPES),
      name: z.string().trim().min(1),
      aliases: z.array(z.string().trim().min(1)).default([]),
      fields: z.record(z.string(), z.unknown()).default({}),
      page: z.string().optional(),
      facts: z.array(newFact).default([]),
      distinct_from: z.array(handle).default([])
    }),
    run: (ctx, input) => {
      const result = createWorld(ctx).establish(input)
      return {
        result,
        event: {
          kind: 'entity_established',
          summary: `Established ${result.handle} (${input.name})`,
          data: { handle: result.handle, type: input.type },
          dmOnly
        }
      }
    }
  }),

  writeTool({
    name: 'edit_page',
    description:
      "Edit an Entity's Page. Pass patches of old/new text (each old must appear exactly once), or full text only into an empty Page. Every revision is kept. Unresolved [[links]] come back with near-matches; nothing is stubbed.",
    input: z
      .object({
        handle,
        version: z.int(),
        text: z.string().min(1).optional(),
        patches: z
          .array(z.object({ old: z.string().min(1), new: z.string() }))
          .min(1)
          .optional()
      })
      .refine((i) => (i.text === undefined) !== (i.patches === undefined), {
        message: 'Pass either text or patches, not both'
      }),
    run: (ctx, { handle, version, text, patches }) => {
      const change = text !== undefined ? { text } : { patches: patches! }
      const result = createWorld(ctx).editPage(handle, version, change)
      return {
        result,
        event: {
          kind: 'page_edited',
          summary: `Edited the Page of ${handle}`,
          data: { handle },
          dmOnly
        }
      }
    }
  }),

  writeTool({
    name: 'set_field',
    description:
      'Set one typed field of an Entity (or its name); null clears an optional field. Returns old, new and the version, and warns naming any current Fact that restates the field.',
    input: z.object({ handle, version: z.int(), field: z.string().min(1), value: z.unknown() }),
    run: (ctx, { handle, version, field, value }) => {
      const result = createWorld(ctx).setField(handle, version, field, value ?? null)
      return {
        result,
        event: {
          kind: 'field_set',
          summary: `Set ${handle}.${field}`,
          data: { handle, field, old: result.old, new: result.new },
          dmOnly
        }
      }
    }
  }),

  writeTool({
    name: 'add_fact',
    description:
      "Add a Fact about an Entity. Pass the subject's version. valid_from is the in-fiction minute it became true (default now; null = since before the Campaign). Name in supersedes the current Facts it replaces: code closes them at valid_from. Nothing is superseded automatically.",
    input: z.object({
      subject: handle,
      version: z.int(),
      claim: z.string().trim().min(1),
      valid_from: minute.optional(),
      supersedes: z.array(z.int()).default([])
    }),
    run: (ctx, input) => {
      const result = createWorld(ctx).addFact(input)
      return {
        result,
        event: {
          kind: 'fact_added',
          summary: `Fact ${result.fact} about ${input.subject}`,
          data: { fact: result.fact, subject: input.subject, superseded: result.superseded },
          dmOnly
        }
      }
    }
  }),

  writeTool({
    name: 'supersede',
    description:
      'Record a supersession noticed later: Fact `by` replaces Fact `old`, which closes at the start of `by`.',
    input: z.object({ old: z.int(), by: z.int() }),
    run: (ctx, { old, by }) => {
      const result = createWorld(ctx).supersede(old, by)
      return {
        result,
        event: {
          kind: 'fact_superseded',
          summary: `Fact ${old} superseded by Fact ${by}`,
          data: { old, by },
          dmOnly
        }
      }
    }
  })
]
