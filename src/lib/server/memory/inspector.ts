/** Read-only memory state for the dev inspector: the memory-run rows plus in-process status. */
import { desc, eq } from 'drizzle-orm'
import type { MemoryInspector, MemoryRunSummary } from '#lib/memory/inspector.ts'
import type { Database } from '../db/connect.ts'
import { memoryRun } from '../db/schema.ts'
import type { MemoryExtraction } from './extraction.ts'
import type { RollingSummary } from './summary.ts'

const RECENT = 10

export function readMemoryInspector(
  db: Database,
  extraction: MemoryExtraction,
  summary: RollingSummary,
  sessionId: string,
  latestSeq: number
): MemoryInspector {
  const recent: MemoryRunSummary[] = db
    .select()
    .from(memoryRun)
    .where(eq(memoryRun.sessionId, sessionId))
    .orderBy(desc(memoryRun.createdAt), desc(memoryRun.toSeq))
    .limit(50)
    .all()
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      outcome: r.outcome,
      fromSeq: r.fromSeq,
      toSeq: r.toSeq,
      accepted: r.accepted,
      dropped: r.dropped,
      droppedItems: r.droppedItems,
      durationMs: r.durationMs,
      createdAt: r.createdAt
    }))
  const watermark = extraction.watermark(sessionId)
  return {
    paused: extraction.paused(sessionId),
    extractionRunning: extraction.running(sessionId),
    summaryRunning: summary.running(sessionId),
    latestSeq,
    watermark,
    lag: Math.max(0, latestSeq - watermark),
    summaryThroughSeq: summary.get(sessionId).throughSeq,
    lastExtraction: recent.find((r) => r.kind === 'extraction') ?? null,
    lastSummary: recent.find((r) => r.kind === 'summary') ?? null,
    recent: recent.slice(0, RECENT)
  }
}
