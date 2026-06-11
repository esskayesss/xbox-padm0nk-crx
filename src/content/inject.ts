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
import type { Config } from '../core/types';
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
	} catch (e) {
		console.warn('[padm0nk] failed to override getGamepads', e);
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

	const hudProps = (): HudProps => ({
		iconUrl,
		toggleCombo: config.toggleCombo,
		helpCombo: config.helpCombo,
		enabled: config.enabled,
	});
	const overlayProps = (): OverlayProps => ({
		open: overlayOpen,
		bindings: config.bindings,
		bindIconBase,
		toggleCombo: config.toggleCombo,
		helpCombo: config.helpCombo,
		onClose: closeOverlay,
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
	}
	function onHelpCombo(): void {
		overlayOpen = !overlayOpen;
		refreshUi();
	}
	function closeOverlay(): void {
		if (!overlayOpen) return;
		overlayOpen = false;
		refreshUi();
	}

	// 7. Config bridge (isolated world → MAIN). Asset URLs arrive ONLY here.
	window.addEventListener('message', (e) => {
		if (e.source !== window) return;
		const d = e.data as { __padm0nk?: string; config?: unknown } & Record<string, unknown>;
		if (!d || d.__padm0nk !== 'config') return;
		if (typeof d.iconUrl === 'string' && d.iconUrl) iconUrl = d.iconUrl;
		if (typeof d.bindIconBase === 'string' && d.bindIconBase) bindIconBase = d.bindIconBase;
		if (typeof d.fontUrl === 'string' && d.fontUrl) fontUrl = d.fontUrl;
		config = normalizeConfig(d.config);
		refreshUi();
	});

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

	console.log('[padm0nk] installed — keyboard+mouse → virtual Xbox controller');
}
