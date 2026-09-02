/** Runtime v2 entrypoint: load the shared core, then exactly one server-resolved renderer. */
(function (global, document) {
	'use strict';
	var config = (global.mmedStudentOsFeatureFlags && global.mmedStudentOsFeatureFlags.calendar_experience) || {};
	var assets = config.assets || {};
	var renderer = config.experience === 'storyforge' ? assets.v2_js : assets.classic_js;

	function load(url, ready) {
		if (ready()) return Promise.resolve();
		if (!url) return Promise.reject(new Error('Calendar runtime asset is unavailable.'));
		return new Promise(function (resolve, reject) {
			var script = document.createElement('script');
			script.src = url;
			script.async = false;
			script.onload = function () { ready() ? resolve() : reject(new Error('Calendar asset did not register.')); };
			script.onerror = function () { reject(new Error('Calendar asset failed to load.')); };
			document.head.appendChild(script);
		});
	}

	load(assets.core, function () { return !!global.MMEDCalendarCore; })
		.then(function () { return load(renderer, function () { return !!(global.MMEDCalendarV4 && global.MMEDCalendarV4.mount); }); })
		.catch(function (error) {
			if (global.console && global.console.error) global.console.error('[Matrix Calendar] runtime boot failed', error);
		});
})(window, document);
