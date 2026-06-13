import { describe, expect, it } from 'vitest';
import {
	AIM_CONTROLS,
	aimConfigValue,
	aimDisplayFill,
	aimDisplayValue,
} from '../src/core/aim-settings';
import { DEFAULT_CONFIG } from '../src/core/config';

/** Display value + unit, as the views render it (was the dead aimDisplayLabel). */
function shownLabel(key: Parameters<typeof aimDisplayValue>[1]): string {
	const control = AIM_CONTROLS.find((c) => c.key === key)!;
	return `${aimDisplayValue(DEFAULT_CONFIG, key).toFixed(control.dp)}${control.unit}`;
}

describe('aim-settings display mapping', () => {
	it('shows defaults in user-facing units', () => {
		expect(shownLabel('sensitivity')).toBe('100%');
		expect(shownLabel('smoothing')).toBe('25%');
		expect(shownLabel('aimMin')).toBe('12%');
		expect(shownLabel('aimCurve')).toBe('25%');
	});

	it('computes slider fill from display ranges', () => {
		expect(aimDisplayFill(DEFAULT_CONFIG, 'sensitivity')).toBeCloseTo(33.3333, 3);
		expect(aimDisplayFill(DEFAULT_CONFIG, 'smoothing')).toBeCloseTo(26.3158, 3);
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
