// Labels for input ids. Single source of truth — fixes the legacy drift where
// inject.js lacked Mouse3/Mouse4 that options.js had (REBUILD.md bug item 2).

/** Human-readable label for an input id. */
export function prettyInput(id: string): string {
	if (id === 'Mouse0') return 'Left Click';
	if (id === 'Mouse1') return 'Middle Click';
	if (id === 'Mouse2') return 'Right Click';
	if (id === 'Mouse3') return 'Mouse 4';
	if (id === 'Mouse4') return 'Mouse 5';
	if (id === 'WheelUp') return 'Wheel ↑';
	if (id === 'WheelDown') return 'Wheel ↓';
	if (id.startsWith('Key')) return id.slice(3);
	if (id.startsWith('Digit')) return id.slice(5);
	if (id.startsWith('Arrow')) return id.slice(5) + ' Arrow';
	return id
		.replace('ControlLeft', 'L-Ctrl')
		.replace('ControlRight', 'R-Ctrl')
		.replace('ShiftLeft', 'L-Shift')
		.replace('ShiftRight', 'R-Shift')
		.replace('AltLeft', 'L-Alt')
		.replace('AltRight', 'R-Alt')
		.replace('Backquote', '` (tilde)');
}
