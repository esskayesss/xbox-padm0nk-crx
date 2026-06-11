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

	// Left stick: clamp each axis independently (legacy feel). An earlier build
	// radial-clamped the (x,y) vector to magnitude 1 so diagonals moved at unit
	// speed (~0.707 each) instead of legacy's ~1.41 — but that changed the feel
	// the project shipped with, so we keep legacy's per-axis clamp.
	axes[AXIS.LX] = clamp(acc0, -1, 1);
	axes[AXIS.LY] = clamp(acc1, -1, 1);

	// Right stick from mouse delta, WITH CARRY-OVER.
	//
	// The bug: mapping instantaneous mouse delta to stick POSITION caps at full
	// deflection (1.0). A fast flick produces `mouseDX * sensitivity` well above 1,
	// which clamps to 1 — and because we then zeroed the delta, every pixel beyond
	// what fit under full deflection was THROWN AWAY. Result: fast flicks "speed up
	// then plateau" and under-rotate, losing the tail of the motion.
	//
	// Fix: only consume the portion of the delta that fits under full deflection;
	// carry the remainder into the next frame. The stick stays pinned at max across
	// frames until the whole flick is delivered — full rotation, just rate-limited
	// by the stick ceiling (which the game enforces regardless). Within [-1,1] the
	// delta is consumed completely (excess 0), so slow/normal aim is unchanged.
	const sens = config.sensitivity;
	const rawX = state.mouseDX * sens;
	const rawY = state.mouseDY * sens;
	const rxTarget = aimResponse(rawX, config.aimMin, config.aimCurve);
	const ryTarget = aimResponse(rawY * (config.invertY ? -1 : 1), config.aimMin, config.aimCurve);
	// carry the overflow beyond full deflection (in mouse-pixel units) to next frame
	state.mouseDX = sens !== 0 ? (rawX - clamp(rawX, -1, 1)) / sens : 0;
	state.mouseDY = sens !== 0 ? (rawY - clamp(rawY, -1, 1)) / sens : 0;

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
