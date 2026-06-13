import { describe, it, expect, vi } from 'vitest';
import {
	NAV_SENTINEL_KEY,
	isNavSentinel,
	shouldArmNavGuard,
	installNavGuard,
	type NavGuardEnv,
} from '../src/content/nav-guard';

describe('shouldArmNavGuard', () => {
	const cases: Array<[boolean, boolean, boolean, boolean]> = [
		// enabled, navButtonBound, pointerLocked => armed
		[true, true, true, true],
		[false, true, true, false],
		[true, false, true, false],
		[true, true, false, false],
		[false, false, false, false],
	];
	for (const [enabled, navButtonBound, pointerLocked, expected] of cases) {
		it(`enabled=${enabled} bound=${navButtonBound} locked=${pointerLocked} -> ${expected}`, () => {
			expect(shouldArmNavGuard({ enabled, navButtonBound, pointerLocked })).toBe(expected);
		});
	}
});

describe('isNavSentinel', () => {
	it('recognizes our tagged sentinel', () => {
		expect(isNavSentinel({ [NAV_SENTINEL_KEY]: true, ts: 1 })).toBe(true);
	});
	it('rejects null, empty, and foreign states', () => {
		expect(isNavSentinel(null)).toBe(false);
		expect(isNavSentinel(undefined)).toBe(false);
		expect(isNavSentinel({})).toBe(false);
		expect(isNavSentinel({ xcloud: 'route' })).toBe(false);
	});
});

/** A fake history stack + popstate dispatcher to drive the guard headless. */
function makeFakeEnv(initial: unknown = null) {
	const stack: unknown[] = [initial];
	let listener: (() => void) | null = null;
	const env: NavGuardEnv = {
		getState: () => stack[stack.length - 1],
		pushSentinel: (s) => stack.push(s),
		back: () => {
			stack.pop();
		},
		addPopstateListener: (fn) => {
			listener = fn;
		},
		removePopstateListener: (fn) => {
			if (listener === fn) listener = null;
		},
	};
	return {
		env,
		stack,
		hasListener: () => listener != null,
		/** Simulate a hardware back press: pop top entry, then fire popstate. */
		fireBack: () => {
			stack.pop();
			listener?.();
		},
		/** Simulate a popstate landing back on the current (sentinel) entry. */
		firePopNoChange: () => listener?.(),
	};
}

describe('installNavGuard', () => {
	it('arm() pushes a sentinel and registers a popstate listener', () => {
		const f = makeFakeEnv(null);
		const guard = installNavGuard({ onNavInput: vi.fn() }, f.env);
		guard.arm();
		expect(isNavSentinel(f.stack[f.stack.length - 1])).toBe(true);
		expect(f.hasListener()).toBe(true);
	});

	it('arm() is idempotent (no duplicate sentinels)', () => {
		const f = makeFakeEnv(null);
		const guard = installNavGuard({ onNavInput: vi.fn() }, f.env);
		guard.arm();
		guard.arm();
		expect(f.stack.length).toBe(2); // initial + one sentinel
	});

	it('a back press pops the sentinel, re-traps, and pulses the input', () => {
		const onNavInput = vi.fn();
		const f = makeFakeEnv({ page: 'game' });
		const guard = installNavGuard({ onNavInput }, f.env);
		guard.arm();
		f.fireBack();
		expect(onNavInput).toHaveBeenCalledTimes(1);
		// Re-trapped: sentinel is back on top so the page never actually leaves.
		expect(isNavSentinel(f.stack[f.stack.length - 1])).toBe(true);
	});

	it('a popstate that stays on the sentinel does nothing (forward return)', () => {
		const onNavInput = vi.fn();
		const f = makeFakeEnv(null);
		const guard = installNavGuard({ onNavInput }, f.env);
		guard.arm();
		f.firePopNoChange();
		expect(onNavInput).not.toHaveBeenCalled();
	});

	it('disarm() removes the listener and pops our sentinel when top-of-stack', () => {
		const f = makeFakeEnv({ page: 'game' });
		const guard = installNavGuard({ onNavInput: vi.fn() }, f.env);
		guard.arm();
		guard.disarm();
		expect(f.hasListener()).toBe(false);
		expect(f.stack[f.stack.length - 1]).toEqual({ page: 'game' }); // sentinel cleaned off
	});

	it('disarm() never pops a foreign top-of-stack entry', () => {
		const f = makeFakeEnv(null);
		const guard = installNavGuard({ onNavInput: vi.fn() }, f.env);
		guard.arm();
		// xCloud stacks its own entry above our sentinel.
		f.env.pushSentinel({ xcloud: 'route' });
		const depth = f.stack.length;
		guard.disarm();
		expect(f.stack.length).toBe(depth); // untouched — we don't pop foreign entries
	});

	it('disarmed guard ignores stray popstates', () => {
		const onNavInput = vi.fn();
		const f = makeFakeEnv(null);
		const guard = installNavGuard({ onNavInput }, f.env);
		guard.arm();
		guard.disarm();
		f.firePopNoChange();
		expect(onNavInput).not.toHaveBeenCalled();
	});
});
