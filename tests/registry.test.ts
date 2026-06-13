import { describe, expect, it } from 'vitest';
import {
	CONTROLLER_ACTIONS,
	allBindsConfigured,
	buildDefaultBindings,
	groupsForOptions,
} from '../src/core/controller-actions';
import { DEFAULT_CONFIG } from '../src/core/config';

// Enumerate the real bind-icon files at build time (Vite feature, no node fs).
const iconModules = import.meta.glob('../assets/bind-icons/*.svg', { eager: false });
const bindIconFiles = new Set(Object.keys(iconModules).map((p) => p.slice(p.lastIndexOf('/') + 1)));

describe('controller-actions registry', () => {
	it('flattening defaultInputs reproduces DEFAULT_CONFIG.bindings', () => {
		expect(buildDefaultBindings()).toEqual(DEFAULT_CONFIG.bindings);
	});

	it('every referenced icon exists in assets/bind-icons', () => {
		expect(bindIconFiles.size).toBeGreaterThan(0);
		for (const entry of CONTROLLER_ACTIONS) {
			if (entry.icon)
				expect(bindIconFiles.has(entry.icon), `${entry.id} -> ${entry.icon}`).toBe(true);
		}
	});

	it('action ids are unique', () => {
		const ids = CONTROLLER_ACTIONS.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('allBindsConfigured is true for the default bindings', () => {
		expect(allBindsConfigured(DEFAULT_CONFIG.bindings)).toBe(true);
	});

	it('allBindsConfigured is false when an action loses every input', () => {
		const bindings = { ...buildDefaultBindings() };
		// Space is the only default input for A; removing it leaves A unmapped.
		delete bindings['Space'];
		expect(allBindsConfigured(bindings)).toBe(false);
	});

	it('allBindsConfigured stays true if an action keeps one of several inputs', () => {
		const bindings = { ...buildDefaultBindings() };
		// D-pad up has ArrowUp + Digit1; dropping one keeps it mapped.
		delete bindings['Digit1'];
		expect(allBindsConfigured(bindings)).toBe(true);
	});

	it('groupsForOptions includes the mouse-driven Aim info group with no items', () => {
		const groups = groupsForOptions();
		const aim = groups.find((g) => g.title === 'Aim — Right Stick');
		expect(aim).toBeDefined();
		expect(aim?.items).toHaveLength(0);
		expect(aim?.info).toMatch(/mouse/i);
	});

	it('groupsForOptions covers every registry action', () => {
		const grouped = groupsForOptions().flatMap((g) => g.items);
		expect(grouped).toHaveLength(CONTROLLER_ACTIONS.length);
	});
});
