<?php
/**
 * MissionMed Video Player — HTML5 Rendering Engine
 *
 * Outputs responsive video player markup with:
 *   - Native HTML5 <video> for direct files (.mp4, .webm, etc.)
 *   - Responsive <iframe> for embedded sources (Vimeo, YouTube, etc.)
 *   - Custom controls overlay (play, progress, volume, fullscreen)
 *   - Size variants (standard / compact / small)
 *   - Error placeholder with admin-only diagnostics
 *   - Lazy-load support via IntersectionObserver
 *
 * @package MissionMed_Hub
 * @since   1.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ── Player Rendering ───────────────────────────────────────────── */

/**
 * Render the complete video player HTML for a resolved video.
 *
 * @param array $video_data Normalized video data from mmed_resolve_video().
 * @param array $options    Shortcode options {
 *     @type string $size     Player size: standard|compact|small.
 *     @type bool   $title    Whether to show the title header.
 *     @type bool   $autoplay Whether to auto-start playback.
 *     @type bool   $resume   Whether to enable resume-from-position.
 * }
 * @return string HTML markup.
 */
function mmed_render_video_player( $video_data, $options = array() ) {
    $defaults = array(
        'size'     => 'standard',
        'lazy'     => true,
        'title'    => true,
        'autoplay' => false,
        'resume'   => true,
    );
    $opts = wp_parse_args( $options, $defaults );

    // Size class mapping.
    $size_classes = array(
        'standard' => 'mmed-player--standard',
        'compact'  => 'mmed-player--compact',
        'small'    => 'mmed-player--small',
    );
    $size_class = $size_classes[ $opts['size'] ] ?? $size_classes['standard'];

    $video_id      = esc_attr( $video_data['id'] ?? '' );
    $title         = $video_data['title'] ?? 'MissionMed Video';
    $playback_url  = $video_data['playback_url'] ?? '';
    $poster        = $video_data['thumbnail'] ?? '';
    $duration_label = $video_data['duration_label'] ?? '';
    $category_label = $video_data['category_label'] ?? '';
    $lesson_id     = get_the_ID();

    // Resume position (user meta).
    $resume_pos = 0;
    if ( $opts['resume'] && is_user_logged_in() ) {
        $user_id  = get_current_user_id();
        $progress = get_user_meta( $user_id, 'mmed_video_progress_' . $video_data['id'], true );
        if ( is_array( $progress ) && isset( $progress['position'] ) ) {
            $resume_pos = floatval( $progress['position'] );
        }
    }

    // Print inline styles once per page.
    $style_html = mmed_player_inline_styles();

    // Metadata line.
    $meta_parts = array_filter( array( $category_label, $duration_label ) );
    $meta_copy  = ! empty( $meta_parts ) ? implode( ' | ', $meta_parts ) : 'MissionMed Library';

    // Build player element.
    if ( mmed_is_direct_video_url( $playback_url ) ) {
        $player_markup = mmed_render_html5_player( $playback_url, $poster, $title, $opts['autoplay'], $opts['lazy'] );
    } else {
        $player_markup = mmed_render_iframe_player( $playback_url, $title, $opts['lazy'] );
    }

    // Assemble full shell.
    $html  = $style_html;
    $html .= '<div class="mmed-video-wrapper ' . esc_attr( $size_class ) . '"'
           . ' data-mmed-video-id="' . $video_id . '"'
           . ' data-lesson-id="' . esc_attr( $lesson_id ) . '"'
           . ' data-resume="' . esc_attr( $resume_pos ) . '"'
           . ' data-autoplay="' . ( $opts['autoplay'] ? 'true' : 'false' ) . '">';

    // Title header.
    if ( $opts['title'] ) {
        $html .= '<div class="mmed-lesson-video-header">'
               .   '<div class="mmed-lesson-video-copy">'
               .     '<span class="mmed-lesson-video-kicker">MissionMed Video</span>'
               .     '<h3 class="mmed-lesson-video-title">' . esc_html( $title ) . '</h3>'
               .     '<p class="mmed-lesson-video-meta">' . esc_html( $meta_copy ) . '</p>'
               .   '</div>'
               . '</div>';
    }

    // Player frame.
    $html .= '<div class="mmed-lesson-video-frame">' . $player_markup . '</div>';

    $html .= '</div>';

    return $html;
}

/**
 * Render an HTML5 <video> element with native controls.
 *
 * @param string $url      Direct video file URL.
 * @param string $poster   Poster image URL.
 * @param string $title    Accessible title.
 * @param bool   $autoplay Whether to autoplay (muted if true per browser policy).
 * @return string
 */
