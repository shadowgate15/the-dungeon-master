import { z } from 'zod'
import {
  FIELD_LABELS,
  STEP_FIELDS,
  type CharacterField,
  type ConversationStep
} from '#lib/character/conversation.ts'
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY,
  ROLL,
  STANDARD_ARRAY,
  rollAbilityScores,
  rollTotals,
  validateAbilityScores
} from '#lib/character/ability-scores.ts'
import { ABILITY_METHODS, encodeRolls, parseAssignment } from '#lib/character/conversation.ts'
import {
  emptyDraft,
  LIMITS,
  resolverDraft,
  type CharacterDraft,
  type WizardRules
} from '#lib/character/draft.ts'
import { parseEquipmentPicks, parseFeaturePicks } from '#lib/character/conversation.ts'
import { categoryItems, equipmentGroups, ownedEquipment } from '#lib/character/equipment.ts'
import { classSpellOptions, spellAllowance, spellPickFlags } from '#lib/character/spells.ts'
import { groupIssues, groupLabel, skillsStepGroups } from '#lib/character/steps.ts'
import { deriveStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { loadWizardRules } from '../character/wizard-rules.ts'
import type { RulesRepository } from '../rules/repository'
import {
  createConversationEngine,
  SUMMARY_MAX,
  TURN_TIMEOUT_MS,
  type ChatPort,
  type ChatTool,
  type CompactResult,
  type Compaction,
  type ConversationEngine,
  type RunTurnOptions,
  type TurnInput,
  type TurnResult
} from './conversation-engine.ts'
import { REPLY_MAX } from '#lib/world/seed.ts'

/**
 * The Character creation conversation: one module over the shared engine (unchanged), serving
 * every wizard step. Per turn the client sends the browser-only draft and the active step; the
 * server resolves the draft's slugs through the Rules Data repository, adds a draft summary and
 * the step's legal options as extra system prompts, and builds a turn schema allowing only that
 * step's fields. Values are Rules Data slugs, never names or numbers.
 *
 * Failure policy on top of the engine:
 * - a draft slug that no longer resolves fails with `options-changed` before any model call;
 * - a proposal the step's validator rejects retries the whole turn (all or nothing) up to
 *   `MAX_RETRIES` times, with a correction naming each problem and the legal options, all within
 *   one turn deadline; then `invalid-output`. The player never sees a rejected attempt.
 *
 * EXTENSION POINT (#117, #118): a step plugs in by adding a `StepModule` to `STEP_MODULES` (its
 * proposal `schema`, `options` prompt, `validate`) and its fields/codecs to
 * `#lib/character/conversation.ts`. `ctx.rules` is the repository; `ctx.draft` the sent draft.
 * #118's `roll_ability_scores` tool and Roll cards extend `ChatRequest`/`TurnResult` on the
 * abilities step only; they do not touch the engine's field/proposal path.
 */

export const MAX_RETRIES = 2

/** What every step module reads: the draft as sent and the repository. */
export interface StepContext {
  draft: DraftView
  rules: RulesRepository
  /** Plain Rules Data for the resolver and the step helpers (the committed dataset). */
  wizard: WizardRules
  /** The set `roll_ability_scores` rolled this turn (one per turn), for validation and the card. */
  rolled?: number[][]
  /** Dice source for server-run rolls; injectable for tests. */
  random?: () => number
}

/** The draft fields the server reads. Later steps widen this (and `draftSchema` in request.ts). */
export type DraftView = Pick<
  CharacterDraft,
  'name' | 'race' | 'subrace' | 'class' | 'subclass' | 'background' | 'alignment'
> &
  Partial<Pick<CharacterDraft, 'appearance' | 'personality' | 'backstory'>> &
  Partial<Pick<CharacterDraft, 'abilityMethod' | 'baseScores' | 'abilityRolls'>> &
  Partial<Pick<CharacterDraft, 'picks' | 'equipment' | 'classSpells'>>

export interface StepModule {
  /** Zod shape of the `proposals` object: only this step's fields, all optional. */
  proposals: z.ZodRawShape
  /** The step's legal options with names and one-line descriptions, injected into the prompt. */
  options: (ctx: StepContext) => string
  /** One plain-language message per illegal proposal; empty when all are legal. */
  validate: (proposals: Partial<Record<CharacterField, string>>, ctx: StepContext) => string[]
  /** Server-run tools offered on this step only (best-effort; see `runCharacterTurn`). */
  tools?: (ctx: StepContext) => ChatTool[]
  /** Step guidance appended to the system prompt. */
  guidance: string
}

// --- Concept ------------------------------------------------------------------------------------

const oneLine = (s: string | null | undefined, max = 90) => {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const conceptModule: StepModule = {
  proposals: {
    name: z.string().max(LIMITS.name).optional(),
    race: z.string().max(100).optional(),
    subrace: z.string().max(100).optional(),
    class: z.string().max(100).optional(),
    background: z.string().max(100).optional(),
    alignment: z.string().max(100).optional(),
    appearance: z.string().max(LIMITS.appearance).optional(),
    personality: z.string().max(LIMITS.personality).optional(),
    backstory: z.string().max(LIMITS.backstory).optional()
  },
  guidance: `Current step: Concept. Propose name (short text), race, subrace, class, background and alignment (each a slug from the legal options, copied exactly), and the narrative fields appearance, personality and backstory (short text in the character's voice, under the stated limits). A subrace must belong to the chosen race. Never propose numbers, ability scores, equipment or spells here.`,
  options({ rules }) {
    const races = rules.races().map((r) => `- ${r.slug}: ${r.name} (${r.size}, speed ${r.speed})`)
    const subraces = rules
      .subraces()
      .map((s) => `- ${s.slug}: ${s.name} (race: ${s.race}) ${oneLine(s.description)}`)
    const classes = rules.classes().map((c) => `- ${c.slug}: ${c.name} (hit die d${c.hitDie})`)
    const backgrounds = rules
      .backgrounds()
      .map((b) => `- ${b.slug}: ${b.name} ${oneLine(b.description, 70)}`.trimEnd())
    const alignments = rules.alignments().map((a) => `- ${a.slug}: ${a.name}`)
    return [
      'Legal options for this step (use the slug before the colon):',
      `Races:\n${races.join('\n')}`,
      `Subraces:\n${subraces.join('\n')}`,
      `Classes:\n${classes.join('\n')}`,
      `Backgrounds:\n${backgrounds.join('\n')}`,
      `Alignments:\n${alignments.join('\n')}`
    ].join('\n')
  },
  validate(p, { draft, rules }) {
    const problems: string[] = []
    const known = (field: CharacterField, slugs: string[]) => {
      const v = p[field]
      if (v !== undefined && !slugs.includes(v)) {
        problems.push(`${FIELD_LABELS[field]} "${v}" is not a legal option.`)
      }
    }
    known(
      'race',
      rules.races().map((r) => r.slug)
    )
    known(
      'class',
      rules.classes().map((c) => c.slug)
    )
    known(
      'background',
      rules.backgrounds().map((b) => b.slug)
    )
    known(
      'alignment',
      rules.alignments().map((a) => a.slug)
    )
    if (p.subrace !== undefined) {
      const race = p.race ?? draft.race
      const sub = rules.subraces().find((s) => s.slug === p.subrace)
      if (!sub) problems.push(`Subrace "${p.subrace}" is not a legal option.`)
      else if (sub.race !== race) {
        problems.push(`Subrace "${p.subrace}" does not belong to the race "${race ?? 'none'}".`)
      }
    }
    if (p.name !== undefined && !p.name.trim()) problems.push('Name must not be empty.')
    return problems
  }
}

// --- Ability scores (#118) ----------------------------------------------------------------------

const METHOD_SLUGS = ABILITY_METHODS as readonly string[]

/** The value set an assignment must use: totals to place, or the point-buy rules. */
function abilitySets(ctx: StepContext) {
  const rolls = ctx.rolled ?? ctx.draft.abilityRolls ?? null
  return { rolls, totals: rolls ? rollTotals(rolls) : null }
}

const abilitiesModule: StepModule = {
  proposals: {
    abilityMethod: z.string().max(40).optional(),
    abilityAssignment: z.string().max(200).optional()
  },
  guidance: `Current step: Ability scores. You may propose abilityMethod (one of standard-array, point-buy, rolling) and abilityAssignment (every ability exactly once as "str=15, dex=14, con=13, int=12, wis=10, cha=8"). An assignment only arranges the value set below for the method in force; you never invent numbers. Never choose the method silently: propose it as abilityMethod for the player to accept, and arrange values only for a method the player chose or that you propose in the same reply. To roll, call the roll_ability_scores tool (only when the player asks to roll or has chosen rolling); never state dice results yourself. The player sees the roll as a card they accept or dismiss.`,
  options({ draft, rolled, random }: StepContext) {
    const ctx = { draft, rolled, random } as StepContext // only the ability data is read
    const { rolls, totals } = abilitySets(ctx)
    const lines = [
      'Legal options for this step:',
      `Methods (slug): standard-array, point-buy, rolling.`,
      `- standard-array: assign ${STANDARD_ARRAY.join(', ')}, each once.`,
      `- point-buy: ${POINT_BUY.budget} points, each score ${POINT_BUY.min} to ${POINT_BUY.max} (costs ${Object.entries(
        POINT_BUY.costs
      )
        .map(([score, cost]) => `${score}:${cost}`)
        .join(', ')}).`,
      `- rolling: ${ROLL.dice}d6 drop lowest, six times; assign the totals.`,
      `Player's current method: ${draft.abilityMethod ?? '(not chosen)'}.`
    ]
    if (rolls) lines.push(`Current rolled totals: ${totals!.join(', ')}.`)
    const scores = draft.baseScores
    if (scores) {
      lines.push(
        `Current base scores: ${ABILITY_KEYS.map((k) => `${ABILITY_LABELS[k]} ${scores[k] ?? 'unset'}`).join(', ')}.`
      )
    }
    return lines.join('\n')
  },
  tools(ctx) {
    return [
      {
        name: 'roll_ability_scores',
        description: `Rolls a full set of ability scores (six rolls of ${ROLL.dice}d6, lowest die dropped) with server code. Takes no arguments; returns each roll's dice and total. Call at most once.`,
        execute() {
          ctx.rolled ??= rollAbilityScores(ctx.random)
          return {
            rolls: ctx.rolled.map((dice, i) => ({
              roll: i + 1,
              dice,
              total: rollTotals([dice])[0]
            })),
            totals: rollTotals(ctx.rolled)
          }
        }
      }
    ]
  },
  validate(p, ctx) {
    const problems: string[] = []
    if (p.abilityMethod !== undefined && !METHOD_SLUGS.includes(p.abilityMethod)) {
      problems.push(
        `Ability score method "${p.abilityMethod}" is not a legal option (standard-array, point-buy or rolling).`
      )
    }
    if (p.abilityAssignment !== undefined) {
      const scores = parseAssignment(p.abilityAssignment)
      const method = (p.abilityMethod ?? ctx.draft.abilityMethod) as
        CharacterDraft['abilityMethod'] | undefined
      if (!scores) {
        problems.push(
          'Ability score assignment must list every ability once as "str=15, dex=14, con=13, int=12, wis=10, cha=8".'
        )
      } else if (!method || !METHOD_SLUGS.includes(method)) {
        problems.push(
          'No ability score method is chosen. Propose abilityMethod for the player to accept, or arrange values only after they choose one.'
        )
      } else {
        const { rolls } = abilitySets(ctx)
        const check = validateAbilityScores(method, scores, rolls)
        problems.push(...check.issues.map((i) => `Ability score assignment: ${i}`))
      }
    }
    return problems
  }
}

// --- Skills & features, equipment, spells (#117) -------------------------------------------------

/** The sent draft as a full `CharacterDraft` (fields the server does not read keep their empty value). */
function fullDraft(view: DraftView, patch: Partial<CharacterDraft> = {}): CharacterDraft {
  const base = emptyDraft()
  return {
    ...base,
    ...view,
    subclass: view.subclass ?? null,
    baseScores: view.baseScores ?? base.baseScores,
    abilityRolls: view.abilityRolls ?? null,
    abilityMethod: view.abilityMethod ?? null,
    picks: view.picks ?? {},
    equipment: view.equipment ?? {},
    classSpells: view.classSpells ?? [],
    ...patch
  }
}

const resolveDraft = (wizard: WizardRules, draft: CharacterDraft) =>
  resolveFeatures(wizard, resolverDraft(draft))

const FEATURE_FORMAT =
  'Format: "choice_key=slug,slug; choice_key=slug" using the choice keys and option slugs listed, exactly the stated number of picks per key.'

const skillsModule: StepModule = {
  proposals: { featurePicks: z.string().max(1500).optional() },
  guidance: `Current step: Skills & features. Propose featurePicks: picks for one or more of the open choices listed, each keyed by its choice key. ${FEATURE_FORMAT} Pick exactly the stated number for every key you include, never repeat a pick, and use only listed options. Never propose numbers, equipment or spells here.`,
  options({ draft, wizard }) {
    const groups = skillsStepGroups(resolveDraft(wizard, fullDraft(draft)))
    if (groups.length === 0) return 'There are no feature choices to make for this draft yet.'
    return [
      'Legal options for this step (choice key, how many to pick, then the option slugs):',
      ...groups.map((g) => {
        const options = g.options.filter((o) => !o.disabled).map((o) => `${o.slug} (${o.name})`)
        const current = g.picks.length ? ` Currently picked: ${g.picks.join(', ')}.` : ''
        return `- ${g.key}: ${groupLabel(g)}; pick ${g.choose}.${current} Options: ${options.join('; ')}`
      })
    ].join('\n')
  },
  validate(p, { draft, wizard }) {
    if (p.featurePicks === undefined) return []
    const picks = parseFeaturePicks(p.featurePicks)
    if (!picks) return [`Skills and features must be written as: ${FEATURE_FORMAT}`]
    const next = fullDraft(draft, { picks: { ...(draft.picks ?? {}), ...picks } })
    const groups = skillsStepGroups(resolveDraft(wizard, next))
    const problems: string[] = []
    for (const key of Object.keys(picks)) {
      const g = groups.find((x) => x.key === key)
      if (!g) {
        problems.push(`"${key}" is not a choice this Character has.`)
        continue
      }
      if (g.status !== 'valid') problems.push(...groupIssues(g))
    }
    return problems
  }
}

const EQUIPMENT_FORMAT =
  'Format: "choice_key=option_index:item_slug,item_slug; choice_key=option_index" with one item slug for each wildcard slot of the chosen option, in order, and nothing after the index when the option has no wildcard.'

const equipmentGroupsOf = (draft: DraftView, wizard: WizardRules) => {
  const full = fullDraft(draft)
  return equipmentGroups(wizard, full, resolveDraft(wizard, full))
}

const equipmentModule: StepModule = {
  proposals: { equipmentPicks: z.string().max(1500).optional() },
  guidance: `Current step: Equipment. Propose equipmentPicks: an option for one or more of the choice groups listed, plus a specific item for every wildcard slot of the option. ${EQUIPMENT_FORMAT} Never choose a disabled option. Never propose numbers, skills or spells here.`,
  options({ draft, wizard }) {
    const groups = equipmentGroupsOf(draft, wizard)
    if (groups.length === 0) return 'There are no equipment choices to make for this draft yet.'
    const categories = new Set<string>()
    const lines = groups.map((g) => {
      const options = g.options.map((o) => {
        o.slots.forEach((c) => categories.add(c))
        const slots = o.slots.length ? ` [wildcard slots: ${o.slots.join(', ')}]` : ''
        return `  ${o.index}: ${o.label}${slots}${o.disabled ? ` (disabled: ${o.disabled})` : ''}`
      })
      return `- ${g.key} (${g.ownerName}): ${g.label}\n${options.join('\n')}`
    })
    const wildcard = [...categories].map(
      (c) =>
        `- ${c}: ${categoryItems(wizard, c)
          .map((i) => i.slug)
          .join(', ')}`
    )
    return [
      'Legal options for this step (choice key, then option index: summary):',
      ...lines,
      ...(wildcard.length ? ['Items for wildcard slots, by category:', ...wildcard] : [])
    ].join('\n')
  },
  validate(p, { draft, wizard }) {
    if (p.equipmentPicks === undefined) return []
    const picks = parseEquipmentPicks(p.equipmentPicks)
    if (!picks) return [`Equipment must be written as: ${EQUIPMENT_FORMAT}`]
    const groups = equipmentGroupsOf(draft, wizard)
    const problems: string[] = []
    for (const [key, pick] of Object.entries(picks)) {
      const g = groups.find((x) => x.key === key)
      if (!g) {
        problems.push(`"${key}" is not an equipment choice this Character has.`)
        continue
      }
      const option = g.options[pick.option]
      if (!option) {
        problems.push(`${key}: option ${pick.option} does not exist.`)
        continue
      }
      if (option.disabled) {
        problems.push(
          `${key}: option ${pick.option} (${option.label}) is disabled. ${option.disabled}`
        )
        continue
      }
      if (pick.wild.length !== option.slots.length) {
        problems.push(
          `${key}: option ${pick.option} needs ${option.slots.length} wildcard item(s), you gave ${pick.wild.length}.`
        )
        continue
      }
      option.slots.forEach((category, i) => {
        const item = pick.wild[i]
        if (!item || !categoryItems(wizard, category).some((c) => c.slug === item)) {
          problems.push(`${key}: "${item ?? ''}" is not a legal ${category} item.`)
        }
      })
    }
    return problems
  }
}

const spellList = (slugs: string[], wizard: WizardRules) =>
  slugs
    .map((slug) => `${slug} (${wizard.spells.find((s) => s.slug === slug)?.name ?? slug})`)
    .join('; ')

const spellsModule: StepModule = {
  proposals: { classSpells: z.string().max(1500).optional() },
  guidance: `Current step: Spells. Propose classSpells: the complete list of the Character's class cantrips and level 1 spells as comma-separated spell slugs (for example "light,mage-hand,magic-missile"), with exactly the stated number of each. The list replaces the player's current class picks. Use only listed spells. Never propose numbers, skills or equipment here.`,
  options({ draft, wizard }) {
    const full = fullDraft(draft)
    const allowance = spellAllowance(wizard, full.class)
    if (allowance.cantrips + allowance.spells === 0) {
      return 'This class picks no spells at level 1. Do not propose any.'
    }
    const resolved = resolveDraft(wizard, full)
    const taken = new Set([
      ...resolved.grantedSpells.map((s) => s.spell),
      ...resolved.groups.filter((g) => g.kind === 'spell').flatMap((g) => g.picks)
    ])
    const options = (level: 0 | 1) =>
      spellList(
        classSpellOptions(wizard, full.class, level)
          .map((o) => o.slug)
          .filter((slug) => !taken.has(slug)),
        wizard
      )
    return [
      `Legal options for this step: pick exactly ${allowance.cantrips} cantrips and ${allowance.spells} level 1 spells.`,
      `Cantrips: ${options(0)}`,
      `Level 1 spells: ${options(1)}`,
      `Current picks: ${full.classSpells.join(', ') || '(none)'}`
    ].join('\n')
  },
  validate(p, { draft, wizard }) {
    if (p.classSpells === undefined) return []
    const slugs = p.classSpells
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (slugs.length === 0) return ['Propose at least one spell slug, comma-separated.']
    const full = fullDraft(draft, { classSpells: slugs })
    const resolved = resolveDraft(wizard, full)
    const stats = deriveStats(wizard, resolved, {
      class: full.class,
      level: full.level,
      baseScores: full.baseScores,
      equipment: ownedEquipment(wizard, full, resolved)
    })
    const flags = spellPickFlags({ rules: wizard, draft: full, resolved, stats })
    const problems = flags.map((f) => f.reason)
    const flagged = new Set(flags.map((f) => f.slug))
    const allowance = spellAllowance(wizard, full.class)
    const count = (level: 0 | 1) =>
      slugs.filter(
        (s) => !flagged.has(s) && wizard.spells.find((x) => x.slug === s)?.level === level
      ).length
    if (count(0) !== allowance.cantrips) {
      problems.push(`Pick exactly ${allowance.cantrips} cantrips, you proposed ${count(0)}.`)
    }
    if (count(1) !== allowance.spells) {
      problems.push(`Pick exactly ${allowance.spells} level 1 spells, you proposed ${count(1)}.`)
    }
    return problems
  }
}

/** The registry: a step with no module has no AI help (the client keeps the chat idle there). */
export const STEP_MODULES: Record<ConversationStep, StepModule> = {
  concept: conceptModule,
  abilities: abilitiesModule,
  skills: skillsModule,
  equipment: equipmentModule,
  spells: spellsModule
}

// --- Prompts ------------------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are helping a player create a Dungeons & Dragons 5e Character in a step-by-step wizard, using only the SRD 5.1 rules content listed for you.
Reply with a short message (a sentence or two) and a "proposals" object holding only the fields you want to change, for the current step only.
You never invent rules, numbers or state: structural choices are slugs copied exactly from the legal options. The player accepts or dismisses each proposal; nothing changes until they accept.
Leave out fields you do not want to change. When the user gives feedback on a pending proposal, answer with a revised proposal for that same field.
Never repeat a proposal the user dismissed. Respect values the player already set unless asked to change them.`

const SUMMARY_PROMPT = `You compress the earlier part of a Character creation conversation so it can continue in a small context.
Write a short summary (a few sentences, under ${SUMMARY_MAX} characters) of the player's intent for the character: concept, personality, preferences and what they reject.
Include which proposals were dismissed and why they were unwanted. Keep a previous summary's still-relevant points. Do not invent details.`

function draftPrompt(draft: DraftView, rules: RulesRepository, step: ConversationStep) {
  const name = <T extends { slug: string; name: string }>(list: T[], slug: string | null) =>
    slug ? (list.find((e) => e.slug === slug)?.name ?? slug) : '(unset)'
  const lines = [
    `- Name: ${draft.name || '(unset)'}`,
    `- Race: ${name(rules.races(), draft.race)}${draft.race ? ` [${draft.race}]` : ''}`,
    `- Subrace: ${name(rules.subraces(), draft.subrace)}`,
    `- Class: ${name(rules.classes(), draft.class)}${draft.class ? ` [${draft.class}]` : ''}`,
    `- Background: ${name(rules.backgrounds(), draft.background)}${draft.background ? ` [${draft.background}]` : ''}`,
    `- Alignment: ${name(rules.alignments(), draft.alignment)}`
  ]
  for (const f of ['appearance', 'personality', 'backstory'] as const) {
    lines.push(`- ${FIELD_LABELS[f]}: ${draft[f]?.trim() ? oneLine(draft[f], 120) : '(unset)'}`)
  }
  return `Current Character draft (the player may have edited it). Active step: ${step}.\n${lines.join('\n')}`
}

// --- Engines ------------------------------------------------------------------------------------

const engines = new Map<ConversationStep, ConversationEngine<CharacterField>>()

/** One engine per step: the turn schema and proposable fields are fixed at engine creation. */
function engineFor(step: ConversationStep) {
  let engine = engines.get(step)
  if (!engine) {
    const fields = STEP_FIELDS[step] as readonly CharacterField[]
    engine = createConversationEngine<CharacterField>({
      systemPrompt: SYSTEM_PROMPT,
      summaryPrompt: SUMMARY_PROMPT,
      turnSchema: z.object({
        reply: z.string().max(REPLY_MAX),
        proposals: z.object(STEP_MODULES[step].proposals)
      }),
      fields,
      fieldLabels: FIELD_LABELS,
      // The draft summary arrives as an extra system prompt; this keeps the seed itself terse.
      seedPrompt: () => 'The live draft follows.'
    })
    engines.set(step, engine)
  }
  return engine
}

// --- Turn ---------------------------------------------------------------------------------------

export type CharacterTurnInput = TurnInput<CharacterField> & {
  step: ConversationStep
  draft: DraftView
}

const OPTIONS_CHANGED = {
  ok: false,
  failure: {
    kind: 'options-changed',
    message: 'A choice in your draft is no longer in the Rules Data. Review it and try again.'
  }
} as const

/** True when every slug the draft holds still resolves in Rules Data. */
function draftResolves(draft: DraftView, rules: RulesRepository) {
  const has = (list: { slug: string }[], slug: string | null) =>
    slug === null || slug === '' || list.some((e) => e.slug === slug)
  return (
    has(rules.races(), draft.race) &&
    has(rules.subraces(), draft.subrace) &&
    has(rules.classes(), draft.class) &&
    has(rules.subclasses(), draft.subclass) &&
    has(rules.backgrounds(), draft.background) &&
    has(rules.alignments(), draft.alignment)
  )
}

const INVALID_OUTPUT = {
  ok: false,
  failure: { kind: 'invalid-output', message: 'The model did not return a usable reply' }
} as const

export interface CharacterTurnOptions extends RunTurnOptions {
  /** Dice source for server-run tools (tests). */
  random?: () => number
  /** Plain Rules Data for the resolver (tests); defaults to the committed dataset. */
  wizardRules?: WizardRules
}

const NO_TOOLS_NOTE =
  'Tools are unavailable right now. Do not claim to roll; if the player wants to roll, tell them to use the Roll button on the step.'

export async function runCharacterTurn(
  port: ChatPort,
  rules: RulesRepository,
  { step, draft, ...input }: CharacterTurnInput,
  options: CharacterTurnOptions = {}
): Promise<TurnResult<CharacterField>> {
  if (!draftResolves(draft, rules)) return OPTIONS_CHANGED
  const module = STEP_MODULES[step]
  const ctx: StepContext = {
    draft,
    rules,
    wizard: options.wizardRules ?? loadWizardRules(),
    random: options.random
  }
  const engine = engineFor(step)
  const base = [
    module.guidance,
    draftPrompt(draft, rules, step),
    module.options(ctx),
    ...(input.extraSystemPrompts ?? [])
  ]

  // One deadline covers every attempt; each engine call gets what is left of it.
  const deadline = Date.now() + (options.timeoutMs ?? TURN_TIMEOUT_MS)
  let compaction: Compaction | undefined
  // Tools are best-effort: if the provider rejects the call, one retry goes without them.
  let tools = module.tools?.(ctx)
  let current: TurnInput<CharacterField> = {
    ...input,
    extraSystemPrompts: base,
    ...(tools && { tools })
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await engine.runTurn(port, current, {
      signal: options.signal,
      timeoutMs: Math.max(1, deadline - Date.now())
    })
    if (!result.ok) {
      if (tools && result.failure.kind === 'provider-error') {
        tools = undefined
        const { tools: _t, ...rest } = current
        void _t
        current = {
          ...rest,
          extraSystemPrompts: [...(rest.extraSystemPrompts ?? []), NO_TOOLS_NOTE]
        }
        base.push(NO_TOOLS_NOTE)
        attempt--
        continue
      }
      return result
    }
    compaction ??= result.compaction
    const problems = module.validate(result.proposals, ctx)
    if (problems.length === 0) {
      const { compaction: _drop, ...rest } = result
      void _drop
      // The Roll card comes first; it is the server's roll, not a model proposal.
      const proposals = ctx.rolled
        ? { abilityRolls: encodeRolls(ctx.rolled), ...rest.proposals }
        : rest.proposals
      return { ...rest, proposals, ...(compaction && { compaction }) }
    }
    // The retry carries the compaction the first call made, so it is not summarized twice.
    current = {
      ...input,
      ...(compaction ?? {}),
      ...(tools && { tools }),
      extraSystemPrompts: [
        ...base,
        `Your previous reply was rejected, so it was discarded. Fix every problem and reply again:\n${problems.map((p) => `- ${p}`).join('\n')}\nUse only the legal options listed above.`
      ]
    }
  }
  return INVALID_OUTPUT
}

/** The summary never includes the draft, so compaction needs neither it nor Rules Data. */
export function compactCharacterConversation(
  port: ChatPort,
  input: TurnInput<CharacterField> & { step: ConversationStep; draft?: unknown },
  options?: RunTurnOptions
): Promise<CompactResult> {
  const { step, draft: _draft, ...rest } = input
  void _draft
  return engineFor(step).compactConversation(port, rest, options)
}
