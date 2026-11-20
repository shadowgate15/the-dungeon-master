// Scores Exchange eval results and prints Markdown tables.
//
//   pnpm eval:exchange:report [results/*.json ...]   (default: every file in results/)
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CASES, type Case, type Category } from './cases.ts'
import type { Adjudication, Effect } from './contract.ts'
import type { Attempt, CaseRecord, CellResult } from './run.ts'

/** The categories the pass bar covers: every clear-cut one plus vague. Checks are scored on their own. */
export const GATE: Category[] = [
  'trivial',
  'move',
  'talk',
  'end_talk',
  'speech',
  'impossible',
  'vague'
]
const CATEGORIES: Category[] = [...GATE.slice(0, -1), 'check', 'vague']

const byId = new Map(CASES.map((c) => [c.id, c]))
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`)
const median = (xs: number[]) => {
  if (xs.length === 0) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const p90 = (xs: number[]) => {
  if (xs.length === 0) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]
}
const mean = (xs: number[]) =>
  xs.length === 0 ? 'n/a' : String(Math.round(xs.reduce((a, b) => a + b, 0) / xs.length))
const secs = (ms?: number) => (ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(2)}s`)

const adjudicationOf = (a: Attempt) => (a.ok ? (a.object as Adjudication) : undefined)

/** A field set that does not belong to the outcome (skill on happens, question on check, ...). */
function stray(a: Adjudication): boolean {
  const checkFields = a.skill !== undefined || a.difficulty !== undefined
  const askFields = a.question !== undefined || a.choices !== undefined
  return (a.outcome !== 'check' && checkFields) || (a.outcome !== 'ask' && askFields)
}

function effectCorrect(expected: Effect, attempt: Attempt): boolean {
  if (!attempt.ok) return false
  const got = attempt.object as Effect
  if (got.effect !== expected.effect) return false
  if (expected.effect === 'move') return got.exitId === expected.exitId
  if (expected.effect === 'talk') return got.npcId === expected.npcId
  return true
}

export interface Score {
  label: string
  model: string
  mode: string
  memory?: string
  n: number
  schemaValid: number
  correct: number
  gateN: number
  gateCorrect: number
  perCategory: Record<string, { n: number; correct: number }>
  checksCalled: number
  skillOk: number
  difficultyPresent: number
  asksCalled: number
  questionPresent: number
  strayFields: number
  effectN: number
  effectValid: number
  effectCorrect: number
  adjTtft: number[]
  adjTotal: number[]
  effTotal: number[]
  reasoningTokens: number[]
  passes: boolean
}

export function score(result: CellResult): Score {
  const s: Score = {
    label: result.label,
    model: result.model,
    mode: result.mode,
    memory: result.memory,
    n: 0,
    schemaValid: 0,
    correct: 0,
    gateN: 0,
    gateCorrect: 0,
    perCategory: {},
    checksCalled: 0,
    skillOk: 0,
    difficultyPresent: 0,
    asksCalled: 0,
    questionPresent: 0,
    strayFields: 0,
    effectN: 0,
    effectValid: 0,
    effectCorrect: 0,
    adjTtft: [],
    adjTotal: [],
    effTotal: [],
    reasoningTokens: [],
    passes: false
  }
  for (const r of result.records) {
    const c = byId.get(r.caseId)
    if (!c) continue
    const a = adjudicationOf(r.adjudication)
    const right = a?.outcome === c.outcome
    s.n++
    if (a) s.schemaValid++
    if (right) s.correct++
    if (GATE.includes(c.category)) {
      s.gateN++
      if (right) s.gateCorrect++
    }
    const cat = (s.perCategory[c.category] ??= { n: 0, correct: 0 })
    cat.n++
    if (right) cat.correct++
    if (a?.outcome === 'check') {
      s.checksCalled++
      if (a.difficulty) s.difficultyPresent++
      if (c.skills && a.skill && c.skills.includes(a.skill)) s.skillOk++
    }
    if (a?.outcome === 'ask') {
      s.asksCalled++
      if (a.question?.trim()) s.questionPresent++
    }
    if (a && stray(a)) s.strayFields++
    if (r.adjudication.ttftMs !== undefined) s.adjTtft.push(r.adjudication.ttftMs)
    s.adjTotal.push(r.adjudication.totalMs)
    if (r.adjudication.reasoningTokens !== undefined)
      s.reasoningTokens.push(r.adjudication.reasoningTokens)
    if (c.effect && r.effect) {
      s.effectN++
      if (r.effect.ok) s.effectValid++
      if (effectCorrect(c.effect, r.effect)) s.effectCorrect++
      s.effTotal.push(r.effect.totalMs)
    }
  }
  s.passes = s.schemaValid / s.n >= 0.9 && s.gateCorrect / s.gateN >= 0.9
  return s
}