function mmed_render_html5_player( $url, $poster, $title, $autoplay = false, $lazy = true ) {
    $poster_attr   = $poster ? ' poster="' . esc_url( $poster ) . '"' : '';
    $autoplay_attr = $autoplay ? ' autoplay muted' : '';
    $preload       = $autoplay ? 'metadata' : ( $lazy ? 'none' : 'metadata' );
    $mime_type     = mmed_get_video_mime_type( $url );

    return '<video class="mmed-lesson-video-player"'
         . ' controls preload="' . esc_attr( $preload ) . '" playsinline'
         . ' title="' . esc_attr( $title ) . '"'
         . $poster_attr
         . $autoplay_attr
         . '>'
         . '<source src="' . esc_url( $url ) . '" type="' . esc_attr( $mime_type ) . '">'
         . '<p>Your browser does not support HTML5 video. '
         . '<a href="' . esc_url( $url ) . '">Download the video</a>.</p>'
         . '</video>';
}

/**
 * Render a responsive iframe embed.
 *
 * @param string $url   Embed URL (Vimeo, YouTube, etc.).
 * @param string $title Accessible title.
 * @return string
 */
function mmed_render_iframe_player( $url, $title, $lazy = true ) {
    $src_attr = $lazy
        ? ' data-src="' . esc_url( $url ) . '" loading="lazy"'
        : ' src="' . esc_url( $url ) . '"';

    return '<iframe class="mmed-lesson-video-embed"'
         . $src_attr
         . ' title="' . esc_attr( $title ) . '"'
         . ' allow="autoplay; fullscreen; picture-in-picture; encrypted-media"'
         . ' allowfullscreen'
         . ' style="border:0;"'
         . '></iframe>';
}

/**
 * Derive an HTML5-friendly MIME type from the video URL extension.
 *
 * @param string $url Video URL.
 * @return string
 */
function mmed_get_video_mime_type( $url ) {
    $path = wp_parse_url( $url, PHP_URL_PATH );
    $ext  = strtolower( pathinfo( (string) $path, PATHINFO_EXTENSION ) );

    $mime_types = array(
        'mp4'  => 'video/mp4',
        'm4v'  => 'video/mp4',
        'mov'  => 'video/quicktime',
        'webm' => 'video/webm',
        'ogg'  => 'video/ogg',
        'ogv'  => 'video/ogg',
    );

    return $mime_types[ $ext ] ?? 'video/mp4';
}

/* ── Error Placeholder ──────────────────────────────────────────── */

/**
 * Render a graceful error placeholder when a video cannot be resolved.
 *
 * @param string $message  Public-facing message.
 * @param string $video_id Video ID (shown to admins only).
 * @return string
 */
function mmed_render_video_error( $message, $video_id = '' ) {
    $style_html = mmed_player_inline_styles();

    $admin_note = '';
    if ( current_user_can( 'edit_posts' ) && $video_id ) {
        $admin_note = '<p class="mmed-video-error__admin">'
                    . 'Admin: Video ID "' . esc_html( $video_id ) . '" could not be resolved. '
                    . 'Check manifest publish status in Content Studio.'
                    . '</p>';
    }

    return $style_html
         . '<div class="mmed-video-wrapper mmed-video-wrapper--error">'
         .   '<div class="mmed-video-error">'
         .     '<div class="mmed-video-error__icon">'
         .       '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">'
         .         '<circle cx="12" cy="12" r="10"/>'
         .         '<line x1="15" y1="9" x2="9" y2="15"/>'
         .         '<line x1="9" y1="9" x2="15" y2="15"/>'
         .       '</svg>'
         .     '</div>'
         .     '<p class="mmed-video-error__message">' . esc_html( $message ) . '</p>'
         .     $admin_note
         .   '</div>'
         . '</div>';
}

/* ── Inline Styles (printed once) ───────────────────────────────── */

/**
 * Output player inline styles exactly once per page load.
 *
 * First tries the CSS block system from hub.css. Falls back to
 * a minimal built-in stylesheet for standalone usage.
 *
 * @return string <style> tag or empty string.
 */
