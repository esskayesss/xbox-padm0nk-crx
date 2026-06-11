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
	}
	let { iconUrl, toggleCombo, helpCombo, enabled }: Props = $props();

	// Second line of defense (see shadow.ts CLICK-SAFETY): swallow on the dock.
	const stop = (e: Event) => e.stopPropagation();
</script>

<div
	class="pointer-events-auto fixed bottom-3 left-3 grid select-none grid-cols-[48px_auto] items-center gap-x-2.5 rounded-[20px] border px-3 py-1.5 backdrop-blur-md"
	class:border-pad-accent={enabled}
	class:border-pad-border={!enabled}
	style="min-width:218px;max-width:min(320px,calc(100vw - 24px));background:color-mix(in srgb, var(--color-pad-bg) 94%, transparent);box-shadow:0 14px 40px rgba(0,0,0,.45),0 0 26px color-mix(in srgb, var(--color-pad-green) 16%, transparent);"
	onpointerdowncapture={stop}
	onmousedowncapture={stop}
	onmouseupcapture={stop}
	onclickcapture={stop}
	role="status"
	aria-label="padm0nk HUD"
>
	<div class="grid min-w-[48px] justify-items-center gap-0.5">
		<div
			class="grid h-[34px] w-[34px] place-items-center overflow-hidden rounded-xl p-1"
			class:opacity-60={!enabled}
			style="background:linear-gradient(145deg, color-mix(in srgb, var(--color-pad-green) 78%, transparent), color-mix(in srgb, var(--color-pad-green) 30%, black));"
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
			class="text-[10px] tracking-[0.14em]"
			class:text-pad-accent={enabled}
			class:text-pad-muted={!enabled}
		>
			{enabled ? 'ON' : 'OFF'}
		</div>
	</div>

	<div class="grid min-w-0 gap-0.5">
		<div class="grid grid-cols-[auto_1fr] items-center gap-1.5">
			<b class="text-pad-accent text-xs font-semibold">{comboLabel(toggleCombo)}</b>
			<span class="text-pad-text truncate text-xs">toggle</span>
		</div>
		<div class="grid grid-cols-[auto_1fr] items-center gap-1.5">
			<b class="text-pad-accent text-xs font-semibold">{comboLabel(helpCombo)}</b>
			<span class="text-pad-text truncate text-xs">binds</span>
		</div>
		<div class="grid grid-cols-[auto_1fr] items-center gap-1.5">
			<b class="text-pad-muted text-xs font-semibold">Esc</b>
			<span class="text-pad-muted truncate text-xs">
				{enabled ? 'release aim lock' : 'click game to lock aim'}
			</span>
		</div>
	</div>
</div>
