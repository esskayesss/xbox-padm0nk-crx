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
 *   - axes[2,3] (right stick): mouse velocity → framerate-normalized → aimResponse
 *   - mouseDX/mouseDY: consumed (zeroed); velX/velY/lastAimT: aim integrator state
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

	// Right stick from mouse VELOCITY (framerate-independent).
	//
	// The legacy/early model mapped each frame's raw mouse delta straight to stick
	// deflection. Two defects fell out of that on high-refresh displays:
	//   1. Framerate dependence — at 180Hz a frame carries ~1/3 the pixels of a
	//      60Hz frame, so the same hand motion produced a weaker, jitterier stick.
	//   2. Per-frame collapse — any frame without a `mousemove` event (180fps > the
	//      mouse's event rate) zeroed the target, so the stick blinked back toward
	//      origin every few frames (visible on a gamepad tester; choppy in game).
	// Smoothing only masked #2, and trading it away for snappiness re-exposed it.
	//
	// Instead: estimate mouse velocity (px/s), smooth it with a framerate-
	// independent time-constant EMA, then normalize back to a 60fps-equivalent
	// per-frame delta before shaping. Result: identical feel at any refresh rate,
	// event-less frames barely dent velocity (no blink), and the stick recenters a
	// few time-constants after the mouse stops (no runaway coast).
	const sens = config.sensitivity;
	const dtMs = state.lastAimT > 0 ? clamp(now - state.lastAimT, 1, 50) : 1000 / 60;
	state.lastAimT = now;
	const dtS = dtMs / 1000;

	// note real mouse activity this frame (before we zero the delta) so we can tell
	// a genuine stop from a momentary event-less frame mid-motion.
	if (state.mouseDX !== 0 || state.mouseDY !== 0) state.lastMoveT = now;
	const idleMs = state.lastMoveT > 0 ? now - state.lastMoveT : Infinity;

	// instantaneous velocity this frame (px/s); a frame with no mouse event => 0
	const instVx = state.mouseDX / dtS;
	const instVy = state.mouseDY / dtS;
	state.mouseDX = 0;
	state.mouseDY = 0;

	// EMA toward instantaneous velocity. `smoothing` maps to the response time
	// constant: 0 => ~25ms (snappy), 0.25 (default) => ~85ms, up to ~253ms. The
	// dt/tau exponent makes it framerate-independent, so one event-less frame only
	// nudges the velocity instead of collapsing it.
	const tauMs = 25 + clamp(config.smoothing, 0, 0.95) * 240;
	const a = 1 - Math.exp(-dtMs / tauMs);
	state.velX += a * (instVx - state.velX);
	state.velY += a * (instVy - state.velY);

	// Recenter on a GENUINE stop, not on small/slow motion. The old approach used a
	// magnitude deadzone (discard velocity below a threshold) — but that silently
	// dropped small, slow adjustments, which hit the vertical axis hardest since Y
	// movements are typically smaller than X. Instead, snap to center only after the
	// mouse has carried no real input for REST_MS. While moving (even sub-pixel,
	// even across event-less frames) every motion registers, symmetric on both axes.
	const REST_MS = 50;
	if (idleMs > REST_MS) {
		state.velX = 0;
		state.velY = 0;
	}

	// normalize velocity to px-per-60fps-frame so `sensitivity` keeps its meaning
	// (calibrated against 60fps), then shape into stick deflection. The aimMin floor
	// inside aimResponse lifts even tiny motion above the game's own stick deadzone.
	const rawX = (state.velX / 60) * sens;
	const rawY = (state.velY / 60) * sens * (config.invertY ? -1 : 1);
	axes[AXIS.RX] = rawX === 0 ? 0 : aimResponse(rawX, config.aimMin, config.aimCurve);
	axes[AXIS.RY] = rawY === 0 ? 0 : aimResponse(rawY, config.aimMin, config.aimCurve);

	state.timestamp = now;
}
