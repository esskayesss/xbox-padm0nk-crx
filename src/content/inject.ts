// padm0nk inject.ts — MAIN-world THIN coordinator (runs at document_start).
//
// Wires the pure core modules + injected shadow UI into the live page:
//   - patches navigator.getGamepads so the page sees our virtual Xbox pad,
//   - runs a per-frame mapper tick over keyboard/mouse state,
//   - mounts the HUD + binds overlay in shadow DOM,
//   - receives config + asset URLs from the isolated-world bridge,
//   - owns lifecycle (connect/disconnect/toggle) and feeds input-capture a
//     small typed controller. All DOM event wiring lives in input-capture.ts.

import { normalizeConfig } from '../core/config';
import {
	makeGamepadConnectedEvent,
	makeGamepadDisconnectedEvent,
	createGetGamepadsOverride,
} from '../core/gamepad-api';
import {
	clearInputs,
	resetGamepadState,
	snapshot,
	createGamepadState,
} from '../core/gamepad-state';
import { step } from '../core/mapper';
import type { Action, Config } from '../core/types';
import {
	mountHud,
	mountOverlay,
	isPadm0nkUiEvent,
	type HudProps,
	type OverlayProps,
	type MountHandle,
} from '../ui/shadow';
import { installInputCapture, type CaptureController } from './input-capture';

declare global {
	interface Window {
		__padm0nkInstalled?: boolean;
	}
}

// 1. Install guard — never double-install in one world.
if (!window.__padm0nkInstalled) {
	window.__padm0nkInstalled = true;
	main();
}

