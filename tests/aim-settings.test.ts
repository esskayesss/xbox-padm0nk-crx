import { describe, expect, it } from 'vitest';
import {
	AIM_CONTROLS,
	aimConfigValue,
	aimDisplayFill,
	aimDisplayLabel,
	aimDisplayValue,
} from '../src/core/aim-settings';
import { DEFAULT_CONFIG } from '../src/core/config';

describe('aim-settings display mapping', () => {
	it('shows defaults in user-facing units', () => {
		expect(aimDisplayLabel(DEFAULT_CONFIG, 'sensitivity')).toBe('100%');
		expect(aimDisplayLabel(DEFAULT_CONFIG, 'smoothing')).toBe('25%');
		expect(aimDisplayLabel(DEFAULT_CONFIG, 'aimMin')).toBe('12%');
		expect(aimDisplayLabel(DEFAULT_CONFIG, 'aimCurve')).toBe('25%');
	});

	it('computes slider fill from display ranges', () => {
		expect(aimDisplayFill(DEFAULT_CONFIG, 'sensitivity')).toBe('33.33333333333333%');
		expect(aimDisplayFill(DEFAULT_CONFIG, 'smoothing')).toBe('26.31578947368421%');
	});

	it('round-trips display values to internal config values', () => {
		for (const control of AIM_CONTROLS) {
			const shown = aimDisplayValue(DEFAULT_CONFIG, control.key).toFixed(control.dp);
			const internal = aimConfigValue(control.key, shown);
			expect(internal).toBeCloseTo(DEFAULT_CONFIG[control.key], 6);
		}
	});

	it('clamps through the display mapping', () => {
		expect(aimConfigValue('sensitivity', '-999')).toBe(0.002);
		expect(aimConfigValue('sensitivity', '999')).toBe(0.05);
		expect(aimConfigValue('smoothing', '999')).toBe(0.95);
		expect(aimConfigValue('aimMin', '999')).toBe(0.5);
		expect(aimConfigValue('aimCurve', '999')).toBe(0.25);
		expect(aimConfigValue('aimCurve', '-999')).toBe(2);
	});
});
