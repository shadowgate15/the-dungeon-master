import type { FakeDm } from '../../../src/testing/fake-dm.ts'

/**
 * Opens with a Narration, then answers the next three Floors with one Narration each.
 * Run: pnpm fake-dm <campaign folder> scripts/fake-dm/examples/narrate-floors.ts
 */
export default async function (dm: FakeDm) {
  await dm.call('narrate', { text: 'Rain drums on the roof of the Gilded Lantern.' })
  for (let turn = 1; turn <= 3; turn++) {
    dm.script({
      on: 'floor',
      run: async (event) => {
        const declarations = event.content.split('\n').filter(Boolean).length
        await dm.call('narrate', {
          text: `Turn ${turn}: the DM answers ${declarations || 'no'} Declaration(s).`
        })
      }
    })
    await dm.settled(10 * 60_000)
  }
}
