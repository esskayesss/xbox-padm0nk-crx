// padm0nk nav-guard — neutralize mouse back/forward (buttons 3/4) navigation.
//
// WHY THIS EXISTS (and why preventDefault can't do it):
//   - Chrome does NOT forward back/forward mouse button presses (X1/X2, button
//     3/4) to the content layer as a cancelable default action
//     (w3c/pointerevents#191). mousedown/mouseup/auxclick preventDefault all
//     fail to stop the navigation.
//   - Browser history TRAVERSALS are explicitly non-cancelable, even
//     same-document (WICG/navigation-api#32), so the Navigation API can't cancel
//     them either.
//   - The only reliable cross-platform JS lever is a history SENTINEL: push a
//     tagged dummy entry on top of the stack so a back press pops the sentinel
//     instead of leaving the page, then immediately re-push it (re-trap).
//
// ANTI-CORRUPTION: we only ever act on OUR OWN sentinel entry and only
// re-push / pop while it is the top of the stack — xCloud's own history
// entries and popstates pass through untouched. The coordinator arms us only
// during pointer-locked gameplay with a nav button bound (tight window), which
// keeps us clear of xCloud's lobby->launch routing.

/** Tag key stamped onto our sentinel history entry. */
export const NAV_SENTINEL_KEY = '__padm0nkNav';

/** True when a history state object is one of OUR sentinel entries. */
export function isNavSentinel(state: unknown): boolean {
	return Boolean(
		state && typeof state === 'object' && (state as Record<string, unknown>)[NAV_SENTINEL_KEY],
	);
}

/**
 * Pure arming predicate (unit-testable). Arm only while the pad is live, a nav
 * button is bound, and the pointer is locked (active gameplay) — outside that
 * window the page must navigate normally.
 */
export function shouldArmNavGuard(input: {
	enabled: boolean;
	navButtonBound: boolean;
	pointerLocked: boolean;
}): boolean {
	return input.enabled && input.navButtonBound && input.pointerLocked;
}

export interface NavGuardOptions {
	/**
	 * Pulse the bound nav input(s) when our sentinel is popped. The raw
	 * mousedown for buttons 3/4 is not reliably delivered (see file header), so
	 * the popstate pop is our authoritative "nav button pressed" signal.
	 */
	onNavInput: () => void;
}

/** Minimal history/event surface — injected so the guard is testable headless. */
export interface NavGuardEnv {
	getState(): unknown;
	pushSentinel(state: unknown): void;
	back(): void;
	addPopstateListener(fn: () => void): void;
	removePopstateListener(fn: () => void): void;
}

function realEnv(): NavGuardEnv {
	return {
		getState: () => history.state,
		pushSentinel: (s) => history.pushState(s, '', location.href),
		back: () => history.back(),
		addPopstateListener: (fn) => window.addEventListener('popstate', fn, true),
		removePopstateListener: (fn) => window.removeEventListener('popstate', fn, true),
	};
}

export interface NavGuard {
	arm(): void;
	disarm(): void;
	uninstall(): void;
}

/**
 * Install the guard. Returns arm()/disarm()/uninstall(); the coordinator decides
 * WHEN to arm via shouldArmNavGuard. Idempotent: double arm()/disarm() is safe.
 */
export function installNavGuard(opts: NavGuardOptions, env: NavGuardEnv = realEnv()): NavGuard {
	let armed = false;

	const sentinel = (): Record<string, unknown> => ({ [NAV_SENTINEL_KEY]: true, ts: Date.now() });

	function onPop(): void {
		if (!armed) return;
		// Still sitting on our own sentinel (a forward press returned to it, or a
		// foreign entry stacked above it was popped) — stay trapped, do nothing.
		if (isNavSentinel(env.getState())) return;
		// Our sentinel was popped by a back/forward press: re-trap so the page
		// never actually leaves, then signal the gameplay input.
		try {
			env.pushSentinel(sentinel());
		} catch {
			/* history refused (sandboxed frame) */
		}
		opts.onNavInput();
	}

	function arm(): void {
		if (armed) return;
		armed = true;
		try {
			env.pushSentinel(sentinel());
		} catch {
			/* history refused */
		}
		env.addPopstateListener(onPop);
	}

	function disarm(): void {
		if (!armed) return;
		armed = false;
		env.removePopstateListener(onPop);
		// Clean our sentinel off the stack, but ONLY if it is still top-of-stack —
		// never pop a foreign (xCloud) entry.
		if (isNavSentinel(env.getState())) {
			try {
				env.back();
			} catch {
				/* ignore */
			}
		}
	}

	function uninstall(): void {
		disarm();
	}

	return { arm, disarm, uninstall };
}
