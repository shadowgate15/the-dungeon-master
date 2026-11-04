// PROTOTYPE (throwaway): in-memory mock of the character creation wizard's state and rules.
// Answers "how should the wizard look and behave"; none of this is production logic.

import { SvelteSet } from 'svelte/reactivity'

export const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
export type Ability = (typeof ABILITIES)[number]
export type StepId = 'concept' | 'abilities' | 'skills' | 'equipment' | 'spells' | 'review'
export type StepStatus = 'locked' | 'incomplete' | 'attention' | 'valid'

export const STEP_LABELS: Record<StepId, string> = {
  concept: 'Concept',
  abilities: 'Ability scores',
  skills: 'Skills',
  equipment: 'Equipment',
  spells: 'Spells',
  review: 'Review'
}

type Race = {
  bonus: Partial<Record<Ability, number>>
  subraces: Record<string, Partial<Record<Ability, number>>>
}
export const RACES: Record<string, Race> = {
  Human: { bonus: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, subraces: {} },
  Elf: { bonus: { DEX: 2 }, subraces: { 'High Elf': { INT: 1 }, 'Wood Elf': { WIS: 1 } } },
  Dwarf: {
    bonus: { CON: 2 },
    subraces: { 'Hill Dwarf': { WIS: 1 }, 'Mountain Dwarf': { STR: 2 } }
  },
  Halfling: { bonus: { DEX: 2 }, subraces: { Lightfoot: { CHA: 1 }, Stout: { CON: 1 } } }
}

type Cls = {
  hitDie: number
  saves: Ability[]
  skillCount: number
  skills: string[]
  caster: boolean
  primary: Ability[]
  equipment: string[][] // slots -> options
}
export const CLASSES: Record<string, Cls> = {
  Fighter: {
    hitDie: 10,
    saves: ['STR', 'CON'],
    skillCount: 2,
    skills: [
      'Acrobatics',
      'Animal Handling',
      'Athletics',
      'History',
      'Insight',
      'Intimidation',
      'Perception',
      'Survival'
    ],
    caster: false,
    primary: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    equipment: [['Chain mail'], ['A martial weapon and a shield', 'Two martial weapons']]
  },
  Wizard: {
    hitDie: 6,
    saves: ['INT', 'WIS'],
    skillCount: 2,
    skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    caster: true,
    primary: ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR'],
    equipment: [
      ['A quarterstaff', 'A dagger'],
      ['A component pouch', 'An arcane focus']
    ]
  },
  Rogue: {
    hitDie: 8,
    saves: ['DEX', 'INT'],
    skillCount: 4,
    skills: [
      'Acrobatics',
      'Athletics',
      'Deception',
      'Insight',
      'Intimidation',
      'Investigation',
      'Perception',
      'Performance',
      'Persuasion',
      'Sleight of Hand',
      'Stealth'
    ],
    caster: false,
    primary: ['DEX', 'CON', 'CHA', 'INT', 'WIS', 'STR'],
    equipment: [
      ['A rapier', 'A shortsword'],
      ['A shortbow and quiver', 'A shortsword']
    ]
  },
  Barbarian: {
    hitDie: 12,
    saves: ['STR', 'CON'],
    skillCount: 2,
    skills: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    caster: false,
    primary: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    equipment: [
      ['A greataxe', 'Any martial melee weapon'],
      ['Two handaxes', 'Any simple weapon']
    ]
  }
}
// Fighter's first slot is really "chain mail OR leather armor + longbow".
CLASSES.Fighter.equipment[0] = ['Chain mail', 'Leather armor, longbow and arrows']

export const SKILL_ABILITY: Record<string, Ability> = {
  Acrobatics: 'DEX',
  'Animal Handling': 'WIS',
  Arcana: 'INT',
  Athletics: 'STR',
  Deception: 'CHA',
  History: 'INT',
  Insight: 'WIS',
  Intimidation: 'CHA',
  Investigation: 'INT',
  Medicine: 'WIS',
  Nature: 'INT',
  Perception: 'WIS',
  Performance: 'CHA',
  Persuasion: 'CHA',
  Religion: 'INT',
  'Sleight of Hand': 'DEX',
  Stealth: 'DEX',
  Survival: 'WIS'
}
export const BACKGROUND_SKILLS = ['Insight', 'Religion'] // Acolyte, the only SRD background
export const CANTRIPS = ['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation', 'Ray of Frost']
export const SPELLS = [
  'Burning Hands',
  'Detect Magic',
  'Mage Armor',
  'Magic Missile',
  'Shield',
  'Sleep'
]
export const ALIGNMENTS = [
  'Lawful good',
  'Neutral good',
  'Chaotic good',
  'Lawful neutral',
  'True neutral',
  'Chaotic neutral',
  'Lawful evil',
  'Neutral evil',
  'Chaotic evil'
]

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
}
export type Method = 'array' | 'pointbuy' | 'roll'

