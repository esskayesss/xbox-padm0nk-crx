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
	}: Props = $props();

	/** A rail/system row: either a bound action or a static INFO value. */
	type Row = { icon: string; label: string; action?: Action; value?: string; dpad?: boolean };

	const leftRows: Row[] = [
		{ icon: 'left-trigger.svg', label: 'LT', action: { t: 'b', i: 6 } },
		{ icon: 'left-bumper.svg', label: 'LB', action: { t: 'b', i: 4 } },
		{ icon: 'left-stick.svg', label: 'Left stick', action: { t: 'a', a: 1, v: -1 } },
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

	/** Bound input ids for an action, prettified; "UNMAPPED" when none. */
	function boundInputs(action: Action): string {
		const ids = Object.keys(bindings).filter((id) => actionEq(bindings[id]!, action));
		return ids.length ? ids.map(prettyInput).join(' / ') : 'UNMAPPED';
	}

	/** Resolve the value shown on a row: static info or live binding. */
	function rowValue(row: Row): string {
		return row.value ?? (row.action ? boundInputs(row.action) : 'UNMAPPED');
	}

	// Second line of defense (see shadow.ts CLICK-SAFETY): swallow on the panel.
	const stop = (e: Event) => e.stopPropagation();
</script>

{#if open}
	<!-- Backdrop: pointer-events on (host is click-through); click closes. -->
	<div
		class="pointer-events-auto fixed inset-0 grid place-items-center p-4"
		style="background:color-mix(in srgb, black 52%, transparent);backdrop-filter:blur(6px);"
		onpointerdowncapture={stop}
		onmousedowncapture={stop}
		onmouseupcapture={stop}
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="presentation"
	>
		<!-- Panel -->
		<div
			class="text-pad-text max-h-[calc(100vh-32px)] w-[min(1040px,calc(100vw-32px))] overflow-auto rounded-3xl border p-[22px]"
			style="border-color:color-mix(in srgb, var(--color-pad-accent) 38%, transparent);background:linear-gradient(145deg, color-mix(in srgb, var(--color-pad-bg-2) 96%, transparent), color-mix(in srgb, var(--color-pad-bg) 96%, transparent));box-shadow:0 28px 90px rgba(0,0,0,.62),0 0 42px color-mix(in srgb, var(--color-pad-green) 18%, transparent);"
			onclickcapture={stop}
			onpointerdowncapture={stop}
			onmousedowncapture={stop}
			onmouseupcapture={stop}
			role="dialog"
			aria-modal="true"
			aria-label="padm0nk binds"
			tabindex="-1"
		>
			<!-- Header: brand orb + title/subtitle | legends + close -->
			<div
				class="mb-[18px] flex items-center justify-between gap-[18px] max-[900px]:flex-col max-[900px]:items-start"
			>
				<div class="flex items-center gap-3.5">
					<!-- Brand orb (green gradient; dim+grayscale when disabled) -->
					<span
						class="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl"
						style="background:linear-gradient(145deg, color-mix(in srgb, var(--color-pad-green) 88%, transparent), color-mix(in srgb, var(--color-pad-green) 28%, black));box-shadow:0 0 24px color-mix(in srgb, var(--color-pad-green) 56%, transparent), inset 0 0 18px rgba(255,255,255,.12);"
					>
						{#if iconUrl}
							<img
								src={iconUrl}
								alt="padm0nk"
								class="block h-[38px] w-[38px] object-contain"
								class:grayscale={!enabled}
								class:opacity-60={!enabled}
								style="filter:drop-shadow(0 1px 1px rgba(0,0,0,.6));"
							/>
						{:else}
							<span class="text-pad-accent text-lg font-bold" aria-hidden="true">p</span>
						{/if}
					</span>
					<div>
						<div class="text-[28px] tracking-[0.02em] uppercase">padm0nk binds</div>
						<div
							class="mt-[3px] text-[13px] uppercase"
							class:text-pad-accent={enabled}
							class:text-pad-muted={!enabled}
						>
							{enabled ? 'Virtual Xbox pad online' : 'padm0nk disabled'}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-2.5">
					<!-- Toggle / Close legends -->
					<div
						class="grid min-w-[260px] grid-cols-2 gap-2.5 max-[900px]:min-w-0 max-[900px]:flex-1"
					>
						<div
							class="rounded-2xl border px-[11px] py-[9px]"
							style="border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.045);"
						>
							<span class="text-pad-muted block text-[11px] uppercase">Toggle</span>
							<span class="text-pad-text block text-sm">{comboLabel(toggleCombo)}</span>
						</div>
						<div
							class="rounded-2xl border px-[11px] py-[9px]"
							style="border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.045);"
						>
							<span class="text-pad-muted block text-[11px] uppercase">Close</span>
							<span class="text-pad-text block text-sm">{comboLabel(helpCombo)} / Esc</span>
						</div>
					</div>
					<button
						type="button"
						class="text-pad-text hover:border-pad-accent grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg leading-none"
						style="border-color:color-mix(in srgb, var(--color-pad-accent) 24%, transparent);background:color-mix(in srgb, var(--color-pad-chip) 80%, transparent);"
						onclick={onClose}
						aria-label="Close binds overlay"
					>
						×
					</button>
				</div>
			</div>

			<!-- Body: 3 columns (rails + center pad-map); stacks under 900px -->
			<div
				class="grid grid-cols-[minmax(180px,0.75fr)_minmax(410px,1.5fr)_minmax(180px,0.75fr)] items-stretch gap-[18px] max-[900px]:grid-cols-1"
			>
				<!-- LEFT rail -->
				<div class="grid content-start gap-[9px] max-[900px]:grid-cols-2">
					<div
						class="text-pad-accent mb-[2px] text-xs tracking-[0.12em] uppercase max-[900px]:col-span-full"
					>
						Left side
					</div>
					{#each leftRows as row (row.label)}
						<div
							class="grid min-h-[44px] grid-cols-[34px_1fr] items-center gap-2.5 rounded-[15px] border px-[9px] py-[7px]"
							style="border-color:rgba(255,255,255,.09);background:rgba(255,255,255,.045);"
						>
							<div class="grid h-[34px] w-[34px] place-items-center">
								{#if bindIconBase}
									<img
										src={bindIconBase + row.icon}
										alt={row.label}
										class="max-h-[30px] max-w-[30px] object-contain"
										style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));"
									/>
								{:else}
									<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
								{/if}
							</div>
							<div class="min-w-0">
								<span class="text-pad-muted block text-[10px] tracking-[0.09em] uppercase">
									{row.label}
								</span>
								<span
									class="text-pad-text block truncate leading-[1.2]"
									class:text-[13px]={row.dpad}
									class:text-sm={!row.dpad}
								>
									{rowValue(row)}
								</span>
							</div>
						</div>
					{/each}
				</div>

				<!-- CENTER: pad-map + system chips + aim bar -->
				<div
					class="min-w-0 rounded-[22px] border p-3 max-[900px]:order-first"
					style="border-color:rgba(255,255,255,.08);background:radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--color-pad-green) 22%, transparent), transparent 42%), rgba(255,255,255,.035);"
				>
					<div
						class="relative aspect-[744/500] w-full overflow-hidden rounded-[18px]"
						style="background:radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--color-pad-green) 25%, transparent), transparent 48%);"
						aria-label="Xbox controller"
					>
						{#if controllerUrl}
							<img
								src={controllerUrl}
								alt="Xbox controller"
								class="absolute inset-0 h-full w-full object-contain"
								style="filter:drop-shadow(0 18px 28px rgba(0,0,0,.55)) drop-shadow(0 0 18px color-mix(in srgb, var(--color-pad-green) 24%, transparent));"
							/>
						{/if}
						<!-- System chips (View/Guide/Menu) — bottom-center -->
						<div
							class="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl border p-[7px] backdrop-blur-[10px]"
							style="border-color:color-mix(in srgb, var(--color-pad-accent) 18%, transparent);background:rgba(5,9,12,.72);box-shadow:0 12px 28px rgba(0,0,0,.34);"
						>
							{#each systemChips as chip (chip.label)}
								<div
									class="grid min-w-[94px] grid-cols-[24px_auto] items-center gap-[7px] rounded-[11px] border px-2 py-[5px]"
									style="border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.045);"
								>
									{#if bindIconBase}
										<img
											src={bindIconBase + chip.icon}
											alt={chip.label}
											class="h-[22px] w-[22px] object-contain"
										/>
									{:else}
										<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
									{/if}
									<div class="min-w-0">
										<span class="text-pad-muted block text-[9px] tracking-[0.09em] uppercase">
											{chip.label}
										</span>
										<span class="text-pad-text block truncate text-xs">{rowValue(chip)}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
					<!-- Aim bar -->
					<div
						class="mt-2.5 flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5"
						style="border-color:color-mix(in srgb, var(--color-pad-accent) 19%, transparent);background:color-mix(in srgb, var(--color-pad-green) 18%, transparent);"
					>
						<span class="text-pad-accent text-xs uppercase">Right stick aim</span>
						<span class="text-pad-text text-right text-sm">Mouse movement while pointer locked</span
						>
					</div>
				</div>

				<!-- RIGHT rail -->
				<div class="grid content-start gap-[9px] max-[900px]:grid-cols-2">
					<div
						class="text-pad-accent mb-[2px] text-xs tracking-[0.12em] uppercase max-[900px]:col-span-full"
					>
						Right side
					</div>
					{#each rightRows as row (row.label)}
						<div
							class="grid min-h-[44px] grid-cols-[34px_1fr] items-center gap-2.5 rounded-[15px] border px-[9px] py-[7px]"
							style="border-color:rgba(255,255,255,.09);background:rgba(255,255,255,.045);"
						>
							<div class="grid h-[34px] w-[34px] place-items-center">
								{#if bindIconBase}
									<img
										src={bindIconBase + row.icon}
										alt={row.label}
										class="max-h-[30px] max-w-[30px] object-contain"
										style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));"
									/>
								{:else}
									<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
								{/if}
							</div>
							<div class="min-w-0">
								<span class="text-pad-muted block text-[10px] tracking-[0.09em] uppercase">
									{row.label}
								</span>
								<span class="text-pad-text block truncate text-sm leading-[1.2]">
									{rowValue(row)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
