/*
 * Matrix entry for Program-Specific PS.
 * Loaded for authorized users only, on the Hub page only. The dedicated menu
 * item is inserted beside the existing File Vault link and points directly to
 * the isolated PSV page. The legacy File Vault launcher remains in its own
 * shadow root. If anything here throws, File Vault and Matrix remain usable.
 */
(function () {
	'use strict';
	try {
		var cfg = window.mmpsEntry || {};
		if (!cfg.url || window.__mmpsEntryMounted) { return; }
		window.__mmpsEntryMounted = true;

		var host = document.createElement('div');
		host.id = 'mmps-entry-host';
		host.setAttribute('data-mmps', 'entry');
		var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
		root.innerHTML =
			'<style>' +
			':host{all:initial}' +
			'.w{position:fixed;right:22px;bottom:22px;z-index:2147483000;display:none;font-family:Archivo,"Avenir Next",system-ui,-apple-system,"Segoe UI",sans-serif}' +
			'.w.on{display:block}' +
			'.c{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-radius:16px;background:linear-gradient(165deg,rgba(19,25,39,.97),rgba(15,20,33,.97));border:1px solid rgba(255,179,64,.5);box-shadow:0 18px 50px -18px rgba(0,0,0,.8),0 0 0 1px rgba(255,179,64,.08);color:#e9eefb;text-decoration:none;max-width:400px}' +
			'.c:hover{border-color:#ffb340}' +
			'.c:focus-visible{outline:3px solid #39d6ff;outline-offset:3px}' +
			'.k{white-space:nowrap;font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#8e9ab4;display:block}' +
			'.t{font-size:15.5px;font-weight:800;letter-spacing:-.01em;display:block;line-height:1.25}' +
			'.t em{color:#ffb340;font-style:normal}' +
			'.g{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#ffb340,#ff7a3d);color:#160c02;font-weight:900;font-size:17px}' +
			'.x{position:absolute;top:-9px;right:-9px;width:24px;height:24px;border-radius:50%;border:1px solid #31405c;background:#0f1522;color:#aab8d1;font-size:14px;line-height:1;cursor:pointer;display:grid;place-items:center}' +
			'.x:hover{color:#fff;border-color:#aab8d1}' +
			'@media (max-width:640px){.w{right:12px;bottom:12px}.c{max-width:280px}}' +
			'</style>' +
			'<div class="w" part="w"><a class="c" href="#" target="_self"><span class="g">PF</span><span><span class="k">Program-Specific Personal Statements</span><span class="t">PS<em>Forge</em> →</span></span></a><button class="x" type="button" aria-label="Hide the PSForge launcher">×</button></div>';
		root.querySelector('.c').setAttribute('href', cfg.url);
		var wrap = root.querySelector('.w');
		var hidden = false;
		root.querySelector('.x').addEventListener('click', function () { hidden = true; wrap.className = 'w'; });

		function menuMounted() {
			return !!document.querySelector('[data-mmps-menu="1"]');
		}
		function mountMenuEntry() {
			if (menuMounted()) { return; }
			var fileVault = document.querySelector('.sos-nav-link[href="#filevault"]');
			var list = fileVault && fileVault.closest ? fileVault.closest('.sos-nav-list') : null;
			if (!list || !fileVault) { return; }
			var item = document.createElement('li');
			item.setAttribute('data-mmps-menu', '1');
			var link = document.createElement('a');
			link.className = 'sos-nav-link';
			link.href = cfg.url;
			link.setAttribute('aria-label', 'Open PSForge');
			var icon = document.createElement('span');
			icon.className = 'sos-nav-icon';
			icon.setAttribute('aria-hidden', 'true');
			icon.textContent = 'PF';
			var label = document.createElement('span');
			label.className = 'sos-nav-text';
			label.textContent = 'PSForge';
			link.appendChild(icon);
			link.appendChild(label);
			item.appendChild(link);
			var fileVaultItem = fileVault.closest ? fileVault.closest('li') : fileVault.parentNode;
			if (!fileVaultItem || fileVaultItem.parentNode !== list) { return; }
			list.insertBefore(item, fileVaultItem.nextSibling);
		}

		function fileVaultOnScreen() {
			var stage = document.getElementById('mmed-file-vault-v2-content') || document.querySelector('[data-fv2-stage]');
			return !!(stage && stage.offsetParent !== null);
		}
		function tick() {
			try {
				mountMenuEntry();
				wrap.className = (!hidden && fileVaultOnScreen()) ? 'w on' : 'w';
			} catch (e) { /* never surface */ }
		}
		function mount() {
			if (!document.body) { return; }
			document.body.appendChild(host);
			tick();
			window.setInterval(tick, 900);
		}
		if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }
	} catch (e) { /* the Hub page must never be affected */ }
})();
