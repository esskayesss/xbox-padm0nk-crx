// padm0nk input-capture — MAIN-world DOM event wiring.
//
// All keyboard / mouse / wheel / pointer-lock / scroll-suppression / focus-loss
// listeners live here, ported faithfully from the legacy inject.js monolith. The
// coordinator (inject.ts) owns state + config + UI and hands us a small typed
// `CaptureController` so this module stays pure DOM plumbing.
//
// Capture-phase everywhere: we attach in the CAPTURE phase so we beat the page's
// own handlers (Space-scroll, etc.) before they run.

import { comboMatches } from '../core/combos';
import type { Config } from '../core/types';

/**
 * The seam between the coordinator (inject.ts) and the DOM wiring. The
 * coordinator implements this; input-capture only calls it. Keeps state +
 * lifecycle in one place and listeners in another.
 */
export interface CaptureController {
	/** Current live config (re-read each event — config swaps via the bridge). */
	getConfig(): Config;
	/** True when an input id has a binding (drives swallow + apply decisions). */
	isBound(id: string): boolean;
	/** Press/release a bound input: mutate held + fire connect on first down. */
	apply(id: string, down: boolean): void;
	/** Toggle-combo pressed (F8): flip enabled. */
	onToggleCombo(): void;
	/** Help-combo pressed (F9): toggle the binds overlay. */
	onHelpCombo(): void;
	/** Escape pressed: close the overlay if open. */
	onEscape(): void;
	/** True when an event originated inside our HUD/overlay shadow hosts. */
	isUiEvent(e: Event): boolean;
	/** Request pointer lock if config.lockPointerOnClick (caller gates down/!locked). */
	requestPointerLockIfEnabled(): void;
	/** Accumulate raw mouse movement into the pad's pending right-stick delta. */
	addMouseDelta(dx: number, dy: number): void;
	/** Drop all held inputs + pending mouse delta (focus/visibility loss, toggle-off). */
	clearInputs(): void;
}

/**
 * Attach every page listener and return a teardown fn that removes them all.
 * Ports the legacy capture layer 1:1.
 */
