import { execFileSync } from 'node:child_process'
import os from 'node:os'

/**
 * Interfaces that carry no address a Player's device can reach: VPN and other tunnels, AirDrop
 * (AWDL, low-latency WLAN), VM and container bridges and virtual ethernet.
 */
const UNUSABLE_INTERFACE =
  /^(utun|awdl|llw|bridge|docker|br-|veth|vboxnet|vmnet|virbr|tun|tap|wg|tailscale|zt|ppp|ipsec|gif|stf)/i

/** macOS's Bonjour name for this machine, or undefined when it has none. */
function macLocalHostName(): string | undefined {
  try {
    return (
      execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

/**
 * The URLs other devices on the network join at: each usable non-internal IPv4 address, plus
 * `<LocalHostName>.local` on macOS, which survives a DHCP change.
 */
export function joinUrls({
  port,
  interfaces = os.networkInterfaces(),
  platform = process.platform,
  localHostName = macLocalHostName
}: {
  port: number
  interfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>
  platform?: NodeJS.Platform
  localHostName?: () => string | undefined
}): string[] {
  const urls: string[] = []
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (UNUSABLE_INTERFACE.test(name)) continue
    for (const info of addresses ?? []) {
      if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) continue
      urls.push(`http://${info.address}:${port}`)
    }
  }
  const hostName = platform === 'darwin' ? localHostName() : undefined
  if (hostName) urls.push(`http://${hostName}.local:${port}`)
  return urls
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Whether a request's Host header names this machine, i.e. the Host's own browser. */
export function isLocalHost(host: string | null): boolean {
  if (!host) return false
  try {
    return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname)
  } catch {
    return false
  }
}
