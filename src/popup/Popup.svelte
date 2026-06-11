<script lang="ts">
	// Compact popup: quick toggles + aim sliders, mirroring the legacy popup.
	// Persistence goes through src/shared/storage.ts (local-first + debounced
	// sync backup); live external edits arrive via onConfigChanged.
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

<main class="bg-pad-bg-2 text-pad-text w-[280px] p-3.5 font-sans text-[13px] leading-relaxed">
	<h1 class="text-pad-accent m-0 mb-2.5 text-sm font-semibold">🎮 padm0nk</h1>

	<!-- Enabled toggle -->
	<label class="my-2 flex items-center justify-between gap-2.5">
		<span>Enabled</span>
		<input
			type="checkbox"
			class="accent-pad-accent"
			checked={config.enabled}
			onchange={(e) => setBool('enabled', e.currentTarget.checked)}
		/>
	</label>

	<!-- Aim / sensitivity sliders -->
	{#each SLIDERS as s (s.key)}
		<label class="my-2 flex items-center justify-between gap-2.5">
			<span>{s.label}</span>
			<input
				type="range"
				class="accent-pad-accent flex-1"
				min={s.min}
				max={s.max}
				step={s.step}
				value={config[s.key]}
				oninput={(e) => setNumber(s.key, e.currentTarget.value)}
			/>
			<span class="text-pad-accent w-[42px] text-right tabular-nums">
				{config[s.key].toFixed(s.dp)}
			</span>
		</label>
	{/each}

	<!-- Behaviour toggles -->
	<label class="my-2 flex items-center justify-between gap-2.5">
		<span>Invert Y</span>
		<input
			type="checkbox"
			class="accent-pad-accent"
			checked={config.invertY}
			onchange={(e) => setBool('invertY', e.currentTarget.checked)}
		/>
	</label>
	<label class="my-2 flex items-center justify-between gap-2.5">
		<span>Lock pointer on click</span>
		<input
			type="checkbox"
			class="accent-pad-accent"
			checked={config.lockPointerOnClick}
			onchange={(e) => setBool('lockPointerOnClick', e.currentTarget.checked)}
		/>
	</label>

	<!-- Actions -->
	<button
		type="button"
		class="bg-pad-chip text-pad-text border-pad-border mt-2.5 w-full cursor-pointer rounded-md border px-2 py-1.5 hover:brightness-125"
		onclick={openOptions}
	>
		⚙️ Advanced remapping…
	</button>
	<button
		type="button"
		class="bg-pad-chip text-pad-text border-pad-border mt-2.5 w-full cursor-pointer rounded-md border px-2 py-1.5 hover:brightness-125"
		onclick={resetSliders}
	>
		Reset sliders to defaults
	</button>

	<small class="text-pad-muted mt-2.5 block">
		Toggle in-game with <b class="text-pad-accent">{toggleLabel}</b>. Open keybinds with
		<b class="text-pad-accent">{helpLabel}</b>. Click the game to lock the mouse for aim;
		<b class="text-pad-accent">Esc</b> releases it.
	</small>
</main>
