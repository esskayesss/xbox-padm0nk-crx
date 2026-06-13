<script lang="ts">
	// Keybind overlay — legacy-fidelity 3-column layout:
	//   header (brand orb + title/subtitle + Toggle/Close legends + × close)
	//   body:
	//     LEFT rail  "Left side"  — LT/LB/Left stick/L3/D-pad rows
	//     CENTER     pad-map      — recolored Xbox controller art (controllerUrl)
	//                              + absolute system-chip row (View/Guide/Menu)
	//                              + aim bar below
	//     RIGHT rail "Right side" — RT/RB/Right stick(info)/R3/A/B/X/Y rows
	//
	// Each rail row shows: bind-icon + label + currently-bound input(s) resolved
	// from `bindings` (prettyInput join " / ", else "UNMAPPED"). The right-stick
	// row is a static INFO row ("Mouse move"). System chips show label + binding.
	//
	// Colors come from theme tokens (text-pad-*/bg-pad-*); gradients, glows,
	// aspect-ratio, and absolute positioning use inline var(--color-pad-*)/rgba
	// matched to the legacy CSS — no raw hex.
	import { prettyInput } from '../../core/labels';
	import { comboLabel } from '../../core/combos';
	import { allBindsConfigured } from '../../core/controller-actions';
	import type { Action, Bindings, Combo } from '../../core/types';

	interface Props {
		open: boolean;
		bindings: Bindings;
		bindIconBase: string;
		controllerUrl: string;
		iconUrl: string;
		enabled: boolean;
		toggleCombo: Combo;
		helpCombo: Combo;
		onClose: () => void;
		onConfigure: () => void;
	}
	let {
		open,
		bindings,
		bindIconBase,
		controllerUrl,
		iconUrl,
		enabled,
		toggleCombo,
		helpCombo,
		onClose,
		onConfigure,
	}: Props = $props();

	/** A rail/system row: either a bound action or a static INFO value. */
	type Row = { icon: string; label: string; action?: Action; value?: string; dpad?: boolean };

	const leftRows: Row[] = [
		{ icon: 'left-trigger.svg', label: 'LT', action: { t: 'b', i: 6 } },
		{ icon: 'left-bumper.svg', label: 'LB', action: { t: 'b', i: 4 } },
		{ icon: 'left-stick.svg', label: 'Left stick', value: 'WASD' },
		{ icon: 'left-stick-press.svg', label: 'L3', action: { t: 'b', i: 10 } },
		{ icon: 'dpad-up.svg', label: 'D-pad up', action: { t: 'b', i: 12 }, dpad: true },
		{ icon: 'dpad-down.svg', label: 'D-pad down', action: { t: 'b', i: 13 }, dpad: true },
		{ icon: 'dpad-left.svg', label: 'D-pad left', action: { t: 'b', i: 14 }, dpad: true },
		{ icon: 'dpad-right.svg', label: 'D-pad right', action: { t: 'b', i: 15 }, dpad: true },
	];

	const rightRows: Row[] = [
		{ icon: 'right-trigger.svg', label: 'RT', action: { t: 'b', i: 7 } },
		{ icon: 'right-bumper.svg', label: 'RB', action: { t: 'b', i: 5 } },
		{ icon: 'right-stick.svg', label: 'Right stick', value: 'Mouse move' },
		{ icon: 'right-stick-press.svg', label: 'R3', action: { t: 'b', i: 11 } },
		{ icon: 'a.svg', label: 'A', action: { t: 'b', i: 0 } },
		{ icon: 'b.svg', label: 'B', action: { t: 'b', i: 1 } },
		{ icon: 'x.svg', label: 'X', action: { t: 'b', i: 2 } },
		{ icon: 'y.svg', label: 'Y', action: { t: 'b', i: 3 } },
	];

	// System buttons docked at the bottom of the center controller card.
	const systemChips: Row[] = [
		{ icon: 'view.svg', label: 'View', action: { t: 'b', i: 8 } },
		{ icon: 'guide.svg', label: 'Guide', action: { t: 'b', i: 16 } },
		{ icon: 'menu.svg', label: 'Menu', action: { t: 'b', i: 9 } },
	];

	/** Action equality — button by index, axis by (axis, direction). */
	function actionEq(a: Action, b: Action): boolean {
		if (a.t !== b.t) return false;
		if (a.t === 'b' && b.t === 'b') return a.i === b.i;
		if (a.t === 'a' && b.t === 'a') return a.a === b.a && a.v === b.v;
		return false;
	}

	function inputIdsFor(action: Action): string[] {
		return Object.keys(bindings).filter((id) => actionEq(bindings[id]!, action));
	}

	function rowValue(row: Row): string {
		if (row.value) return row.value;
		if (!row.action) return 'UNMAPPED';
		const ids = inputIdsFor(row.action);
		return ids.length ? ids.map(prettyInput).join(' / ') : 'UNMAPPED';
	}

	// Second line of defense (see shadow.ts CLICK-SAFETY): swallow on the panel.
	const stop = (e: Event) => e.stopPropagation();

	// Warn when one or more controller actions have no input bound.
	const bindsComplete = $derived(allBindsConfigured(bindings));
