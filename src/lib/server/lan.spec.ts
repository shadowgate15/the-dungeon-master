import { describe, expect, it } from 'vitest'
import { isLocalHost, joinUrls } from './lan'

type Ifaces = Parameters<typeof joinUrls>[0]['interfaces']

const v4 = (address: string, internal = false) => ({
  address,
  family: 'IPv4' as const,
  internal,
  netmask: '255.255.255.0',
  mac: '',
  cidr: null
})

describe('joinUrls', () => {
  it('lists non-internal IPv4 addresses as URLs on the port', () => {
    const interfaces = {
      lo0: [v4('127.0.0.1', true)],
      en0: [
        v4('192.168.1.20'),
        { ...v4('fe80::1'), family: 'IPv6' as const, netmask: '', cidr: null }
      ]
    } as unknown as Ifaces
    expect(joinUrls({ interfaces, port: 4777, platform: 'linux' })).toEqual([
      'http://192.168.1.20:4777'
    ])
  })

  it('leaves out VPN, AirDrop, bridge, container and link-local interfaces', () => {
    const interfaces = {
      en0: [v4('10.0.0.5')],
      utun3: [v4('10.8.0.2')],
      awdl0: [v4('10.1.1.1')],
      llw0: [v4('10.1.1.2')],
      bridge100: [v4('192.168.64.1')],
      docker0: [v4('172.17.0.1')],
      'br-abc123': [v4('172.18.0.1')],
      veth1: [v4('172.19.0.1')],
      tailscale0: [v4('100.64.0.1')],
      wg0: [v4('10.9.0.1')],
      en5: [v4('169.254.10.20')]
    } as unknown as Ifaces
    expect(joinUrls({ interfaces, port: 1, platform: 'linux' })).toEqual(['http://10.0.0.5:1'])
  })

  it('adds the <LocalHostName>.local name on macOS only', () => {
    const interfaces = { en0: [v4('10.0.0.5')] } as unknown as Ifaces
    expect(
      joinUrls({ interfaces, port: 9, platform: 'darwin', localHostName: () => 'Hosts-Mac' })
    ).toEqual(['http://10.0.0.5:9', 'http://Hosts-Mac.local:9'])
    expect(
      joinUrls({ interfaces, port: 9, platform: 'linux', localHostName: () => 'Hosts-Mac' })
    ).toEqual(['http://10.0.0.5:9'])
  })

  it('skips the name when macOS has none', () => {
    const interfaces = { en0: [v4('10.0.0.5')] } as unknown as Ifaces
    expect(
      joinUrls({ interfaces, port: 9, platform: 'darwin', localHostName: () => undefined })
    ).toEqual(['http://10.0.0.5:9'])
  })
})

describe('isLocalHost', () => {
  it('recognises the machine itself and nothing else', () => {
    expect(isLocalHost('localhost:4777')).toBe(true)
    expect(isLocalHost('127.0.0.1:4777')).toBe(true)
    expect(isLocalHost('[::1]:4777')).toBe(true)
    expect(isLocalHost('192.168.1.20:4777')).toBe(false)
    expect(isLocalHost(null)).toBe(false)
  })
})