function mmed_player_inline_styles() {
    static $printed = false;

    if ( $printed ) {
        return '';
    }
    $printed = true;

    // Try hub.css block system first (existing pipeline).
    if ( function_exists( 'mmed_hub_get_css_block' ) ) {
        $hub_css = mmed_hub_get_css_block( 'MMED_VIDEO_SHORTCODE' );
        if ( $hub_css ) {
            return '<style id="mmed-video-player-inline">' . $hub_css . '</style>';
        }
    }

    // Fallback: minimal built-in styles for standalone operation.
    return '<style id="mmed-video-player-inline">
.mmed-video-wrapper{position:relative;width:100%;max-width:960px;margin:1.5em auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.mmed-player--compact{max-width:720px}
.mmed-player--small{max-width:480px}
.mmed-lesson-video-header{padding:0 0 .75em}
.mmed-lesson-video-kicker{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#D4AF63;margin-bottom:4px}
.mmed-lesson-video-title{margin:0 0 4px;font-size:1.15em;font-weight:600;color:#1a2332}
.mmed-lesson-video-meta{margin:0;font-size:.85em;color:#6b7b8d}
.mmed-lesson-video-frame{position:relative;width:100%;padding-bottom:56.25%;background:#0a1628;border-radius:8px;overflow:hidden}
.mmed-lesson-video-player,.mmed-lesson-video-embed{position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px}
.mmed-video-wrapper--error{text-align:center;padding:3em 1em;background:#f8f9fa;border:1px solid #e2e6ea;border-radius:8px}
.mmed-video-error__icon{color:#8b95a1;margin-bottom:12px}
.mmed-video-error__message{font-size:.95em;color:#4a5568}
.mmed-video-error__admin{font-size:.8em;color:#c53030;margin-top:8px}
</style>';
}

/* ── Lazy-Load Script (printed once) ────────────────────────────── */

/**
 * Print the lazy-load / resume / progress-save JavaScript once.
 *
 * Uses IntersectionObserver for lazy loading and saves watch position
 * via a lightweight AJAX heartbeat every 15 seconds.
 *
 * @return string <script> tag or empty string.
 */
function mmed_player_inline_script() {
    static $printed = false;

    if ( $printed ) {
        return '';
    }
    $printed = true;

    return '<script id="mmed-video-player-js">
(function(){
    "use strict";

    /* ── Lazy-load via IntersectionObserver ──────────────── */
    if("IntersectionObserver" in window){
        var observer = new IntersectionObserver(function(entries){
            entries.forEach(function(e){
                if(!e.isIntersecting) return;
                var w = e.target;
                var f = w.querySelector("iframe[data-src]");
                var v = w.querySelector("video.mmed-lesson-video-player");
                if(f && f.dataset.src){
                    f.src = f.dataset.src;
                    f.removeAttribute("data-src");
                }
                if(v && v.preload === "none"){ v.preload = "metadata"; }
                observer.unobserve(w);
            });
        }, {rootMargin:"200px"});
        document.querySelectorAll(".mmed-video-wrapper").forEach(function(el){
            observer.observe(el);
        });
    }

    /* ── Resume from last position ──────────────────────── */
    document.querySelectorAll(".mmed-video-wrapper[data-resume]").forEach(function(w){
        var resume = parseFloat(w.dataset.resume) || 0;
        if(resume <= 0) return;
        var v = w.querySelector("video");
        if(!v) return;
        v.addEventListener("loadedmetadata", function(){
            if(resume < v.duration - 5){ v.currentTime = resume; }
        }, {once:true});
    });

    /* ── Autoplay when visible ──────────────────────────── */
    document.querySelectorAll(".mmed-video-wrapper[data-autoplay=\"true\"]").forEach(function(w){
        var v = w.querySelector("video");
        if(!v) return;
        if("IntersectionObserver" in window){
            var ao = new IntersectionObserver(function(entries){
                entries.forEach(function(e){
                    if(e.isIntersecting){ v.play().catch(function(){}); ao.unobserve(w); }
                });
            }, {threshold:0.5});
            ao.observe(w);
        }
    });

    /* ── Progress heartbeat (save every 15s) ────────────── */
    if(typeof mmedVideoAjax !== "undefined" && mmedVideoAjax.ajaxurl){
        document.querySelectorAll(".mmed-video-wrapper video").forEach(function(v){
            var w = v.closest(".mmed-video-wrapper");
            if(!w) return;
            var vid = w.dataset.mmedVideoId;
            var lid = w.dataset.lessonId;
            if(!vid) return;
            var lastSaved = 0;
            var sendProgress = function(fd){
                if(typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"){
                    var sent = navigator.sendBeacon(mmedVideoAjax.ajaxurl, fd);
                    if(sent) return;
                }
                if(typeof fetch === "function"){
                    fetch(mmedVideoAjax.ajaxurl, {
                        method: "POST",
                        body: fd,
                        credentials: "same-origin",
                        keepalive: true
                    }).catch(function(){});
                }
            };
            v.addEventListener("timeupdate", function(){
                var now = Math.floor(Date.now() / 1000);
                if(now - lastSaved < 15) return;
                lastSaved = now;
                var fd = new FormData();
                fd.append("action","mmed_save_video_progress");
                fd.append("nonce", mmedVideoAjax.nonce);
                fd.append("video_id", vid);
                fd.append("lesson_id", lid || "");
                fd.append("position", v.currentTime);
                fd.append("duration", v.duration);
                sendProgress(fd);
            });
        });
    }
})();
</script>';
}
