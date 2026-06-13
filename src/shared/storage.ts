// Typed, framework-free storage helper shared by popup + options + bridge.
//
// Storage strategy (local-first, sync-backup):
//   - chrome.storage.local is the FAST, LIVE store. Content scripts read it and
//     it fires onChanged synchronously in the same profile, so writing local is
//     the instant live-update path to the page.
//   - chrome.storage.sync is the cross-device BACKUP. It is slower, rate-limited,
//     and quota-constrained, so we only write it on a debounce (~400ms) and only
//     ever READ it as a fallback for old installs that predate the local store.
//   - On a sync-only profile we MIGRATE the config into local on first read so
//     every subsequent read is fast and the live-update path works.
//
// All raw reads pass through normalizeConfig so callers always get a complete,
// well-formed Config (clamped numerics, recovered bindings, derived combos).

import { DEFAULT_CONFIG, normalizeConfig } from '../core/config';
import type { Config } from '../core/types';

const KEY = 'config';
const SYNC_DEBOUNCE_MS = 400;

/** Promise-wrapped chrome.storage.<area>.get(KEY). Resolves the raw value. */
function rawGet(area: chrome.storage.StorageArea): Promise<unknown> {
	return new Promise((resolve) => {
		try {
			area.get(KEY, (res) => resolve(res ? res[KEY] : undefined));
		} catch {
			resolve(undefined);
		}
	});
}

/** Promise-wrapped chrome.storage.<area>.set({ [KEY]: value }). */
function rawSet(area: chrome.storage.StorageArea, value: Config): Promise<void> {
	return new Promise((resolve) => {
		try {
			area.set({ [KEY]: value }, () => resolve());
		} catch {
			resolve();
		}
	});
}

/**
 * Read the active config.
 *
 * local-first → sync-fallback (+ migrate to local) → normalized DEFAULT_CONFIG.
 * The result is always run through normalizeConfig, so callers never have to
 * defend against partial/old/untrusted stored shapes.
 */
export async function readConfig(): Promise<Config> {
	const local = await rawGet(chrome.storage.local);
	if (local != null) return normalizeConfig(local);

	// Fallback: old installs only ever wrote sync. Migrate it into local so the
	// fast/live path works from here on.
	const sync = await rawGet(chrome.storage.sync);
	if (sync != null) {
		const normalized = normalizeConfig(sync);
		await rawSet(chrome.storage.local, normalized);
		return normalized;
	}

	return normalizeConfig(DEFAULT_CONFIG);
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist the config.
 *
 * Writes chrome.storage.local immediately (instant live-update to content
 * scripts via onChanged), then debounces the chrome.storage.sync backup so we
 * don't burn the sync write quota on every slider tick. The debounce is shared
 * here so popup/options don't each reinvent it.
 *
 * Returns the local-write promise; the sync backup completes asynchronously.
 */
export function writeConfig(config: Config): Promise<void> {
	const localWrite = rawSet(chrome.storage.local, config);
	if (syncTimer != null) clearTimeout(syncTimer);
	syncTimer = setTimeout(() => {
		syncTimer = null;
		void rawSet(chrome.storage.sync, config);
	}, SYNC_DEBOUNCE_MS);
	return localWrite;
}

/**
 * Subscribe to config changes in either store. The new value is normalized
 * before invoking cb. Returns an unsubscribe function.
 */
export function onConfigChanged(cb: (config: Config) => void): () => void {
	const listener = (
		changes: { [key: string]: chrome.storage.StorageChange },
		area: chrome.storage.AreaName,
	): void => {
		if ((area === 'local' || area === 'sync') && changes[KEY]) {
			cb(normalizeConfig(changes[KEY].newValue));
		}
	};
	try {
		chrome.storage.onChanged.addListener(listener);
	} catch {
		return () => {};
	}
	return () => {
		try {
			chrome.storage.onChanged.removeListener(listener);
		} catch {
			/* no-op */
		}
	};
}
