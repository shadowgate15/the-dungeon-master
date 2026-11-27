/**
 * What the request handler needs to know about LAN mode: whether the server is open to the
 * network, and the LAN Campaign, the one Campaign a remote browser may reach. The LAN Campaign is
 * the folder `dm` last launched a session in on this server, kept in memory so it lasts between
 * Sessions until another `dm` run replaces it or the server stops.
 */
type Access = { lan: boolean; campaign: string | undefined }

let state: Access = { lan: false, campaign: undefined }

export const lanAccess = {
  get lan() {
    return state.lan
  },
  get campaign() {
    return state.campaign
  },
  set(next: Partial<Access>) {
    state = { ...state, ...next }
  },
  reset() {
    state = { lan: false, campaign: undefined }
  }
}

/** Whether a remote browser may reach this path: the LAN Campaign's pages and APIs, and the shell they need. */
export function remoteMayReach(pathname: string, campaign: string): boolean {
  const own = [`/campaigns/${campaign}`, `/api/campaigns/${campaign}`]
  if (own.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return true
  return (
    pathname === '/api/events' ||
    pathname === '/api/sessions' ||
    pathname === '/theme' ||
    pathname.startsWith('/_app/')
  )
}
