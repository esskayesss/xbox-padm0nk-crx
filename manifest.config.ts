import { defineManifest } from '@crxjs/vite-plugin';

// Match patterns mirrored from the legacy manifest.json content_scripts.
const MATCHES = [
	'https://www.xbox.com/*/play*',
	'https://www.xbox.com/play*',
	'https://www.gamepad-tester.com/*',
	'https://gamepad-tester.com/*',
	'https://hardwaretester.com/gamepad*',
];

// Host patterns for web-accessible resources (mirrors legacy WAR matches).
const WAR_MATCHES = [
	'https://www.xbox.com/*',
	'https://www.gamepad-tester.com/*',
	'https://gamepad-tester.com/*',
	'https://hardwaretester.com/*',
];

export default defineManifest({
	manifest_version: 3,
	name: 'padm0nk — Keyboard & Mouse for xCloud',
	version: '1.0.0',
	description:
		'Play Xbox Cloud Gaming with mouse + keyboard by emulating an Xbox controller via the Gamepad API. Free, no drivers.',
	minimum_chrome_version: '111',
	permissions: ['storage'],
	icons: {
		'16': 'icons/icon-16.png',
		'32': 'icons/icon-32.png',
		'48': 'icons/icon-48.png',
		'128': 'icons/icon-128.png',
	},
	options_ui: {
		page: 'src/options/index.html',
		open_in_tab: true,
	},
	action: {
		default_title: 'padm0nk',
		default_popup: 'src/popup/index.html',
		default_icon: {
			'16': 'icons/icon-16.png',
			'32': 'icons/icon-32.png',
			'48': 'icons/icon-48.png',
			'128': 'icons/icon-128.png',
		},
	},
	web_accessible_resources: [
		{
			resources: [
				'assets/xbox-controller.svg',
				'assets/bind-icons/*.svg',
				'assets/fonts/*.woff',
				'icons/padm0nk.png',
			],
			matches: WAR_MATCHES,
		},
	],
	content_scripts: [
		{
			matches: MATCHES,
			js: ['src/content/bridge.ts'],
			run_at: 'document_start',
			all_frames: true,
		},
		{
			matches: MATCHES,
			js: ['src/content/inject.ts'],
			run_at: 'document_start',
			world: 'MAIN',
			all_frames: true,
		},
	],
});
