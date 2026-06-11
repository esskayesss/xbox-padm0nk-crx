// Pure per-frame mapping tick: resolve held inputs + mouse delta into pad state.
// No side effects beyond mutating the passed state's buttons/axes/timestamp and
// consuming (zeroing) its mouse delta. Deterministic + unit-testable.

import { AXIS } from './constants';
import type { Config, GamepadState } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Aim response curve: shapes a raw normalized mouse delta into a stick output.
 * Lifts tiny deltas above in-game stick deadzones (via `aimMin` floor) and
 * applies a power curve (`aimCurve` < 1 boosts fine motion). Sign-preserving,
 * clamped to [-1, 1]. Exported for unit testing.
 */
export function aimResponse(raw: number, aimMin = 0.12, aimCurve = 0.75): number {
	const value = clamp(raw, -1, 1);
	const magnitude = Math.abs(value);
	if (magnitude === 0) return 0;
	const min = clamp(aimMin, 0, 0.5);
	const curve = clamp(aimCurve, 0.25, 2);
	const shaped = magnitude ** curve;
	return Math.sign(value) * clamp(min + (1 - min) * shaped, 0, 1);
}

/**
 * Advance the virtual pad by one frame. Mutates `state` in place:
 *   - buttons: 0/1 from held button bindings
 *   - axes[0,1] (left stick): summed held axis bindings, radial-clamped
 *   - axes[2,3] (right stick): mouse delta → aimResponse → smoothed toward target
 *   - mouseDX/mouseDY: consumed (zeroed)
 *   - timestamp: set to `now`
 */
export function step(config: Config, state: GamepadState, now: number): void {
	const buttons = state.buttons;
	const axes = state.axes;

	// reset buttons; accumulate left-stick deflection into locals
	buttons.fill(0);
	let acc0 = 0;
	let acc1 = 0;
	for (const id of state.held) {
		const b = config.bindings[id];
		if (!b) continue;
		if (b.t === 'b') {
			buttons[b.i] = 1;
		} else if (b.t === 'a') {
			if (b.a === AXIS.LX) acc0 += b.v;
			else acc1 += b.v;
		}
	}

	// Bug 1 — radial clamp (intentional divergence from legacy).
	// Legacy clamped each axis independently (clamp(ax0,-1,1); clamp(ax1,-1,1)),
	// so a diagonal like W+D produced the vector (1,1) with magnitude √2 ≈ 1.41 —
	// i.e. diagonal movement was ~41% faster than cardinal. We instead clamp the
	// (ax0,ax1) VECTOR to magnitude ≤ 1, scaling both components by 1/mag while
	// preserving direction. Cardinal inputs (mag ≤ 1) are unchanged; diagonals now
	// move at correct unit-circle speed (~0.707 each).
	const mag = Math.hypot(acc0, acc1);
	if (mag > 1) {
		acc0 /= mag;
		acc1 /= mag;
	}
	axes[AXIS.LX] = acc0;
	axes[AXIS.LY] = acc1;

	// Right stick from mouse delta. aimResponse lifts tiny deltas above in-game
	// stick deadzones so slow mouse movement still moves the crosshair.
	const rxTarget = aimResponse(state.mouseDX * config.sensitivity, config.aimMin, config.aimCurve);
	const ryTarget = aimResponse(
		state.mouseDY * config.sensitivity * (config.invertY ? -1 : 1),
		config.aimMin,
		config.aimCurve,
	);
	state.mouseDX = 0;
	state.mouseDY = 0;

	const s = clamp(config.smoothing, 0, 0.95);
	let nx = axes[AXIS.RX] * s + rxTarget * (1 - s);
	let ny = axes[AXIS.RY] * s + ryTarget * (1 - s);
	// snap tiny residue to zero so the stick truly recenters
	if (Math.abs(nx) < 0.005) nx = 0;
	if (Math.abs(ny) < 0.005) ny = 0;
	axes[AXIS.RX] = nx;
	axes[AXIS.RY] = ny;

	state.timestamp = now;
}
