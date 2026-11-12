// PROTOTYPE (issue: Journal panel). Throwaway fixtures: the real journal reads memory tables.
export type Kind = 'npc' | 'place' | 'faction' | 'event' | 'fact'
export type Entry = {
  id: string
  kind: Kind
  name: string
  summary: string
  /** npc only */
  status?: 'alive' | 'dead' | 'missing' | 'departed'
  stance?: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'allied'
  stanceNote?: string
  place?: string
  knows?: string[]
  session: number
  /** Relative to the previous Session (resumed) or the last Turn (live). */
  change: null | 'new' | 'updated'
  changeNote?: string
}
export type JournalState = 'empty' | 'first' | 'resumed'
export const KINDS: { kind: Kind; label: string; plural: string }[] = [
  { kind: 'npc', label: 'NPC', plural: 'People' },
  { kind: 'place', label: 'Place', plural: 'Places' },
  { kind: 'faction', label: 'Faction', plural: 'Factions' },
  { kind: 'event', label: 'Event', plural: 'Events' },
  { kind: 'fact', label: 'Fact', plural: 'Facts' }
]

const e = (x: Partial<Entry> & Pick<Entry, 'id' | 'kind' | 'name' | 'summary'>): Entry => ({
  session: 1,
  change: null,
  ...x
})

const first: Entry[] = [
  e({
    id: 'n1',
    kind: 'npc',
    name: 'Brenna Ashdown',
    summary: 'Innkeeper of the Gilded Stag; trades rumours for coin.',
    status: 'alive',
    stance: 'friendly',
    stanceNote: 'Liked that you paid your tab.',
    place: 'The Gilded Stag',
    knows: ['The mill burned on purpose'],
    change: 'new'
  }),
  e({
    id: 'p1',
    kind: 'place',
    name: 'The Gilded Stag',
    summary: 'A roadside inn in Hollowmere. Warm, loud, watched.',
    change: 'new'
  }),
  e({
    id: 'f1',
    kind: 'fact',
    name: 'The mill burned on purpose',
    summary: 'Scorch marks start inside the grain store, not the wheel.',
    change: 'new'
  })
]

const resumed: Entry[] = [
  e({
    id: 'n1',
    kind: 'npc',
    name: 'Brenna Ashdown',
    summary: 'Innkeeper of the Gilded Stag; trades rumours for coin.',
    status: 'alive',
    stance: 'allied',
    stanceNote: 'You pulled her cellar door off a fire.',
    place: 'The Gilded Stag',
    knows: ['The mill burned on purpose', 'Voss pays the watch'],
    change: 'updated',
    changeNote: 'Friendly → Allied',
    session: 1
  }),
  e({
    id: 'n2',
    kind: 'npc',
    name: 'Captain Voss',
    summary: 'Captain of the Hollowmere watch. Tired, clipped, owned by someone.',
    status: 'alive',
    stance: 'wary',
    stanceNote: 'Thinks you are the reason for the trouble.',
    place: 'Watch House',
    knows: ['Voss pays the watch'],
    change: 'new',
    session: 2
  }),
  e({
    id: 'n3',
    kind: 'npc',
    name: 'Old Tam',
    summary: 'Miller. Last seen running into the smoke.',
    status: 'missing',
    stance: 'neutral',
    place: 'Hollowmere Mill',
    change: 'updated',
    changeNote: 'Alive → Missing',
    session: 1
  }),
  e({
    id: 'n4',
    kind: 'npc',
    name: 'Sister Eleth',
    summary: 'Travelling cleric who bandaged your arm and asked nothing.',
    status: 'departed',
    stance: 'friendly',
    session: 1
  }),
  e({
    id: 'p1',
    kind: 'place',
    name: 'The Gilded Stag',
    summary: 'A roadside inn in Hollowmere. Warm, loud, watched.',
    session: 1
  }),
  e({
    id: 'p2',
    kind: 'place',
    name: 'Hollowmere Mill',
    summary: 'Burned to the footings. Still smoking when you left.',
    change: 'updated',
    changeNote: 'Now ruined',
    session: 2
  }),
  e({
    id: 'p3',
    kind: 'place',
    name: 'Watch House',
    summary: 'Stone and shuttered. Two guards at the door at all hours.',
    change: 'new',
    session: 2
  }),
  e({
    id: 'fa1',
    kind: 'faction',
    name: 'The Hollowmere Watch',
    summary: 'Keeps the peace by keeping quiet. Answers to Voss, who answers elsewhere.',
    change: 'new',
    session: 2
  }),
  e({
    id: 'ev1',
    kind: 'event',
    name: 'The mill fire',
    summary: 'Night of the harvest feast. The fire took the mill and nearly the street.',
    session: 1
  }),
  e({
    id: 'ev2',
    kind: 'event',
    name: 'Voss turned you out of the Watch House',
    summary: 'He wanted names. You had none he liked.',
    change: 'new',
    session: 2
  }),
  e({
    id: 'f1',
    kind: 'fact',
    name: 'The mill burned on purpose',
    summary: 'Scorch marks start inside the grain store, not the wheel.',
    session: 1
  }),
  e({
    id: 'f2',
    kind: 'fact',
    name: 'Voss pays the watch',
    summary: 'Brenna saw the purse change hands. She will not say whose it is.',
    change: 'new',
    session: 2
  })
]

export function journalFor(state: JournalState): Entry[] {
  return state === 'empty' ? [] : state === 'first' ? first : resumed
}
export const unseen = (entries: Entry[]) => entries.filter((x) => x.change !== null)
export const byKind = (entries: Entry[], kind: Kind) => entries.filter((x) => x.kind === kind)
