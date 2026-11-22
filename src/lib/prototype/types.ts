// PROTOTYPE: props every play-screen variant takes.
import type { DmStatus } from './play-mock.ts'

export type Scenario = { combat: boolean; status: DmStatus; elapsed: number }
export type VariantProps = { scenario: Scenario; onsend: () => void; onresolve: () => void }
