import { and, inArray, isNull } from 'drizzle-orm'
import { FIELD_LABELS, SEED_FIELDS } from '#lib/world/seed.ts'
import type { Database } from '../db/connect'
import { world } from '../db/schema'
import {
  runField,
  type FieldRequest,
  type FieldResult,
  type RunFieldOptions
} from './field-generation.ts'
import type { ChatPort } from './port.ts'

/**
 * Runs one field request with whatever context its flow needs from the database. World
 * needs none. Campaign loads the selected Worlds' Seeds into one extra system prompt on every
 * call; a World that is archived or missing fails with `context-invalid` before any model call.
 */

type WorldRow = typeof world.$inferSelect

function worldsPrompt(worlds: WorldRow[]) {
  if (worlds.length === 0) {
    return 'Worlds this Campaign is set in: none selected yet. Do not invent a setting; keep the value general.'
  }
  const blocks = worlds.map((w) => {
    const lines = SEED_FIELDS.map((f) => `  - ${FIELD_LABELS[f]}: ${w[f] || '(unset)'}`)
    return `- World:\n${lines.join('\n')}`
  })
  return `Worlds this Campaign is set in (stay consistent with them):\n${blocks.join('\n')}`
}

/** Loads the Worlds in the order requested; null when any is archived or missing. */
function loadActiveWorlds(db: Database, ids: string[]): WorldRow[] | null {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = db
    .select()
    .from(world)
    .where(and(inArray(world.id, unique), isNull(world.archivedAt)))
    .all()
  if (rows.length !== unique.length) return null
  return unique.map((id) => rows.find((w) => w.id === id)!)
}

export async function runFieldRequest(
  port: ChatPort,
  db: Database,
  request: FieldRequest,
  options: RunFieldOptions = {}
): Promise<FieldResult> {
  if (request.flow !== 'campaign') return runField(port, request, options)

  const worlds = loadActiveWorlds(db, request.worldIds)
  if (!worlds) {
    return {
      ok: false,
      failure: {
        kind: 'context-invalid',
        message:
          'A selected World was archived or deleted. Remove it from the Campaign to continue.'
      }
    }
  }
  return runField(port, request, {
    ...options,
    extraSystemPrompts: [...(options.extraSystemPrompts ?? []), worldsPrompt(worlds)]
  })
}
