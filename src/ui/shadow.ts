// Shadow-DOM mount helpers for the injected UI surfaces (HUD + binds overlay).
//
// =====================================================================
// P6 CONTRACT — read this before wiring the coordinator (content/inject.ts).
// =====================================================================
//
// Public API (signatures P6 calls):
//
//   mountHud(opts: HudMountOptions): MountHandle<HudProps>
//   mountOverlay(opts: OverlayMountOptions): MountHandle<OverlayProps>
//
//   interface MountHandle<P> {
//     host: HTMLElement;          // the shadow HOST div (use in composedPath checks)
//     root: ShadowRoot;           // open shadow root (style + component live here)
//     update(patch: Partial<P>): void;  // push live config/state; reactive
//     destroy(): void;            // unmount component + remove host from DOM
//   }
//
// CLICK-SAFETY (P6 relies on this):
//   - Each host carries a stable attribute: `data-padm0nk="hud"` | `"overlay"`.
//     Match it in `event.composedPath()` to SKIP pointer-lock / game-bind on
//     clicks landing on our UI. Helpers exported below:
//       HUD_HOST_SELECTOR, OVERLAY_HOST_SELECTOR, isPadm0nkUiEvent(e)
//   - The host is `position:fixed; inset:0; pointer-events:none` so it never
//     blocks page clicks; only the inner panel(s) set `pointer-events:auto`.
//   - SECOND LINE OF DEFENSE (already handled inside the components): the HUD
//     dock and overlay panel stopPropagation on pointerdown/mousedown/mouseup/
//     click (legacy parity). So even without the composedPath check, a click on
//     the panel will not bubble to the page. P6 should STILL do the composedPath
//     check for capture-phase listeners (which run before the components see the
//     event) and for pointer-lock suppression.
//
// STYLE ISOLATION (REBUILD.md "Style isolation" + Bug 7):
//   - Compiled Tailwind CSS is imported as a string via `?inline` and injected
//     into a `<style>` inside the shadow root — NOT a page-level `<style>`.
//     This isolates from the page and dodges page `style-src` CSP.
//   - A font `@font-face` is injected from the bridge-supplied `fontUrl`
//     (web-accessible, no CDN hotlink). Absent/failed font degrades to the
//     fallback stack `"Bahnschrift","Segoe UI",system-ui,sans-serif`.
//
// =====================================================================

import { mount, unmount, type Component } from 'svelte';
import { createPropsBox } from './reactive-props.svelte';
import Hud from './hud/Hud.svelte';
import BindsOverlay from './binds-overlay/BindsOverlay.svelte';
import type { Action, Bindings, Combo } from '../core/types';
// Compiled Tailwind + theme tokens as a string (CSP-safe shadow injection).
import compiledCss from './styles/theme.css?inline';

/** Attribute used to identify our shadow hosts in composedPath. */
export const HOST_ATTR = 'data-padm0nk';
export const HUD_HOST_VALUE = 'hud';
export const OVERLAY_HOST_VALUE = 'overlay';
export const HUD_HOST_SELECTOR = `[${HOST_ATTR}="${HUD_HOST_VALUE}"]`;
export const OVERLAY_HOST_SELECTOR = `[${HOST_ATTR}="${OVERLAY_HOST_VALUE}"]`;

/** Fallback font stack when the bundled Bahnschrift is missing or fails to load. */
const FONT_FAMILY = `"Padm0nk Bahnschrift", "Bahnschrift", "Segoe UI", system-ui, sans-serif`;

/** A live handle returned by mountHud / mountOverlay. */
export interface MountHandle<P> {
	/** The shadow HOST element — match this in event.composedPath() (click-safety). */
	host: HTMLElement;
	/** The open shadow root (style + mounted component live here). */
	root: ShadowRoot;
	/** Push a partial props patch; the component updates reactively. */
	update(patch: Partial<P>): void;
	/** Unmount the component and remove the host from the DOM. */
	destroy(): void;
}

export type HudProps = {
	iconUrl: string;
	toggleCombo: Combo;
	helpCombo: Combo;
	enabled: boolean;
	/** True on an active game session (xbox.com /play/launch/...) — fades the HUD. */
	inGame: boolean;
};

