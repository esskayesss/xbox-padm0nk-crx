<script lang="ts">
	// Keybind overlay — a larger, scrollable panel listing every control grouped
	// by the registry `group`. Each row: bind-icon + label + currently-bound
	// input(s) (via prettyInput). Closable via the close button or backdrop.
	//
	// Rows derive from the SINGLE registry (controller-actions.groupsForOptions):
	// info groups (e.g. the mouse-driven right stick) render their descriptive
	// text; item groups render one row per ControllerAction, with the bound
	// inputs resolved by filtering `bindings` for actions equal to entry.action.
	//
	// Colors come ONLY from theme tokens — no inline hex.
	import { groupsForOptions } from '../../core/controller-actions';
	import { prettyInput } from '../../core/labels';
	import { comboLabel } from '../../core/combos';
	import type { Action, Bindings, Combo } from '../../core/types';

	interface Props {
		open: boolean;
		bindings: Bindings;
		bindIconBase: string;
		toggleCombo: Combo;
		helpCombo: Combo;
		onClose: () => void;
	}
	let { open, bindings, bindIconBase, toggleCombo, helpCombo, onClose }: Props = $props();

	const groups = groupsForOptions();

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
			class="text-pad-text flex max-h-[calc(100vh-32px)] w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border"
			style="border-color:color-mix(in srgb, var(--color-pad-accent) 38%, transparent);background:color-mix(in srgb, var(--color-pad-bg-2) 96%, transparent);box-shadow:0 28px 90px rgba(0,0,0,.62),0 0 42px color-mix(in srgb, var(--color-pad-green) 18%, transparent);"
			onclickcapture={stop}
			onpointerdowncapture={stop}
			onmousedowncapture={stop}
			onmouseupcapture={stop}
			role="dialog"
			aria-modal="true"
			aria-label="padm0nk binds"
			tabindex="-1"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between gap-4 border-b px-6 py-4"
				style="border-color:color-mix(in srgb, var(--color-pad-accent) 16%, transparent);"
			>
				<div>
					<div class="text-lg font-semibold tracking-wide uppercase">padm0nk binds</div>
					<div class="text-pad-accent mt-0.5 text-xs uppercase">
						Toggle {comboLabel(toggleCombo)} · Close {comboLabel(helpCombo)} / Esc
					</div>
				</div>
				<button
					type="button"
					class="text-pad-text hover:border-pad-accent grid h-9 w-9 place-items-center rounded-full border text-lg leading-none"
					style="border-color:color-mix(in srgb, var(--color-pad-accent) 24%, transparent);background:color-mix(in srgb, var(--color-pad-chip) 80%, transparent);"
					onclick={onClose}
					aria-label="Close binds overlay"
				>
					×
				</button>
			</div>

			<!-- Scrollable body -->
			<div class="grid gap-5 overflow-auto px-6 py-5">
				{#each groups as group (group.title)}
					<section class="grid gap-2">
						<h3 class="text-pad-accent text-xs font-semibold tracking-[0.12em] uppercase">
							{group.title}
						</h3>
						{#if group.info}
							<p class="text-pad-muted text-sm">{group.info}</p>
						{/if}
						{#if group.items.length}
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{#each group.items as item (item.id)}
									<div
										class="grid grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border px-3 py-2"
										style="border-color:color-mix(in srgb, var(--color-pad-border) 70%, transparent);background:color-mix(in srgb, var(--color-pad-chip) 45%, transparent);"
									>
										<div class="grid h-[34px] w-[34px] place-items-center">
											{#if bindIconBase && item.icon}
												<img
													src={bindIconBase + item.icon}
													alt={item.label}
													class="max-h-[30px] max-w-[30px] object-contain"
												/>
											{:else}
												<span class="text-pad-muted text-xs" aria-hidden="true">•</span>
											{/if}
										</div>
										<div class="min-w-0">
											<span class="text-pad-muted block text-[10px] tracking-[0.09em] uppercase">
												{item.label}
											</span>
											<span class="text-pad-text block truncate text-sm">
												{boundInputs(item.action)}
											</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</div>
		</div>
	</div>
{/if}
