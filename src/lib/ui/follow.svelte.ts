import type { Attachment } from 'svelte/attachments'

/** How close to the bottom, in px, still counts as at the bottom. */
const AT_BOTTOM = 24

/** What the Player does that cuts the landing slide short. */
const PLAYER_INPUT = ['wheel', 'touchmove', 'keydown'] as const

/**
 * Keeps a scrolling list at its latest entry: attach it with
 * `{@attach follow(() => entries.length > 0)}`.
 *
 * Once `hasEntries()` first turns true, the list lands on its bottom, sliding down the last
 * screenful (or jumping, under reduced motion). From then on, while the list is following,
 * anything that makes its content taller keeps it at the bottom. Scrolling away stops it
 * following; being back at the bottom starts it again.
 */
export function follow(hasEntries: () => boolean): Attachment<HTMLElement> {
  return (list) => {
    let landed = false
    let following = true
    /** The landing slide is under way, so its scroll events say nothing about the Player. */
    let sliding = false
    /** Where `follow` last put the list, so its own scroll events are not taken for the Player's. */
    let placed = -1

    const bottom = () => list.scrollHeight - list.clientHeight
    const jump = () => {
      list.scrollTop = bottom()
      placed = list.scrollTop
    }
    const slide = () => {
      sliding = bottom() - list.scrollTop >= 1
      if (sliding) list.scrollTo({ top: bottom(), behavior: 'smooth' })
    }

    $effect(() => {
      if (landed || !hasEntries()) return
      landed = true
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return jump()
      list.scrollTop = bottom() - list.clientHeight
      slide()
    })

    const stick = () => {
      if (!landed || !following) return
      if (sliding) slide()
      else jump()
    }
    // A row can grow without a DOM change (fonts loading, text rewrapping), so each row's size
    // is watched as well as the rows themselves.
    const resized = new ResizeObserver(stick)
    resized.observe(list)
    const watchRows = () => {
      for (const row of list.children) resized.observe(row)
    }
    watchRows()
    const changed = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) if (node instanceof Element) resized.unobserve(node)
      }
      watchRows()
      stick()
    })
    changed.observe(list, { childList: true, subtree: true, characterData: true })

    const onPlayerInput = () => (sliding = false)
    const onScroll = () => {
      if (sliding || list.scrollTop === placed) return
      following = bottom() - list.scrollTop <= AT_BOTTOM
    }
    const onScrollEnd = () => (sliding = false)
    for (const type of PLAYER_INPUT) list.addEventListener(type, onPlayerInput, { passive: true })
    list.addEventListener('scroll', onScroll, { passive: true })
    list.addEventListener('scrollend', onScrollEnd)

    return () => {
      changed.disconnect()
      resized.disconnect()
      for (const type of PLAYER_INPUT) list.removeEventListener(type, onPlayerInput)
      list.removeEventListener('scroll', onScroll)
      list.removeEventListener('scrollend', onScrollEnd)
    }
  }
}