</script>

{#snippet bindEditor(row: Row, compact = false)}
	{#if row.action}
		{@const ids = inputIdsFor(row.action)}
		{#if ids.length}
			<div class="mt-1 flex flex-wrap items-center gap-1">
				{#each ids as id (id)}
					<span
						class="bg-pad-chip border-pad-border inline-flex max-w-full items-center rounded-sm border px-1.5 py-0.5"
					>
						<span class="text-pad-key truncate font-semibold {compact ? 'text-2xs' : 'text-xs'}"
							>{prettyInput(id)}</span
						>
					</span>
				{/each}
			</div>
		{:else}
			<span class="text-pad-muted mt-1 block {compact ? 'text-2xs' : 'text-xs'} tracking-wide"
				>UNMAPPED</span
			>
		{/if}
	{:else}
		<span class="text-pad-text block truncate {compact ? 'text-xs' : 'text-sm'} leading-tight">
			{rowValue(row)}
		</span>
	{/if}
{/snippet}

{#if open}
	<!-- Backdrop: pointer-events on (host is click-through); click closes. -->
	<div
		class="pointer-events-auto fixed inset-0 grid place-items-center p-4"
		style="background:color-mix(in srgb, black 52%, transparent);backdrop-filter:blur(6px);"
		onpointerdowncapture={stop}
		onmousedowncapture={stop}
		onmouseupcapture={stop}
		onwheel={(e) => {
			e.preventDefault();
			e.stopPropagation();
		}}
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="presentation"
	>
		<!-- Panel -->
		<div
			class="text-pad-text pad-panel-bg border-pad-accent/40 max-h-[calc(100vh-32px)] w-[min(1040px,calc(100vw-32px))] overflow-auto rounded-lg border p-5"
			onpointerdowncapture={stop}
			onmousedowncapture={stop}
			onmouseupcapture={stop}
			role="dialog"
			aria-modal="true"
			aria-label="padm0nk binds"
			tabindex="-1"
		>
			{#if !bindsComplete}
				<div
					class="bg-pad-danger text-pad-bg -mx-5 -mt-5 mb-4 px-5 py-2 text-center text-sm font-semibold tracking-wide uppercase"
					role="alert"
				>
					Some controls are unmapped — open Configure keybinds to map them
				</div>
			{/if}
			<!-- Header: brand orb + title/subtitle | shortcut legends -->
			<div
				class="mb-4 flex items-center justify-between gap-4 max-[900px]:flex-col max-[900px]:items-start"
			>
				<div class="flex items-center gap-3.5">
					<!-- Brand orb (green gradient; dim+grayscale when disabled) -->
					<span class="pad-orb grid size-12 place-items-center overflow-hidden rounded-sm">
						{#if iconUrl}
							<img
								src={iconUrl}
								alt="padm0nk"
								class="pad-icon-glow block size-9 object-contain"
								class:grayscale={!enabled}
								class:opacity-60={!enabled}
							/>
						{:else}
							<span class="text-pad-accent text-lg font-bold" aria-hidden="true">p</span>
						{/if}
					</span>
					<div>
						<div class="text-2xl tracking-wide uppercase">padm0nk binds</div>
						<div
							class="mt-0.5 text-sm uppercase"
							class:text-pad-accent={enabled}
							class:text-pad-muted={!enabled}
						>
							{enabled ? 'Virtual Xbox pad online' : 'padm0nk disabled'}
						</div>
					</div>
				</div>

				<div class="flex items-stretch gap-2.5 max-[900px]:flex-1">
					<div class="grid min-w-64 grid-cols-2 gap-2.5 max-[900px]:min-w-0 max-[900px]:flex-1">
						<div class="pad-surface rounded-sm border px-3 py-2">
							<span class="text-pad-muted block text-xs uppercase">Toggle</span>
							<span class="text-pad-text block text-sm">{comboLabel(toggleCombo)}</span>
						</div>
						<div class="pad-surface rounded-sm border px-3 py-2">
							<span class="text-pad-muted block text-xs uppercase">Close</span>
							<span class="text-pad-text block text-sm">{comboLabel(helpCombo)} / Esc</span>
						</div>
					</div>
					<button
						type="button"
						class="bg-pad-white text-pad-ink hover:bg-pad-key flex cursor-pointer flex-col items-start rounded-sm px-3 py-2"
						onclick={onConfigure}
					>
						<span class="text-sm">Configure keybinds</span>
						<span class="mt-1 text-lg leading-none" aria-hidden="true">↗</span>
					</button>
				</div>
			</div>

			<!-- Body: 3 columns (rails + center pad-map); stacks under 900px -->
			<div class="grid grid-cols-binds items-stretch gap-4 max-[900px]:grid-cols-1">
				<!-- LEFT rail -->
				<div class="grid content-start gap-2 max-[900px]:grid-cols-2">
					<div
						class="text-pad-accent mb-0.5 text-xs tracking-widest uppercase max-[900px]:col-span-full"
					>
						Left side
					</div>
					{#each leftRows as row (row.label)}
						<div class="pad-surface flex min-h-11 items-center gap-2 rounded-sm border px-2 py-2">
							<div class="grid size-9 shrink-0 place-items-center">
								{#if bindIconBase}
									<img
										src={bindIconBase + row.icon}
										alt={row.label}
										class="pad-icon-glow max-h-7 max-w-7 object-contain"
									/>
								{:else}
									<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
								{/if}
							</div>
							<div class="min-w-0">
								<span class="text-pad-muted block text-2xs tracking-widest uppercase">
									{row.label}
								</span>
								{@render bindEditor(row)}
							</div>
						</div>
					{/each}
				</div>

				<!-- CENTER: controller art on top; system buttons + aim bar docked bottom -->
				<div
					class="pad-card-bg border-pad-hairline flex min-w-0 flex-col rounded-md border p-3 max-[900px]:order-first"
				>
					<div
						class="pad-padmap-bg relative aspect-controller w-full overflow-visible rounded-md"
						aria-label="Xbox controller"
					>
						{#if controllerUrl}
							<img
								src={controllerUrl}
								alt="Xbox controller"
								class="pad-art-glow absolute inset-0 h-full w-full object-contain"
							/>
						{/if}
					</div>

					<!-- Docked at the bottom of the card: system buttons + aim bar -->
					<div class="mt-auto grid gap-2.5 pt-3">
						<!-- View / Guide / Menu strip -->
						<div
							class="pad-strip-bg border-pad-accent/20 flex justify-center gap-2 rounded-md border p-2 backdrop-blur-sm"
						>
							{#each systemChips as chip (chip.label)}
								<div
									class="pad-surface flex w-full min-w-24 items-center gap-2 rounded-sm border px-2 py-1.5"
								>
									{#if bindIconBase}
										<img
											src={bindIconBase + chip.icon}
											alt={chip.label}
											class="pad-icon-glow size-5 shrink-0 object-contain"
										/>
									{:else}
										<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
									{/if}
									<div class="min-w-0">
										<span class="text-pad-muted block text-2xs tracking-widest uppercase">
											{chip.label}
										</span>
										{@render bindEditor(chip, true)}
									</div>
								</div>
							{/each}
						</div>

						<!-- Aim bar -->
						<div
							class="pad-aim-bg border-pad-accent/20 flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5"
						>
							<span class="text-pad-accent text-xs uppercase">Right stick aim</span>
							<span class="text-pad-text text-right text-sm"
								>Mouse movement while pointer locked</span
							>
						</div>
					</div>
				</div>

				<!-- RIGHT rail -->
				<div class="grid content-start gap-2 max-[900px]:grid-cols-2">
					<div
						class="text-pad-accent mb-0.5 text-xs tracking-widest uppercase max-[900px]:col-span-full"
					>
						Right side
					</div>
					{#each rightRows as row (row.label)}
						<div class="pad-surface flex min-h-11 items-center gap-2 rounded-sm border px-2 py-2">
							<div class="grid size-9 shrink-0 place-items-center">
								{#if bindIconBase}
									<img
										src={bindIconBase + row.icon}
										alt={row.label}
										class="pad-icon-glow max-h-7 max-w-7 object-contain"
									/>
								{:else}
									<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
								{/if}
							</div>
							<div class="min-w-0">
								<span class="text-pad-muted block text-2xs tracking-widest uppercase">
									{row.label}
								</span>
								{@render bindEditor(row)}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
