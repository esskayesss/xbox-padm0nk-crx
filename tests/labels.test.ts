import { describe, expect, it } from 'vitest';
import { prettyInput } from '../src/core/labels';

describe('prettyInput', () => {
	it('labels all mouse buttons (incl. Mouse3/4 — the legacy drift fix)', () => {
		expect(prettyInput('Mouse0')).toBe('Left Click');
		expect(prettyInput('Mouse1')).toBe('Middle Click');
		expect(prettyInput('Mouse2')).toBe('Right Click');
		expect(prettyInput('Mouse3')).toBe('Mouse 4');
		expect(prettyInput('Mouse4')).toBe('Mouse 5');
	});

	it('labels wheel directions', () => {
		expect(prettyInput('WheelUp')).toBe('Wheel ↑');
		expect(prettyInput('WheelDown')).toBe('Wheel ↓');
	});

	it('strips Key / Digit prefixes', () => {
		expect(prettyInput('KeyW')).toBe('W');
		expect(prettyInput('Digit1')).toBe('1');
	});

	it('expands Arrow codes', () => {
		expect(prettyInput('ArrowUp')).toBe('Up Arrow');
		expect(prettyInput('ArrowDown')).toBe('Down Arrow');
		expect(prettyInput('ArrowLeft')).toBe('Left Arrow');
		expect(prettyInput('ArrowRight')).toBe('Right Arrow');
	});

	it('labels modifier keys and Backquote', () => {
		expect(prettyInput('ControlLeft')).toBe('L-Ctrl');
		expect(prettyInput('ControlRight')).toBe('R-Ctrl');
		expect(prettyInput('ShiftLeft')).toBe('L-Shift');
		expect(prettyInput('ShiftRight')).toBe('R-Shift');
		expect(prettyInput('AltLeft')).toBe('L-Alt');
		expect(prettyInput('AltRight')).toBe('R-Alt');
		expect(prettyInput('Backquote')).toBe('` (tilde)');
	});

	it('passes unknown ids through unchanged', () => {
		expect(prettyInput('F8')).toBe('F8');
		expect(prettyInput('Space')).toBe('Space');
	});
});
