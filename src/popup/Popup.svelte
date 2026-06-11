<script lang="ts">
	// Compact popup: quick toggles + aim sliders, mirroring the legacy popup.
	// Persistence goes through src/shared/storage.ts (local-first + debounced
	// sync backup); live external edits arrive via onConfigChanged.
	//
	// Visual language matches the HUD/overlay: branded orb header with ON/OFF
	// echo, themed bg-pad-surface cards, themed scale only (no arbitrary
	// brackets / inline gradients). Values stay registry/config-driven.
	import { onMount } from 'svelte';
	import { DEFAULT_CONFIG } from '../core/config';
	import { comboLabel } from '../core/combos';
	import { readConfig, writeConfig, onConfigChanged } from '../shared/storage';
	import type { Config } from '../core/types';

	// Slider ranges match the legacy options page byte-for-byte.
	const SLIDERS = [
		{ key: 'sensitivity', label: 'Mouse sensitivity', min: 0.002, max: 0.05, step: 0.001, dp: 3 },
		{ key: 'smoothing', label: 'Smoothing', min: 0, max: 0.9, step: 0.05, dp: 2 },
		{ key: 'aimMin', label: 'Aim min', min: 0, max: 0.35, step: 0.01, dp: 2 },
		{ key: 'aimCurve', label: 'Aim curve', min: 0.35, max: 1.5, step: 0.05, dp: 2 },
	] as const;

	// Behaviour toggles rendered config-driven (same surface as legacy popup).
	const TOGGLES = [
		{ key: 'invertY', label: 'Invert Y' },
		{ key: 'lockPointerOnClick', label: 'Lock pointer on click' },
	] as const;

	// Brand icon resolved from the extension (popup has chrome.* access); falls
	// back to a "p" glyph when unavailable, mirroring the HUD orb fallback.
	const iconUrl = (() => {
		try {
			return chrome.runtime?.getURL?.('icons/padm0nk.png') ?? '';
		} catch {
			return '';
		}
	})();

	let config = $state<Config>(structuredClone(DEFAULT_CONFIG));

	// Footer hint reflects the *current* configured combos, not hardcoded F8/F9.
	const toggleLabel = $derived(comboLabel(config.toggleCombo));
	const helpLabel = $derived(comboLabel(config.helpCombo));

	onMount(() => {
		void readConfig().then((c) => (config = c));
		// Live-refresh when another surface (options page / content) edits config.
		return onConfigChanged((c) => (config = c));
	});

	function save(): void {
		void writeConfig($state.snapshot(config));
	}

	function setNumber(key: (typeof SLIDERS)[number]['key'], raw: string): void {
		config[key] = parseFloat(raw);
		save();
	}

	function setBool(key: 'enabled' | 'invertY' | 'lockPointerOnClick', value: boolean): void {
		config[key] = value;
		save();
	}

	// Reset ONLY slider/toggle fields; preserve bindings + toggle/help combos.
	function resetSliders(): void {
		config = {
			...config,
			enabled: DEFAULT_CONFIG.enabled,
			sensitivity: DEFAULT_CONFIG.sensitivity,
			smoothing: DEFAULT_CONFIG.smoothing,
			aimMin: DEFAULT_CONFIG.aimMin,
			aimCurve: DEFAULT_CONFIG.aimCurve,
			invertY: DEFAULT_CONFIG.invertY,
			lockPointerOnClick: DEFAULT_CONFIG.lockPointerOnClick,
		};
		save();
	}

	function openOptions(): void {
		chrome.runtime.openOptionsPage();
	}
</script>

<main class="bg-pad-bg-2 text-pad-text w-70 p-3 font-sans text-sm leading-relaxed">
	<!-- Branded header: orb + title + ON/OFF state echoing the HUD. -->
	<header class="pad-surface mb-3 flex items-center gap-2.5 rounded-md border p-2">
		<span class="pad-orb grid size-9 shrink-0 place-items-center overflow-hidden rounded-sm p-1">
			{#if iconUrl}
				<img
					src={iconUrl}
					alt="padm0nk"
					class="pad-icon-glow h-full w-full object-contain"
					class:grayscale={!config.enabled}
				/>
			{:else}
				<span class="text-pad-accent text-sm font-bold" aria-hidden="true">p</span>
			{/if}
		</span>
		<div class="min-w-0 flex-1">
			<div class="text-pad-text truncate text-sm font-semibold">padm0nk</div>
			<div
				class="text-2xs tracking-widest uppercase"
				class:text-pad-accent={config.enabled}
				class:text-pad-muted={!config.enabled}
			>
				{config.enabled ? 'ON' : 'OFF'}
			</div>
		</div>
	</header>

	<!-- Prominent enable toggle. -->
	<label
		class="pad-surface mb-3 flex cursor-pointer items-center justify-between gap-2.5 rounded-sm border px-3 py-2"
	>
		<span class="font-semibold">Enabled</span>
		<input
			type="checkbox"
			class="accent-pad-accent size-5"
			checked={config.enabled}
			onchange={(e) => setBool('enabled', e.currentTarget.checked)}
		/>
	</label>

	<!-- Aim / sensitivity sliders, grouped on a themed surface card. -->
	<section class="pad-surface mb-3 grid gap-2 rounded-md border p-3">
		{#each SLIDERS as s (s.key)}
			<label class="grid gap-1">
				<div class="flex items-center justify-between gap-2">
					<span class="text-pad-muted text-xs">{s.label}</span>
					<span class="text-pad-accent w-10 text-right text-xs tabular-nums">
						{config[s.key].toFixed(s.dp)}
					</span>
				</div>
				<input
					type="range"
					class="accent-pad-accent w-full"
					min={s.min}
					max={s.max}
					step={s.step}
					value={config[s.key]}
					oninput={(e) => setNumber(s.key, e.currentTarget.value)}
				/>
			</label>
		{/each}
	</section>

	<!-- Behaviour toggles, config-driven. -->
	<section class="pad-surface mb-3 grid gap-1 rounded-md border p-3">
		{#each TOGGLES as t (t.key)}
			<label class="flex cursor-pointer items-center justify-between gap-2.5">
				<span>{t.label}</span>
				<input
					type="checkbox"
					class="accent-pad-accent"
					checked={config[t.key]}
					onchange={(e) => setBool(t.key, e.currentTarget.checked)}
				/>
			</label>
		{/each}
	</section>

	<!-- Footer: open full options + reset; combo hints below. -->
	<div class="flex gap-2">
		<button
			type="button"
			class="bg-pad-chip text-pad-text border-pad-border flex-1 cursor-pointer rounded-sm border px-2 py-1.5 text-xs hover:brightness-125"
			onclick={openOptions}
		>
			⚙️ Advanced…
		</button>
		<button
			type="button"
			class="bg-pad-chip text-pad-text border-pad-border flex-1 cursor-pointer rounded-sm border px-2 py-1.5 text-xs hover:brightness-125"
			onclick={resetSliders}
		>
			Reset sliders
		</button>
	</div>

	<small class="text-pad-muted mt-2.5 block text-xs">
		Toggle in-game with <b class="text-pad-accent">{toggleLabel}</b>. Open keybinds with
		<b class="text-pad-accent">{helpLabel}</b>. Click the game to lock the mouse for aim;
		<b class="text-pad-accent">Esc</b> releases it.
	</small>
</main>
