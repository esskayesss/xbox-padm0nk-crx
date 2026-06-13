<script lang="ts">
	// Popup command deck: quick power state + aim tuning. Persists through
	// shared/storage.ts; external edits live-refresh through onConfigChanged.
	import { onMount } from 'svelte';
	import { DEFAULT_CONFIG } from '../core/config';
	import { comboLabel } from '../core/combos';
	import { readConfig, writeConfig, onConfigChanged } from '../shared/storage';
	import type { Config } from '../core/types';

	const SLIDERS = [
		{
			key: 'sensitivity',
			label: 'Sensitivity',
			hint: 'Mouse → stick gain',
			min: 0.002,
			max: 0.05,
			step: 0.001,
			dp: 3,
		},
		{
			key: 'smoothing',
			label: 'Smoothing',
			hint: 'Aim inertia',
			min: 0,
			max: 0.9,
			step: 0.05,
			dp: 2,
		},
		{
			key: 'aimMin',
			label: 'Aim min',
			hint: 'Deadzone lift',
			min: 0,
			max: 0.35,
			step: 0.01,
			dp: 2,
		},
		{
			key: 'aimCurve',
			label: 'Aim curve',
			hint: 'Fine control shape',
			min: 0.35,
			max: 1.5,
			step: 0.05,
			dp: 2,
		},
	] as const;

	const TOGGLES = [
		{ key: 'invertY', label: 'Invert Y', hint: 'Flip vertical aim' },
		{ key: 'lockPointerOnClick', label: 'Aim lock', hint: 'Click game to capture mouse' },
	] as const;

	const iconUrl = (() => {
		try {
			return chrome.runtime?.getURL?.('icons/padm0nk.png') ?? '';
		} catch {
			return '';
		}
	})();

	let config = $state<Config>(structuredClone(DEFAULT_CONFIG));
	const toggleLabel = $derived(comboLabel(config.toggleCombo));
	const helpLabel = $derived(comboLabel(config.helpCombo));
	const stateLabel = $derived(config.enabled ? 'armed' : 'offline');

	onMount(() => {
		void readConfig().then((c) => (config = c));
		return onConfigChanged((c) => (config = c));
	});

	function save(): void {
		void writeConfig($state.snapshot(config));
	}

	function sliderFor(key: (typeof SLIDERS)[number]['key']): (typeof SLIDERS)[number] {
		return SLIDERS.find((s) => s.key === key)!;
	}

	function clampNumber(key: (typeof SLIDERS)[number]['key'], raw: string): number {
		const s = sliderFor(key);
		const parsed = Number.parseFloat(raw);
		const value = Number.isFinite(parsed) ? parsed : config[key];
		return Math.min(s.max, Math.max(s.min, value));
	}

	function setNumber(key: (typeof SLIDERS)[number]['key'], raw: string): void {
		config[key] = clampNumber(key, raw);
		save();
	}

	function setBool(key: 'enabled' | 'invertY' | 'lockPointerOnClick', value: boolean): void {
		config[key] = value;
		save();
	}

	function resetSliders(): void {
		config = {
			...config,
			sensitivity: DEFAULT_CONFIG.sensitivity,
			smoothing: DEFAULT_CONFIG.smoothing,
			aimMin: DEFAULT_CONFIG.aimMin,
			aimCurve: DEFAULT_CONFIG.aimCurve,
		};
		save();
	}

	function openOptions(): void {
		chrome.runtime.openOptionsPage();
	}
</script>

