import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { createGamepadState } from '../src/core/gamepad-state';
import { aimResponse, step } from '../src/core/mapper';
import type { Config } from '../src/core/types';

function cfg(overrides: Partial<Config> = {}): Config {
	return { ...DEFAULT_CONFIG, ...overrides };
}

describe('mapper.step — left stick', () => {
	it('holding KeyW deflects LY to -1', () => {
		const s = createGamepadState();
		s.held.add('KeyW');
		step(cfg(), s, 1);
		expect(s.axes[1]).toBeCloseTo(-1, 6);
		expect(s.axes[0]).toBe(0);
	});

	it('opposing W+S cancels to 0', () => {
		const s = createGamepadState();
		s.held.add('KeyW');
		s.held.add('KeyS');
		step(cfg(), s, 1);
		expect(s.axes[1]).toBe(0);
	});

	it('diagonal W+D clamps each axis independently to full deflection (legacy feel)', () => {
		const s = createGamepadState();
		s.held.add('KeyW'); // LY -1
		s.held.add('KeyD'); // LX +1
		step(cfg(), s, 1);
		// legacy parity: each axis reaches its full ±1 (diagonal magnitude ~1.41),
		// NOT radially clamped to ~0.707 — restores the original movement feel.
		expect(s.axes[0]).toBeCloseTo(1, 6); // LX +1
		expect(s.axes[1]).toBeCloseTo(-1, 6); // LY -1
		expect(Math.hypot(s.axes[0], s.axes[1])).toBeCloseTo(Math.SQRT2, 6);
	});

	it('button binding sets the mapped button to 1', () => {
		const s = createGamepadState();
		s.held.add('Space'); // A = index 0
		step(cfg(), s, 1);
		expect(s.buttons[0]).toBe(1);
		expect(s.buttons[1]).toBe(0);
	});
});

