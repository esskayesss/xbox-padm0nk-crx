// padm0nk bridge.js — isolated content-script world.
// Has chrome.* APIs; relays stored config into the MAIN-world inject.js.
(() => {
	function post(config) {
		window.postMessage(
			{
				__padm0nk: "config",
				config: config || {},
				controllerUrl:
					chrome.runtime?.getURL?.("assets/xbox-controller.svg") || "",
				iconUrl: chrome.runtime?.getURL?.("icons/padm0nk.png") || "",
				bindIconBase: chrome.runtime?.getURL?.("assets/bind-icons/") || "",
			},
			"*",
		);
	}

	// initial load: local is the fast/live store; sync is fallback for old installs.
	try {
		chrome.storage?.local.get("config", (localRes) => {
			if (localRes && localRes.config) {
				post(localRes.config);
				return;
			}
			chrome.storage?.sync.get("config", (syncRes) => {
				const config = syncRes && syncRes.config ? syncRes.config : {};
				post(config);
				if (syncRes && syncRes.config) chrome.storage?.local.set({ config });
			});
		});
	} catch {
		post({});
	}

	// live updates from the popup
	try {
		chrome.storage?.onChanged.addListener((changes, area) => {
			if ((area === "sync" || area === "local") && changes.config) {
				post(changes.config.newValue || {});
			}
		});
	} catch {}
})();