<main class="bg-pad-bg text-pad-text w-70 overflow-hidden p-2 font-sans text-sm leading-tight">
	<section class="pad-panel-bg border-pad-accent/40 rounded-md border p-3">
		<header class="flex items-start gap-3">
			<span
				class="pad-orb grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm p-1.5"
			>
				{#if iconUrl}
					<img
						src={iconUrl}
						alt="padm0nk"
						class="pad-icon-glow h-full w-full object-contain"
						class:grayscale={!config.enabled}
						class:opacity-60={!config.enabled}
					/>
				{:else}
					<span class="text-pad-accent text-lg font-bold" aria-hidden="true">p</span>
				{/if}
			</span>
			<div class="min-w-0 flex-1">
				<div class="flex items-center justify-between gap-2">
					<div class="text-xl font-semibold tracking-wide uppercase">padm0nk</div>
					<span
						class="rounded-sm border px-2 py-0.5 text-2xs tracking-widest uppercase"
						class:border-pad-accent={config.enabled}
						class:border-pad-border={!config.enabled}
						class:text-pad-accent={config.enabled}
						class:text-pad-muted={!config.enabled}
					>
						{stateLabel}
					</span>
				</div>
				<p class="text-pad-muted mt-1 text-xs leading-tight">
					Keyboard + mouse translated into a virtual Xbox pad.
				</p>
			</div>
		</header>

		<div class="mt-3 grid grid-cols-3 gap-2">
			<label
				class="pad-surface flex cursor-pointer items-center justify-between gap-2 rounded-sm border p-2"
			>
				<span class="text-pad-text text-xs font-semibold">Enabled</span>
				<input
					type="checkbox"
					class="accent-pad-accent"
					checked={config.enabled}
					onchange={(e) => setBool('enabled', e.currentTarget.checked)}
				/>
			</label>
			{#each TOGGLES as t (t.key)}
				<label
					class="pad-surface flex cursor-pointer items-center justify-between gap-2 rounded-sm border p-2"
				>
					<span class="text-pad-text text-xs font-semibold">{t.label}</span>
					<input
						type="checkbox"
						class="accent-pad-accent"
						checked={config[t.key]}
						onchange={(e) => setBool(t.key, e.currentTarget.checked)}
					/>
				</label>
			{/each}
		</div>
	</section>

	<section class="grid gap-2 pt-2">
		<section class="pad-surface grid gap-3 rounded-md border p-3">
			<div class="flex items-center justify-between">
				<h2 class="text-pad-accent text-xs font-semibold tracking-widest uppercase">Aim tuning</h2>
				<button
					type="button"
					class="text-pad-muted hover:text-pad-accent cursor-pointer text-2xs uppercase tracking-widest"
					onclick={resetSliders}
				>
					Reset
				</button>
			</div>
			{#each SLIDERS as s (s.key)}
				<label class="grid gap-1">
					<div class="flex items-baseline justify-between gap-2">
						<span>
							<span class="block text-xs font-semibold">{s.label}</span>
							<span class="text-pad-muted text-2xs uppercase tracking-wide">{s.hint}</span>
						</span>
						<input
							type="number"
							class="pad-number w-16 rounded-sm px-1.5 py-0.5 text-right font-mono text-xs"
							min={s.min}
							max={s.max}
							step={s.step}
							value={config[s.key].toFixed(s.dp)}
							onchange={(e) => setNumber(s.key, e.currentTarget.value)}
						/>
					</div>
					<input
						type="range"
						class="pad-range w-full"
						min={s.min}
						max={s.max}
						step={s.step}
						value={config[s.key]}
						oninput={(e) => setNumber(s.key, e.currentTarget.value)}
					/>
				</label>
			{/each}
		</section>

		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border hover:border-pad-accent cursor-pointer rounded-sm border px-2 py-2 text-xs font-semibold"
				onclick={openOptions}
			>
				Advanced
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border hover:border-pad-accent cursor-pointer rounded-sm border px-2 py-2 text-xs font-semibold"
				onclick={() => chrome.tabs?.create?.({ url: 'https://hardwaretester.com/gamepad' })}
			>
				Test pad
			</button>
		</div>

		<p class="text-pad-muted text-xs leading-snug">
			<b class="text-pad-accent">{toggleLabel}</b> toggles in-game.
			<b class="text-pad-accent">{helpLabel}</b> edits binds. Click game to lock aim; Esc releases.
		</p>
	</section>
</main>