export type Proposal = {
  id: number
  step: StepId
  label: string
  value: string
  status: 'pending' | 'accepted' | 'dismissed' | 'superseded'
  apply: () => void
}
export type ChatMsg = { from: 'you' | 'dm'; text: string; step: StepId; proposalIds?: number[] }

const mod = (n: number) => Math.floor((n - 10) / 2)
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export class Wizard {
  // Concept
  name = $state('')
  premise = $state('')
  race = $state('')
  subrace = $state('')
  cls = $state('')
  background = $state('')
  alignment = $state('')
  backstory = $state('')
  // Abilities
  method = $state<Method>('array')
  rolled = $state<number[] | null>(null)
  assign = $state<Record<Ability, number | null>>({
    STR: null,
    DEX: null,
    CON: null,
    INT: null,
    WIS: null,
    CHA: null
  })
  pb = $state<Record<Ability, number>>({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })
  // Skills / equipment / spells
  skills = $state<string[]>([])
  equipment = $state<(number | null)[]>([])
  cantrips = $state<string[]>([])
  spells = $state<string[]>([])

  current = $state<StepId>('concept')
  notices = $state<string[]>([])
  proposals = $state<Proposal[]>([])
  chat = $state<ChatMsg[]>([
    {
      from: 'dm',
      step: 'concept',
      text: 'Tell me about the hero you have in mind and I will suggest options. You decide what sticks.'
    }
  ])
  nextId = 1

  // ---- rules (mock) ----
  get cl() {
    return CLASSES[this.cls] as Cls | undefined
  }
  get steps(): StepId[] {
    return (['concept', 'abilities', 'skills', 'equipment', 'spells', 'review'] as StepId[]).filter(
      (s) => s !== 'spells' || this.cl?.caster
    )
  }
  get pool(): number[] {
    return this.method === 'array' ? STANDARD_ARRAY : (this.rolled ?? [])
  }
  base(a: Ability): number | null {
    if (this.method === 'pointbuy') return this.pb[a]
    const i = this.assign[a]
    return i === null ? null : (this.pool[i] ?? null)
  }
  racial(a: Ability): number {
    const r = RACES[this.race]
    return (r?.bonus[a] ?? 0) + (r?.subraces[this.subrace]?.[a] ?? 0)
  }
  score(a: Ability): number | null {
    const b = this.base(a)
    return b === null ? null : b + this.racial(a)
  }
  get pbSpent() {
    return ABILITIES.reduce((n, a) => n + (POINT_COST[this.pb[a]] ?? 0), 0)
  }
  /** The preview. Everything here is computed, never stored. */
  get stats() {
    const m = (a: Ability) => mod(this.score(a) ?? 10)
    const prof = 2
    const cl = this.cl
    const armor = cl && this.cls === 'Fighter' && this.equipment[0] === 0 ? 16 : null
    const ac =
      armor ??
      (this.cls === 'Barbarian'
        ? 10 + m('DEX') + m('CON')
        : this.cls === 'Rogue'
          ? 11 + m('DEX')
          : 10 + m('DEX'))
    const profSkills = [...BACKGROUND_SKILLS, ...this.skills]
    return {
      hp: cl ? cl.hitDie + m('CON') : null,
      ac: cl ? ac : null,
      prof,
      init: m('DEX'),
      speed: this.race === 'Dwarf' || this.race === 'Halfling' ? 25 : 30,
      mods: Object.fromEntries(ABILITIES.map((a) => [a, m(a)])) as Record<Ability, number>,
      saves: ABILITIES.map((a) => ({
        a,
        v: m(a) + (cl?.saves.includes(a) ? prof : 0),
        proficient: !!cl?.saves.includes(a)
      })),
      skillMods: [...new SvelteSet(profSkills)].map((s) => ({ s, v: m(SKILL_ABILITY[s]) + prof })),
      spellDc: cl?.caster ? 8 + prof + m('INT') : null,
      spellAtk: cl?.caster ? prof + m('INT') : null,
      cantripsAllowed: 3,
      spellsAllowed: cl?.caster ? Math.max(1, 1 + m('INT')) + 1 : 0,
      slots: cl?.caster ? 2 : 0
    }
  }

  // ---- validity ----
  get conceptMissing(): string[] {
    const need: [string, boolean][] = [
      ['name', !this.name.trim()],
      ['race', !this.race],
      [
        'subrace',
        !!this.race && Object.keys(RACES[this.race].subraces).length > 0 && !this.subrace
      ],
      ['class', !this.cls],
      ['background', !this.background]
    ]
    return need.filter(([, m]) => m).map(([n]) => n)
  }
  get conceptValid() {
    return this.conceptMissing.length === 0
  }
  flags(step: StepId): string[] {
    const out: string[] = []
    if (step === 'skills' && this.cl) {
      for (const s of this.skills) {
        if (!this.cl.skills.includes(s)) out.push(`${s} isn't a ${this.cls} skill`)
        if (BACKGROUND_SKILLS.includes(s)) out.push(`${s} is already granted by ${this.background}`)
      }
      if (this.skills.length > this.cl.skillCount)
        out.push(`You can only have ${this.cl.skillCount} skills`)
    }
    if (step === 'spells' && this.cl?.caster) {
      if (this.cantrips.length > this.stats.cantripsAllowed)
        out.push(`Only ${this.stats.cantripsAllowed} cantrips`)
      if (this.spells.length > this.stats.spellsAllowed)
        out.push(`Spell count changed with INT: you can prepare ${this.stats.spellsAllowed}`)
    }
    return out
  }
  complete(step: StepId): boolean {
    const cl = this.cl
    switch (step) {
      case 'concept':
        return this.conceptValid
      case 'abilities':
        return this.method === 'pointbuy'
          ? this.pbSpent <= 27
          : ABILITIES.every((a) => this.assign[a] !== null)
      case 'skills':
        return !!cl && this.skills.length === cl.skillCount
      case 'equipment':
        return !!cl && cl.equipment.every((_, i) => this.equipment[i] != null)
      case 'spells':
        return (
          this.cantrips.length === this.stats.cantripsAllowed &&
          this.spells.length === this.stats.spellsAllowed
        )
      case 'review':
        return this.steps.filter((s) => s !== 'review').every((s) => this.status(s) === 'valid')
    }
  }
  status(step: StepId): StepStatus {
    if (step !== 'concept' && !this.conceptValid) return 'locked'
    if (step === 'review') return this.complete('review') ? 'valid' : 'locked'
    if (this.flags(step).length) return 'attention'
    return this.complete(step) ? 'valid' : 'incomplete'
  }
  go(step: StepId) {
    if (this.status(step) !== 'locked') this.current = step
  }
  get next(): StepId | null {
    const i = this.steps.indexOf(this.current)
    return this.steps[i + 1] ?? null
  }
  get prev(): StepId | null {
    const i = this.steps.indexOf(this.current)
    return this.steps[i - 1] ?? null
  }

  // ---- changing earlier choices: keep-and-flag, or clear-and-say ----
  setRace(r: string) {
    this.race = r
    if (this.subrace && !(this.subrace in RACES[r].subraces)) {
      this.notices.push(`Subrace cleared: ${r} has no ${this.subrace}.`)
      this.subrace = ''
    }
  }
  setClass(c: string) {
    if (c === this.cls) return
    const had = this.equipment.some((e) => e != null)
    this.cls = c
    this.equipment = []
    if (had) this.notices.push(`Equipment cleared: ${c} has different starting-equipment choices.`)
    if (!CLASSES[c].caster && (this.cantrips.length || this.spells.length)) {
      this.cantrips = []
      this.spells = []
      this.notices.push(`Spells cleared: ${c} doesn't cast at level 1.`)
    }
    if (!this.steps.includes(this.current)) this.current = 'concept'
  }

  // ---- ability helpers ----
  setMethod(m: Method) {
    if (m === this.method) return
    this.method = m
    this.assign = { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null }
    this.pb = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
  }
  roll() {
    const one = () => {
      const d = Array.from(
        { length: 4 },
        () => 1 + Math.floor(Math.random() * 4 + Math.random() * 3)
      )
      return d
        .sort((a, b) => a - b)
        .slice(1)
        .reduce((x, y) => x + y, 0)
    }
    this.rolled = Array.from({ length: 6 }, one).sort((a, b) => b - a)
    this.assign = { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null }
  }
  usedIdx(except?: Ability) {
    return ABILITIES.filter((a) => a !== except)
      .map((a) => this.assign[a])
      .filter((i) => i !== null)
  }

  toggle(list: string[], v: string) {
    const i = list.indexOf(v)
    if (i >= 0) list.splice(i, 1)
    else list.push(v)
  }

  // ---- fake AI ----
  private add(step: StepId, label: string, value: string, apply: () => void): number {
    for (const p of this.proposals)
      if (p.step === step && p.label === label && p.status === 'pending') p.status = 'superseded'
    const id = this.nextId++
    this.proposals.push({ id, step, label, value, status: 'pending', apply })
    return id
  }
  say(text: string) {
    const step = this.current
    this.chat.push({ from: 'you', text, step })
    const ids: number[] = []
    let reply: string
    if (step === 'concept') {
      reply = 'A few ideas for the Concept:'
      ids.push(this.add(step, 'Name', 'Mira Ashvale', () => (this.name = 'Mira Ashvale')))
      ids.push(this.add(step, 'Class', 'Wizard', () => this.setClass('Wizard')))
      ids.push(
        this.add(step, 'Race', 'Elf (High Elf)', () => {
          this.setRace('Elf')
          this.subrace = 'High Elf'
        })
      )
      ids.push(
        this.add(
          step,
          'Backstory',
          'Raised in a monastery archive, Mira left the day the lamps went out one by one.',
          () =>
            (this.backstory =
              'Raised in a monastery archive, Mira left the day the lamps went out one by one.')
        )
      )
      ids.push(this.add(step, 'Background', 'Acolyte', () => (this.background = 'Acolyte')))
    } else if (step === 'abilities') {
      const order = this.cl?.primary ?? ABILITIES
      reply = `Standard array, weighted toward ${order[0]}:`
      ids.push(
        this.add(
          step,
          'Assignment',
          order.map((a, i) => `${a} ${STANDARD_ARRAY[i]}`).join(', '),
          () => {
            this.setMethod('array')
            order.forEach((a, i) => (this.assign[a] = i))
          }
        )
      )
    } else if (step === 'skills') {
      const pick = (this.cl?.skills ?? [])
        .filter((s) => !BACKGROUND_SKILLS.includes(s))
        .slice(0, this.cl?.skillCount ?? 2)
      reply = 'These fit the concept:'
      ids.push(
        this.add(
          step,
          'Skills',
          pick.join(', ') || 'Pick a class first',
          () => (this.skills = pick)
        )
      )
    } else if (step === 'equipment') {
      reply = 'I would take the first option in each slot.'
      ids.push(
        this.add(
          step,
          'Equipment',
          (this.cl?.equipment ?? []).map((s) => s[0]).join('; '),
          () => (this.equipment = (this.cl?.equipment ?? []).map(() => 0))
        )
      )
    } else if (step === 'spells') {
      reply = 'A sturdy opening spellbook:'
      ids.push(
        this.add(
          step,
          'Cantrips',
          'Fire Bolt, Mage Hand, Light',
          () => (this.cantrips = ['Fire Bolt', 'Mage Hand', 'Light'])
        )
      )
      ids.push(
        this.add(
          step,
          'Spells',
          'Magic Missile, Shield',
          () => (this.spells = ['Magic Missile', 'Shield'])
        )
      )
    } else {
      reply = 'Everything is valid. Read it over and save when you are happy.'
    }
    this.chat.push({ from: 'dm', text: reply, step, proposalIds: ids })
  }
  accept(id: number) {
    const p = this.proposals.find((x) => x.id === id)
    if (!p || p.status !== 'pending') return
    p.apply()
    p.status = 'accepted'
  }
  dismiss(id: number) {
    const p = this.proposals.find((x) => x.id === id)
    if (p?.status === 'pending') p.status = 'dismissed'
  }
  pending(step: StepId) {
    return this.proposals.filter((p) => p.step === step && p.status === 'pending')
  }
}