/** Skill acceptability is scored only on check cases the model also called a check. */
function skillOnCheckCases(result: CellResult): { n: number; ok: number } {
  let n = 0
  let ok = 0
  for (const r of result.records) {
    const c = byId.get(r.caseId)
    const a = adjudicationOf(r.adjudication)
    if (c?.category !== 'check' || a?.outcome !== 'check') continue
    n++
    if (a.skill && c.skills?.includes(a.skill)) ok++
  }
  return { n, ok }
}

export function summaryTable(results: CellResult[]): string {
  const head =
    '| Cell | Mode | Memory | Schema-valid | Outcome (all) | Outcome (gate) | Vague→ask | Check outcome | Skill OK | Difficulty on check | Stray fields | Effect valid | Effect correct | Adj TTFT p50 / p90 | Adj total p50 / p90 | Reasoning tokens (mean) | Effect total p50 | Pass |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  const rows = results.map((result) => {
    const s = score(result)
    const vague = s.perCategory.vague ?? { n: 0, correct: 0 }
    const check = s.perCategory.check ?? { n: 0, correct: 0 }
    const skill = skillOnCheckCases(result)
    return `| ${s.label} | ${s.mode} | ${s.memory ?? 'n/a'} | ${pct(s.schemaValid, s.n)} | ${pct(s.correct, s.n)} | ${pct(s.gateCorrect, s.gateN)} | ${pct(vague.correct, vague.n)} | ${pct(check.correct, check.n)} | ${pct(skill.ok, skill.n)} | ${pct(s.difficultyPresent, s.checksCalled)} | ${pct(s.strayFields, s.schemaValid)} | ${pct(s.effectValid, s.effectN)} | ${pct(s.effectCorrect, s.effectN)} | ${secs(median(s.adjTtft))} / ${secs(p90(s.adjTtft))} | ${secs(median(s.adjTotal))} / ${secs(p90(s.adjTotal))} | ${mean(s.reasoningTokens)} | ${secs(median(s.effTotal))} | ${s.passes ? 'yes' : 'no'} |`
  })
  return [head, ...rows].join('\n')
}

export function categoryTable(results: CellResult[]): string {
  const head = `| Cell | ${CATEGORIES.join(' | ')} |\n| --- | ${CATEGORIES.map(() => '---').join(' | ')} |`
  const rows = results.map((result) => {
    const s = score(result)
    return `| ${s.label} | ${CATEGORIES.map((c) => pct(s.perCategory[c]?.correct ?? 0, s.perCategory[c]?.n ?? 0)).join(' | ')} |`
  })
  return [head, ...rows].join('\n')
}

/** Per case: how each cell's runs came out, e.g. `happens×4 check×1`. */
export function caseTable(results: CellResult[]): string {
  const head = `| Case | Expected | ${results.map((r) => r.label).join(' | ')} |\n| --- | --- | ${results.map(() => '---').join(' | ')} |`
  const tally = (records: CaseRecord[], c: Case) => {
    const counts = new Map<string, number>()
    for (const r of records.filter((x) => x.caseId === c.id)) {
      const a = adjudicationOf(r.adjudication)
      const key = a
        ? a.outcome + (a.outcome === 'check' && a.skill ? `:${a.skill}` : '')
        : 'INVALID'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts].map(([k, v]) => `${k}×${v}`).join(' ')
  }
  const rows = CASES.map(
    (c) =>
      `| ${c.id} | ${c.outcome}${c.skills ? `:${c.skills.join('/')}` : ''} | ${results.map((r) => tally(r.records, c)).join(' | ')} |`
  )
  return [head, ...rows].join('\n')
}

if (import.meta.main) {
  const dir = join(import.meta.dirname, 'results')
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => join(dir, f))
  const results = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as CellResult)
  console.log('## Summary\n')
  console.log(summaryTable(results))
  console.log('\n## Outcome accuracy by category\n')
  console.log(categoryTable(results))
  console.log('\n## Outcomes per case\n')
  console.log(caseTable(results))
}