export function installInputCapture(ctrl: CaptureController): () => void {
	// --- Scroll-suppression state (the "swallow" dance, ported verbatim) -------
	//
	// When we swallow a mapped key/mouse/wheel event we must also undo any scroll
	// the page may already have queued for it. Strategy (legacy):
	//   1. Mark a 250ms window during which scrolling is forbidden.
	//   2. preventDefault + stop*Propagation so the page never sees the event.
	//   3. Re-pin the scroll position across THREE async phases (microtask, rAF,
	//      macrotask) because different engines apply scroll at different points.
	// A capture-phase scroll listener records the last *allowed* position while we
	// are NOT blocking, so restoreScroll knows where to snap back to.
	let blockScrollUntil = 0;
	let lastAllowedScrollX = window.scrollX;
	let lastAllowedScrollY = window.scrollY;

	function restoreScroll(): void {
		if (performance.now() <= blockScrollUntil) {
			window.scrollTo(lastAllowedScrollX, lastAllowedScrollY);
		}
	}

	function swallow(e: Event): void {
		blockScrollUntil = performance.now() + 250;
		e.preventDefault();
		e.stopPropagation();
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
		// Re-pin across all three timing phases — see note above.
		queueMicrotask(restoreScroll);
		requestAnimationFrame(restoreScroll);
		setTimeout(restoreScroll, 0);
	}

	// --- Pointer-lock tracking -------------------------------------------------
	let pointerLocked = document.pointerLockElement != null;

	// --- Keyboard --------------------------------------------------------------
	function onKey(e: KeyboardEvent, down: boolean): void {
		const config = ctrl.getConfig();

		// Combos + Escape are checked BEFORE the enabled gate, so the toggle combo
		// can re-enable a disabled pad. Combos only on a fresh (non-repeat) down.
		if (down && !e.repeat && comboMatches(config.helpCombo, e)) {
			ctrl.onHelpCombo();
			swallow(e);
			return;
		}
		if (down && !e.repeat && comboMatches(config.toggleCombo, e)) {
			ctrl.onToggleCombo();
			swallow(e);
			return;
		}
		if (down && e.code === 'Escape') {
			ctrl.onEscape();
			// Note: do not swallow Escape unconditionally; legacy only acted when the
			// overlay was open. onEscape is a no-op when closed; swallow is harmless
			// here but we keep it scoped to avoid eating Escape for the page when our
			// overlay is closed. (Match legacy: swallow only mattered with overlay up.)
		}

		if (!config.enabled) return;

		const mapped = ctrl.isBound(e.code);
		if (mapped) {
			// Always swallow mapped keys — including autorepeat keydowns — so Space
			// can't scroll / PageDown the page while also acting as Xbox A.
			swallow(e);
		}
		if (e.repeat) return;
		if (mapped) ctrl.apply(e.code, down);
	}

	function onKeyPress(e: KeyboardEvent): void {
		const config = ctrl.getConfig();
		if (!config.enabled) return;
		// Some browsers/pages scroll on keypress rather than keydown.
		const code = e.code || (e.key === ' ' ? 'Space' : '');
		if (code && ctrl.isBound(code)) swallow(e);
	}

	// Keyboard guards are bound on multiple DOM levels because Space-scroll can be
	// attached to body/document by sites. Track bound targets for clean teardown.
	const keyboardTargets = new Set<EventTarget>();
	const keydownHandler = (e: Event) => onKey(e as KeyboardEvent, true);
	const keyupHandler = (e: Event) => onKey(e as KeyboardEvent, false);
	const keypressHandler = (e: Event) => onKeyPress(e as KeyboardEvent);

	function bindKeyboardGuards(target: EventTarget | null): void {
		if (!target || keyboardTargets.has(target)) return;
		keyboardTargets.add(target);
		target.addEventListener('keydown', keydownHandler, true);
		target.addEventListener('keypress', keypressHandler, true);
		target.addEventListener('keyup', keyupHandler, true);
	}

	function bindBodyKeyboardGuards(): void {
		bindKeyboardGuards(document.documentElement);
		bindKeyboardGuards(document.body);
	}

	bindKeyboardGuards(window);
	bindKeyboardGuards(document);
	bindBodyKeyboardGuards();
	let bodyGuardListener: (() => void) | null = null;
	if (!document.body) {
		bodyGuardListener = bindBodyKeyboardGuards;
		document.addEventListener('DOMContentLoaded', bindBodyKeyboardGuards, { once: true });
	}

	// --- Scroll listener (records last allowed position; re-pins while blocking) -
	const scrollHandler = (): void => {
		if (performance.now() <= blockScrollUntil) {
			restoreScroll();
			return;
		}
		lastAllowedScrollX = window.scrollX;
		lastAllowedScrollY = window.scrollY;
	};
	window.addEventListener('scroll', scrollHandler, true);

	// --- Mouse buttons ---------------------------------------------------------
	function onMouseButton(e: MouseEvent, down: boolean): void {
		// CLICK-SAFETY: clicks on our HUD/overlay must never bind or pointer-lock.
		// This runs FIRST so even capture-phase listeners respect the UI surfaces.
		if (ctrl.isUiEvent(e)) return;

		const config = ctrl.getConfig();
		if (!config.enabled) return;

		// Pointer lock is requested on any (non-UI) page mousedown, independent of
		// whether the button itself is bound. Caller checks lockPointerOnClick.
		if (down && !pointerLocked) {
			ctrl.requestPointerLockIfEnabled();
		}

		const id = 'Mouse' + e.button;
		if (ctrl.isBound(id)) {
			ctrl.apply(id, down);
			swallow(e);
		}
	}

	const mousedownHandler = (e: Event) => onMouseButton(e as MouseEvent, true);
	const mouseupHandler = (e: Event) => onMouseButton(e as MouseEvent, false);
	window.addEventListener('mousedown', mousedownHandler, true);
	window.addEventListener('mouseup', mouseupHandler, true);

	// --- Mouse move (right stick; only while pointer-locked) -------------------
	const mousemoveHandler = (e: Event): void => {
		const config = ctrl.getConfig();
		if (!config.enabled) return;
		// Only steer when the pointer is locked; otherwise the OS cursor is in charge.
		if (!pointerLocked) return;
		const me = e as MouseEvent;
		ctrl.addMouseDelta(me.movementX || 0, me.movementY || 0);
	};
	window.addEventListener('mousemove', mousemoveHandler, true);

	// --- Wheel (pulse a bound wheel direction) ---------------------------------
	const wheelHandler = (e: Event): void => {
		const config = ctrl.getConfig();
		if (!config.enabled) return;
		const we = e as WheelEvent;
		const id = we.deltaY < 0 ? 'WheelUp' : 'WheelDown';
		if (ctrl.isBound(id)) {
			ctrl.apply(id, true);
			setTimeout(() => ctrl.apply(id, false), 60); // pulse: release shortly after
			swallow(e);
		}
	};
	window.addEventListener('wheel', wheelHandler, { capture: true, passive: false });

	// --- Context menu (suppress only when actively aiming) ---------------------
	const contextmenuHandler = (e: Event): void => {
		const config = ctrl.getConfig();
		if (config.enabled && pointerLocked) e.preventDefault();
	};
	window.addEventListener('contextmenu', contextmenuHandler, true);

	// --- Pointer-lock change ---------------------------------------------------
	const pointerlockchangeHandler = (): void => {
		pointerLocked = document.pointerLockElement != null;
	};
	document.addEventListener('pointerlockchange', pointerlockchangeHandler, true);

	// --- Focus / visibility loss: clear stuck inputs ---------------------------
	// If a keyup/mouseup fires outside the page (Alt-Tab while holding W) it never
	// reaches us, so the input would stick. Drop everything on focus/visibility loss.
	const blurHandler = (): void => ctrl.clearInputs();
	const visibilityHandler = (): void => {
		if (document.visibilityState === 'hidden') ctrl.clearInputs();
	};
	window.addEventListener('blur', blurHandler, true);
	document.addEventListener('visibilitychange', visibilityHandler, true);

	// --- Teardown --------------------------------------------------------------
	return function uninstall(): void {
		for (const target of keyboardTargets) {
			target.removeEventListener('keydown', keydownHandler, true);
			target.removeEventListener('keypress', keypressHandler, true);
			target.removeEventListener('keyup', keyupHandler, true);
		}
		keyboardTargets.clear();
		if (bodyGuardListener) {
			document.removeEventListener('DOMContentLoaded', bodyGuardListener);
		}
		window.removeEventListener('scroll', scrollHandler, true);
		window.removeEventListener('mousedown', mousedownHandler, true);
		window.removeEventListener('mouseup', mouseupHandler, true);
		window.removeEventListener('mousemove', mousemoveHandler, true);
		window.removeEventListener('wheel', wheelHandler, true);
		window.removeEventListener('contextmenu', contextmenuHandler, true);
		document.removeEventListener('pointerlockchange', pointerlockchangeHandler, true);
		window.removeEventListener('blur', blurHandler, true);
		document.removeEventListener('visibilitychange', visibilityHandler, true);
	};
}
