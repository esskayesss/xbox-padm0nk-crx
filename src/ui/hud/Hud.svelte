<script lang="ts">
	// Passive HUD dock — bottom-left. Shows the padm0nk icon, ON/OFF state, and
	// the real toggle + help combos as key hints. Click-safe: stops pointer/mouse
	// events from reaching the page (legacy parity; P6 also checks composedPath).
	//
	// Colors come ONLY from theme tokens (text-pad-*, bg-pad-*) — no inline hex.
	import { comboLabel } from '../../core/combos';
	import type { Combo } from '../../core/types';

	interface Props {
		iconUrl: string;
		toggleCombo: Combo;
		helpCombo: Combo;
		enabled: boolean;
		inGame: boolean;
	}
	let { iconUrl, toggleCombo, helpCombo, enabled, inGame }: Props = $props();

	// Second line of defense (see shadow.ts CLICK-SAFETY): swallow on the dock.
	const stop = (e: Event) => e.stopPropagation();
</script>

<div
	class="pad-hud-bg pointer-events-auto fixed bottom-3 left-3 flex min-w-56 max-w-[min(320px,calc(100vw-24px))] select-none items-center gap-2 rounded-sm border p-1.5 backdrop-blur-md transition-opacity duration-200 hover:opacity-100"
	class:border-pad-accent={enabled}
	class:border-pad-border={!enabled}
	class:opacity-20={inGame}
	onpointerdowncapture={stop}
	onmousedowncapture={stop}
	onmouseupcapture={stop}
	onclickcapture={stop}
	role="status"
	aria-label="padm0nk HUD"
>
	<div class="grid shrink-0 justify-items-center gap-0.5">
		<div
			class="pad-orb-hud grid size-10 place-items-center overflow-hidden rounded-sm p-1"
			class:opacity-60={!enabled}
		>
			{#if iconUrl}
				<img
					src={iconUrl}
					alt="padm0nk"
					class="h-full w-full object-contain"
					class:grayscale={!enabled}
				/>
			{:else}
				<span class="text-pad-accent text-sm font-bold" aria-hidden="true">p</span>
			{/if}
		</div>
		<div
			class="text-2xs tracking-widest"
			class:text-pad-accent={enabled}
			class:text-pad-muted={!enabled}
		>
			{enabled ? 'ON' : 'OFF'}
		</div>
	</div>

	<div class="grid min-w-0 gap-0.5">
		<div class="flex items-center gap-1.5">
			<b class="text-pad-accent text-xs font-semibold">{comboLabel(toggleCombo)}</b>
			<span class="text-pad-text min-w-0 flex-1 truncate text-xs">toggle</span>
		</div>
		<div class="flex items-center gap-1.5">
			<b class="text-pad-accent text-xs font-semibold">{comboLabel(helpCombo)}</b>
			<span class="text-pad-text min-w-0 flex-1 truncate text-xs">binds</span>
		</div>
		<div class="flex items-center gap-1.5">
			<b class="text-pad-muted text-xs font-semibold">Esc</b>
			<span class="text-pad-muted min-w-0 flex-1 truncate text-xs">
				{enabled ? 'release aim lock' : 'click game to lock aim'}
			</span>
		</div>
	</div>
</div>
