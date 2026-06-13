// Tiny shared numeric helpers. One source of truth for clamp so the mapper,
// config normalizer, and aim-settings can't drift on range semantics.

/** Clamp n into [lo, hi]. Assumes callers pass finite numbers. */
export function clamp(n: number, lo: number, hi: number): number {
	return n < lo ? lo : n > hi ? hi : n;
}