function main(): void {
	// 2. State + config (defaults until the bridge posts) + asset URLs.
	const state = createGamepadState();
	let config: Config = normalizeConfig(undefined);
	let iconUrl = '';
	let bindIconBase = '';
	let controllerUrl = '';
	let fontUrl = '';
	let overlayOpen = false;

	// 3. Patch the Gamepad API. Capture native first, then install the override
	//    (also as webkitGetGamepads for engines that reference it). Legacy parity.
	const nativeGetGamepads = navigator.getGamepads?.bind(navigator) ?? null;
	const override = createGetGamepadsOverride({
		native: nativeGetGamepads,
		state,
		isEnabled: () => config.enabled,
	});
	try {
		Object.defineProperty(navigator, 'getGamepads', {
			configurable: true,
			enumerable: true,
			value: override,
		});
		Object.defineProperty(navigator, 'webkitGetGamepads', {
			configurable: true,
			enumerable: true,
			value: override,
		});
	} catch {
		/* page refused getGamepads override */
	}

	// 4. Per-frame mapper tick. Step every frame so right-stick smoothing decays
	//    to center even with no input (legacy ran the tick continuously).
	function loop(): void {
		step(config, state, performance.now());
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);

	// 5. Shadow UI (HUD dock + binds overlay). Remount only to pick up a font URL
	//    that arrives after the initial mount (props otherwise update reactively).
	let hud: MountHandle<HudProps> | null = null;
	let overlay: MountHandle<OverlayProps> | null = null;
	let mountedFontUrl = '';

	// Active game session: xbox.com launches a title at /<locale>/play/launch/...
	// Used to fade the HUD only during play, not on the dashboard or test sites.
	const isInGame = (): boolean => /\/play\/launch\//.test(location.pathname);

	const hudProps = (): HudProps => ({
		iconUrl,
		toggleCombo: config.toggleCombo,
		helpCombo: config.helpCombo,
		enabled: config.enabled,
		inGame: isInGame(),
	});
	const overlayProps = (): OverlayProps => ({
		open: overlayOpen,
		bindings: config.bindings,
		bindIconBase,
		controllerUrl,
		iconUrl,
		enabled: config.enabled,
		toggleCombo: config.toggleCombo,
		helpCombo: config.helpCombo,
		onClose: closeOverlay,
		onBind: bindInOverlay,
		onUnbind: unbindInOverlay,
	});

	function mountUi(): void {
		hud = mountHud({ ...hudProps(), fontUrl });
		overlay = mountOverlay({ ...overlayProps(), fontUrl });
		mountedFontUrl = fontUrl;
	}
	function refreshUi(): void {
		if (!hud || !overlay) return;
		// @font-face is baked into the shadow <style> at mount; remount once if the
		// bridge delivers a real fontUrl after we mounted with an empty one.
		if (fontUrl && fontUrl !== mountedFontUrl) {
			hud.destroy();
			overlay.destroy();
			mountUi();
			return;
		}
		hud.update(hudProps());
		overlay.update(overlayProps());
	}

	if (document.body) mountUi();
	else document.addEventListener('DOMContentLoaded', mountUi, { once: true });

	// Fade the HUD only on an active game session. xbox.com routes client-side, so
	// poll the URL and refresh when we enter/leave /play/launch/... (a full reload
	// isn't guaranteed). 1s latency is plenty for a passive opacity change.
	let lastHref = location.href;
	setInterval(() => {
		if (location.href === lastHref) return;
		lastHref = location.href;
		refreshUi();
	}, 1000);

	// 6. Lifecycle helpers.
	function fireConnect(): void {
		if (state.connected) return;
		state.connected = true;
		state.timestamp = performance.now();
		window.dispatchEvent(makeGamepadConnectedEvent(snapshot(state, 0)));
		refreshUi();
	}
	function fireDisconnect(): void {
		if (!state.connected) return;
		const gp = snapshot(state, 0);
		state.connected = false;
		window.dispatchEvent(makeGamepadDisconnectedEvent(gp));
		refreshUi();
	}
	function apply(id: string, down: boolean): void {
		if (!config.bindings[id]) return;
		if (down) state.held.add(id);
		else state.held.delete(id);
		// Reflect edge-triggered inputs immediately, not only on the next RAF. xCloud
		// can poll getGamepads around UI select handling; native pads expose the new
		// button state immediately, so keep the virtual snapshot in lockstep.
		step(config, state, performance.now());
		if (down) fireConnect(); // first mapped down brings the pad online
	}
	function toggle(): void {
		config.enabled = !config.enabled;
		if (config.enabled) {
			resetGamepadState(state); // clear stale deflection before re-enable
		} else {
			clearInputs(state);
			fireDisconnect();
			if (document.pointerLockElement) {
				try {
					document.exitPointerLock();
				} catch {
					/* ignore */
				}
			}
		}
		refreshUi();
		persistEnabled();
	}
	// Scroll-lock the page while the overlay is open (Bug: page scrolled behind
	// the modal). Saves + restores the prior inline overflow on <html> and <body>.
	let scrollLocked = false;
	let prevHtmlOverflow = '';
	let prevBodyOverflow = '';
	function lockScroll(on: boolean): void {
		if (on === scrollLocked) return;
		scrollLocked = on;
		const html = document.documentElement;
		const body = document.body;
		if (on) {
			prevHtmlOverflow = html.style.overflow;
			prevBodyOverflow = body?.style.overflow ?? '';
			html.style.overflow = 'hidden';
			if (body) body.style.overflow = 'hidden';
		} else {
			html.style.overflow = prevHtmlOverflow;
			if (body) body.style.overflow = prevBodyOverflow;
		}
	}

	// Single source of truth for overlay open/close. Opening frees the cursor
	// (exit pointer lock so the modal is clickable — locked-pointer mouse events
	// retarget to <html>, which would make the close button unreachable) and
	// locks page scroll; closing restores both.
	function setOverlay(open: boolean): void {
		if (overlayOpen === open) return;
		overlayOpen = open;
		if (open) {
			try {
				document.exitPointerLock?.();
			} catch {
				/* ignore */
			}
			lockScroll(true);
		} else {
			lockScroll(false);
		}
		refreshUi();
	}
	function onHelpCombo(): void {
		setOverlay(!overlayOpen);
	}
	function closeOverlay(): void {
		setOverlay(false);
	}
	function persistEnabled(): void {
		window.postMessage({ __padm0nk: 'set-enabled', enabled: config.enabled }, '*');
	}
	function bindInOverlay(action: Action, inputId: string): void {
		const next: Config = {
			...config,
			bindings: { ...config.bindings, [inputId]: { ...action } },
		};
		config = normalizeConfig(next);
		window.postMessage({ __padm0nk: 'bind', action, inputId }, '*');
		refreshUi();
	}
	function unbindInOverlay(inputId: string): void {
		const bindings = { ...config.bindings };
		delete bindings[inputId];
		config = normalizeConfig({ ...config, bindings });
		window.postMessage({ __padm0nk: 'unbind', inputId }, '*');
		refreshUi();
	}

	// 7. Config bridge (isolated world → MAIN). Asset URLs arrive ONLY here.
	//    HANDSHAKE: the bridge may post before this listener exists (CRXJS loads
	//    us via async dynamic import). So we PING the bridge with `hello` and keep
	//    retrying until the first config arrives; the bridge replies on demand.
	let gotConfig = false;
	window.addEventListener('message', (e) => {
		if (e.source !== window) return;
		const d = e.data as { __padm0nk?: string; config?: unknown } & Record<string, unknown>;
		if (!d || d.__padm0nk !== 'config') return;
		gotConfig = true;
		if (typeof d.iconUrl === 'string' && d.iconUrl) iconUrl = d.iconUrl;
		if (typeof d.bindIconBase === 'string' && d.bindIconBase) bindIconBase = d.bindIconBase;
		if (typeof d.controllerUrl === 'string' && d.controllerUrl) controllerUrl = d.controllerUrl;
		if (typeof d.fontUrl === 'string' && d.fontUrl) fontUrl = d.fontUrl;
		config = normalizeConfig(d.config);
		refreshUi();
	});
	function requestConfig(): void {
		if (gotConfig) return;
		window.postMessage({ __padm0nk: 'hello' }, '*');
	}
	requestConfig();
	for (const t of [50, 150, 400, 900]) setTimeout(requestConfig, t);

	// 8. Wire DOM capture via a small typed controller seam.
	const ctrl: CaptureController = {
		getConfig: () => config,
		isBound: (id) => Boolean(config.bindings[id]),
		apply,
		onToggleCombo: toggle,
		onHelpCombo,
		onEscape: closeOverlay,
		isUiEvent: isPadm0nkUiEvent,
		requestPointerLockIfEnabled: () => {
			if (!config.lockPointerOnClick) return;
			// Bug 3: never (re)lock while the binds modal is open — a click inside the
			// modal must keep the cursor free so the user can dismiss it.
			if (overlayOpen) return;
			try {
				document.documentElement.requestPointerLock?.();
			} catch {
				/* ignore */
			}
		},
		addMouseDelta: (dx, dy) => {
			state.mouseDX += dx;
			state.mouseDY += dy;
		},
		clearInputs: () => clearInputs(state),
	};
	installInputCapture(ctrl);
}
