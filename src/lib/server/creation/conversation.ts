import { asc } from 'drizzle-orm'
import type { ConversationMessage } from '#lib/creation/conversation.ts'
import type { Queryable } from '../db/connect'
import { conversationMessage } from '../db/schema'

/** Adds a line to the creation conversation. It is out of fiction: never an Event. */
export function addConversationLine(
  db: Queryable,
  line: Pick<ConversationMessage, 'author' | 'text'> & { player?: string | null },
  at: number
): ConversationMessage {
  return db
    .insert(conversationMessage)
    .values({ author: line.author, player: line.player ?? null, text: line.text, createdAt: at })
    .returning()
    .get()
}

/** A Campaign's creation conversation, oldest first. */
export function conversationLines(db: Queryable): ConversationMessage[] {
  return db.select().from(conversationMessage).orderBy(asc(conversationMessage.id)).all()
}
