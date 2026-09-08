/**
 * MissionMed Video Inserter — Admin-Side Video Picker Controller
 *
 * Implements LDV-007 UX specification:
 *   - Full-screen modal with search, filters, and 3-column grid
 *   - Preview panel with metadata and inline player
 *   - Single-insert, multi-queue, and replace flows
 *   - ≤ 3 clicks from intent to shortcode insertion
 *
 * Dependencies: jQuery (WordPress admin), mmedInserter (localized config)
 *
 * @package MissionMed_Hub
 * @since   1.6.3
 */
(function( $, config ) {
    'use strict';

    if ( typeof config === 'undefined' ) {
        return;
    }

    /* ── State ─────────────────────────────────────────────────── */

    var state = {
        open:         false,
        mode:         'insert',  // 'insert' | 'replace'
        replaceId:    '',
        replaceTitle: '',
        search:       '',
        division:     '',
        category:     '',
        sort:         'relevance',
        page:         1,
        loading:      false,
        videos:       [],
        total:        0,
        hasMore:      false,
        selected:     null,
        queue:        [],
        debounceTimer: null,
    };

    /* ── DOM References ────────────────────────────────────────── */

    var $modal, $grid, $loading, $empty, $loadMore, $preview, $queueBar;
    var $search, $divisionPills, $categorySelect, $sortSelect;

    /* ── Initialization ────────────────────────────────────────── */

    function init() {
        $modal          = $( '#mmed-video-inserter-modal' );
        $grid           = $( '#mmed-inserter-grid' );
        $loading        = $( '#mmed-inserter-loading' );
        $empty          = $( '#mmed-inserter-empty' );
        $loadMore       = $( '#mmed-inserter-load-more' );
        $preview        = $( '#mmed-inserter-preview' );
        $queueBar       = $( '#mmed-inserter-queue-bar' );
        $search         = $( '#mmed-inserter-search' );
        $divisionPills  = $( '#mmed-division-pills' );
        $categorySelect = $( '#mmed-category-filter' );
        $sortSelect     = $( '#mmed-sort-filter' );

        if ( ! $modal.length ) return;

        buildFilterControls();
        bindEvents();
        injectEditorButton();
    }

    /* ── Filter Controls Setup ─────────────────────────────────── */

    function buildFilterControls() {
        // Division pills.
        if ( config.divisions && config.divisions.length ) {
            config.divisions.forEach( function( div ) {
                $divisionPills.append(
                    '<button class="mmed-pill" data-value="' + esc( div ) + '">' +
                    esc( capitalize( div ) ) + '</button>'
                );
            });
        }

        // Category dropdown.
        if ( config.categories && config.categories.length ) {
            config.categories.forEach( function( cat ) {
                $categorySelect.append(
                    '<option value="' + esc( cat ) + '">' + esc( capitalize( cat ) ) + '</option>'
                );
            });
        }
    }

    /* ── Event Binding ─────────────────────────────────────────── */

    function bindEvents() {
        // Open modal triggers.
        $( document ).on( 'click', '.mmed-open-inserter, .mmed-gutenberg-btn', function( e ) {
            e.preventDefault();
            openModal( 'insert' );
        });

        // Close modal.
        $modal.on( 'click', '.mmed-inserter-close, .mmed-inserter-backdrop', closeModal );

        // Escape key.
        $( document ).on( 'keydown', function( e ) {
            if ( e.key === 'Escape' && state.open ) {
                closeModal();
            }
        });

        // Search input (debounced).
        $search.on( 'input', function() {
            var val = $search.val();
            if ( state.debounceTimer ) clearTimeout( state.debounceTimer );
            state.debounceTimer = setTimeout( function() {
                state.search = val;
                state.page   = 1;
                state.videos = [];
                loadVideos();
            }, 200 );
        });

        // Division pills.
        $divisionPills.on( 'click', '.mmed-pill', function() {
            $divisionPills.find( '.mmed-pill' ).removeClass( 'mmed-pill--active' );
            $( this ).addClass( 'mmed-pill--active' );
            state.division = $( this ).data( 'value' ) || '';
            state.page     = 1;
            state.videos   = [];
            loadVideos();
        });

        // Category filter.
        $categorySelect.on( 'change', function() {
            state.category = $( this ).val();
            state.page     = 1;
            state.videos   = [];
            loadVideos();
        });

        // Sort filter.
        $sortSelect.on( 'change', function() {
            state.sort = $( this ).val();
            state.page = 1;
            state.videos = [];
            loadVideos();
        });

        // Tabs.
        $modal.on( 'click', '.mmed-inserter-tab', function() {
            $modal.find( '.mmed-inserter-tab' ).removeClass( 'mmed-inserter-tab--active' );
            $( this ).addClass( 'mmed-inserter-tab--active' );
            var tab = $( this ).data( 'tab' );
            if ( tab === 'recent' ) {
                state.sort = 'newest';
                $sortSelect.val( 'newest' );
            }
            state.page = 1;
            state.videos = [];
            loadVideos();
        });

        // Video card click → preview.
        $grid.on( 'click', '.mmed-inserter-card', function() {
            var videoId = $( this ).data( 'video-id' );
            selectVideo( videoId );
        });

        // Queue toggle on card.
        $grid.on( 'click', '.mmed-inserter-card-queue', function( e ) {
            e.stopPropagation();
            var videoId = $( this ).closest( '.mmed-inserter-card' ).data( 'video-id' );
            toggleQueue( videoId );
        });

        // Preview panel: Insert.
        $( '#mmed-preview-insert' ).on( 'click', function() {
            if ( state.selected ) {
                insertVideo( state.selected );
            }
        });

        // Preview panel: Add to queue.
        $( '#mmed-preview-queue' ).on( 'click', function() {
            if ( state.selected ) {
                toggleQueue( state.selected.id );
            }
        });

        // Preview panel: Copy shortcode.
        $( '#mmed-preview-copy' ).on( 'click', function() {
            if ( state.selected ) {
                copyToClipboard( state.selected.shortcode );
                $( this ).text( config.i18n.copied );
                var btn = this;
                setTimeout( function() {
                    $( btn ).text( config.i18n.copyShortcode );
                }, 2000 );
            }
        });

        // Queue bar: Insert all.
        $( '#mmed-queue-insert-all' ).on( 'click', insertAllQueued );

        // Queue bar: Clear.
        $( '#mmed-queue-clear' ).on( 'click', clearQueue );

        // Load more.
        $loadMore.on( 'click', '.mmed-inserter-load-more-btn', function() {
            state.page++;
            loadVideos( true );
        });

        // Clear filters.
        $modal.on( 'click', '.mmed-inserter-clear-filters', function() {
            resetFilters();
            loadVideos();
        });
    }

    /* ── Modal Open/Close ──────────────────────────────────────── */

    function openModal( mode, replaceVideoId, replaceTitle ) {
        state.open         = true;
        state.mode         = mode || 'insert';
        state.replaceId    = replaceVideoId || '';
        state.replaceTitle = replaceTitle || '';
        state.selected     = null;
        state.queue        = [];
        state.page         = 1;
        state.videos       = [];

        $modal.show();
        $preview.hide();
        $queueBar.hide();

        if ( state.mode === 'replace' ) {
            $modal.find( '.mmed-inserter-replace-banner' ).show()
                  .find( '.mmed-inserter-replace-title' ).text( state.replaceTitle );
            $( '#mmed-preview-insert' ).text( config.i18n.replaceVideo );
        } else {
            $modal.find( '.mmed-inserter-replace-banner' ).hide();
            $( '#mmed-preview-insert' ).text( config.i18n.insertVideo );
        }

        // Focus search.
        setTimeout( function() { $search.focus(); }, 100 );

        loadVideos();

        // Prevent body scroll.
        $( 'body' ).addClass( 'mmed-inserter-open' );
    }

    function closeModal() {
        state.open = false;
        $modal.hide();
        $( 'body' ).removeClass( 'mmed-inserter-open' );
    }

    /* ── Data Loading ──────────────────────────────────────────── */

    function loadVideos( append ) {
        if ( state.loading ) return;
        state.loading = true;

        if ( ! append ) {
            $grid.empty();
            $loading.show();
            $empty.hide();
            $loadMore.hide();
        }

        $.post( config.ajaxUrl, {
            action:   'mmed_inserter_load_videos',
            nonce:    config.nonce,
            search:   state.search,
            division: state.division,
            category: state.category,
            sort:     state.sort,
            page:     state.page,
            per_page: config.perPage,
        }, function( response ) {
            state.loading = false;
            $loading.hide();

            if ( ! response.success || ! response.data ) {
                if ( ! append ) $empty.show();
                return;
            }

            var data = response.data;
            state.total   = data.total;
            state.hasMore = data.hasMore;

            if ( append ) {
                state.videos = state.videos.concat( data.videos );
            } else {
                state.videos = data.videos;
            }

            if ( state.videos.length === 0 ) {
                $empty.show();
                return;
            }

            renderGrid( data.videos, append );

            if ( state.hasMore ) {
                $loadMore.show();
            } else {
                $loadMore.hide();
            }
        }).fail( function() {
            state.loading = false;
            $loading.hide();
            if ( ! append ) $empty.show();
        });
    }

    /* ── Grid Rendering ────────────────────────────────────────── */

    function renderGrid( videos, append ) {
        if ( ! append ) {
            $grid.empty();
        }

        videos.forEach( function( v ) {
            var queueIdx  = getQueueIndex( v.id );
            var isQueued  = queueIdx >= 0;
            var queueNum  = isQueued ? ( queueIdx + 1 ) : '';
            var cdnClass  = v.cdn_status === 'published' ? 'mmed-cdn--published' : 'mmed-cdn--local';
            var cdnLabel  = v.cdn_status === 'published' ? 'Published' : 'Not Published';

            var thumb = v.thumbnail || '';
            var thumbStyle = thumb
                ? 'background-image:url(' + esc( thumb ) + ')'
                : 'background:#1a2332';

            var card = $(
                '<div class="mmed-inserter-card' + ( isQueued ? ' mmed-inserter-card--queued' : '' ) + '"' +
                '     data-video-id="' + esc( v.id ) + '">' +
                '  <div class="mmed-inserter-card-thumb" style="' + thumbStyle + '">' +
                '    <span class="mmed-inserter-card-duration">' + esc( v.duration_label ) + '</span>' +
                ( isQueued ? '<span class="mmed-inserter-card-queue-badge">' + queueNum + '</span>' : '' ) +
                '    <button class="mmed-inserter-card-queue" type="button" title="Add to queue">+</button>' +
                '  </div>' +
                '  <div class="mmed-inserter-card-info">' +
                '    <p class="mmed-inserter-card-title">' + esc( v.title ) + '</p>' +
                '    <p class="mmed-inserter-card-meta">' +
                       esc( v.category || '' ) +
                       ( v.category && v.division ? ' &middot; ' : '' ) +
                       esc( capitalize( v.division || '' ) ) +
                '    </p>' +
                '    <span class="mmed-inserter-cdn-badge ' + cdnClass + '">' + cdnLabel + '</span>' +
                '  </div>' +
                '</div>'
            );

            $grid.append( card );
        });
    }

    /* ── Video Selection / Preview ─────────────────────────────── */

    function selectVideo( videoId ) {
        // Highlight card.
        $grid.find( '.mmed-inserter-card' ).removeClass( 'mmed-inserter-card--selected' );
        $grid.find( '.mmed-inserter-card[data-video-id="' + videoId + '"]' )
             .addClass( 'mmed-inserter-card--selected' );

        // Load detail via AJAX.
        $.post( config.ajaxUrl, {
            action:   'mmed_inserter_video_detail',
            nonce:    config.nonce,
            video_id: videoId,
        }, function( response ) {
            if ( ! response.success || ! response.data ) return;

            state.selected = response.data;
            renderPreview( response.data );
            $preview.show();
        });
    }

    function renderPreview( video ) {
        // Thumbnail / mini player.
        var playerHtml = '';
        if ( video.thumbnail ) {
            playerHtml = '<div class="mmed-preview-thumb" style="background-image:url(' + esc( video.thumbnail ) + ')">' +
                         '<div class="mmed-preview-play-icon">&#9654;</div></div>';
        } else {
            playerHtml = '<div class="mmed-preview-thumb mmed-preview-thumb--empty">' +
                         '<div class="mmed-preview-play-icon">&#9654;</div></div>';
        }
        $( '#mmed-preview-player' ).html( playerHtml );

        // Metadata.
        $( '#mmed-preview-title' ).text( video.title );
        $( '#mmed-preview-duration' ).text( video.duration_label );
        $( '#mmed-preview-category' ).text( video.category || '' );
        $( '#mmed-preview-division' ).text( capitalize( video.division || '' ) );

        // CDN status.
        var statusClass = video.cdn_status === 'published' ? 'mmed-status--green' : 'mmed-status--orange';
        var statusLabel = video.cdn_status === 'published' ? 'CDN Published' : 'Local Only';
        $( '#mmed-preview-status' ).html(
            '<span class="mmed-status-dot ' + statusClass + '"></span> ' + statusLabel
        );

        // Tags.
        var tagsHtml = '';
        if ( video.tags && video.tags.length ) {
            video.tags.forEach( function( tag ) {
                tagsHtml += '<span class="mmed-tag-chip" data-tag="' + esc( tag ) + '">' + esc( tag ) + '</span>';
            });
        }
        $( '#mmed-preview-tags' ).html( tagsHtml );

        // Tag click → filter.
        $( '#mmed-preview-tags' ).off( 'click', '.mmed-tag-chip' ).on( 'click', '.mmed-tag-chip', function() {
            var tag = $( this ).data( 'tag' );
            $search.val( tag );
            state.search = tag;
            state.page = 1;
            state.videos = [];
            loadVideos();
        });

        // Used in.
        if ( video.used_in && video.used_in.length ) {
            var usedHtml = '';
            video.used_in.forEach( function( lesson ) {
                usedHtml += '<li><a href="' + esc( lesson.edit_url ) + '" target="_blank">' +
                            esc( lesson.title ) + '</a></li>';
            });
            $( '#mmed-preview-used-list' ).html( usedHtml );
            $( '#mmed-preview-used' ).show();
        } else {
            $( '#mmed-preview-used' ).hide();
        }
    }

    /* ── Insertion ─────────────────────────────────────────────── */

    function insertVideo( video ) {
        var shortcode = video.shortcode || '[mmi_video id="' + video.id + '"]';

        if ( state.mode === 'replace' && state.replaceId ) {
            replaceInEditor( state.replaceId, shortcode );
            showToast( config.i18n.videoReplaced + ' — ' + video.title );
        } else {
            insertAtCursor( shortcode );
            showToast( config.i18n.videoInserted + ' — ' + video.title );
        }

        closeModal();
    }

    function insertAllQueued() {
        if ( state.queue.length === 0 ) return;

        var shortcodes = state.queue.map( function( v ) {
            return v.shortcode || '[mmi_video id="' + v.id + '"]';
        });

        insertAtCursor( shortcodes.join( '\n\n' ) );
        showToast( state.queue.length + ' ' + config.i18n.videosInserted );
        closeModal();
    }

    /**
     * Insert content at the current cursor position in the editor.
     */
    function insertAtCursor( content ) {
        // Try Gutenberg (Block Editor).
        if ( typeof wp !== 'undefined' && wp.data && wp.data.dispatch ) {
            try {
                var block = wp.blocks.createBlock( 'core/shortcode', {
                    text: content,
                } );
                wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
                return;
            } catch ( e ) {
                // Fall through to TinyMCE.
            }
        }

        // Try TinyMCE (Classic Editor).
        if ( typeof tinymce !== 'undefined' ) {
            var editor = tinymce.activeEditor || tinymce.get( 'content' );
            if ( editor && ! editor.isHidden() ) {
                editor.execCommand( 'mceInsertContent', false, content );
                return;
            }
        }

        // Fallback: text editor textarea.
        var $textarea = $( '#content' );
        if ( $textarea.length ) {
            var ta = $textarea[0];
            var start = ta.selectionStart || ta.value.length;
            var before = ta.value.substring( 0, start );
            var after  = ta.value.substring( start );
            ta.value = before + content + after;
            ta.selectionStart = ta.selectionEnd = start + content.length;
            $textarea.trigger( 'input' );
        }
    }

    /**
     * Replace an existing shortcode in the editor content.
     */
    function replaceInEditor( oldVideoId, newShortcode ) {
        var pattern = new RegExp(
            '\\[(?:mmed_video|mmi_video|mm_video)[^\\]]*id=["\']?' + escRegex( oldVideoId ) + '["\']?[^\\]]*\\]',
            'g'
        );

        // Try Gutenberg.
        if ( typeof wp !== 'undefined' && wp.data && wp.data.select ) {
            try {
                var blocks = wp.data.select( 'core/block-editor' ).getBlocks();
                blocks.forEach( function( block ) {
                    if ( block.name === 'core/shortcode' && pattern.test( block.attributes.text ) ) {
                        wp.data.dispatch( 'core/block-editor' ).updateBlockAttributes( block.clientId, {
                            text: block.attributes.text.replace( pattern, newShortcode ),
                        } );
                    }
                });
                return;
            } catch ( e ) {
                // Fall through.
            }
        }

        // TinyMCE.
        if ( typeof tinymce !== 'undefined' ) {
            var editor = tinymce.activeEditor || tinymce.get( 'content' );
            if ( editor && ! editor.isHidden() ) {
                var html = editor.getContent();
                editor.setContent( html.replace( pattern, newShortcode ) );
                return;
            }
        }

        // Text editor.
        var $textarea = $( '#content' );
        if ( $textarea.length ) {
            $textarea.val( $textarea.val().replace( pattern, newShortcode ) );
            $textarea.trigger( 'input' );
        }
    }

    /* ── Queue Management ──────────────────────────────────────── */

    function toggleQueue( videoId ) {
        var idx = getQueueIndex( videoId );
        if ( idx >= 0 ) {
            state.queue.splice( idx, 1 );
        } else {
            // Find video data.
            var video = findVideoById( videoId );
            if ( video ) {
                state.queue.push( video );
            }
        }
        updateQueueUI();
        refreshCardStates();
    }

    function clearQueue() {
        state.queue = [];
        updateQueueUI();
        refreshCardStates();
    }

    function getQueueIndex( videoId ) {
        for ( var i = 0; i < state.queue.length; i++ ) {
            if ( state.queue[i].id === videoId ) return i;
        }
        return -1;
    }

    function updateQueueUI() {
        if ( state.queue.length > 0 ) {
            $queueBar.show();
            $( '#mmed-queue-count' ).text( state.queue.length + ' video' + ( state.queue.length > 1 ? 's' : '' ) + ' selected' );
        } else {
            $queueBar.hide();
        }
    }

    function refreshCardStates() {
        $grid.find( '.mmed-inserter-card' ).each( function() {
            var $card = $( this );
            var vid   = $card.data( 'video-id' );
            var idx   = getQueueIndex( vid );

            $card.toggleClass( 'mmed-inserter-card--queued', idx >= 0 );
            $card.find( '.mmed-inserter-card-queue-badge' ).remove();
            if ( idx >= 0 ) {
                $card.find( '.mmed-inserter-card-thumb' ).append(
                    '<span class="mmed-inserter-card-queue-badge">' + ( idx + 1 ) + '</span>'
                );
            }
        });
    }

    /* ── Editor Button Injection ───────────────────────────────── */

    function injectEditorButton() {
        // Gutenberg: Add button to editor header.
        if ( typeof wp !== 'undefined' && wp.data ) {
            waitForElement( '.edit-post-header__toolbar', function( $toolbar ) {
                if ( ! $toolbar.find( '.mmed-gutenberg-btn' ).length ) {
                    $toolbar.append(
                        '<button class="mmed-gutenberg-btn" type="button">' +
                        '<svg viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>' +
                        'Add MissionMed Video' +
                        '</button>'
                    );
                }
            });
        }

        // Classic Editor: TinyMCE button is handled by the PHP mce_buttons filter.
        // We also add a direct button above the editor for easy access.
        var $editorWrap = $( '#wp-content-editor-tools' );
        if ( $editorWrap.length && ! $editorWrap.find( '.mmed-open-inserter' ).length ) {
            $editorWrap.append(
                '<button class="button mmed-open-inserter" type="button" style="margin-left:10px;">' +
                '&#9654; Add MissionMed Video</button>'
            );
        }
    }

    /* ── Utility Functions ─────────────────────────────────────── */

    function findVideoById( videoId ) {
        for ( var i = 0; i < state.videos.length; i++ ) {
            if ( state.videos[i].id === videoId ) return state.videos[i];
        }
        return null;
    }

    function resetFilters() {
        state.search   = '';
        state.division = '';
        state.category = '';
        state.sort     = 'relevance';
        state.page     = 1;
        $search.val( '' );
        $divisionPills.find( '.mmed-pill' ).removeClass( 'mmed-pill--active' ).first().addClass( 'mmed-pill--active' );
        $categorySelect.val( '' );
        $sortSelect.val( 'relevance' );
    }

    function showToast( message ) {
        var $toast = $( '<div class="mmed-inserter-toast">' + esc( message ) + '</div>' );
        $( 'body' ).append( $toast );
        setTimeout( function() { $toast.addClass( 'mmed-inserter-toast--visible' ); }, 10 );
        setTimeout( function() {
            $toast.removeClass( 'mmed-inserter-toast--visible' );
            setTimeout( function() { $toast.remove(); }, 300 );
        }, 3000 );
    }

    function copyToClipboard( text ) {
        if ( navigator.clipboard && navigator.clipboard.writeText ) {
            navigator.clipboard.writeText( text );
        } else {
            var $temp = $( '<textarea>' ).val( text ).appendTo( 'body' ).select();
            document.execCommand( 'copy' );
            $temp.remove();
        }
    }

    function capitalize( str ) {
        if ( ! str ) return '';
        return str.charAt( 0 ).toUpperCase() + str.slice( 1 );
    }

    function esc( str ) {
        if ( ! str ) return '';
        var div = document.createElement( 'div' );
        div.appendChild( document.createTextNode( str ) );
        return div.innerHTML;
    }

    function escRegex( str ) {
        return str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
    }

    function waitForElement( selector, callback, maxWait ) {
        maxWait = maxWait || 5000;
        var elapsed = 0;
        var interval = setInterval( function() {
            var $el = $( selector );
            if ( $el.length ) {
                clearInterval( interval );
                callback( $el );
            }
            elapsed += 100;
            if ( elapsed >= maxWait ) {
                clearInterval( interval );
            }
        }, 100 );
    }

    /* ── TinyMCE Plugin Registration ───────────────────────────── */

    if ( typeof tinymce !== 'undefined' ) {
        tinymce.PluginManager.add( 'mmed_video_insert', function( editor ) {
            editor.addButton( 'mmed_video_insert', {
                title: 'Add MissionMed Video',
                icon:  'media-video',
                onclick: function() {
                    openModal( 'insert' );
                },
            });
        });
    }

    /* ── Boot ──────────────────────────────────────────────────── */

    $( document ).ready( init );

})( jQuery, typeof mmedInserter !== 'undefined' ? mmedInserter : undefined );
