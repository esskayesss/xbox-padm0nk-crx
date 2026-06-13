import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/core/config';
import type { Bindings } from '../src/core/types';

// Legacy DEFAULT_CONFIG.bindings, transcribed from .local/legacy/inject.js.
const EXPECTED_BINDINGS: Bindings = {
	KeyW: { t: 'a', a: 1, v: -1 },
	KeyS: { t: 'a', a: 1, v: 1 },
	KeyA: { t: 'a', a: 0, v: -1 },
	KeyD: { t: 'a', a: 0, v: 1 },
	Space: { t: 'b', i: 0 },
	ControlLeft: { t: 'b', i: 1 },
	KeyR: { t: 'b', i: 2 },
	KeyF: { t: 'b', i: 3 },
	KeyQ: { t: 'b', i: 4 },
	KeyE: { t: 'b', i: 5 },
	Mouse2: { t: 'b', i: 6 },
	Mouse0: { t: 'b', i: 7 },
	ShiftLeft: { t: 'b', i: 10 },
	KeyC: { t: 'b', i: 11 },
	Tab: { t: 'b', i: 8 },
	Enter: { t: 'b', i: 9 },
	Backquote: { t: 'b', i: 16 },
	ArrowUp: { t: 'b', i: 12 },
	ArrowDown: { t: 'b', i: 13 },
	ArrowLeft: { t: 'b', i: 14 },
	ArrowRight: { t: 'b', i: 15 },
	Digit1: { t: 'b', i: 12 },
	Digit2: { t: 'b', i: 13 },
	Digit3: { t: 'b', i: 14 },
	Digit4: { t: 'b', i: 15 },
};

describe('DEFAULT_CONFIG', () => {
	it('bindings match the legacy map exactly', () => {
		expect(DEFAULT_CONFIG.bindings).toEqual(EXPECTED_BINDINGS);
	});

	it('scalar defaults match the spec', () => {
		expect(DEFAULT_CONFIG.enabled).toBe(true);
		expect(DEFAULT_CONFIG.sensitivity).toBe(0.018);
		expect(DEFAULT_CONFIG.smoothing).toBe(0.25);
		expect(DEFAULT_CONFIG.aimMin).toBe(0.12);
		expect(DEFAULT_CONFIG.aimCurve).toBe(0.75);
		expect(DEFAULT_CONFIG.invertY).toBe(false);
		expect(DEFAULT_CONFIG.lockPointerOnClick).toBe(true);
		expect(DEFAULT_CONFIG.toggleKey).toBe('F8');
		expect(DEFAULT_CONFIG.toggleCombo).toEqual({
			code: 'F8',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
		expect(DEFAULT_CONFIG.helpCombo).toEqual({
			code: 'F9',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
	});
});

describe('normalizeConfig', () => {
	it('returns full defaults for empty / garbage input', () => {
		expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG);
		expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
		expect(normalizeConfig('nope')).toEqual(DEFAULT_CONFIG);
	});

	it('clamps out-of-range numerics', () => {
		const high = normalizeConfig({
			sensitivity: 999,
			smoothing: 5,
			aimMin: 9,
			aimCurve: 100,
		});
		expect(high.sensitivity).toBe(0.05);
		expect(high.smoothing).toBe(0.95);
		expect(high.aimMin).toBe(0.5);
		expect(high.aimCurve).toBe(2);

		const low = normalizeConfig({
			sensitivity: -1,
			smoothing: -1,
			aimMin: -1,
			aimCurve: 0,
		});
		expect(low.sensitivity).toBe(0.002);
		expect(low.smoothing).toBe(0);
		expect(low.aimMin).toBe(0);
		expect(low.aimCurve).toBe(0.25);
	});

	it('fills missing fields from defaults', () => {
		const c = normalizeConfig({ sensitivity: 0.03 });
		expect(c.sensitivity).toBe(0.03);
		expect(c.smoothing).toBe(DEFAULT_CONFIG.smoothing);
		expect(c.bindings).toEqual(DEFAULT_CONFIG.bindings);
	});

	it('recovers empty / missing bindings to defaults', () => {
		expect(normalizeConfig({ bindings: {} }).bindings).toEqual(DEFAULT_CONFIG.bindings);
		expect(normalizeConfig({ bindings: 'bad' }).bindings).toEqual(DEFAULT_CONFIG.bindings);
	});

	it('drops malformed binding entries but keeps valid ones', () => {
		const c = normalizeConfig({
			bindings: {
				KeyJ: { t: 'b', i: 3 },
				KeyK: { t: 'x' },
				KeyL: { t: 'a', a: 9, v: 2 },
			},
		});
		expect(c.bindings).toEqual({ KeyJ: { t: 'b', i: 3 } });
	});

	it('derives toggleCombo from a legacy toggleKey-only profile', () => {
		const c = normalizeConfig({ toggleKey: 'F10' });
		expect(c.toggleKey).toBe('F10');
		expect(c.toggleCombo).toEqual({
			code: 'F10',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
	});

	it('prefers an explicit toggleCombo over toggleKey', () => {
		const c = normalizeConfig({
			toggleKey: 'F10',
			toggleCombo: { code: 'KeyP', ctrl: true, alt: false, shift: false, meta: false },
		});
		expect(c.toggleCombo).toEqual({
			code: 'KeyP',
			ctrl: true,
			alt: false,
			shift: false,
			meta: false,
		});
	});
});
