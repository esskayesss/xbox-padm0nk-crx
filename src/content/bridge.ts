// padm0nk bridge — ISOLATED content-script world.
//
// Only this world has chrome.* APIs. The MAIN-world inject coordinator has NO
// chrome.* access (different JS world), so the bridge is the sole channel that:
//   1. reads the stored config (local-first, sync-fallback + migrate; see
//      shared/storage.ts for the rationale), and
//   2. resolves extension asset URLs via chrome.runtime.getURL and ships them to
//      MAIN through window.postMessage. MAIN cannot compute these URLs itself.
//
// fontUrl (Bug 6): legacy hotlinked Bahnschrift from the xbox CDN. We now ship a
// bundled, web-accessible font at assets/fonts/bahnschrift.woff and pass its
// extension URL here. If the file is absent / fails to load, MAIN-world UI
// (P5/P6) MUST fall back to the system stack:
//   "Bahnschrift", "Segoe UI", system-ui, sans-serif
// See assets/fonts/README.md.

import { onConfigChanged, readConfig } from '../shared/storage';
import type { Config } from '../core/types';

interface BridgePayload {
	__padm0nk: 'config';
	config: Config | Record<string, never>;
	controllerUrl: string;
	iconUrl: string;
	bindIconBase: string;
	fontUrl: string;
}

/** chrome.runtime.getURL with a guard for when chrome.* is unavailable. */
function getURL(path: string): string {
	try {
		return chrome.runtime?.getURL?.(path) ?? '';
	} catch {
		return '';
	}
}

// Last config we posted — replayed when MAIN sends a `hello` (handshake below).
let lastConfig: Config | Record<string, never> = {};
let loggedUrls = false;

/** Post config + freshly-resolved asset URLs to the MAIN world. */
function post(config: Config | Record<string, never>): void {
	lastConfig = config;
	const payload: BridgePayload = {
		__padm0nk: 'config',
		config,
		controllerUrl: getURL('assets/xbox-controller.svg'),
		iconUrl: getURL('icons/padm0nk.png'),
		bindIconBase: getURL('assets/bind-icons/'),
		// NEW (Bug 6): bundled font, no longer hotlinked from the xbox CDN.
		fontUrl: getURL('assets/fonts/bahnschrift.woff'),
	};
	// One-time diagnostic so a human can confirm the extension asset URLs resolve
	// (empty here would mean chrome.runtime.getURL failed / WAR misconfigured).
	if (!loggedUrls) {
		loggedUrls = true;
		console.log('[padm0nk] bridge asset URLs', {
			icon: payload.iconUrl,
			controller: payload.controllerUrl,
			bindIconBase: payload.bindIconBase,
		});
	}
	window.postMessage(payload, '*');
}

// HANDSHAKE (fixes the dynamic-import race): the MAIN-world inject coordinator
// registers its `message` listener asynchronously (CRXJS loads it via dynamic
// import), so a single proactive post can land before MAIN is listening — and
// every asset URL silently goes missing. So we BOTH (a) post proactively, and
// (b) reply to MAIN's `hello` pings with the latest payload. Asset URLs do not
// depend on storage, so we post them immediately too (before readConfig).
post({});

window.addEventListener('message', (e) => {
	if (e.source !== window) return;
	const d = e.data as { __padm0nk?: string } | null;
	if (d && d.__padm0nk === 'hello') post(lastConfig);
});

// Initial load. readConfig handles local-first → sync-fallback (+ migrate) and
// always returns a normalized Config. On any failure keep the empty config so
// MAIN still has the asset URLs and renders with safe defaults.
readConfig()
	.then((config) => post(config))
	.catch(() => post({}));

// Relay live config changes (popup/options write local; sync may also change).
// We re-post the full payload so MAIN's asset URLs stay fresh too.
onConfigChanged((config) => post(config));
