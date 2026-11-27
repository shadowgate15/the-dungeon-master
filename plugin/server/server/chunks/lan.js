import os from "node:os";
import { execFileSync } from "node:child_process";
// src/lib/server/lan.ts
/**
* Interfaces that carry no address a Player's device can reach: VPN and other tunnels, AirDrop
* (AWDL, low-latency WLAN), VM and container bridges and virtual ethernet.
*/
var UNUSABLE_INTERFACE = /^(utun|awdl|llw|bridge|docker|br-|veth|vboxnet|vmnet|virbr|tun|tap|wg|tailscale|zt|ppp|ipsec|gif|stf)/i;
/** macOS's Bonjour name for this machine, or undefined when it has none. */
function macLocalHostName() {
	try {
		return execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim() || void 0;
	} catch {
		return;
	}
}
/**
* The URLs other devices on the network join at: each usable non-internal IPv4 address, plus
* `<LocalHostName>.local` on macOS, which survives a DHCP change.
*/
function joinUrls({ port, interfaces = os.networkInterfaces(), platform = process.platform, localHostName = macLocalHostName }) {
	const urls = [];
	for (const [name, addresses] of Object.entries(interfaces)) {
		if (UNUSABLE_INTERFACE.test(name)) continue;
		for (const info of addresses ?? []) {
			if (info.family !== "IPv4" || info.internal || info.address.startsWith("169.254.")) continue;
			urls.push(`http://${info.address}:${port}`);
		}
	}
	const hostName = platform === "darwin" ? localHostName() : void 0;
	if (hostName) urls.push(`http://${hostName}.local:${port}`);
	return urls;
}
var LOCAL_HOSTNAMES = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"[::1]"
]);
/** Whether a request's Host header names this machine, i.e. the Host's own browser. */
function isLocalHost(host) {
	if (!host) return false;
	try {
		return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname);
	} catch {
		return false;
	}
}
export { joinUrls as n, isLocalHost as t };

//# sourceMappingURL=lan.js.map