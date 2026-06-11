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
	import { groupsForOptions } from '../core/controller-actions';
	import { DEFAULT_CONFIG, normalizeConfig } from '../core/config';
	import { comboFromEvent, comboLabel } from '../core/combos';
	import { prettyInput } from '../core/labels';
	import { readConfig, writeConfig, onConfigChanged } from '../shared/storage';
	import type { Action, Config } from '../core/types';

	const groups = groupsForOptions();

	const SLIDERS = [
		{
			key: 'sensitivity',
			label: 'Mouse sensitivity (→ right stick)',
			min: 0.002,
			max: 0.05,
			step: 0.001,
			dp: 3,
		},
		{
			key: 'smoothing',
			label: 'Smoothing (0 sharp → 0.9 floaty)',
			min: 0,
			max: 0.9,
			step: 0.05,
			dp: 2,
		},
		{
			key: 'aimMin',
			label: 'Aim minimum (deadzone compensation)',
			min: 0,
			max: 0.35,
			step: 0.01,
			dp: 2,
		},
		{
			key: 'aimCurve',
			label: 'Aim curve (<1 boosts fine aim)',
			min: 0.35,
			max: 1.5,
			step: 0.05,
			dp: 2,
		},
	] as const;

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

	let savedTimer: ReturnType<typeof setTimeout> | null = null;
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;
	let fileInput: HTMLInputElement;

	const actionEq = (a: Action | undefined, b: Action): boolean =>
		a != null &&
		a.t === b.t &&
		(a.t === 'b'
			? a.i === (b as typeof a).i
			: a.a === (b as typeof a).a && a.v === (b as typeof a).v);

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
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('mousedown', onMouse, true);
			window.removeEventListener('wheel', onWheel, true);
		};
	});

	// ---- settings ----
	function setNumber(key: (typeof SLIDERS)[number]['key'], raw: string): void {
		config[key] = parseFloat(raw);
		save();
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
	class="bg-pad-bg text-pad-text mx-auto min-h-screen max-w-[760px] px-[22px] pt-7 pb-16 font-sans text-sm leading-relaxed"
>
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

	<!-- Conflict warning (Tier-4): non-blocking inline notice. -->
	{#if conflictNotice}
		<div
			role="status"
			class="border-pad-accent/40 bg-pad-green/10 text-pad-accent mb-2 rounded-md border px-3 py-2 text-[13px]"
		>
			⚠ {conflictNotice}
		</div>
	{/if}

	<!-- Remapping sections, generated from the registry. -->
	{#each groups as group (group.title)}
		<h2
			class="text-pad-muted border-pad-chip mt-7 mb-2.5 border-b pb-1.5 text-sm font-normal tracking-[0.08em] uppercase"
		>
			{group.title}
		</h2>
		{#if group.info}
			<div class="text-pad-muted italic">{group.info}</div>
		{/if}
		{#if group.items.length}
			<div class="grid grid-cols-[140px_1fr] items-center gap-x-3.5 gap-y-2">
				{#each group.items as item (item.id)}
					<div class="text-pad-text/80">{item.label}</div>
					<div class="flex flex-wrap items-center gap-1.5">
						{#each inputsFor(item.action) as id (id)}
							<span
								class="bg-pad-chip border-pad-border inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px]"
							>
								<b class="text-pad-accent font-semibold">{prettyInput(id)}</b>
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
							class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-[13px] {isCapturing(
								capturing,
								'binding',
								item.id,
							)
								? 'animate-pulse border-amber-500 bg-amber-950/40 text-amber-300'
								: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
							onclick={() =>
								isCapturing(capturing, 'binding', item.id)
									? cancelCapture()
									: startCapture({ kind: 'binding', action: item.action, id: item.id })}
						>
							{isCapturing(capturing, 'binding', item.id) ? 'press input… (Esc cancels)' : '＋ Add'}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/each}

	<!-- Mouse & behaviour -->
	<h2
		class="text-pad-muted border-pad-chip mt-7 mb-2.5 border-b pb-1.5 text-sm font-normal tracking-[0.08em] uppercase"
	>
		Mouse &amp; behaviour
	</h2>
	<div class="flex flex-col gap-1">
		{#each SLIDERS as s (s.key)}
			<label class="my-1 flex max-w-[420px] items-center justify-between gap-3">
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
				<span class="text-pad-accent w-12 text-right tabular-nums"
					>{config[s.key].toFixed(s.dp)}</span
				>
			</label>
		{/each}
		<label class="my-1 flex max-w-[420px] items-center justify-between gap-3">
			<span>Invert Y axis</span>
			<input
				type="checkbox"
				class="accent-pad-accent"
				checked={config.invertY}
				onchange={(e) => setBool('invertY', e.currentTarget.checked)}
			/>
		</label>
		<label class="my-1 flex max-w-[420px] items-center justify-between gap-3">
			<span>Lock pointer on click (aim)</span>
			<input
				type="checkbox"
				class="accent-pad-accent"
				checked={config.lockPointerOnClick}
				onchange={(e) => setBool('lockPointerOnClick', e.currentTarget.checked)}
			/>
		</label>
		<label class="my-1 flex max-w-[420px] items-center justify-between gap-3">
			<span>Toggle on/off key combo</span>
			<button
				type="button"
				class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-[13px] {isCapturing(
					capturing,
					'toggle',
				)
					? 'animate-pulse border-amber-500 bg-amber-950/40 text-amber-300'
					: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
				onclick={() =>
					isCapturing(capturing, 'toggle') ? cancelCapture() : startCapture({ kind: 'toggle' })}
			>
				{isCapturing(capturing, 'toggle') ? 'press combo… (Esc cancels)' : toggleLabel}
			</button>
		</label>
		<label class="my-1 flex max-w-[420px] items-center justify-between gap-3">
			<span>Show keybinds combo</span>
			<button
				type="button"
				class="cursor-pointer rounded-md border border-dashed px-2.5 py-0.5 text-[13px] {isCapturing(
					capturing,
					'help',
				)
					? 'animate-pulse border-amber-500 bg-amber-950/40 text-amber-300'
					: 'border-pad-accent/40 bg-pad-green/10 text-pad-accent'}"
				onclick={() =>
					isCapturing(capturing, 'help') ? cancelCapture() : startCapture({ kind: 'help' })}
			>
				{isCapturing(capturing, 'help') ? 'press combo… (Esc cancels)' : helpLabel}
			</button>
		</label>
	</div>

	<!-- Import / Export -->
	<details class="mt-3.5">
		<summary class="text-pad-muted cursor-pointer">Import / Export profile</summary>
		<textarea
			class="bg-pad-bg-3 text-pad-text/80 border-pad-border mt-2 h-[150px] w-full rounded-md border p-2.5 font-mono text-xs leading-relaxed"
			spellcheck="false"
			bind:value={jsonText}
		></textarea>
		<div class="mt-3 flex flex-wrap gap-2.5">
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-[13px] hover:brightness-125"
				onclick={exportToBox}
			>
				Copy current → box
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-[13px] hover:brightness-125"
				onclick={importFromBox}
			>
				Apply from box
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-[13px] hover:brightness-125"
				onclick={downloadProfile}
			>
				Download profile (.json)
			</button>
			<button
				type="button"
				class="bg-pad-chip text-pad-text border-pad-border cursor-pointer rounded-md border px-3.5 py-2 text-[13px] hover:brightness-125"
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
	<div class="mt-[18px] flex flex-wrap gap-2.5">
		<button
			type="button"
			class="text-pad-danger cursor-pointer rounded-md border border-red-900 bg-transparent px-3.5 py-2 text-[13px] hover:brightness-125"
			onclick={resetAll}
		>
			Reset everything to defaults
		</button>
	</div>
</div>
