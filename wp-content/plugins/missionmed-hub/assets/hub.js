/**
 * MissionMed Hub — Command Center JS (MR-LD-10)
 * Vanilla JS — no jQuery dependency
 */

(function () {
	'use strict';

	var activeDivision = null;
	var lastVideoTrigger = null;
	var videoModalPreviousOverflow = '';
	var videoInserterState = {
		config: null,
		manifest: [],
		filteredVideos: [],
		selectedVideo: null,
		context: null,
		app: null,
		previousActiveElement: null,
		previousOverflow: '',
	};

	/**
	 * Initialize all Command Center functionality
	 */
	function init() {
		initDivisionSwitcher();
		initSidebarNavigation();
		initMobileMenu();
		initCollapsibleTasks();
		initFileUpload();
		initTimezoneConversion();
		initHeroCTA();
		initVideoLibrary();
		initLearnDashVideoInserter();
		initHashRouting();
	}

	/* ═══ SIDEBAR NAVIGATION ═══ */

	function initSidebarNavigation() {
		const navItems = document.querySelectorAll('.mmed-nav-item[data-view]');
		const views = document.querySelectorAll('.mmed-view');

		navItems.forEach(function (item) {
			item.addEventListener('click', function (e) {
				e.preventDefault();
				const viewId = item.getAttribute('data-view');
				switchView(viewId, navItems, views);

				// Close mobile menu
				closeMobileMenu();

				// Update hash
				history.replaceState(null, '', '#' + viewId);
			});
		});
	}

	function switchView(viewId, navItems, views) {
		if (!navItems) navItems = document.querySelectorAll('.mmed-nav-item[data-view]');
		if (!views) views = document.querySelectorAll('.mmed-view');

		navItems.forEach(function (nav) {
			nav.classList.toggle('active', nav.getAttribute('data-view') === viewId);
		});

		views.forEach(function (view) {
			view.classList.toggle('active', view.id === 'view-' + viewId);
		});

		closeVideoModal();

		// Scroll to top of main content
		var main = document.getElementById('mmed-main');
		if (main) main.scrollTop = 0;
		window.scrollTo(0, 0);
	}

	/* ═══ DIVISION SWITCHER ═══ */

	function initDivisionSwitcher() {
		var tabs = document.querySelectorAll('.mmed-division-tab[data-division]');
		if (!tabs.length) return;

		var preferredDivision = null;
		try {
			preferredDivision = window.localStorage.getItem('mmedActiveDivision');
		} catch (error) {
			preferredDivision = null;
		}

		var defaultTab = document.querySelector('.mmed-division-tab.active') || tabs[0];
		var targetDivision = defaultTab ? defaultTab.getAttribute('data-division') : null;

		if (preferredDivision && document.querySelector('.mmed-division-tab[data-division="' + preferredDivision + '"]')) {
			targetDivision = preferredDivision;
		}

		if (targetDivision) {
			setActiveDivision(targetDivision, false);
		}

		tabs.forEach(function (tab) {
			tab.addEventListener('click', function () {
				var divisionId = tab.getAttribute('data-division');
				if (!divisionId) return;
				setActiveDivision(divisionId, true);
			});
		});
	}

	function setActiveDivision(divisionId, persist) {
		var tabs = document.querySelectorAll('.mmed-division-tab[data-division]');
		var panels = document.querySelectorAll('.mmed-division-panel[data-division-panel]');
		var scopedSections = document.querySelectorAll('.mmed-division-scoped[data-division-scope]');

		if (!tabs.length) return;
		activeDivision = divisionId;

		tabs.forEach(function (tab) {
			var isMatch = tab.getAttribute('data-division') === divisionId;
			tab.classList.toggle('active', isMatch);
			tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');

			if (persist && isMatch) {
				tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
			}
		});

		panels.forEach(function (panel) {
			var isMatch = panel.getAttribute('data-division-panel') === divisionId;
			panel.classList.toggle('active', isMatch);
			panel.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
		});

		scopedSections.forEach(function (section) {
			var isMatch = section.getAttribute('data-division-scope') === divisionId;
			section.classList.toggle('is-active', isMatch);
			section.hidden = !isMatch;
		});

		updateDivisionLabels(divisionId);

		if (persist) {
			try {
				window.localStorage.setItem('mmedActiveDivision', divisionId);
			} catch (error) {
				/* Ignore storage failures. */
			}
		}
	}

	function updateDivisionLabels(divisionId) {
		var tab = document.querySelector('.mmed-division-tab[data-division="' + divisionId + '"]');
		if (!tab) return;

		var labelElement = tab.querySelector('.mmed-division-tab-label');
		var label = labelElement ? labelElement.textContent.trim() : divisionId;
		var targets = document.querySelectorAll('[data-active-division-label]');

		targets.forEach(function (target) {
			target.textContent = label;
		});
	}

	/* ═══ HASH ROUTING ═══ */

	function initHashRouting() {
		routeFromHash();
		window.addEventListener('hashchange', routeFromHash);
	}

	function routeFromHash() {
		var hash = window.location.hash.replace('#', '');
		var validViews = ['dashboard', 'tasks', 'sessions', 'courses', 'videos', 'documents'];

		if (hash && validViews.indexOf(hash) !== -1) {
			switchView(hash);
		}
	}

	/* ═══ VIDEO LIBRARY ═══ */

	function initVideoLibrary() {
		var filterSelects = document.querySelectorAll('.mmed-video-filter-select[data-video-filter]');
		var triggers = document.querySelectorAll('[data-video-trigger]');
		var closeControls = document.querySelectorAll('[data-video-close]');

		filterSelects.forEach(function (select) {
			select.addEventListener('change', applyVideoFilters);
		});

		triggers.forEach(function (trigger) {
			trigger.addEventListener('click', function () {
				openVideoModal(trigger);
			});
		});

		closeControls.forEach(function (control) {
			control.addEventListener('click', closeVideoModal);
		});

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') {
				closeVideoModal();
			}
		});

		applyVideoFilters();
	}

	function applyVideoFilters() {
		var cards = document.querySelectorAll('[data-video-card]');
		if (!cards.length) return;

		var divisionFilter = document.querySelector('.mmed-video-filter-select[data-video-filter="division"]');
		var categoryFilter = document.querySelector('.mmed-video-filter-select[data-video-filter="category"]');
		var summary = document.querySelector('[data-video-results-summary]');
		var emptyState = document.querySelector('[data-video-empty]');
		var visibleCount = 0;
		var totalCount = cards.length;
		var divisionValue = divisionFilter ? divisionFilter.value : 'all';
		var categoryValue = categoryFilter ? categoryFilter.value : 'all';

		cards.forEach(function (card) {
			var matchesDivision = divisionValue === 'all' || card.getAttribute('data-video-division') === divisionValue;
			var matchesCategory = categoryValue === 'all' || card.getAttribute('data-video-category') === categoryValue;
			var isVisible = matchesDivision && matchesCategory;

			card.hidden = !isVisible;
			if (isVisible) {
				visibleCount += 1;
			}
		});

		if (summary) {
			summary.textContent = 'Showing ' + visibleCount + ' of ' + totalCount + ' videos';
		}

		if (emptyState) {
			emptyState.hidden = visibleCount !== 0;
		}
	}

	function openVideoModal(trigger) {
		var modal = document.getElementById('mmed-video-modal');
		var player = document.getElementById('mmed-video-player');
		var embed = document.getElementById('mmed-video-embed');
		var title = document.getElementById('mmed-video-modal-title');
		var meta = document.getElementById('mmed-video-modal-meta');
		var link = document.getElementById('mmed-video-modal-link');
		var playbackUrl = trigger.getAttribute('data-playback-url');

		if (!modal || !player || !embed || !playbackUrl) return;

		lastVideoTrigger = trigger;
		videoModalPreviousOverflow = document.body.style.overflow;

		if (title) title.textContent = trigger.getAttribute('data-video-title') || 'Video playback';
		if (meta) meta.textContent = trigger.getAttribute('data-video-meta') || 'MissionMed Video Library';
		if (link) link.href = playbackUrl;

		if (isDirectVideoFile(playbackUrl)) {
			embed.hidden = true;
			embed.removeAttribute('src');
			player.hidden = false;
			player.src = playbackUrl;
			player.load();
			var playPromise = player.play();
			if (playPromise && typeof playPromise.catch === 'function') {
				playPromise.catch(function () {
					/* User can start playback manually if autoplay is blocked. */
				});
			}
		} else {
			player.pause();
			player.hidden = true;
			player.removeAttribute('src');
			embed.hidden = false;
			embed.src = playbackUrl;
		}

		modal.hidden = false;
		modal.classList.add('is-open');
		modal.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeVideoModal() {
		var modal = document.getElementById('mmed-video-modal');
		var player = document.getElementById('mmed-video-player');
		var embed = document.getElementById('mmed-video-embed');

		if (!modal || modal.hidden) return;

		if (player) {
			player.pause();
			player.hidden = true;
			player.removeAttribute('src');
			player.load();
		}

		if (embed) {
			embed.hidden = true;
			embed.removeAttribute('src');
		}

		modal.hidden = true;
		modal.classList.remove('is-open');
		modal.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = videoModalPreviousOverflow;

		if (lastVideoTrigger) {
			lastVideoTrigger.focus();
			lastVideoTrigger = null;
		}
	}

	function isDirectVideoFile(url) {
		try {
			var pathname = new URL(url, window.location.href).pathname.toLowerCase();
			return /\.(mp4|m4v|mov|webm|ogg)$/i.test(pathname);
		} catch (error) {
			return /\.(mp4|m4v|mov|webm|ogg)(\?.*)?$/i.test(url);
		}
	}

	/* ═══ LEARNDASH VIDEO INSERTER ═══ */

	function initLearnDashVideoInserter() {
		var config = window.mmedHub && window.mmedHub.videoInserter;
		var app = document.getElementById('mmed-video-inserter-app');
		if (!config || !config.enabled || !app || app.getAttribute('data-mmed-ready') === 'true') return;

		videoInserterState.config = config;
		videoInserterState.manifest = Array.isArray(config.manifest) ? config.manifest.slice() : [];
		videoInserterState.app = app;

		app.setAttribute('data-mmed-ready', 'true');
		populateVideoInserterCategories();
		updateVideoInserterSearchPlaceholder();

		document.addEventListener('click', handleVideoInserterDocumentClick);
		document.addEventListener('keydown', handleVideoInserterKeydown);

		var searchInput = app.querySelector('[data-mmed-video-search]');
		var categorySelect = app.querySelector('[data-mmed-video-category]');
		var insertButton = app.querySelector('[data-mmed-video-insert]');

		if (searchInput) {
			searchInput.addEventListener('input', renderVideoInserterGrid);
		}

		if (categorySelect) {
			categorySelect.addEventListener('change', renderVideoInserterGrid);
		}

		if (insertButton) {
			insertButton.addEventListener('click', insertSelectedVideoIntoEditor);
		}

		ensureGutenbergLaunchButton();
		if (config.isBlockEditor) {
			observeGutenbergToolbar();
		}
	}

	function handleVideoInserterDocumentClick(event) {
		var launchButton = event.target.closest('[data-mmed-video-launch]');
		if (launchButton && videoInserterState.app) {
			event.preventDefault();
			openVideoInserter(launchButton);
			return;
		}

		if (!videoInserterState.app || videoInserterState.app.hidden) return;

		if (event.target.closest('[data-mmed-video-close]')) {
			event.preventDefault();
			closeVideoInserter();
			return;
		}

		var cardButton = event.target.closest('[data-mmed-video-card-id]');
		if (cardButton) {
			event.preventDefault();
			selectVideoForInserter(cardButton.getAttribute('data-mmed-video-card-id'));
		}
	}

	function handleVideoInserterKeydown(event) {
		if (event.key === 'Escape' && videoInserterState.app && !videoInserterState.app.hidden) {
			closeVideoInserter();
		}
	}

	function observeGutenbergToolbar() {
		if (!window.MutationObserver || videoInserterState.toolbarObserver) return;

		videoInserterState.toolbarObserver = new MutationObserver(function () {
			ensureGutenbergLaunchButton();
		});

		videoInserterState.toolbarObserver.observe(document.body, { childList: true, subtree: true });
	}

	function ensureGutenbergLaunchButton() {
		var config = videoInserterState.config;
		if (!config || !config.isBlockEditor) return;

		if (document.querySelector('.mmed-video-launch-button.is-gutenberg')) return;

		var containers = [
			'.edit-post-header-toolbar',
			'.editor-header__toolbar',
			'.editor-header__settings',
		];
		var target = null;

		containers.some(function (selector) {
			target = document.querySelector(selector);
			return !!target;
		});

		if (!target) return;

		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'components-button is-secondary mmed-video-launch-button is-gutenberg';
		button.setAttribute('data-mmed-video-launch', 'true');
		button.textContent = config.buttonLabel || 'Insert Video';
		target.appendChild(button);
	}

	function populateVideoInserterCategories() {
		var app = videoInserterState.app;
		var config = videoInserterState.config;
		if (!app || !config) return;

		var categorySelect = app.querySelector('[data-mmed-video-category]');
		if (!categorySelect) return;

		var options = ['<option value="all">All categories</option>'];
		(config.categories || []).forEach(function (category) {
			options.push(
				'<option value="' + escapeHtml(category.value) + '">' +
					escapeHtml(category.label + ' (' + category.count + ')') +
				'</option>'
			);
		});
		categorySelect.innerHTML = options.join('');
	}

	function updateVideoInserterSearchPlaceholder() {
		var app = videoInserterState.app;
		var config = videoInserterState.config;
		if (!app || !config) return;

		var searchInput = app.querySelector('[data-mmed-video-search]');
		if (searchInput && config.searchPlaceholder) {
			searchInput.setAttribute('placeholder', config.searchPlaceholder);
		}
	}

	function openVideoInserter(sourceButton) {
		var app = videoInserterState.app;
		if (!app) return;

		videoInserterState.context = getVideoInserterContext();
		videoInserterState.previousActiveElement = sourceButton || document.activeElement;
		videoInserterState.previousOverflow = document.body.style.overflow;

		updateVideoInserterContext();
		app.hidden = false;
		app.setAttribute('aria-hidden', 'false');
		app.classList.add('is-open');
		document.body.style.overflow = 'hidden';

		renderVideoInserterGrid();

		var searchInput = app.querySelector('[data-mmed-video-search]');
		if (searchInput) {
			window.requestAnimationFrame(function () {
				searchInput.focus();
				searchInput.select();
			});
		}
	}

	function closeVideoInserter() {
		var app = videoInserterState.app;
		if (!app || app.hidden) return;

		stopVideoInserterPreviewMedia();
		app.hidden = true;
		app.setAttribute('aria-hidden', 'true');
		app.classList.remove('is-open');
		document.body.style.overflow = videoInserterState.previousOverflow || '';
		videoInserterState.selectedVideo = null;

		if (videoInserterState.previousActiveElement && typeof videoInserterState.previousActiveElement.focus === 'function') {
			videoInserterState.previousActiveElement.focus();
		}
	}

	function updateVideoInserterContext() {
		var app = videoInserterState.app;
		var context = videoInserterState.context || {};
		if (!app) return;

		var modeLabel = app.querySelector('[data-mmed-video-mode]');
		var contextEl = app.querySelector('[data-mmed-video-context]');
		var insertButton = app.querySelector('[data-mmed-video-insert]');
		var currentVideo = context.currentVideoId ? findManifestVideoById(context.currentVideoId) : null;

		if (modeLabel) {
			modeLabel.textContent = context.mode === 'replace' ? 'Replace Existing Video' : 'MissionMed Lesson Editor';
		}

		if (contextEl) {
			if (context.mode === 'replace' && currentVideo) {
				contextEl.hidden = false;
				contextEl.textContent = 'Replacing: ' + currentVideo.title;
			} else {
				contextEl.hidden = true;
				contextEl.textContent = '';
			}
		}

		if (insertButton) {
			insertButton.textContent = context.mode === 'replace'
				? (videoInserterState.config.replaceLabel || 'Replace Video')
				: (videoInserterState.config.insertLabel || 'Insert Video');
		}
	}

	function renderVideoInserterGrid() {
		var app = videoInserterState.app;
		if (!app) return;

		var searchInput = app.querySelector('[data-mmed-video-search]');
		var categorySelect = app.querySelector('[data-mmed-video-category]');
		var grid = app.querySelector('[data-mmed-video-grid]');
		var summary = app.querySelector('[data-mmed-video-summary]');
		var emptyState = app.querySelector('[data-mmed-video-empty]');
		var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
		var category = categorySelect ? categorySelect.value : 'all';

		videoInserterState.filteredVideos = videoInserterState.manifest.filter(function (video) {
			var matchesCategory = category === 'all' || video.category === category;
			var haystack = (video.search_blob || '').toLowerCase();
			var matchesQuery = !query || haystack.indexOf(query) !== -1;
			return matchesCategory && matchesQuery;
		});

		if (summary) {
			if (!videoInserterState.manifest.length && videoInserterState.config.statusMessage) {
				summary.textContent = videoInserterState.config.statusMessage;
			} else {
				summary.textContent = 'Showing ' + videoInserterState.filteredVideos.length + ' of ' + videoInserterState.manifest.length + ' videos';
			}
		}

		if (emptyState) {
			emptyState.hidden = videoInserterState.filteredVideos.length !== 0;
		}

		if (grid) {
			grid.innerHTML = videoInserterState.filteredVideos.map(function (video) {
				var isSelected = videoInserterState.selectedVideo && videoInserterState.selectedVideo.id === video.id;
				var thumbMarkup = video.thumbnail
					? '<img src="' + escapeHtml(video.thumbnail) + '" alt="' + escapeHtml(video.title) + '" loading="lazy" />'
					: '<div class="mmed-video-inserter-card-fallback"><span>' + escapeHtml(video.division_label || 'MissionMed') + '</span></div>';

				return (
					'<button type="button" class="mmed-video-inserter-card' + (isSelected ? ' is-selected' : '') + '" data-mmed-video-card-id="' + escapeHtml(video.id) + '">' +
						'<div class="mmed-video-inserter-card-thumb">' + thumbMarkup + '</div>' +
						'<div class="mmed-video-inserter-card-body">' +
							'<div class="mmed-video-inserter-card-pills">' +
								'<span>' + escapeHtml(video.category_label || 'General') + '</span>' +
								'<span>' + escapeHtml(video.duration_label || '') + '</span>' +
							'</div>' +
							'<strong class="mmed-video-inserter-card-title">' + escapeHtml(video.title) + '</strong>' +
							'<span class="mmed-video-inserter-card-meta">' + escapeHtml(video.division_label || 'MissionMed') + '</span>' +
						'</div>' +
					'</button>'
				);
			}).join('');
		}

		if (!videoInserterState.filteredVideos.length) {
			selectVideoForInserter(null);
			return;
		}

		var currentId = videoInserterState.selectedVideo && videoInserterState.selectedVideo.id;
		var preferredId = (videoInserterState.context && videoInserterState.context.currentVideoId) || currentId || videoInserterState.filteredVideos[0].id;
		selectVideoForInserter(preferredId);
		if (!videoInserterState.selectedVideo && videoInserterState.filteredVideos[0] && preferredId !== videoInserterState.filteredVideos[0].id) {
			selectVideoForInserter(videoInserterState.filteredVideos[0].id);
		}
	}

	function selectVideoForInserter(videoId) {
		var app = videoInserterState.app;
		if (!app) return;

		var nextVideo = videoId ? findManifestVideoById(videoId) : null;
		if (nextVideo && videoInserterState.filteredVideos.length) {
			var isVisible = videoInserterState.filteredVideos.some(function (video) {
				return video.id === nextVideo.id;
			});
			if (!isVisible) {
				nextVideo = null;
			}
		}

		videoInserterState.selectedVideo = nextVideo;
		renderVideoInserterPreview();

		var cards = app.querySelectorAll('[data-mmed-video-card-id]');
		cards.forEach(function (card) {
			card.classList.toggle('is-selected', !!nextVideo && card.getAttribute('data-mmed-video-card-id') === nextVideo.id);
		});
	}

	function renderVideoInserterPreview() {
		var app = videoInserterState.app;
		if (!app) return;

		var emptyState = app.querySelector('[data-mmed-video-preview-empty]');
		var preview = app.querySelector('[data-mmed-video-preview]');
		var insertButton = app.querySelector('[data-mmed-video-insert]');
		var video = videoInserterState.selectedVideo;

		stopVideoInserterPreviewMedia();

		if (!video) {
			if (emptyState) emptyState.hidden = false;
			if (preview) preview.hidden = true;
			if (insertButton) insertButton.disabled = true;
			return;
		}

		if (emptyState) emptyState.hidden = true;
		if (preview) preview.hidden = false;
		if (insertButton) insertButton.disabled = false;

		setPreviewMediaSource(video);

		var divisionEl = app.querySelector('[data-mmed-video-preview-division]');
		var titleEl = app.querySelector('[data-mmed-video-preview-title]');
		var durationEl = app.querySelector('[data-mmed-video-preview-duration]');
		var categoryEl = app.querySelector('[data-mmed-video-preview-category]');

		if (divisionEl) divisionEl.textContent = video.division_label || 'MissionMed';
		if (titleEl) titleEl.textContent = video.title || 'MissionMed Video';
		if (durationEl) durationEl.textContent = video.duration_label || 'Duration unavailable';
		if (categoryEl) categoryEl.textContent = video.category_label || 'General';
	}

	function setPreviewMediaSource(video) {
		var app = videoInserterState.app;
		if (!app || !video) return;

		var player = app.querySelector('[data-mmed-video-player]');
		var embed = app.querySelector('[data-mmed-video-embed]');
		if (!player || !embed) return;

		if (isDirectVideoFile(video.playback_url)) {
			embed.hidden = true;
			embed.removeAttribute('src');
			player.hidden = false;
			player.setAttribute('poster', video.thumbnail || '');
			player.src = video.playback_url;
			player.load();
			var playPromise = player.play();
			if (playPromise && typeof playPromise.catch === 'function') {
				playPromise.catch(function () {
					/* Autoplay can be blocked by the browser. */
				});
			}
		} else {
			player.pause();
			player.hidden = true;
			player.removeAttribute('src');
			player.load();
			embed.hidden = false;
			embed.src = video.playback_url;
		}
	}

	function stopVideoInserterPreviewMedia() {
		var app = videoInserterState.app;
		if (!app) return;

		var player = app.querySelector('[data-mmed-video-player]');
		var embed = app.querySelector('[data-mmed-video-embed]');

		if (player) {
			player.pause();
			player.hidden = true;
			player.removeAttribute('src');
			player.removeAttribute('poster');
			player.load();
		}

		if (embed) {
			embed.hidden = true;
			embed.removeAttribute('src');
		}
	}

	function findManifestVideoById(videoId) {
		if (!videoId) return null;

		for (var index = 0; index < videoInserterState.manifest.length; index += 1) {
			if (videoInserterState.manifest[index].id === videoId) {
				return videoInserterState.manifest[index];
			}
		}

		return null;
	}

	function getVideoInserterContext() {
		if (videoInserterState.config && videoInserterState.config.isBlockEditor) {
			var blockContext = getGutenbergVideoContext();
			if (blockContext) return blockContext;
		}

		return getClassicVideoContext();
	}

	function getGutenbergVideoContext() {
		var wpApi = window.wp;
		if (!wpApi || !wpApi.data || !wpApi.data.select) return null;

		var blockEditorStore = wpApi.data.select('core/block-editor');
		if (!blockEditorStore || typeof blockEditorStore.getSelectedBlock !== 'function') {
			return null;
		}

		var selectedBlock = blockEditorStore.getSelectedBlock();
		if (selectedBlock && selectedBlock.name === 'core/shortcode') {
			var blockContent = selectedBlock.attributes && selectedBlock.attributes.text ? selectedBlock.attributes.text : '';
			var matchedId = extractVideoIdFromShortcode(blockContent);
			if (matchedId) {
				return {
					editorType: 'gutenberg',
					mode: 'replace',
					currentVideoId: matchedId,
					clientId: selectedBlock.clientId,
				};
			}
		}

		return {
			editorType: 'gutenberg',
			mode: 'insert',
			currentVideoId: null,
			clientId: null,
		};
	}

	function getClassicVideoContext() {
		var textarea = findEditorTextarea();
		var tinymceEditor = window.tinymce && tinymce.activeEditor && !tinymce.activeEditor.isHidden() ? tinymce.activeEditor : null;

		if (tinymceEditor) {
			var selectedText = tinymceEditor.selection ? tinymceEditor.selection.getContent({ format: 'text' }) : '';
			var matchedId = extractVideoIdFromShortcode(selectedText);
			if (matchedId) {
				return {
					editorType: 'tinymce',
					mode: 'replace',
					currentVideoId: matchedId,
					selectedText: selectedText,
				};
			}

			return {
				editorType: 'tinymce',
				mode: 'insert',
				currentVideoId: null,
				selectedText: '',
			};
		}

		if (textarea) {
			var target = findShortcodeInTextarea(textarea);
			if (target) {
				return {
					editorType: 'textarea',
					mode: 'replace',
					currentVideoId: target.id,
					rangeStart: target.start,
					rangeEnd: target.end,
					textarea: textarea,
				};
			}

			return {
				editorType: 'textarea',
				mode: 'insert',
				currentVideoId: null,
				rangeStart: textarea.selectionStart,
				rangeEnd: textarea.selectionEnd,
				textarea: textarea,
			};
		}

		return {
			editorType: 'unknown',
			mode: 'insert',
			currentVideoId: null,
		};
	}

	function findEditorTextarea() {
		return document.getElementById('content')
			|| document.querySelector('textarea.wp-editor-area')
			|| document.querySelector('textarea.editor-post-text-editor');
	}

	function findShortcodeInTextarea(textarea) {
		if (!textarea || typeof textarea.value !== 'string') return null;

		var content = textarea.value;
		var start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : 0;
		var end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : start;
		var regex = /\[(?:mmi_video|mm_video|mmed_video)\s+[^\]]*?id=(["']?)([A-Za-z0-9_-]+)\1[^\]]*?\]/ig;
		var match;

		while ((match = regex.exec(content))) {
			var matchStart = match.index;
			var matchEnd = match.index + match[0].length;
			var overlapsSelection = start !== end
				? start <= matchEnd && end >= matchStart
				: start >= matchStart && start <= matchEnd;

			if (overlapsSelection) {
				return {
					id: match[2],
					start: matchStart,
					end: matchEnd,
				};
			}
		}

		return null;
	}

	function extractVideoIdFromShortcode(text) {
		if (!text) return null;
		var match = text.match(/\[(?:mmi_video|mm_video|mmed_video)\s+[^\]]*?id=(["']?)([A-Za-z0-9_-]+)\1[^\]]*?\]/i);
		return match ? match[2] : null;
	}

	function insertSelectedVideoIntoEditor() {
		var video = videoInserterState.selectedVideo;
		var context = videoInserterState.context || {};
		if (!video) return;

		var shortcode = '[mmi_video id="' + video.id + '"]';
		var success = false;

		if (context.editorType === 'gutenberg') {
			success = insertVideoIntoGutenberg(shortcode, context);
		} else if (context.editorType === 'tinymce') {
			success = insertVideoIntoTinyMCE(shortcode, context);
		} else if (context.editorType === 'textarea') {
			success = insertVideoIntoTextarea(shortcode, context);
		}

		if (!success) {
			emitVideoInserterNotice('MissionMed video insertion could not find the lesson editor.', 'error');
			return;
		}

		emitVideoInserterNotice(
			(context.mode === 'replace' ? 'Video replaced' : 'Video inserted') + ' - ' + video.title,
			'success'
		);
		closeVideoInserter();
	}

	function insertVideoIntoGutenberg(shortcode, context) {
		var wpApi = window.wp;
		if (!wpApi || !wpApi.blocks || !wpApi.data || !wpApi.data.dispatch) return false;

		var newBlock = wpApi.blocks.createBlock('core/shortcode', { text: shortcode });
		var dispatcher = wpApi.data.dispatch('core/block-editor');
		if (!dispatcher) return false;

		if (context.mode === 'replace' && context.clientId && typeof dispatcher.replaceBlock === 'function') {
			dispatcher.replaceBlock(context.clientId, newBlock);
			return true;
		}

		if (typeof dispatcher.insertBlocks === 'function') {
			dispatcher.insertBlocks(newBlock);
			return true;
		}

		return false;
	}

	function insertVideoIntoTinyMCE(shortcode, context) {
		if (!window.tinymce || !tinymce.activeEditor) return false;

		var editor = tinymce.activeEditor;
		editor.undoManager.transact(function () {
			if (context.mode === 'replace' && context.selectedText) {
				editor.selection.setContent(shortcode);
			} else {
				editor.insertContent(shortcode);
			}
		});
		editor.focus();
		return true;
	}

	function insertVideoIntoTextarea(shortcode, context) {
		var textarea = context.textarea || findEditorTextarea();
		if (!textarea) return false;

		var start = context.mode === 'replace' ? context.rangeStart : textarea.selectionStart;
		var end = context.mode === 'replace' ? context.rangeEnd : textarea.selectionEnd;
		var originalValue = textarea.value || '';
		var nextValue = originalValue.slice(0, start) + shortcode + originalValue.slice(end);

		textarea.value = nextValue;
		textarea.focus();
		textarea.selectionStart = textarea.selectionEnd = start + shortcode.length;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		textarea.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	}

	function emitVideoInserterNotice(message, type) {
		var wpApi = window.wp;
		if (wpApi && wpApi.data && wpApi.data.dispatch) {
			var notices = wpApi.data.dispatch('core/notices');
			if (notices) {
				if (type === 'error' && typeof notices.createErrorNotice === 'function') {
					notices.createErrorNotice(message, { type: 'snackbar' });
					return;
				}

				if (typeof notices.createSuccessNotice === 'function') {
					notices.createSuccessNotice(message, { type: 'snackbar' });
					return;
				}
			}
		}

		console.log(message);
	}

	function escapeHtml(value) {
		return String(value || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/* ═══ MOBILE MENU ═══ */

	function initMobileMenu() {
		var hamburger = document.getElementById('mmed-hamburger');
		var sidebar = document.getElementById('mmed-sidebar');
		var overlay = document.getElementById('mmed-overlay');

		if (!hamburger || !sidebar) return;

		hamburger.addEventListener('click', function () {
			var isOpen = sidebar.classList.contains('open');
			if (isOpen) {
				closeMobileMenu();
			} else {
				sidebar.classList.add('open');
				hamburger.classList.add('open');
				if (overlay) overlay.classList.add('active');
				document.body.style.overflow = 'hidden';
			}
		});

		if (overlay) {
			overlay.addEventListener('click', closeMobileMenu);
		}
	}

	function closeMobileMenu() {
		var sidebar = document.getElementById('mmed-sidebar');
		var hamburger = document.getElementById('mmed-hamburger');
		var overlay = document.getElementById('mmed-overlay');

		if (sidebar) sidebar.classList.remove('open');
		if (hamburger) hamburger.classList.remove('open');
		if (overlay) overlay.classList.remove('active');
		document.body.style.overflow = '';
	}

	/* ═══ COLLAPSIBLE TASKS ═══ */

	function initCollapsibleTasks() {
		var taskHeaders = document.querySelectorAll('.mmed-collapsible-task .mmed-task-header');

		taskHeaders.forEach(function (header) {
			header.addEventListener('click', function (e) {
				if (e.target.closest('.mmed-status-badge')) return;

				var taskItem = header.closest('.mmed-collapsible-task');
				if (!taskItem) return;

				var expanded = header.getAttribute('aria-expanded') === 'true';
				var expandedContent = taskItem.querySelector('.mmed-task-expanded');
				if (!expandedContent) return;

				if (expanded) {
					header.setAttribute('aria-expanded', 'false');
					expandedContent.style.display = 'none';
				} else {
					header.setAttribute('aria-expanded', 'true');
					expandedContent.style.display = 'flex';
				}
			});

			header.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					header.click();
				}
			});
		});
	}

	/* ═══ FILE UPLOAD ═══ */

	function initFileUpload() {
		var fileInputs = document.querySelectorAll('.mmed-file-input');

		fileInputs.forEach(function (input) {
			input.addEventListener('change', handleFileUpload);

			// Drag-and-drop
			var uploadZone = input.closest('.mmed-file-upload-area');
			if (!uploadZone) return;
			var zone = uploadZone.querySelector('.mmed-upload-zone');
			if (!zone) return;

			zone.addEventListener('click', function () {
				input.click();
			});

			zone.addEventListener('dragover', function (e) {
				e.preventDefault();
				zone.style.borderColor = '#3B82F6';
				zone.style.background = 'rgba(59, 130, 246, 0.04)';
			});

			zone.addEventListener('dragleave', function (e) {
				e.preventDefault();
				zone.style.borderColor = '';
				zone.style.background = '';
			});

			zone.addEventListener('drop', function (e) {
				e.preventDefault();
				zone.style.borderColor = '';
				zone.style.background = '';

				if (e.dataTransfer.files.length > 0) {
					input.files = e.dataTransfer.files;
					handleFileUpload({ target: input });
				}
			});
		});
	}

	function handleFileUpload(e) {
		var input = e.target;
		var taskId = input.getAttribute('data-task-id');
		var file = input.files[0];

		if (!file || !taskId) return;

		var taskItem = input.closest('.mmed-collapsible-task') || input.closest('.mmed-task-item');
		var uploadArea = input.closest('.mmed-file-upload-area');
		var progressDiv = uploadArea.querySelector('.mmed-upload-progress');
		var errorDiv = uploadArea.querySelector('.mmed-upload-error');

		errorDiv.style.display = 'none';
		errorDiv.textContent = '';
		progressDiv.style.display = 'block';
		progressDiv.innerHTML = '<p>Uploading ' + file.name + '...</p>';
		progressDiv.style.backgroundColor = '';
		progressDiv.style.color = '';

		var formData = new FormData();
		formData.append('action', 'mmed_upload_file');
		formData.append('task_id', taskId);
		formData.append('file', file);
		formData.append('_mmed_nonce', window.mmedHub.nonce);

		fetch(window.mmedHub.ajax_url, {
			method: 'POST',
			body: formData,
		})
			.then(function (response) { return response.json(); })
			.then(function (data) {
				progressDiv.style.display = 'none';

				if (data.success) {
					// Update status badge
					if (taskItem) {
						var badge = taskItem.querySelector('.mmed-status-badge');
						if (badge) {
							badge.textContent = 'Under Review';
							badge.style.backgroundColor = '#F59E0B';
						}
						var dot = taskItem.querySelector('.mmed-task-dot');
						if (dot) {
							dot.style.backgroundColor = '#F59E0B';
						}
					}

					// Show file confirmation (file_url may or may not be in response)
					var fileUrl = (data.data && data.data.file_url) || '';
					var existingLink = uploadArea.parentElement.querySelector('.mmed-file-link');
					if (fileUrl) {
						if (existingLink) {
							existingLink.href = fileUrl;
						} else {
							var linkHtml = '<div class="mmed-task-file"><a href="' + fileUrl + '" class="mmed-file-link" download>' +
								'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
								'Download: ' + file.name + '</a></div>';
							uploadArea.insertAdjacentHTML('afterend', linkHtml);
						}
					} else if (!existingLink) {
						// Show filename without link (refresh page to get download)
						var confirmHtml = '<div class="mmed-task-file"><span class="mmed-file-link" style="cursor:default;">' +
							'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
							'Submitted: ' + file.name + '</span></div>';
						uploadArea.insertAdjacentHTML('afterend', confirmHtml);
					}

					input.value = '';

					// Success message
					progressDiv.style.display = 'block';
					progressDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
					progressDiv.style.color = '#059669';
					progressDiv.innerHTML = '<p>File uploaded successfully!</p>';
					setTimeout(function () { progressDiv.style.display = 'none'; }, 3000);
				} else {
					errorDiv.style.display = 'block';
					errorDiv.textContent = (data.data && data.data.message) || 'Upload failed. Please try again.';
				}
			})
			.catch(function (error) {
				progressDiv.style.display = 'none';
				errorDiv.style.display = 'block';
				errorDiv.textContent = 'Network error. Please try again.';
				console.error('Upload error:', error);
			});
	}

	/* ═══ TIMEZONE CONVERSION ═══ */

	function initTimezoneConversion() {
		var datetimeElements = document.querySelectorAll('[data-timestamp]');

		datetimeElements.forEach(function (el) {
			var timestamp = parseInt(el.getAttribute('data-timestamp'), 10);
			if (isNaN(timestamp)) return;

			try {
				var date = new Date(timestamp * 1000);
				var formatter = new Intl.DateTimeFormat(navigator.language, {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZoneName: 'short',
				});

				el.textContent = formatter.format(date);
				el.setAttribute('title', date.toString());
			} catch (error) {
				console.error('Timezone conversion error:', error);
			}
		});
	}

	/* ═══ HERO CTA ═══ */

	function initHeroCTA() {
		var priorityLinks = document.querySelectorAll('.mmed-hero-cta, .mmed-quick-action-card');
		var heroButtons = document.querySelectorAll('[data-action="scroll-to-task"][data-task-id]');

		priorityLinks.forEach(function (link) {
			link.addEventListener('click', function (event) {
				var route = parseTaskRoute(link.getAttribute('href') || '');
				if (!route) return;

				event.preventDefault();
				openTaskRoute(route.taskId, route.divisionId);
			});
		});

		if (!heroButtons.length) return;

		heroButtons.forEach(function (heroBtn) {
			heroBtn.addEventListener('click', function () {
				openTaskRoute(heroBtn.getAttribute('data-task-id'), heroBtn.getAttribute('data-division'));
			});
		});
	}

	function parseTaskRoute(href) {
		var match = String(href || '').match(/^#mmed-task-([a-z0-9_-]+)-([0-9]+)$/i);
		if (!match) return null;

		return {
			divisionId: match[1],
			taskId: match[2],
		};
	}

	function openTaskRoute(taskId, divisionId) {
		if (!taskId) return;

		if (divisionId) {
			setActiveDivision(divisionId, true);
		}

		switchView('tasks');
		history.replaceState(null, '', '#tasks');

		setTimeout(function () {
			var taskEl = document.querySelector('.mmed-collapsible-task[data-task-id="' + taskId + '"]');
			if (!taskEl) return;

			var header = taskEl.querySelector('.mmed-task-header');
			if (header && header.getAttribute('aria-expanded') !== 'true') {
				header.click();
			}

			taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			taskEl.style.transition = 'box-shadow 0.3s ease';
			taskEl.style.boxShadow = '0 0 0 2px var(--mmed-gold)';
			setTimeout(function () {
				taskEl.style.boxShadow = '';
			}, 2000);
		}, 100);
	}

	/* ═══ INIT ═══ */

	window.mmedHub = window.mmedHub || {};
	window.mmedHub.init = init;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
