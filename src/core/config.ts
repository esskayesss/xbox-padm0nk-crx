// Default configuration and defensive normalization.

import { AIM_LIMITS } from './aim-settings';
import { buildDefaultBindings } from './controller-actions';
import type { Action, Bindings, Combo, Config } from './types';

/** Built once; bindings derived from the controller-actions registry. */
export const DEFAULT_CONFIG: Config = {
	enabled: true,
	sensitivity: 0.018,
	smoothing: 0.25,
	aimMin: 0.12,
	aimCurve: 0.75,
	invertY: false,
	lockPointerOnClick: true,
	toggleKey: 'F8',
	toggleCombo: { code: 'F8', ctrl: false, alt: false, shift: false, meta: false },
	helpCombo: { code: 'F9', ctrl: false, alt: false, shift: false, meta: false },
	bindings: buildDefaultBindings(),
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null;
}

/** Coerce to a finite number, falling back to a default, then clamp to range. */
function num(value: unknown, fallback: number, lo: number, hi: number): number {
	const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	return clamp(n, lo, hi);
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/** Validate a single action shape; returns null if malformed. */
function normalizeAction(raw: unknown): Action | null {
	if (!isRecord(raw)) return null;
	if (raw.t === 'b') {
		const i = raw.i;
		if (typeof i === 'number' && Number.isInteger(i)) return { t: 'b', i };
		return null;
	}
	if (raw.t === 'a') {
		const a = raw.a;
		const v = raw.v;
		if ((a === 0 || a === 1) && (v === -1 || v === 1)) return { t: 'a', a, v };
		return null;
	}
	return null;
}

/** Keep only well-formed action entries from a raw bindings object. */
function normalizeBindings(raw: unknown): Bindings | null {
	if (!isRecord(raw)) return null;
	const out: Bindings = {};
	for (const [id, value] of Object.entries(raw)) {
		const action = normalizeAction(value);
		if (action) out[id] = action;
	}
	return Object.keys(out).length > 0 ? out : null;
}

/** Build a combo from raw input, falling back to a default. */
function normalizeCombo(raw: unknown, fallback: Combo): Combo {
	if (!isRecord(raw) || typeof raw.code !== 'string') return { ...fallback };
	return {
		code: raw.code,
		ctrl: bool(raw.ctrl, false),
		alt: bool(raw.alt, false),
		shift: bool(raw.shift, false),
		meta: bool(raw.meta, false),
	};
}

/**
 * Merge a raw (possibly partial / untrusted) config over the defaults.
 * Clamps numerics, coerces booleans, recovers empty bindings, and derives the
 * toggle combo from a legacy toggleKey-only profile (REBUILD.md bug item 4).
 */
export function normalizeConfig(raw: unknown): Config {
	const src = isRecord(raw) ? raw : {};

	const toggleKey = typeof src.toggleKey === 'string' ? src.toggleKey : DEFAULT_CONFIG.toggleKey;

	// Prefer an explicit toggleCombo; otherwise derive from legacy toggleKey.
	const toggleCombo = isRecord(src.toggleCombo)
		? normalizeCombo(src.toggleCombo, DEFAULT_CONFIG.toggleCombo)
		: normalizeCombo(
				{ code: toggleKey, ctrl: false, alt: false, shift: false, meta: false },
				DEFAULT_CONFIG.toggleCombo,
			);

	const bindings = normalizeBindings(src.bindings) ?? buildDefaultBindings();

	return {
		enabled: bool(src.enabled, DEFAULT_CONFIG.enabled),
		sensitivity: num(
			src.sensitivity,
			DEFAULT_CONFIG.sensitivity,
			AIM_LIMITS.sensitivity.min,
			AIM_LIMITS.sensitivity.max,
		),
		smoothing: num(
			src.smoothing,
			DEFAULT_CONFIG.smoothing,
			AIM_LIMITS.smoothing.min,
			AIM_LIMITS.smoothing.max,
		),
		aimMin: num(src.aimMin, DEFAULT_CONFIG.aimMin, AIM_LIMITS.aimMin.min, AIM_LIMITS.aimMin.max),
		aimCurve: num(
			src.aimCurve,
			DEFAULT_CONFIG.aimCurve,
			AIM_LIMITS.aimCurve.min,
			AIM_LIMITS.aimCurve.max,
		),
		invertY: bool(src.invertY, DEFAULT_CONFIG.invertY),
		lockPointerOnClick: bool(src.lockPointerOnClick, DEFAULT_CONFIG.lockPointerOnClick),
		toggleKey,
		toggleCombo,
		helpCombo: normalizeCombo(src.helpCombo, DEFAULT_CONFIG.helpCombo),
		bindings,
	};
}
