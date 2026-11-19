/** The Journal's shape, shared by the server read and the UI. See GLOSSARY.md (Journal). */
import type { NpcStatus, Stance } from './enums.ts'

export interface JournalPerson {
  id: string
  name: string
  role: string
  status: NpcStatus
  /** Stance toward the playing Character; neutral when none is recorded. */
  stance: Stance
}

export interface JournalPlace {
  id: string
  name: string
  description: string
}

export interface JournalFact {
  id: string
  title: string
  detail: string
}

/** The entries first established in one Session. */
export interface JournalGroup<T> {
  sessionId: string
  sessionNumber: number
  entries: T[]
}

/** Entries by kind, each grouped by Session, newest Session first. */
export interface Journal {
  people: JournalGroup<JournalPerson>[]
  places: JournalGroup<JournalPlace>[]
  facts: JournalGroup<JournalFact>[]
}

/** What a new Session's first view recaps. */
export interface Recap {
  source: 'summary' | 'narration'
  sessionId: string
  text: string
}