export type OverlayProps = {
	open: boolean;
	bindings: Bindings;
	bindIconBase: string;
	/** Recolored Xbox controller art (center pad-map). */
	controllerUrl: string;
	/** Brand icon (overlay header orb). */
	iconUrl: string;
	/** Mirror of config.enabled — drives the on/off subtitle + orb dim. */
	enabled: boolean;
	toggleCombo: Combo;
	helpCombo: Combo;
	/** Invoked when the user closes via the close button or backdrop click. */
	onClose: () => void;
	/** Bind a captured input id to an action from the overlay. */
	onBind: (action: Action, inputId: string) => void;
	/** Remove a single input binding from the overlay. */
	onUnbind: (inputId: string) => void;
};

export type HudMountOptions = HudProps & { fontUrl?: string };
export type OverlayMountOptions = OverlayProps & { fontUrl?: string };

/**
 * True when an event originated inside one of our shadow hosts. P6 uses this
 * (via composedPath) to skip pointer-lock / game-bind for HUD/overlay clicks.
 */
export function isPadm0nkUiEvent(e: Event): boolean {
	const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
	for (const node of path) {
		if (
			node instanceof HTMLElement &&
			(node.matches?.(HUD_HOST_SELECTOR) || node.matches?.(OVERLAY_HOST_SELECTOR))
		) {
			return true;
		}
	}
	return false;
}

/** Build the `<style>` text: compiled Tailwind + optional @font-face + base. */
function buildStyleText(fontUrl: string | undefined): string {
	const fontFace = fontUrl
		? `@font-face{font-family:"Padm0nk Bahnschrift";font-style:normal;font-weight:600;` +
			`font-stretch:normal;font-display:swap;src:url("${fontUrl}") format("woff");}`
		: '';
	// Scoped reset + font on the root wrapper. Colors come only from theme tokens.
	const base = `:host{all:initial}.padm0nk-ui{font-family:${FONT_FAMILY};}`;
	return `${fontFace}\n${compiledCss}\n${base}`;
}

/**
 * Create a fixed, full-viewport, click-through shadow host and inject the
 * compiled CSS (+ font) into its open shadow root. Returns the host, root, and
 * a mount target div (class `padm0nk-ui`, where the Svelte component mounts).
 */
function createShadowHost(
	hostValue: string,
	fontUrl: string | undefined,
): { host: HTMLElement; root: ShadowRoot; target: HTMLElement } {
	const host = document.createElement('div');
	host.setAttribute(HOST_ATTR, hostValue);
	// Click-through: the host never blocks the page; only inner panels opt in.
	host.style.cssText =
		'position:fixed;inset:0;z-index:2147483647;pointer-events:none;border:0;margin:0;padding:0;';

	const root = host.attachShadow({ mode: 'open' });

	const style = document.createElement('style');
	style.textContent = buildStyleText(fontUrl);
	root.appendChild(style);

	const target = document.createElement('div');
	target.className = 'padm0nk-ui';
	root.appendChild(target);

	return { host, root, target };
}

/** Append a host to <body> (or document element if body not ready yet). */
function attachHost(host: HTMLElement): void {
	(document.body ?? document.documentElement).appendChild(host);
}

/**
 * Generic: mount a Svelte component into a fresh shadow host with reactive
 * props. mountHud/mountOverlay are thin typed wrappers over this.
 */
function mountInShadow<P extends Record<string, any>>(
	ComponentCtor: Component<P>,
	hostValue: string,
	initialProps: P,
	fontUrl: string | undefined,
): MountHandle<P> {
	const { host, root, target } = createShadowHost(hostValue, fontUrl);
	attachHost(host);

	const box = createPropsBox<P>(initialProps);
	const instance = mount(ComponentCtor, { target, props: box.props });

	let destroyed = false;
	return {
		host,
		root,
		update(patch: Partial<P>) {
			if (destroyed) return;
			box.set(patch);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			unmount(instance);
			host.remove();
		},
	};
}

/** Mount the passive HUD dock (bottom-left). */
export function mountHud(opts: HudMountOptions): MountHandle<HudProps> {
	const { fontUrl, ...props } = opts;
	return mountInShadow<HudProps>(Hud, HUD_HOST_VALUE, props, fontUrl);
}

/** Mount the keybind overlay (centered panel, toggled via `open`). */
export function mountOverlay(opts: OverlayMountOptions): MountHandle<OverlayProps> {
	const { fontUrl, ...props } = opts;
	return mountInShadow<OverlayProps>(BindsOverlay, OVERLAY_HOST_VALUE, props, fontUrl);
}
