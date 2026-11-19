import type { DroppedItem, MemoryRunKind, MemoryRunOutcome } from './enums.ts'

/** One memory-run row as the inspector shows it: counts and drop reasons, never item text. */
export interface MemoryRunSummary {
  id: string
  kind: MemoryRunKind
  outcome: MemoryRunOutcome
  fromSeq: number
  toSeq: number
  accepted: number
  dropped: number
  droppedItems: DroppedItem[]
  durationMs: number
  createdAt: number
}

/** What the Session page load hands the dev-only inspector's Memory section. */
export interface MemoryInspector {
  /** Extraction paused after repeated failures. */
  paused: boolean
  extractionRunning: boolean
  summaryRunning: boolean
  /** Latest Event seq in the log. */
  latestSeq: number
  /** The last Event seq extraction covers. */
  watermark: number
  /** Events not yet extracted: latest seq minus the watermark. */
  lag: number
  summaryThroughSeq: number
  lastExtraction: MemoryRunSummary | null
  lastSummary: MemoryRunSummary | null
  /** Newest first. */
  recent: MemoryRunSummary[]
}
