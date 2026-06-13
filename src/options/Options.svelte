<script lang="ts">
	// Full remapping UI, driven by the controller-actions registry.
	//
	// Sections, labels and the mouse-driven "Aim — Right Stick" info group all
	// come from groupsForOptions(); chips are rendered from the live bindings via
	// prettyInput. Capture flow ports the legacy startCapture/commitCapture, minus
	// the dead commitCapture toggle branch (toggle/help are combos only).
	//
	// Persistence flows through src/shared/storage.ts. Tier-4 additions: file
	// import/export and a remap-conflict warning when an input is reassigned.
	import { onMount } from 'svelte';
	import {
		AIM_CONTROLS,
		aimConfigValue,
		aimDisplayFill,
		aimDisplayValue,
	} from '../core/aim-settings';
	import { actionEq, groupsForOptions, allBindsConfigured } from '../core/controller-actions';
	import { DEFAULT_CONFIG, normalizeConfig } from '../core/config';
	import { comboFromEvent, comboLabel } from '../core/combos';
	import { prettyInput } from '../core/labels';
	import { readConfig, writeConfig, onConfigChanged } from '../shared/storage';
	import type { Action, Config } from '../core/types';

	const groups = groupsForOptions();
	const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/esskayesss';
	const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/esskayesss';
	const GITHUB_REPO_URL = 'https://github.com/esskayesss/xbox-padm0nk-crx';
	const WEBSITE_URL = 'https://esskayesss.github.io/xbox-padm0nk-crx/';

	/** Resolve a bind-icon asset URL for the options (extension) page. */
	function iconUrl(icon: string): string {
		try {
			return chrome.runtime?.getURL?.(`assets/bind-icons/${icon}`) ?? '';
		} catch {
			return '';
		}
	}

	let config = $state<Config>(structuredClone(DEFAULT_CONFIG));

	// Capture state: which row (binding) or combo button is awaiting input.
	type Capturing =
		| { kind: 'binding'; action: Action; id: string }
		| { kind: 'toggle' | 'help' }
		| null;
	let capturing = $state<Capturing>(null);

	let jsonText = $state('');
	let saved = $state(false);
	let conflictNotice = $state<string | null>(null);

	const toggleLabel = $derived(comboLabel(config.toggleCombo));
	const helpLabel = $derived(comboLabel(config.helpCombo));
	const bindsComplete = $derived(allBindsConfigured(config.bindings));

	let savedTimer: ReturnType<typeof setTimeout> | null = null;
	let saveQueueTimer: ReturnType<typeof setTimeout> | null = null;
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;
	let fileInput: HTMLInputElement;

	/** Input ids currently bound to a given action. */
	function inputsFor(action: Action): string[] {
		return Object.keys(config.bindings).filter((id) => actionEq(config.bindings[id], action));
	}

	/** Friendly label of whatever control an input id is currently bound to. */
	function controlLabelFor(action: Action): string {
		for (const g of groups) {
			for (const item of g.items) {
				if (actionEq(action, item.action)) return `${g.title} · ${item.label}`;
			}
		}
		return 'another control';
	}

	function flashSaved(): void {
		saved = true;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => (saved = false), 900);
	}

	function showConflict(msg: string): void {
		conflictNotice = msg;
		if (noticeTimer) clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (conflictNotice = null), 4000);
	}

	function save(): void {
		void writeConfig($state.snapshot(config));
		flashSaved();
	}

	function queueSave(): void {
		if (saveQueueTimer) clearTimeout(saveQueueTimer);
		saveQueueTimer = setTimeout(save, 80);
	}

	// ---- capture ----
	function startCapture(c: Exclude<Capturing, null>): void {
		capturing = c;
	}
	function cancelCapture(): void {
		capturing = null;
	}

	/** Bind a raw input id (key / Mouse0-4 / WheelUp|Down) to the captured action. */
	function commitBinding(inputId: string): void {
		if (capturing?.kind !== 'binding') return;
		const existing = config.bindings[inputId];
		// Tier-4 conflict warning: surface silent reassignment to the user.
		if (existing && !actionEq(existing, capturing.action)) {
			showConflict(`Reassigned ${prettyInput(inputId)} from ${controlLabelFor(existing)}`);
		}
		config.bindings[inputId] = { ...capturing.action };
		capturing = null;
		save();
	}

	function commitCombo(e: KeyboardEvent): void {
		if (capturing?.kind !== 'toggle' && capturing?.kind !== 'help') return;
		const combo = comboFromEvent(e);
		if (capturing.kind === 'toggle') {
			// Combo is source of truth; keep legacy toggleKey in sync for old reads.
			config.toggleKey = combo.code;
			config.toggleCombo = combo;
		} else {
			config.helpCombo = combo;
		}
		capturing = null;
		save();
	}

	function unbind(id: string): void {
		delete config.bindings[id];
		save();
	}

	// Global capture-phase listeners while a capture is active.
	onMount(() => {
		void readConfig().then((c) => (config = c));
		const unsub = onConfigChanged((c) => (config = c));

		const onKey = (e: KeyboardEvent): void => {
			if (!capturing) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.code === 'Escape') return cancelCapture();
			if (capturing.kind === 'toggle' || capturing.kind === 'help') return commitCombo(e);
			commitBinding(e.code); // binding kind — keys bind by code
		};
		const onMouse = (e: MouseEvent): void => {
			if (capturing?.kind !== 'binding') return; // combos must be keys
			if ((e.target as Element)?.closest('button, .chip-x')) return;
			e.preventDefault();
			commitBinding('Mouse' + e.button);
		};
		const onWheel = (e: WheelEvent): void => {
			if (capturing?.kind !== 'binding') return;
			e.preventDefault();
			commitBinding(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
		};

		window.addEventListener('keydown', onKey, true);
		window.addEventListener('mousedown', onMouse, true);
		window.addEventListener('wheel', onWheel, { capture: true, passive: false });
		return () => {
			unsub();
			if (saveQueueTimer) clearTimeout(saveQueueTimer);
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('mousedown', onMouse, true);
			window.removeEventListener('wheel', onWheel, true);
		};
	});

	// ---- settings ----
	function setNumber(key: (typeof AIM_CONTROLS)[number]['key'], raw: string): void {
		config[key] = aimConfigValue(key, raw);
		queueSave();
	}
	function setBool(key: 'invertY' | 'lockPointerOnClick', value: boolean): void {
		config[key] = value;
		save();
	}

	// ---- import / export ----
	function exportToBox(): void {
		jsonText = JSON.stringify($state.snapshot(config), null, 2);
	}
	function importFromBox(): void {
		try {
			config = normalizeConfig(JSON.parse(jsonText));
			save();
		} catch (err) {
			alert('Invalid JSON: ' + (err instanceof Error ? err.message : String(err)));
		}
	}
	function downloadProfile(): void {
		const blob = new Blob([JSON.stringify($state.snapshot(config), null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'padm0nk-profile.json';
		a.click();
		URL.revokeObjectURL(url);
	}
	function onUpload(e: Event): void {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				config = normalizeConfig(JSON.parse(String(reader.result)));
				save();
			} catch (err) {
				alert('Invalid profile file: ' + (err instanceof Error ? err.message : String(err)));
			}
		};
		reader.readAsText(file);
		(e.target as HTMLInputElement).value = ''; // allow re-uploading same file
	}

	function resetAll(): void {
		if (!confirm('Reset ALL bindings and settings to defaults?')) return;
		config = normalizeConfig(structuredClone(DEFAULT_CONFIG));
		save();
	}

	const isCapturing = (c: Capturing, kind: string, id?: string): boolean =>
		c != null && c.kind === kind && (id === undefined || (c.kind === 'binding' && c.id === id));
</script>

<div
	class="text-pad-text mx-auto min-h-screen max-w-3xl px-5 pt-7 pb-16 font-sans text-sm leading-relaxed"
>
	<section
		class="bg-pad-sponsor text-pad-sponsor-soft border-pad-sponsor-strong mb-4 flex flex-col gap-3 rounded-md border px-4 py-3 shadow-pad-hud sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<div class="text-sm font-black tracking-wide uppercase">❤ Support padm0nk</div>
			<div class="text-pad-sponsor-soft/85 text-xs">
				Help keep the extension free, open source, and actively maintained.
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href={GITHUB_SPONSORS_URL}
				target="_blank"
				rel="noreferrer"
				class="bg-pad-sponsor-soft text-pad-sponsor-strong rounded-sm px-3 py-1 text-xs font-black uppercase hover:brightness-95"
			>
				GitHub Sponsors
			</a>
			<a
				href={BUY_ME_COFFEE_URL}
				target="_blank"
				rel="noreferrer"
				class="border-pad-coffee-border bg-pad-coffee text-pad-coffee-text hover:bg-pad-coffee-hover rounded-sm border px-3 py-1 text-xs font-black uppercase"
			>
				Buy Me a Coffee
			</a>
		</div>
	</section>

	<h1 class="text-pad-accent m-0 mb-1 flex items-center gap-2 text-xl">
		🎮 padm0nk Configuration
		<span
			class="text-pad-accent text-xs transition-opacity duration-200"
			class:opacity-0={!saved}
			class:opacity-100={saved}>saved ✓</span
		>
	</h1>
	<p class="text-pad-muted mb-2">
		Remap every control. Click <b class="text-pad-accent">＋ Add</b> on a row, then press the key /
		mouse button you want to bind. Click a chip's <b class="text-pad-danger">×</b> to unbind. Changes
		apply live — just reload the xCloud tab.
	</p>

	<!-- Coverage warning: one or more controller actions have no input bound. -->
	{#if !bindsComplete}
		<div
			role="alert"
			class="bg-pad-danger text-pad-bg mb-2 rounded-md px-3 py-2 text-sm font-semibold"
		>
			⚠ Some controls are unmapped — bind every action below for full coverage.
		</div>
	{/if}

	<!-- Conflict warning (Tier-4): non-blocking inline notice. -->
	{#if conflictNotice}
		<div
			role="status"
			class="border-pad-accent/40 bg-pad-green/10 text-pad-accent mb-2 rounded-md border px-3 py-2 text-sm"
		>
			⚠ {conflictNotice}
		</div>
	{/if}

	<!-- Remapping sections, generated from the registry. -->
	{#each groups as group (group.title)}
		<h2
			class="text-pad-muted border-pad-chip mt-7 mb-2.5 border-b pb-1.5 text-sm font-normal tracking-widest uppercase"
		>
			{group.title}
		</h2>
		{#if group.info}
			<div class="text-pad-muted italic">{group.info}</div>
		{/if}
		{#if group.items.length}
			<div class="grid grid-cols-field items-center gap-x-3.5 gap-y-2">
				{#each group.items as item (item.id)}
					<div class="text-pad-text/80 flex items-center gap-2">
						{#if item.icon}
							<img
								src={iconUrl(item.icon)}
								alt=""
								aria-hidden="true"
								class="pad-icon-glow size-5 shrink-0 object-contain"
							/>
						{/if}
						<span>{item.label}</span>
					</div>
					{#if group.fixed}
						<div class="flex flex-wrap items-center gap-1.5">
							{#each inputsFor(item.action) as id (id)}
								<span
									class="bg-pad-chip border-pad-border inline-flex items-center rounded-md border px-2 py-0.5 text-sm"
								>
									<b class="text-pad-key font-semibold">{prettyInput(id)}</b>
								</span>
							{/each}
							<span class="text-pad-muted text-2xs uppercase tracking-wide">fixed</span>
						</div>
					{:else}
						<div class="flex flex-wrap items-center gap-1.5">
							{#each inputsFor(item.action) as id (id)}
								<span
									class="bg-pad-chip border-pad-border inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm"
								>
									<b class="text-pad-key font-semibold">{prettyInput(id)}</b>
									<button
										type="button"
										class="chip-x text-pad-danger cursor-pointer font-bold"
										title="Unbind"
										aria-label="Unbind {prettyInput(id)}"
										onclick={() => unbind(id)}>×</button
									>
								</span>
							{/each}
							<button
								type="button"
								class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-sm {isCapturing(
									capturing,
									'binding',
									item.id,
								)
									? 'animate-pulse border-pad-capture bg-pad-capture-bg text-pad-capture'
									: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
								onclick={() =>
									isCapturing(capturing, 'binding', item.id)
										? cancelCapture()
										: startCapture({ kind: 'binding', action: item.action, id: item.id })}
							>
								{isCapturing(capturing, 'binding', item.id)
									? 'press input… (Esc cancels)'
									: '＋ Add'}
							</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{/each}

	<!-- Mouse & behaviour -->
	<h2
		class="text-pad-muted border-pad-chip mt-7 mb-2.5 border-b pb-1.5 text-sm font-normal tracking-widest uppercase"
	>
		Mouse &amp; behaviour
	</h2>
	<div class="grid grid-cols-field items-center gap-x-3.5 gap-y-2">
		{#each AIM_CONTROLS as s (s.key)}
			<label id={`options-${s.key}-label`} for={`options-${s.key}-range`} class="text-pad-text/80">
				{s.label}
			</label>
			<div class="flex items-center gap-3">
				<input
					id={`options-${s.key}-range`}
					type="range"
					class="pad-range w-full"
					aria-labelledby={`options-${s.key}-label`}
					style={`--pad-fill: ${aimDisplayFill(config, s.key)}%`}
					min={s.min}
					max={s.max}
					step={s.step}
					value={aimDisplayValue(config, s.key)}
					oninput={(e) => setNumber(s.key, e.currentTarget.value)}
					onchange={save}
				/>
				<input
					type="number"
					class="pad-number w-20 shrink-0 rounded-sm px-2 py-1 text-right font-mono text-sm"
					aria-label={`${s.label} value`}
					min={s.min}
					max={s.max}
					step={s.step}
					value={aimDisplayValue(config, s.key).toFixed(s.dp)}
					onchange={(e) => setNumber(s.key, e.currentTarget.value)}
				/>
			</div>
		{/each}

		<label id="options-invertY-label" for="options-invertY" class="text-pad-text/80"
			>Invert Y axis</label
		>
		<div>
			<input
				id="options-invertY"
				type="checkbox"
				class="accent-pad-accent"
				checked={config.invertY}
				onchange={(e) => setBool('invertY', e.currentTarget.checked)}
			/>
		</div>

		<label id="options-lockPointer-label" for="options-lockPointer" class="text-pad-text/80">
			Lock pointer on click (aim)
		</label>
		<div>
			<input
				id="options-lockPointer"
				type="checkbox"
				class="accent-pad-accent"
				checked={config.lockPointerOnClick}
				onchange={(e) => setBool('lockPointerOnClick', e.currentTarget.checked)}
			/>
		</div>

		<div class="text-pad-text/80">Toggle on/off key combo</div>
		<div>
			<button
				type="button"
				class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-sm {isCapturing(
					capturing,
					'toggle',
				)
					? 'animate-pulse border-pad-capture bg-pad-capture-bg text-pad-capture'
					: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
				onclick={() =>
					isCapturing(capturing, 'toggle') ? cancelCapture() : startCapture({ kind: 'toggle' })}
			>
				{isCapturing(capturing, 'toggle') ? 'press combo… (Esc cancels)' : toggleLabel}
			</button>
		</div>

		<div class="text-pad-text/80">Show keybinds combo</div>
		<div>
			<button
				type="button"
				class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-sm {isCapturing(
					capturing,
					'help',
				)
					? 'animate-pulse border-pad-capture bg-pad-capture-bg text-pad-capture'
					: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
				onclick={() =>
					isCapturing(capturing, 'help') ? cancelCapture() : startCapture({ kind: 'help' })}
			>
				{isCapturing(capturing, 'help') ? 'press combo… (Esc cancels)' : helpLabel}
			</button>
		</div>
	</div>

	<!-- Import / Export -->
	<details class="mt-3.5">
		<summary class="text-pad-muted cursor-pointer">Import / Export profile</summary>
		<textarea
			class="bg-pad-bg-3 text-pad-text/80 border-pad-border mt-2 h-36 w-full rounded-md border p-2.5 font-mono text-xs leading-relaxed"
			spellcheck="false"
			bind:value={jsonText}
		></textarea>
		<div class="mt-3 flex flex-wrap gap-2.5">
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-sm hover:brightness-125"
				onclick={exportToBox}
			>
				Copy current → box
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-sm hover:brightness-125"
				onclick={importFromBox}
			>
				Apply from box
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-sm hover:brightness-125"
				onclick={downloadProfile}
			>
				Download profile (.json)
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-sm hover:brightness-125"
				onclick={() => fileInput.click()}
			>
				Upload profile
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				class="hidden"
				onchange={onUpload}
			/>
		</div>
	</details>

	<!-- Danger zone -->
	<div class="mt-4 flex flex-wrap gap-2.5">
		<button
			type="button"
			class="text-pad-danger cursor-pointer rounded-md border border-pad-danger-border bg-transparent px-3.5 py-2 text-sm hover:brightness-125"
			onclick={resetAll}
		>
			Reset everything to defaults
		</button>
	</div>

	<footer
		class="border-pad-border text-pad-muted mt-10 flex flex-wrap items-center gap-4 border-t pt-4 text-xs"
	>
		<a
			href={GITHUB_REPO_URL}
			target="_blank"
			rel="noreferrer"
			class="text-pad-accent hover:underline"
		>
			GitHub repository ↗
		</a>
		<a href={WEBSITE_URL} target="_blank" rel="noreferrer" class="text-pad-accent hover:underline">
			Website ↗
		</a>
	</footer>
</div>
