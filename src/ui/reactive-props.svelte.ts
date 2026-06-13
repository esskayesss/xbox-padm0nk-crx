// Tiny rune-backed reactive props box.
//
// Svelte 5 props passed to `mount()` are NOT reactive unless the props object
// itself is a `$state` proxy. Runes are only compiled in `.svelte` / `.svelte.ts`
// modules, so this helper lives here (not in `shadow.ts`) to keep the public
// mount contract in a plain `.ts` file while still giving P6 live `update()`.

/**
 * Wrap an initial props object in a `$state` proxy. Mutating via `set()` patches
 * the same proxy, so a component mounted with `box.props` re-renders reactively.
 */
export function createPropsBox<T extends object>(
	initial: T,
): {
	props: T;
	set(patch: Partial<T>): void;
} {
	const props = $state<T>({ ...initial });
	return {
		props,
		set(patch: Partial<T>) {
			Object.assign(props, patch);
		},
	};
}
