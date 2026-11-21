/**
 * What of the Scene and the Event log may reach the browser. The DC of a Check is kept server-side
 * (on the open Call and in Call event data) and is stripped here, so the player never sees it.
 */
import type { SceneState, SceneView, SessionEvent } from '#lib/session/enums.ts'

/** An event without the DC in its data. */
export function clientEvent(event: SessionEvent): SessionEvent {
  if (!event.data || !('dc' in event.data)) return event
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dc, ...data } = event.data
  return { ...event, data }
}

/** The Scene with its open Call's DC left out. */
export function clientScene(scene: SceneState): SceneView {
  if (!scene.openCall) return { ...scene, openCall: null }
  if (scene.openCall.kind !== 'check') return { ...scene, openCall: scene.openCall }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dc, ...call } = scene.openCall
  return { ...scene, openCall: call }
}