describe('mapper.step — right stick (mouse)', () => {
	it('invertY flips the ryTarget sign', () => {
		const a = createGamepadState();
		a.mouseDY = 100;
		step(cfg({ smoothing: 0, invertY: false }), a, 16);
		const normal = a.axes[3];

		const b = createGamepadState();
		b.mouseDY = 100;
		step(cfg({ smoothing: 0, invertY: true }), b, 16);
		const inverted = b.axes[3];

		expect(Math.sign(normal)).toBe(-Math.sign(inverted));
		expect(normal).toBeCloseTo(-inverted, 6);
	});

	it('ramps up while the mouse moves, then fully recenters after it stops (no coast)', () => {
		const s = createGamepadState();
		const c = cfg({ smoothing: 0.25 });
		const dt = 1000 / 180; // 180fps
		let t = 0;
		const up: number[] = [];
		for (let i = 0; i < 20; i++) {
			s.mouseDX = 8;
			t += dt;
			step(c, s, t);
			up.push(s.axes[2]);
		}
		expect(up[0]).toBeGreaterThan(0);
		expect(up[up.length - 1]).toBeGreaterThan(up[0]); // velocity EMA ramped up
		// mouse stops: the stick must decay back to exactly 0, not coast forever
		for (let i = 0; i < 120; i++) {
			s.mouseDX = 0;
			t += dt;
			step(c, s, t);
		}
		expect(s.axes[2]).toBe(0);
		expect(s.velX).toBe(0);
	});

	it('does not blink to 0 on a single event-less frame mid-motion', () => {
		const s = createGamepadState();
		const c = cfg({ smoothing: 0.25 });
		const dt = 1000 / 180;
		let t = 0;
		for (let i = 0; i < 10; i++) {
			s.mouseDX = 8;
			t += dt;
			step(c, s, t);
		}
		const moving = s.axes[2];
		expect(moving).toBeGreaterThan(0.1);
		// one frame where no mousemove arrived (180fps outruns the mouse event rate)
		s.mouseDX = 0;
		t += dt;
		step(c, s, t);
		// barely dips — must NOT collapse toward origin (the old per-frame bug)
		expect(s.axes[2]).toBeGreaterThan(moving * 0.8);
	});

	it('framerate-independent: same hand speed yields ~same deflection at 60 vs 180fps', () => {
		const run = (dtMs: number, pxPerFrame: number): number => {
			const s = createGamepadState();
			const c = cfg({ smoothing: 0.25 });
			let t = 0;
			for (let i = 0; i < 80; i++) {
				s.mouseDX = pxPerFrame;
				t += dtMs;
				step(c, s, t);
			}
			return s.axes[2];
		};
		// 24px/60fps and 8px/180fps are both 1440 px/s of hand motion
		const at60 = run(1000 / 60, 24);
		const at180 = run(1000 / 180, 8);
		expect(at180).toBeCloseTo(at60, 2);
	});

	it('recenters with a smooth ramp, not a floored plateau (no hard snap)', () => {
		const s = createGamepadState();
		const c = cfg({ smoothing: 0.25 });
		const dt = 1000 / 180;
		let t = 0;
		for (let i = 0; i < 30; i++) {
			s.mouseDX = 20;
			t += dt;
			step(c, s, t);
		}
		expect(s.axes[2]).toBeGreaterThan(0.12); // strongly deflected while moving
		const tail: number[] = [];
		for (let i = 0; i < 120; i++) {
			s.mouseDX = 0;
			t += dt;
			step(c, s, t);
			tail.push(s.axes[2]);
		}
		// once idle, the floor drops so output rides the decaying velocity DOWN through
		// the sub-aimMin region instead of holding 0.12 then snapping.
		expect(tail.some((v) => v > 0 && v < 0.12)).toBe(true);
		expect(tail[tail.length - 1]).toBe(0); // fully settled
	});

	it('registers small/slow motion instead of deadzoning it (symmetric X and Y)', () => {
		const dt = 1000 / 180;
		const run = (axis: 'x' | 'y'): number => {
			const s = createGamepadState();
			const c = cfg({ smoothing: 0.25 });
			let t = 0;
			// slow creep ~0.3px/frame (~55px/s) — below the old magnitude deadzone,
			// which silently dropped it (worst on the smaller-motion vertical axis).
			for (let i = 0; i < 40; i++) {
				if (axis === 'x') s.mouseDX = 0.3;
				else s.mouseDY = 0.3;
				t += dt;
				step(c, s, t);
			}
			return axis === 'x' ? s.axes[2] : s.axes[3];
		};
		const x = run('x');
		const y = run('y');
		expect(x).toBeGreaterThan(0); // small motion is NOT dropped
		expect(y).toBeGreaterThan(0);
		expect(y).toBeCloseTo(x, 6); // perfectly symmetric
	});

	it('deadzone snap: residue < 0.005 collapses to 0', () => {
		const s = createGamepadState();
		// seed a tiny residual right-stick value, then tick with no mouse input
		s.axes[2] = 0.004;
		s.axes[3] = -0.004;
		step(cfg({ smoothing: 0.9 }), s, 1);
		expect(s.axes[2]).toBe(0);
		expect(s.axes[3]).toBe(0);
	});

	it('consumes (zeroes) the pending mouse delta each tick', () => {
		const s = createGamepadState();
		s.mouseDX = 50;
		s.mouseDY = -50;
		step(cfg(), s, 1);
		expect(s.mouseDX).toBe(0);
		expect(s.mouseDY).toBe(0);
	});

	it('leaves timestamp alone when output is unchanged', () => {
		const s = createGamepadState();
		step(cfg(), s, 1234);
		expect(s.timestamp).toBe(0);
	});

	it('sets timestamp to now when output changes', () => {
		const s = createGamepadState();
		s.held.add('Space');
		step(cfg(), s, 1234);
		expect(s.timestamp).toBe(1234);
		step(cfg(), s, 1250);
		expect(s.timestamp).toBe(1234);
		s.held.delete('Space');
		step(cfg(), s, 1300);
		expect(s.timestamp).toBe(1300);
	});
});

describe('aimResponse', () => {
	it('returns 0 for 0 input', () => {
		expect(aimResponse(0)).toBe(0);
	});

	it('is sign-preserving', () => {
		expect(aimResponse(0.5)).toBeGreaterThan(0);
		expect(aimResponse(-0.5)).toBeLessThan(0);
	});

	it('is monotonic over [0,1]', () => {
		let prev = -Infinity;
		for (let r = 0.01; r <= 1; r += 0.01) {
			const v = aimResponse(r);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});

	it('applies the aimMin floor for any nonzero input', () => {
		// curve clamps to >=0.25; even a tiny input lands at/above the floor
		const tiny = aimResponse(0.0001, 0.2, 0.75);
		expect(Math.abs(tiny)).toBeGreaterThanOrEqual(0.2 - 1e-9);
	});

	it('curve < 1 boosts small inputs vs linear', () => {
		const boosted = aimResponse(0.25, 0, 0.5);
		const linear = aimResponse(0.25, 0, 1);
		expect(boosted).toBeGreaterThan(linear);
	});

	it('clamps raw input to [-1,1]', () => {
		expect(aimResponse(5)).toBeCloseTo(aimResponse(1), 6);
		expect(aimResponse(-5)).toBeCloseTo(aimResponse(-1), 6);
	});
});
