<script lang="ts">
	// Popup command deck: quick power state + aim tuning. Persists through
	// shared/storage.ts; external edits live-refresh through onConfigChanged.
	import { onMount } from 'svelte';
	import {
		AIM_CONTROLS,
		aimConfigValue,
		aimDisplayFill,
		aimDisplayValue,
	} from '../core/aim-settings';
	import { DEFAULT_CONFIG } from '../core/config';
	import { comboLabel } from '../core/combos';
	import { readConfig, writeConfig, onConfigChanged } from '../shared/storage';
	import type { Config } from '../core/types';

	const TOGGLES = [
		{ key: 'invertY', label: 'Invert Y', hint: 'Flip vertical aim' },
		{ key: 'lockPointerOnClick', label: 'Aim lock', hint: 'Click game to capture mouse' },
	] as const;

	const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/esskayesss';
	const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/esskayesss';

	let config = $state<Config>(structuredClone(DEFAULT_CONFIG));
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const toggleLabel = $derived(comboLabel(config.toggleCombo));
	const helpLabel = $derived(comboLabel(config.helpCombo));
	const stateLabel = $derived(config.enabled ? 'armed' : 'offline');

	onMount(() => {
		void readConfig().then((c) => (config = c));
		const unsub = onConfigChanged((c) => (config = c));
		return () => {
			unsub();
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	function save(): void {
		void writeConfig($state.snapshot(config));
	}

	function queueSave(): void {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 80);
	}

	function setNumber(key: (typeof AIM_CONTROLS)[number]['key'], raw: string): void {
		config[key] = aimConfigValue(key, raw);
		queueSave();
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

	function openUrl(url: string): void {
		chrome.tabs?.create?.({ url });
	}
</script>

<main class="bg-pad-bg text-pad-text w-70 overflow-hidden p-2 font-sans text-sm leading-tight">
	<section class="pad-panel-bg border-pad-accent/40 rounded-md border p-3">
		<header class="flex items-center justify-between gap-2">
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
		</header>

		<div class="mt-3 grid grid-cols-3 gap-2">
			<label
				class="pad-surface flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border p-2 text-center"
			>
				<span class="text-pad-text text-xs font-semibold leading-tight">Enabled</span>
				<input
					type="checkbox"
					class="accent-pad-accent"
					checked={config.enabled}
					onchange={(e) => setBool('enabled', e.currentTarget.checked)}
				/>
			</label>
			{#each TOGGLES as t (t.key)}
				<label
					class="pad-surface flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border p-2 text-center"
				>
					<span class="text-pad-text text-xs font-semibold leading-tight">{t.label}</span>
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
			{#each AIM_CONTROLS as s (s.key)}
				<div class="grid gap-1">
					<div class="flex items-baseline justify-between gap-2">
						<span>
							<label
								id={`popup-${s.key}-label`}
								for={`popup-${s.key}-range`}
								class="block text-xs font-semibold"
							>
								{s.label}
							</label>
							<span class="text-pad-muted text-2xs uppercase tracking-wide">{s.hint}</span>
						</span>
						<input
							type="number"
							class="pad-number w-16 rounded-sm px-1.5 py-0.5 text-right font-mono text-xs"
							aria-label={`${s.label} value`}
							min={s.min}
							max={s.max}
							step={s.step}
							value={aimDisplayValue(config, s.key).toFixed(s.dp)}
							onchange={(e) => setNumber(s.key, e.currentTarget.value)}
						/>
					</div>
					<input
						id={`popup-${s.key}-range`}
						type="range"
						class="pad-range w-full"
						aria-labelledby={`popup-${s.key}-label`}
						style={`--pad-fill: ${aimDisplayFill(config, s.key)}`}
						min={s.min}
						max={s.max}
						step={s.step}
						value={aimDisplayValue(config, s.key)}
						oninput={(e) => setNumber(s.key, e.currentTarget.value)}
						onchange={save}
					/>
				</div>
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
			<b class="text-pad-accent">{helpLabel}</b> edits binds.
		</p>

		<div class="space-y-1.5">
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="bg-pad-sponsor text-pad-sponsor-soft hover:bg-pad-sponsor-strong border-pad-sponsor/70 cursor-pointer rounded-sm border px-2 py-2 text-xs font-black tracking-wide uppercase"
					onclick={() => openUrl(GITHUB_SPONSORS_URL)}
				>
					❤ Sponsor
				</button>
				<button
					type="button"
					class="border-pad-coffee-border bg-pad-coffee text-pad-coffee-text hover:bg-pad-coffee-hover cursor-pointer rounded-sm border px-2 py-2 text-xs font-black tracking-wide uppercase"
					onclick={() => openUrl(BUY_ME_COFFEE_URL)}
				>
					☕ Buy a coffee
				</button>
			</div>
		</div>
	</section>
</main>
