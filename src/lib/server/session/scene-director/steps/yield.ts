import type { MenuOption } from '../types.ts'

/** Always offered: hands control back to the player. */
export const yieldOption: MenuOption = {
  verb: 'yield',
  offer: () => [
    {
      id: 'yield',
      hint: 'Stop and let the player act. Pick this when they have something to respond to.'
    }
  ],
  async *run() {
    yield* []
    return { type: 'done', reason: 'yield' }
  }
}
