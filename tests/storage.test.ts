import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import type { Config } from '../src/core/types';

// ---- in-memory chrome.storage mock -----------------------------------------
//
// Models chrome.storage.local + .sync as plain object stores plus an onChanged
// dispatcher, so we can assert local-first reads, sync->local migration, the
// debounced sync backup, and onChanged normalization without a real browser.

type Store = Record<string, unknown>;
type ChangeListener = (
	changes: { [key: string]: chrome.storage.StorageChange },
	area: chrome.storage.AreaName,
) => void;

let localStore: Store;
let syncStore: Store;
let listeners: ChangeListener[];

function makeArea(store: () => Store, area: chrome.storage.AreaName) {
	return {
		get(key: string, cb: (items: Store) => void) {
			const s = store();
			cb(key in s ? { [key]: s[key] } : {});
		},
		set(items: Store, cb?: () => void) {
			const s = store();
			const changes: { [k: string]: chrome.storage.StorageChange } = {};
			for (const [k, v] of Object.entries(items)) {
				changes[k] = { oldValue: s[k], newValue: v };
				s[k] = v;
			}
			cb?.();
			for (const l of listeners) l(changes, area);
		},
	};
}

beforeEach(() => {
	localStore = {};
	syncStore = {};
	listeners = [];
	vi.useFakeTimers();
	(globalThis as unknown as { chrome: unknown }).chrome = {
		storage: {
			local: makeArea(() => localStore, 'local'),
			sync: makeArea(() => syncStore, 'sync'),
			onChanged: {
				addListener: (l: ChangeListener) => listeners.push(l),
				removeListener: (l: ChangeListener) => {
					listeners = listeners.filter((x) => x !== l);
				},
			},
		},
	};
});

afterEach(() => {
	vi.useRealTimers();
	vi.resetModules();
});

// Re-import fresh each test so the module-level debounce timer is isolated.
async function loadStorage() {
	return import('../src/shared/storage');
}

describe('readConfig', () => {
	it('reads local first and normalizes it', async () => {
		localStore.config = { ...DEFAULT_CONFIG, sensitivity: 999 }; // out of range
		const { readConfig } = await loadStorage();
		const cfg = await readConfig();
		expect(cfg.sensitivity).toBe(0.05); // clamped by normalizeConfig
		expect(syncStore.config).toBeUndefined(); // local hit: sync untouched
	});

	it('falls back to sync and migrates into local', async () => {
		syncStore.config = { ...DEFAULT_CONFIG, smoothing: 0.5 };
		const { readConfig } = await loadStorage();
		const cfg = await readConfig();
		expect(cfg.smoothing).toBe(0.5);
		// migrated copy now lives in local
		expect((localStore.config as Config).smoothing).toBe(0.5);
	});

	it('returns normalized defaults when nothing stored', async () => {
		const { readConfig } = await loadStorage();
		const cfg = await readConfig();
		expect(cfg).toEqual(DEFAULT_CONFIG);
	});
});

describe('writeConfig', () => {
	it('writes local immediately and debounces the sync backup', async () => {
		const { writeConfig } = await loadStorage();
		const cfg = { ...DEFAULT_CONFIG, invertY: true };
		await writeConfig(cfg);
		expect((localStore.config as Config).invertY).toBe(true); // instant
		expect(syncStore.config).toBeUndefined(); // not yet
		vi.advanceTimersByTime(400);
		expect((syncStore.config as Config).invertY).toBe(true); // debounced
	});

	it('coalesces rapid writes into one sync backup', async () => {
		const { writeConfig } = await loadStorage();
		await writeConfig({ ...DEFAULT_CONFIG, aimMin: 0.1 });
		await writeConfig({ ...DEFAULT_CONFIG, aimMin: 0.2 });
		await writeConfig({ ...DEFAULT_CONFIG, aimMin: 0.3 });
		expect(syncStore.config).toBeUndefined();
		vi.advanceTimersByTime(400);
		expect((syncStore.config as Config).aimMin).toBeCloseTo(0.3);
	});
});

describe('onConfigChanged', () => {
	it('normalizes the new value and supports unsubscribe', async () => {
		const { onConfigChanged } = await loadStorage();
		const seen: Config[] = [];
		const off = onConfigChanged((c) => seen.push(c));

		localStore.config = { ...DEFAULT_CONFIG, aimCurve: 99 }; // out of range
		// fire a change
		(globalThis as unknown as { chrome: typeof chrome }).chrome.storage.local.set({
			config: localStore.config,
		});
		expect(seen).toHaveLength(1);
		expect(seen[0].aimCurve).toBe(2); // clamped

		off();
		(globalThis as unknown as { chrome: typeof chrome }).chrome.storage.local.set({
			config: localStore.config,
		});
		expect(seen).toHaveLength(1); // no further callbacks after unsubscribe
	});
});
