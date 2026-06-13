import { normalizeConfig } from '../core/config';
import { readConfig } from '../shared/storage';

const COLORED_ICON = {
	16: 'icons/icon-16.png',
	32: 'icons/icon-32.png',
	48: 'icons/icon-48.png',
	128: 'icons/icon-128.png',
};

const DISABLED_ICON = {
	16: 'icons/icon-disabled-16.png',
	32: 'icons/icon-disabled-32.png',
	48: 'icons/icon-disabled-48.png',
	128: 'icons/icon-disabled-128.png',
};

async function setActionIcon(enabled: boolean): Promise<void> {
	await chrome.action.setIcon({ path: enabled ? COLORED_ICON : DISABLED_ICON });
	await chrome.action.setTitle({ title: enabled ? 'padm0nk — ON' : 'padm0nk — OFF' });
}

async function updateActionIconFromStorage(): Promise<void> {
	const config = await readConfig();
	await setActionIcon(config.enabled);
}

void updateActionIconFromStorage();

chrome.runtime.onInstalled.addListener(() => {
	void updateActionIconFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
	void updateActionIconFromStorage();
});

chrome.storage.onChanged.addListener((changes, area) => {
	if ((area === 'local' || area === 'sync') && changes.config) {
		void setActionIcon(normalizeConfig(changes.config.newValue).enabled);
	}
});
