import { describe, expect, it } from 'vitest';
import { comboFromEvent, comboLabel, comboMatches } from '../src/core/combos';
import type { Combo } from '../src/core/types';

/** Minimal KeyboardEvent stand-in; the helpers only read these fields. */
function ev(
	code: string,
	mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {},
): KeyboardEvent {
	return {
		code,
		ctrlKey: !!mods.ctrl,
		altKey: !!mods.alt,
		shiftKey: !!mods.shift,
		metaKey: !!mods.meta,
	} as KeyboardEvent;
}

describe('comboFromEvent', () => {
	it('captures a plain key with no modifiers', () => {
		expect(comboFromEvent(ev('F8'))).toEqual({
			code: 'F8',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
	});

	it('captures a modified key', () => {
		expect(comboFromEvent(ev('KeyP', { ctrl: true, shift: true }))).toEqual({
			code: 'KeyP',
			ctrl: true,
			alt: false,
			shift: true,
			meta: false,
		});
	});

	it('excludes the modifier when the key IS the modifier (alone)', () => {
		expect(comboFromEvent(ev('ShiftLeft', { shift: true }))).toEqual({
			code: 'ShiftLeft',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
		expect(comboFromEvent(ev('ControlRight', { ctrl: true }))).toEqual({
			code: 'ControlRight',
			ctrl: false,
			alt: false,
			shift: false,
			meta: false,
		});
	});
});

describe('comboLabel', () => {
	it('orders modifiers Ctrl+Alt+Shift+Meta then the key', () => {
		const combo: Combo = { code: 'KeyP', ctrl: true, alt: true, shift: true, meta: true };
		expect(comboLabel(combo)).toBe('Ctrl+Alt+Shift+Meta+P');
	});

	it('labels a plain function key', () => {
		expect(comboLabel({ code: 'F9', ctrl: false, alt: false, shift: false, meta: false })).toBe(
			'F9',
		);
	});
});

describe('comboMatches', () => {
	it('round-trips a plain key', () => {
		const combo = comboFromEvent(ev('F8'));
		expect(comboMatches(combo, ev('F8'))).toBe(true);
		expect(comboMatches(combo, ev('F9'))).toBe(false);
	});

	it('round-trips a modified key and rejects modifier mismatch', () => {
		const combo = comboFromEvent(ev('KeyP', { ctrl: true }));
		expect(comboMatches(combo, ev('KeyP', { ctrl: true }))).toBe(true);
		expect(comboMatches(combo, ev('KeyP'))).toBe(false);
		expect(comboMatches(combo, ev('KeyP', { ctrl: true, shift: true }))).toBe(false);
	});

	it('a modifier-key-alone combo does not self-match (faithful legacy quirk)', () => {
		// comboFromEvent strips the modifier when the key IS the modifier, so the
		// stored combo has shift:false while any real ShiftLeft event has
		// shiftKey:true — the two never match. Matches legacy inject.js behavior.
		const combo = comboFromEvent(ev('ShiftLeft', { shift: true }));
		expect(combo.shift).toBe(false);
		expect(comboMatches(combo, ev('ShiftLeft', { shift: true }))).toBe(false);
		// It only matches a (physically impossible) ShiftLeft event with no shift.
		expect(comboMatches(combo, ev('ShiftLeft'))).toBe(true);
	});
});
