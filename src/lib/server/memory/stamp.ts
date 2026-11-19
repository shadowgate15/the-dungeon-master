/** Provenance columns for World memory rows: which Session and event seq wrote or last changed them. */
export const changedStamp = (sessionId: string, seq: number | null) => ({
  changedSessionId: sessionId,
  changedSeq: seq
})

/** A new row's provenance: created and changed at the same point. */
export const createdStamp = (sessionId: string, seq: number | null) => ({
  createdSessionId: sessionId,
  createdSeq: seq,
  ...changedStamp(sessionId, seq)
})
