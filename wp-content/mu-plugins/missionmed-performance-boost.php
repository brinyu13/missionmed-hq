<?php
/**
 * Plugin Name: MissionMed Performance Boost
 * Description: Server-side performance optimizations for GTmetrix A grade.
 * Author: MissionMed
 * Version: 3.16.2
 *
 * Thread: MM-SPEED-HOME-009
 * Safety: Non-logged-in frontend only. Admin always untouched.
 *
 * v3.1 Changes (from Lighthouse sandbox run - CLS 0.875 root cause):
 * - Fonts: display=swap → display=optional (eliminates ALL font-swap CLS)
 * - Preload critical woff2 files (Inter 400/700, Poppins 600/700)
 * - Fix hero preload URL to match actual CSS URL (w=1920&q=80)
 * - Remove preload-as-style (redundant with render-blocking stylesheet)
 *
 * v3.9 Changes (MM-SPEED-HOME-011):
 * - Homepage-only removal of Elementor interactions option catalog when unused.
 * - Homepage-only removal of verified non-home inline CSS payload.
 *
 * v3.10 Changes (MM-SPEED-HOME-012):
 * - Homepage-only externalization of verified base64 video testimonial JPEG thumbnails.
 *
 * v3.11 Changes (MM-SPEED-HOME-016):
 * - Homepage-only hero rendering simplification experiment.
 * - Neutralize hero SVG noise layer and remove backdrop blur/shadow stack.
 *
 * v3.12 Changes (MM-SPEED-MR-001):
 * - Mission Residency-only removal of unused Elementor interactions payload.
 * - Reuses the homepage-proven data-interactions safety gate.
 *
 * v3.13 Changes (MM-SPEED-MR-002):
 * - Mission Residency-only, logged-out dequeue of WISDM/LearnDash report assets.
 * - Preserves logged-in, LearnDash, WooCommerce, admin, AJAX, REST, and cron contexts.
 *
 * v3.14 Changes (MM-SPEED-MR-004):
 * - Mission Residency-only custom runtime startup refactor.
 * - Defers below-fold widget initialization and removes startup forced layout.
 * - Matches the original inline page script before Autoptimize converts it.
 *
 * v3.15 Changes (MM-SPEED-MR-005):
 * - Mission Residency-only below-fold section containment experiment.
 * - Adds conservative content-visibility geometry reservations to the heaviest sections.
 *
 * v3.16 Changes (MM-SPEED-MR-006):
 * - Mission Residency-only LCP hero image optimization experiment.
 * - Swaps CSS background image to a same-visual optimized WebP variant and preloads it.
 *
 * v3.16.1 Changes (MM-AUTH-UX-002):
 * - CSS-only logged-out /my-account lost-password link contrast polish.
 * - No auth, redirect, cookie, Arena, Matrix, Woo handler, or routing changes.
 *
 * v3.16.2 Changes (B1-Storyforge-100-e-d):
 * - Preserve Matrix Runtime asset versions for protected App Mode shells.
 *
 * v3.0 Changes:
 * - Fonts now RENDER-BLOCKING (fixes CLS 0.42 from font swap)
 * - CLS prevention CSS for mm107-hero__noise (fixes CLS 0.34)
 * - Remove hidden duplicate hero section
 * - Add width/height to Mission_Class_Screenshot image
 * - Preload hero background image for LCP
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// =============================================
// 1. DISABLE WORDPRESS EMOJI (saves 2 HTTP requests + inline JS)
// =============================================
add_action( 'init', function() {
    if ( is_admin() ) return;

    remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
    remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
    remove_action( 'wp_print_styles', 'print_emoji_styles' );
    remove_action( 'admin_print_styles', 'print_emoji_styles' );
    remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
    remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
    remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );

    add_filter( 'tiny_mce_plugins', function( $plugins ) {
        if ( is_array( $plugins ) ) {
            return array_diff( $plugins, array( 'wpemoji' ) );
        }
        return $plugins;
    });

    add_filter( 'wp_resource_hints', function( $urls, $relation_type ) {
        if ( 'dns-prefetch' === $relation_type ) {
            $urls = array_filter( $urls, function( $url ) {
                return ( strpos( $url, 'https://s.w.org/images/core/emoji/' ) === false );
            });
        }
        return $urls;
    }, 10, 2 );
});

// =============================================
// 2. REMOVE QUERY STRINGS FROM STATIC RESOURCES
// =============================================
add_filter( 'script_loader_src', 'mm_perf_remove_query_strings', 15, 1 );
add_filter( 'style_loader_src', 'mm_perf_remove_query_strings', 15, 1 );

function mm_perf_remove_query_strings( $src ) {
    if ( is_admin() ) return $src;
    if ( mm_perf_should_preserve_matrix_runtime_version( $src ) ) return $src;
    if ( strpos( $src, '?ver=' ) !== false ) {
        $src = remove_query_arg( 'ver', $src );
    }
    return $src;
}

function mm_perf_should_preserve_matrix_runtime_version( $src ) {
    if ( ! is_string( $src ) || '' === $src ) {
        return false;
    }

    $path = wp_parse_url( $src, PHP_URL_PATH );
    if ( ! is_string( $path ) || '' === $path ) {
        return false;
    }

    $matrix_runtime_assets = array(
        '/wp-content/plugins/missionmed-hub/assets/student-os.js',
        '/wp-content/plugins/missionmed-hub/assets/student-os.css',
        '/wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js',
        '/wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css',
        '/wp-content/plugins/missionmed-hub/assets/scheduler-mount.js',
        '/wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js',
        '/wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css',
        '/wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js',
        '/wp-content/plugins/missionmed-hub/assets/student-os-storyforge.css',
    );

    return in_array( $path, $matrix_runtime_assets, true );
}

function mm_perf_strip_homepage_payload_bloat( $html ) {
    $html = mm_perf_strip_homepage_elementor_interactions_payload( $html );
    $html = mm_perf_strip_homepage_non_home_css_payload( $html );
    $html = mm_perf_externalize_homepage_video_testimonial_thumbnails( $html );
    $html = mm_perf_simplify_homepage_hero_rendering( $html );

    return $html;
}

function mm_perf_strip_mission_residency_payload_bloat( $html ) {
    $html = mm_perf_strip_homepage_elementor_interactions_payload( $html );
    $html = mm_perf_refactor_mission_residency_custom_runtime( $html );
    $html = mm_perf_add_mission_residency_section_containment( $html );
    $html = mm_perf_optimize_mission_residency_lcp_image( $html );

    return $html;
}

function mm_perf_add_mission_residency_section_containment( $html ) {
    if ( stripos( $html, 'mm-speed-mr-005-section-containment' ) !== false ) {
        return $html;
    }

    $required_markers = array(
        'page-id-5686',
        'elementor-element-0ae31bd',
        'elementor-element-5e7973e',
        'elementor-element-394c6a5',
        'elementor-element-92c23a5',
        'elementor-element-b5db894',
        'elementor-element-a3476d2',
    );

    foreach ( $required_markers as $marker ) {
        if ( stripos( $html, $marker ) === false ) {
            return $html;
        }
    }

    $css = <<<'CSS'
<style id="mm-speed-mr-005-section-containment">
@supports (content-visibility: auto) {
  body.page-id-5686 .elementor-element-0ae31bd,
  body.page-id-5686 .elementor-element-5e7973e,
  body.page-id-5686 .elementor-element-394c6a5,
  body.page-id-5686 .elementor-element-92c23a5,
  body.page-id-5686 .elementor-element-b5db894,
  body.page-id-5686 .elementor-element-a3476d2 {
    content-visibility: auto;
  }

  body.page-id-5686 .elementor-element-0ae31bd { contain-intrinsic-size: auto 4300px; }
  body.page-id-5686 .elementor-element-5e7973e { contain-intrinsic-size: auto 3350px; }
  body.page-id-5686 .elementor-element-394c6a5 { contain-intrinsic-size: auto 1400px; }
  body.page-id-5686 .elementor-element-92c23a5 { contain-intrinsic-size: auto 1420px; }
  body.page-id-5686 .elementor-element-b5db894 { contain-intrinsic-size: auto 1450px; }
  body.page-id-5686 .elementor-element-a3476d2 { contain-intrinsic-size: auto 1800px; }
}
</style>
CSS;

    if ( stripos( $html, '</head>' ) !== false ) {
        return preg_replace( '/<\/head>/i', $css . "\n</head>", $html, 1 );
    }

    return $html . "\n" . $css;
}

function mm_perf_optimize_mission_residency_lcp_image( $html ) {
    if ( stripos( $html, 'mm-speed-mr-006-lcp-preload' ) !== false ) {
        return $html;
    }

    if ( stripos( $html, 'page-id-5686' ) === false || stripos( $html, 'mr1503d-hero' ) === false ) {
        return $html;
    }

    $original  = 'https://missionmedinstitute.com/wp-content/uploads/2026/03/mission-residency-run.webp';
    $optimized = 'https://missionmedinstitute.com/wp-content/uploads/2026/06/mm-speed-mr-006/mission-residency-run-mr006-q100.webp';

    if ( strpos( $html, $original ) === false ) {
        return $html;
    }

    $html = str_replace( $original, $optimized, $html );

    $preload = '<link id="mm-speed-mr-006-lcp-preload" rel="preload" as="image" href="'
        . $optimized
        . '" type="image/webp" fetchpriority="high">' . "\n";

    if ( stripos( $html, '</head>' ) !== false ) {
        return preg_replace( '/<\/head>/i', $preload . '</head>', $html, 1 );
    }

    return $preload . $html;
}

add_action( 'wp_enqueue_scripts', 'mm_perf_dequeue_mission_residency_wisdm_reports_assets', 9999 );
add_action( 'wp_print_scripts', 'mm_perf_dequeue_mission_residency_wisdm_reports_assets', 100 );
add_action( 'wp_print_styles', 'mm_perf_dequeue_mission_residency_wisdm_reports_assets', 100 );
add_action( 'wp_print_footer_scripts', 'mm_perf_dequeue_mission_residency_wisdm_reports_assets', 100 );

function mm_perf_is_public_mission_residency_request() {
    if ( is_admin() || is_user_logged_in() ) {
        return false;
    }

    if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) {
        return false;
    }

    if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
        return false;
    }

    if ( defined( 'DOING_CRON' ) && DOING_CRON ) {
        return false;
    }

    if ( defined( 'WP_CLI' ) && WP_CLI ) {
        return false;
    }

    if ( function_exists( 'is_cart' ) && is_cart() ) {
        return false;
    }

    if ( function_exists( 'is_checkout' ) && is_checkout() ) {
        return false;
    }

    if ( function_exists( 'is_account_page' ) && is_account_page() ) {
        return false;
    }

    if ( function_exists( 'is_singular' ) && is_singular( array( 'sfwd-courses', 'sfwd-lessons', 'sfwd-topic', 'sfwd-quiz', 'groups' ) ) ) {
        return false;
    }

    if ( is_page( 5686 ) || is_page( 'mission-residency' ) ) {
        return true;
    }

    $request_path = isset( $_SERVER['REQUEST_URI'] )
        ? trim( (string) wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ), '/' )
        : '';

    return 'mission-residency' === $request_path;
}

function mm_perf_dequeue_mission_residency_wisdm_reports_assets() {
    if ( ! mm_perf_is_public_mission_residency_request() ) {
        return;
    }

    mm_perf_dequeue_handles_by_prefix(
        'wp_scripts',
        array(
            'wisdm-learndash-reports-front-end-script-',
            'wrld_admin_dashboard_settings_',
        ),
        array(
            'wrld-common-script',
        )
    );

    mm_perf_dequeue_handles_by_prefix(
        'wp_styles',
        array(
            'wisdm-learndash-reports-front-end-style-',
            'wrld_admin_dashboard_settings_',
        ),
        array(
            'wrld-common-style',
            'wrld_global_styles',
        )
    );
}

function mm_perf_dequeue_handles_by_prefix( $registry_name, $prefixes, $exact_handles ) {
    $registry = 'wp_scripts' === $registry_name ? wp_scripts() : wp_styles();

    foreach ( (array) $registry->queue as $handle ) {
        $matched = in_array( $handle, $exact_handles, true );

        if ( ! $matched ) {
            foreach ( $prefixes as $prefix ) {
                if ( 0 === strpos( $handle, $prefix ) ) {
                    $matched = true;
                    break;
                }
            }
        }

        if ( ! $matched ) {
            continue;
        }

        if ( 'wp_scripts' === $registry_name ) {
            wp_dequeue_script( $handle );
        } else {
            wp_dequeue_style( $handle );
        }
    }
}

function mm_perf_refactor_mission_residency_custom_runtime( $html ) {
    if ( stripos( $html, 'data:text/javascript;base64,' ) === false && stripos( $html, 'PROGRAM DIRECTOR FACTORS' ) === false ) {
        return $html;
    }

    $replaced = 0;

    $html = preg_replace_callback(
        '/<script\b([^>]*)\bsrc=(["\'])data:text\/javascript;base64,([^"\']+)\2([^>]*)>\s*<\/script>\s*/is',
        function( $matches ) use ( &$replaced ) {
            if ( $replaced > 0 ) {
                return $matches[0];
            }

            $decoded = base64_decode( $matches[3], true );

            if ( $decoded === false || ! mm_perf_is_mission_residency_custom_runtime_script( $decoded ) ) {
                return $matches[0];
            }

            $replaced++;

            return '<script id="mm-speed-mr-004-custom-runtime" defer src="data:text/javascript;base64,'
                . base64_encode( mm_perf_get_mission_residency_optimized_runtime_js() )
                . '"></script>' . "\n";
        },
        $html
    );

    if ( $replaced > 0 ) {
        return $html;
    }

    return preg_replace_callback(
        '/<script\b((?:(?!\bsrc=)[^>])*)>(.*?)<\/script>\s*/is',
        function( $matches ) use ( &$replaced ) {
            if ( $replaced > 0 ) {
                return $matches[0];
            }

            if ( ! mm_perf_is_mission_residency_custom_runtime_script( $matches[2] ) ) {
                return $matches[0];
            }

            $replaced++;

            return '<script id="mm-speed-mr-004-custom-runtime" defer src="data:text/javascript;base64,'
                . base64_encode( mm_perf_get_mission_residency_optimized_runtime_js() )
                . '"></script>' . "\n";
        },
        $html
    );
}

function mm_perf_is_mission_residency_custom_runtime_script( $script ) {
    $required_markers = array(
        'PROGRAM DIRECTOR FACTORS',
        "pdfRender('all')",
        "rfRender('all')",
        "costRender('real')",
        'void i.offsetWidth',
        'getBoundingClientRect()',
        'data-mr1503d-pdf',
    );

    foreach ( $required_markers as $marker ) {
        if ( strpos( $script, $marker ) === false ) {
            return false;
        }
    }

    return true;
}

function mm_perf_get_mission_residency_optimized_runtime_js() {
    return <<<'JS'
(function(){
  'use strict';
  var win=window;
  var doc=document;
  var raf=win.requestAnimationFrame||function(cb){return setTimeout(function(){cb(Date.now());},16);};
  var idle=win.requestIdleCallback?function(cb,t){win.requestIdleCallback(cb,{timeout:t||1200});}:function(cb){setTimeout(cb,0);};
  function ready(fn){if(doc.readyState==='loading'){doc.addEventListener('DOMContentLoaded',fn,{once:true});}else{fn();}}
  function each(sel,fn,root){Array.prototype.forEach.call((root||doc).querySelectorAll(sel),fn);}
  function onceNear(target,fn,margin){var done=false;function run(){if(done)return;done=true;fn();}if(!target){idle(run);return;}if('IntersectionObserver'in win){var io=new IntersectionObserver(function(ents){ents.forEach(function(en){if(en.isIntersecting){io.disconnect();run();}});},{rootMargin:margin||'1200px 0px',threshold:0});io.observe(target);}else{idle(run,800);}}
  ready(function(){
    setupReveal();
    setupStickyState();
    setupCounters();
    setupPdf();
    setupRedFlags();
    setupCost();
    setupFaq();
  });
  function setupReveal(){
    var items=Array.prototype.slice.call(doc.querySelectorAll('.mr1503d-reveal'));
    if(!items.length)return;
    raf(function(){
      if('IntersectionObserver'in win){
        var io=new IntersectionObserver(function(ents){
          ents.forEach(function(en){if(en.isIntersecting){en.target.classList.add('is-in');io.unobserve(en.target);}});
        },{threshold:.12,rootMargin:'0px 0px -10% 0px'});
        items.forEach(function(el){io.observe(el);});
      }else{
        items.forEach(function(el){el.classList.add('is-in');});
      }
    });
  }
  function setupStickyState(){
    var nav=doc.querySelector('[data-mr1503d-nav]');
    var sticky=doc.querySelector('[data-mr1503d-stickyread]');
    var mustreadSeen=false;
    var pending=false;
    var mr=doc.getElementById('mustread');
    function update(){
      pending=false;
      var y=win.scrollY||win.pageYOffset||0;
      if(nav)nav.classList.toggle('is-scrolled',y>40);
      if(sticky){
        var thresh=Math.max(win.innerHeight*.7,500);
        sticky.classList.toggle('is-in',y>thresh&&!mustreadSeen);
      }
    }
    function request(){if(!pending){pending=true;raf(update);}}
    if(mr&&'IntersectionObserver'in win){
      var mustreadObserver=new IntersectionObserver(function(ents){
        ents.forEach(function(en){if(en.isIntersecting){mustreadSeen=true;request();}});
      },{rootMargin:'0px 0px -25% 0px',threshold:0});
      mustreadObserver.observe(mr);
    }
    win.addEventListener('scroll',request,{passive:true});
    win.addEventListener('resize',request,{passive:true});
    raf(request);
  }
  function setupCounters(){
    function animateCounters(){
      each('[data-mr1503d-counter]',function(el){
        if(el.dataset.done==='1')return;
        var target=parseFloat(el.getAttribute('data-mr1503d-counter')||'0');
        var suffix=el.getAttribute('data-mr1503d-suffix')||'';
        var dec=parseInt(el.getAttribute('data-mr1503d-decimals')||'0',10);
        var dur=1400;
        var start=performance.now();
        function tick(now){
          var p=Math.min(1,(now-start)/dur);
          var e=1-Math.pow(1-p,3);
          var v=target*e;
          el.textContent=(dec?v.toFixed(dec):Math.round(v))+suffix;
          if(p<1)raf(tick);else el.dataset.done='1';
        }
        raf(tick);
      });
    }
    if('IntersectionObserver'in win){
      var aio=new IntersectionObserver(function(ents){
        ents.forEach(function(en){if(en.isIntersecting){animateCounters();aio.unobserve(en.target);}});
      },{threshold:.4});
      each('.mr1503d-authority',function(s){aio.observe(s);});
    }else{
      idle(animateCounters,500);
    }
  }
  var PDF={g1:[{l:"USMLE Step 1 pass",f:90,i:4.5,h:["drj"]},{l:"MSPE / Dean's Letter",f:85,i:4.1,h:[]},{l:"Letters of recommendation",f:84,i:4.2,h:["mc","mr"]},{l:"USMLE Step 2 CK score",f:83,i:4.2,h:["drj"]},{l:"Personal statement",f:81,i:4.0,h:["mr"]},{l:"Any failed USMLE attempt",f:77,i:4.4,h:["mr","drj"]},{l:"Overcoming significant obstacles",f:74,i:4.1,h:["mr"]},{l:"Diversity characteristics",f:72,i:4.0,h:[]},{l:"Commitment to specialty",f:72,i:4.4,h:["mr","mc"]},{l:"Leadership qualities",f:72,i:4.2,h:["mr"]}],g2:[{l:"Interpersonal skills",f:87,i:4.8,h:["mr"]},{l:"Faculty interaction on IV day",f:87,i:4.6,h:["mr"]},{l:"Feedback from current residents",f:76,i:4.6,h:["mr"]},{l:"House staff interaction on IV",f:76,i:4.7,h:["mr"]},{l:"USMLE Step 2 CK score",f:65,i:4.2,h:["drj"]},{l:"Letters of recommendation",f:64,i:4.1,h:["mc","mr"]},{l:"MSPE / Dean's Letter",f:63,i:4.0,h:[]},{l:"Personal statement",f:63,i:4.4,h:["mr"]},{l:"Commitment to specialty",f:62,i:4.4,h:["mr","mc"]},{l:"Leadership qualities",f:61,i:4.3,h:["mr"]},{l:"Professionalism & ethics",f:61,i:4.8,h:["mr"]}]};
  var PDF_PRODUCTS={all:null,mr:'mr',drj:'drj',mc:'mc'};
  function setupPdf(){
    var pdfRoot=doc.getElementById('pdf')||doc.querySelector('[data-mr1503d-pdf-rows]');
    var initialized=false;
    function ensure(which){if(!initialized){initialized=true;}pdfRender(which||'all');}
    each('[data-mr1503d-pdf]',function(b){
      b.addEventListener('click',function(){
        each('[data-mr1503d-pdf]',function(x){x.classList.remove('is-active');});
        b.classList.add('is-active');
        ensure(b.getAttribute('data-mr1503d-pdf'));
      });
    });
    onceNear(pdfRoot,function(){idle(function(){ensure('all');},600);},'1600px 0px');
  }
  function pdfRender(which){
    var prod=PDF_PRODUCTS[which];
    var helped=0,total=0;
    ['g1','g2'].forEach(function(gate){
      var box=doc.querySelector('[data-mr1503d-pdf-rows="'+gate+'"]');
      if(!box)return;
      box.innerHTML=PDF[gate].map(function(r){
        total++;
        var isHelped=prod?r.h.indexOf(prod)>-1:r.h.length>0;
        if(isHelped)helped++;
        return '<div class="mr1503d-pdf-row '+(isHelped?'h':'is-dim')+'"><span class="lab">'+r.l+'</span><div class="bar"><i style="width:0" data-w="'+r.f+'"></i></div><span class="pct">'+r.f+'%</span><span class="imp">'+r.i.toFixed(1)+'</span></div>';
      }).join('');
    });
    var c=doc.querySelector('[data-mr1503d-pdfcount]');
    var t=doc.querySelector('[data-mr1503d-pdftotal]');
    if(c)c.textContent=helped;
    if(t)t.textContent=' of '+total+' factors';
    raf(function(){raf(function(){
      each('[data-mr1503d-pdf-rows] .bar > i',function(i){
        i.style.width=(parseInt(i.getAttribute('data-w')||'0',10)||0)+'%';
      });
    });});
  }
  var RF={all:{stat:"100%",lab:"matched in our verified red-flag dataset",desc:"102 verified testimonials. 35 documented red-flag cases. 100% match rate among completed cycles. Lowest Step 1 was 191. Oldest YOG was 2002.",cards:[{n:"Chelsey Cc",d:"4 failed before Mission · matched 1st cycle with Mission",q:"After 5 residency cycles with sweats, tears, and growing curves, I matched."},{n:"Sonia Jahan",d:"4 failed before Mission · matched 1st cycle · IM",q:"Once an impossible dream turned into reality."},{n:"Anissa Rahman",d:"YOG 2007 · matched 1st cycle · 1st choice",q:"It is ABSOLUTELY POSSIBLE no matter what your year of graduation is."}]},oldgrad:{stat:"Up to 24 yrs",lab:"longest YOG gap matched (Psychiatry)",desc:"Old graduate is the most common red flag. 48.6% of red-flag cases. Documented matches at YOG 2002, 2004, 2005, 2007, 2008. Strategy: reframe the gap, leverage compensating LORs, target programs that value experience.",cards:[{n:"Yamini Arukala",d:"India · YOG 2008 · 15-yr gap · matched FM with Mission",q:"Matched at Lincoln Medical and Mental Health Center."},{n:"Abhinav Vasireddy",d:"India · YOG 2008 · matched IM with Mission",q:"Dr. B's ability to transform red flags into compelling narratives was remarkable."},{n:"Anissa Rahman",d:"YOG 2007 · matched 1st cycle · 1st choice IM",q:"Two fellowships completed since."}]},lowstep:{stat:"191",lab:"lowest Step 1 matched in our database (FM)",desc:"Step 1 below 220 is documented as low-impact in our verified outcomes. Matches at 191 (FM), 198 with attempts (Psych prematch), 202 (Peds), 212 (Neuro 1st choice), 213 (PM&R 1st choice).",cards:[{n:"Reference IMG-LS-04",d:"Step 1: 191 · matched FM with Mission · 360 Elite",q:"Lowest verified Step 1 matched."},{n:"Reference IMG-LS-01",d:"Step 1: 212 · matched Neuro 1st choice with Mission",q:"1st choice on a low-score profile."},{n:"Reference IMG-LS-02",d:"Step 1: 213 · matched Peds 1st choice with Mission",q:"Compensated through interview performance."}]},attempt:{stat:"3rd attempt",lab:"matched at Step 1: 188 (anonymized)",desc:"USMLE attempts are recoverable. Matches with 188 (3rd attempt) and 198 (3rd attempt prematch). Strategy: own the attempt, demonstrate growth, target programs that value resilience.",cards:[{n:"Anonymized",d:"Step 1: 188 (3rd attempt) · matched with Mission",q:"Programs evaluate more than numbers. He matched."},{n:"Reference IMG-LS-03",d:"Step 1: 214 · multi-attempt history · prematch with Mission",q:"Prematch despite multiple attempts."},{n:"Manisha Kanumuri",d:"6 attempts · 9 years · matched 1st cycle with Mission",q:"Six attempts. Nine years. Finally."}]},multicycle:{stat:"5 cycles",lab:"most cycles before matching with Mission",desc:"34.3% of red-flag cases are multi-cycle. 42.9% previously unmatched. The students all matched on their first cycle with Mission. Strategy: complete application overhaul, not the same plan.",cards:[{n:"Chelsey Cc",d:"4 failed before Mission · matched 1st cycle with Mission · 2023",q:"After 5 residency cycles, I AM SO PROUD TO SHARE THAT I HAVE MATCHED."},{n:"Wahida Rashid Rakhi",d:"2 failed before Mission · matched 1st cycle with Mission · IM",q:"Third cycle success. Would not be here without your help."},{n:"Salini Anoop",d:"1 failed before Mission · matched 1st cycle with Mission · 12-yr YOG",q:"This time, I took the leap. Best decision of my Match journey."}]},visa:{stat:"Decade later",lab:"Jalpa returned after visa denial · matched again",desc:"Visa concerns are 2.9% of cases but compound heavily with other flags. Strategy: target sponsoring programs, consider prelim/transitional. Mission Residency support extends across visa setbacks.",cards:[{n:"Jalpa Kumari",d:"Visa denied 2017 · returned · 360 Elite",q:"I only sent one text to Dr. B. Always just a text away even after a decade."},{n:"Reference Visa+Weak",d:"Compound visa case · matched · prelim path",q:"Targeted sponsoring programs and built a transition pathway."}]},oneIV:{stat:"1 IV",lab:"matched on a single interview invitation",desc:"Documented matches on a single interview invite. Strategy: extreme preparation, deep program research, optimize for that one shot.",cards:[{n:"IMG-1IV-01",d:"Step 1: 227 · YOG 2014 · 1 IV · matched IM with Mission",q:"Single invite. Drilled until ready. Matched."},{n:"IMG-1IV-02",d:"Step 1: 220 · YOG 2011 · 1 IV · matched IM with Mission",q:"One interview, full preparation, full result."},{n:"IMG-1IV-03",d:"Step 1: 198 (3rd attempt) · 1 IV · prematch Psych with Mission",q:"Slot secured against compound red flags."}]},competitive:{stat:"PM&R · Surg · Anesth",lab:"competitive specialty matches with Mission",desc:"5.7% of red-flag cases pursued competitive specialties. Documented matches in Anesthesiology, PM&R (1st Choice), General Surgery.",cards:[{n:"Reference Anesth",d:"Step 1: 213 · Step 2: 243 · matched Anesth with Mission",q:"Competitive specialty match against the odds."},{n:"Reference PM&R",d:"Step 1: 213 · matched 1st choice PM&R with Mission · 360 Elite",q:"PM&R 1st choice on full 360 Elite pathway."},{n:"Reference Surgery",d:"Step 1: 223 · matched Surg with Mission · 360 Elite",q:"Surgery match against IMG-competitive odds."}]}};
  function setupRedFlags(){
    var root=doc.querySelector('[data-mr1503d-rfcards]')||doc.querySelector('[data-mr1503d-rf]');
    var initialized=false;
    function ensure(which){initialized=true;rfRender(which||'all');}
    each('[data-mr1503d-rf]',function(b){
      b.addEventListener('click',function(){
        each('[data-mr1503d-rf]',function(x){x.classList.remove('is-active');});
        b.classList.add('is-active');
        ensure(b.getAttribute('data-mr1503d-rf'));
      });
    });
    onceNear(root,function(){if(!initialized)idle(function(){ensure('all');},600);},'1400px 0px');
  }
  function rfRender(which){
    var data=RF[which]||RF.all;
    var n=doc.querySelector('[data-mr1503d-rfstatnum]');
    var l=doc.querySelector('[data-mr1503d-rfstatlab]');
    var d=doc.querySelector('[data-mr1503d-rfdesc]');
    var c=doc.querySelector('[data-mr1503d-rfcards]');
    if(n)n.textContent=data.stat;
    if(l)l.textContent=data.lab;
    if(d)d.textContent=data.desc;
    if(c)c.innerHTML=data.cards.map(function(card){return '<div class="mr1503d-rf-card"><div class="name">'+card.n+'</div><div class="det">'+card.d+'</div><div class="quote">"'+card.q+'"</div></div>';}).join('');
  }
  var COST={cons:{name:"Conservative · 100 programs · 2 rotations",total:83207,eras1:3720,eras2:3720,rot:3400,hous:3051,e1:"ERAS Application Fees (100 programs)",e2:"ERAS Reapplication (100 programs)",rl:"2 Rotations (1 hands-on + 1 observership)"},real:{name:"Realistic · 150 programs · 3 rotations",total:89853,eras1:5430,eras2:5430,rot:5100,hous:4577,e1:"ERAS Application Fees (150 programs)",e2:"ERAS Reapplication (150 programs)",rl:"3 Rotations (2 hands-on + 1 observership)"},hard:{name:"Hardcore · 200 programs · 4 rotations",total:96499,eras1:7140,eras2:7140,rot:6800,hous:6103,e1:"ERAS Application Fees (200 programs)",e2:"ERAS Reapplication (200 programs)",rl:"4 Rotations (3 hands-on + 1 observership)"}};
  function setupCost(){
    var root=doc.getElementById('cost')||doc.querySelector('[data-mr1503d-costnum]')||doc.querySelector('[data-mr1503d-cost]');
    var initialized=false;
    function ensure(which){initialized=true;costRender(which||'real');}
    each('[data-mr1503d-cost]',function(b){
      b.addEventListener('click',function(){
        each('[data-mr1503d-cost]',function(x){x.classList.remove('is-active');});
        b.classList.add('is-active');
        ensure(b.getAttribute('data-mr1503d-cost'));
      });
    });
    onceNear(root,function(){if(!initialized)idle(function(){ensure('real');},600);},'1400px 0px');
  }
  function fmt(n){return '$'+n.toLocaleString('en-US');}
  function costRender(which){
    var c=COST[which]||COST.real;
    var num=doc.querySelector('[data-mr1503d-costnum]');
    var sc=doc.querySelector('[data-mr1503d-costscenario]');
    if(num){
      var current=parseInt(num.textContent.replace(/[^0-9]/g,''),10)||c.total;
      var target=c.total;
      var dur=900;
      var start=performance.now();
      function tick(now){
        var p=Math.min(1,(now-start)/dur);
        var e=1-Math.pow(1-p,3);
        num.textContent=fmt(Math.round(current+(target-current)*e));
        if(p<1)raf(tick);
      }
      raf(tick);
    }
    if(sc)sc.textContent=c.name;
    function setVal(key,val){each('[data-mr1503d-costval="'+key+'"]',function(el){el.textContent=fmt(val);});}
    function setLab(key,txt){each('[data-mr1503d-costlabel="'+key+'"]',function(el){el.textContent=txt;});}
    setVal('eras1',c.eras1);setVal('eras2',c.eras2);setVal('rot',c.rot);setVal('hous',c.hous);
    setLab('eras1',c.e1);setLab('eras2',c.e2);setLab('rot',c.rl);
  }
  function setupFaq(){
    each('[data-mr1503d-faq]',function(list){
      list.addEventListener('click',function(e){
        var q=e.target.closest('.mr1503d-faq-q');
        if(q)q.parentNode.classList.toggle('is-open');
      });
    });
  }
})();
JS;
}

function mm_perf_simplify_homepage_hero_rendering( $html ) {
    if ( stripos( $html, 'id="mm107-hero"' ) === false || stripos( $html, 'mm107-hero__content' ) === false ) {
        return $html;
    }

    if ( stripos( $html, 'mm-home-016-hero-rendering-experiment' ) !== false ) {
        return $html;
    }

    $css = '<style id="mm-home-016-hero-rendering-experiment">'
        . 'body.home:not(.logged-in) #mm107-hero .mm107-hero__noise{display:none!important;opacity:0!important;background:none!important;background-image:none!important;}'
        . 'body.home:not(.logged-in) #mm107-hero .mm107-hero__content{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:linear-gradient(135deg,rgba(11,29,48,.62) 0%,rgba(15,42,68,.42) 100%)!important;box-shadow:0 10px 24px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.05)!important;}'
        . '@media(max-width:768px){body.home:not(.logged-in) #mm107-hero .mm107-hero__content{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:linear-gradient(135deg,rgba(11,29,48,.72) 0%,rgba(15,42,68,.50) 100%)!important;box-shadow:0 8px 18px rgba(0,0,0,.16)!important;}}'
        . '</style>' . "\n";

    if ( preg_match( '/<style\b[^>]*id=["\']mm-body-styles-early["\'][^>]*>.*?<\/style>\s*/is', $html, $match, PREG_OFFSET_CAPTURE ) ) {
        $insert_at = $match[0][1] + strlen( $match[0][0] );
        return substr( $html, 0, $insert_at ) . $css . substr( $html, $insert_at );
    }

    return preg_replace( '/<\/head>/i', $css . '</head>', $html, 1 );
}

function mm_perf_externalize_homepage_video_testimonial_thumbnails( $html ) {
    if ( stripos( $html, 'data:image/jpeg;base64,' ) === false ) {
        return $html;
    }

    $thumbnail_map = array(
        '617c9e69f08a29b4be0bf2ddaa0b9237465f821b1f6c98ebe698b57928e22df7' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-03-marian-tearful-match-call.jpg',
        '8667351959ae711fb823f610d52c0eb6fa9375ec716d01444369a80b82656392' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-04-chelsey-matched-after-5-cycles.jpg',
        '0744216d072d35521dbf87b89bb584284b9bd84bb07628a9d73df33c3cb7e1a4' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-05-yamini-left-medicine-15-years.jpg',
        'af7c44a84a97eef67813c26fe2667c91f755530a06a38d882a94297fbc23a2d5' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-06-gunjan-family-finds-out.jpg',
        '8a5a8c13c4fe77d66998a6ca256ff185a41325d4ebee42630b2a2d6ea7d88422' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-07-sana-failed-last-year-matched-this-year.jpg',
        'd6b18f6c516388e3701c883d63e396cb498a8ffde16f7accf3b0551a78253f0d' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-08-maisha-best-decision.jpg',
        'b41ba397fdf36ccc38891e82cbb9973cadc05911903fd3a9cab767a59008bc0b' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-09-maksura-found-where-she-belonged.jpg',
        'c0a948b8ec8170207f0a850a8faca73bd5c34493a08d12cbd288cc1f4f6ac707' => '/wp-content/uploads/2026/06/mm-speed-home-012/mm-home-012-10-mahabuba-confidence.jpg',
    );

    return preg_replace_callback(
        '/<img\b[^>]*\ssrc=(["\'])data:image\/jpeg;base64,([^"\']+)\1[^>]*>/i',
        function( $matches ) use ( $thumbnail_map ) {
            $tag     = $matches[0];
            $quote   = $matches[1];
            $decoded = base64_decode( $matches[2], true );

            if ( $decoded === false ) {
                return $tag;
            }

            $hash = hash( 'sha256', $decoded );

            if ( ! isset( $thumbnail_map[ $hash ] ) ) {
                return $tag;
            }

            return preg_replace(
                '/\ssrc=(["\'])data:image\/jpeg;base64,[^"\']+\1/i',
                ' src=' . $quote . $thumbnail_map[ $hash ] . $quote,
                $tag,
                1
            );
        },
        $html
    );
}

function mm_perf_strip_homepage_elementor_interactions_payload( $html ) {
    if ( stripos( $html, 'elementor-interactions-js-extra' ) === false ) {
        return $html;
    }

    $has_page_interactions = (bool) preg_match( '/\sdata-interactions=(["\'])/i', $html );

    if ( $has_page_interactions ) {
        $minimal_config = '<script id="elementor-interactions-js-extra">var ElementorInteractionsConfig={"constants":{"defaultDuration":300,"defaultDelay":0,"slideDistance":100,"scaleStart":0,"easing":"linear","ease":"linear"}};</script>';

        return preg_replace(
            '/<script\b[^>]*id=["\']elementor-interactions-js-extra["\'][^>]*>.*?<\/script>\s*/is',
            $minimal_config,
            $html,
            1
        );
    }

    $html = preg_replace(
        '/<script\b[^>]*id=["\']elementor-interactions-js-extra["\'][^>]*>.*?<\/script>\s*/is',
        '',
        $html,
        1
    );

    $html = preg_replace(
        '/<script\b[^>]*id=["\']elementor-interactions-js["\'][^>]*src=["\'][^"\']*interactions\.min\.js[^"\']*["\'][^>]*><\/script>\s*/is',
        '',
        $html,
        1
    );

    return $html;
}

function mm_perf_strip_homepage_non_home_css_payload( $html ) {
    if ( stripos( $html, '<style' ) === false ) {
        return $html;
    }

    return preg_replace_callback(
        '/<style\b([^>]*)>(.*?)<\/style>\s*/is',
        'mm_perf_filter_homepage_style_block',
        $html
    );
}

function mm_perf_filter_homepage_style_block( $matches ) {
    $attrs = $matches[1];
    $css   = $matches[2];

    if ( mm_perf_is_homepage_irrelevant_style_block( $attrs, $css ) ) {
        return '';
    }

    $filtered_css = mm_perf_strip_homepage_irrelevant_css_from_mixed_block( $css );

    if ( trim( $filtered_css ) === '' ) {
        return '';
    }

    return '<style' . $attrs . '>' . $filtered_css . '</style>';
}

function mm_perf_is_homepage_irrelevant_style_block( $attrs, $css ) {
    if ( preg_match( '/\sid=["\'](?:mm-ep-1402g-css|mm-ep-1402f-css)["\']/i', $attrs ) ) {
        return true;
    }

    $needles = array(
        '.woocommerce-product-gallery{ opacity: 1 !important; }',
        '.noty_theme__learndash.noty_type__success',
        'MR-096: Fix WooCommerce cart/checkout text visibility',
        'MR-TIGHTEN: Mission Residency Section Compaction',
        'LearnDash Matrix Reskin',
        'MR-MyAccount-Matrix-Reskin',
        'MR-WOO-ACCOUNT-001',
        'EXAMPREP FULL-WIDTH EDGE-TO-EDGE FIX',
        'scope arena header',
        'MM CLINICALS PAGE - DESIGN LANGUAGE RENOVATION',
        'Rank List Engine (page 5402)',
        'USCE PAGE STYLES',
        'ExamPrep Page (ID: 3503)',
        'RankListIQ + Mission Control',
        'Rank List Engine (page 4216)',
    );

    foreach ( $needles as $needle ) {
        if ( stripos( $css, $needle ) !== false ) {
            return true;
        }
    }

    return false;
}

function mm_perf_strip_homepage_irrelevant_css_from_mixed_block( $css ) {
    $css = preg_replace(
        '/\/\*[\s\S]*?SC-107A[\s\S]*?(?=\/\*\s*CUHP-108: Full-bleed override)/',
        '',
        $css,
        1
    );

    $css = preg_replace(
        '/\/\*\s*ExamPrep Hero Background Image Override[\s\S]*$/',
        '',
        $css,
        1
    );

    $css = preg_replace(
        '/\/\*\s*=+\s*MissionMed - Woo My Account[\s\S]*?(?=\/\*[\s\S]*?MR-308: Visual Polish[\s\S]*?\*\/)/',
        '',
        $css,
        1
    );

    $css = preg_replace(
        '/\/\*\s*E1: ExamPrep[\s\S]*?(?=\/\*\s*MM-PROD-AUDIT-2026-05-08 END\s*\*\/)/',
        '',
        $css,
        1
    );

    $css = preg_replace(
        '/\/\*\s*D8-445: scoped logged-out \/my-account entry polish\s*\*\/[\s\S]*$/',
        '',
        $css,
        1
    );

    return $css;
}

// =============================================
// 3. DNS-PREFETCH FOR ANALYTICS
// =============================================
add_action( 'wp_head', function() {
    if ( is_admin() || is_user_logged_in() ) return;
    echo '<link rel="dns-prefetch" href="//www.googletagmanager.com">' . "\n";
    echo '<link rel="dns-prefetch" href="//www.google-analytics.com">' . "\n";
}, 1 );

// =============================================
// 4. LOGGED-OUT /MY-ACCOUNT LINK CONTRAST POLISH
// =============================================
add_action( 'wp_head', function() {
    if ( is_admin() || is_user_logged_in() ) return;
    if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) return;
    if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) return;
    if ( defined( 'WP_CLI' ) && WP_CLI ) return;
    if ( ! function_exists( 'is_account_page' ) || ! is_account_page() ) return;

    echo '<style id="mm-auth-ux-002-login-polish">'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .woocommerce-LostPassword a,'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .lost_password a{'
        . 'color:#0f2a44!important;font-weight:800;text-decoration:underline!important;'
        . 'text-decoration-thickness:1.5px!important;text-underline-offset:3px!important;'
        . 'transition:color 160ms ease,background-color 160ms ease,outline-color 160ms ease}'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .woocommerce-LostPassword a:hover,'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .lost_password a:hover,'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .woocommerce-LostPassword a:focus,'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .lost_password a:focus{'
        . 'color:#1b2f4a!important;background:rgba(15,42,68,.08)!important;'
        . 'border-radius:6px;text-decoration-color:#1b2f4a!important}'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .woocommerce-LostPassword a:focus-visible,'
        . 'body.woocommerce-account:not(.logged-in) #customer_login .lost_password a:focus-visible{'
        . 'outline:2px solid rgba(15,42,68,.45)!important;outline-offset:3px!important}'
        . '</style>' . "\n";
}, 200 );

// =============================================
// 5. PRELOAD LCP HERO + CLS PREVENTION CSS
// =============================================
add_action( 'wp_head', function() {
    if ( ! is_front_page() || is_user_logged_in() ) return;

    // Preload self-hosted hero background (WebP, 380KB vs 566KB Unsplash JPEG).
    // The output buffer rewrites the Unsplash URL in CSS to this local copy.
    echo '<link rel="preload" as="image" href="/wp-content/uploads/2026/06/hero-bg-optimized.webp" fetchpriority="high" type="image/webp">' . "\n";

    // CLS PREVENTION: Pin hero + container dimensions in earliest CSS.
    // The hero is pre-moved in the output buffer (see section 10) to match
    // the final DOM. This CSS ensures correct dimensions from first paint.
    echo '<style id="mm-cls-prevent">'
        . '.mm107-hero{display:flex!important;min-height:520px!important;'
        . 'padding:60px 0 56px;position:relative;overflow:hidden;'
        . 'align-items:center;width:100vw!important;max-width:100vw!important;'
        . 'margin-left:calc(-50vw + 50%)!important}'
        . '.elementor-element-mm0000e{display:none!important}'
        . '@media(max-width:767px){.mm107-hero{min-height:auto!important;'
        . 'padding:48px 0 44px;width:100%!important;max-width:100%!important;'
        . 'margin-left:0!important;align-items:flex-start}}'
        . '</style>' . "\n";
}, 1 );

// =============================================
// 6. REMOVE JQUERY MIGRATE (not needed for modern jQuery)
// =============================================
add_action( 'wp_default_scripts', function( $scripts ) {
    if ( is_admin() ) return;
    if ( isset( $scripts->registered['jquery'] ) ) {
        $script = $scripts->registered['jquery'];
        if ( $script->deps ) {
            $script->deps = array_diff( $script->deps, array( 'jquery-migrate' ) );
        }
    }
});

// =============================================
// 7. DISABLE WORDPRESS EMBEDS (saves 1 HTTP request)
// =============================================
add_action( 'wp_footer', function() {
    if ( is_admin() ) return;
    wp_deregister_script( 'wp-embed' );
});

// =============================================
// 8. DISABLE DASHICONS ON FRONTEND (for non-logged-in users)
// =============================================
add_action( 'wp_enqueue_scripts', function() {
    if ( ! is_user_logged_in() ) {
        wp_deregister_style( 'dashicons' );
    }
});

// =============================================
// 9. DISABLE UNUSED BLOCK STYLES (conservative)
// =============================================
add_action( 'wp_enqueue_scripts', function() {
    if ( is_user_logged_in() ) return;
    wp_dequeue_style( 'classic-theme-styles' );
}, 100 );

// =============================================
// 10. DISABLE HEARTBEAT ON FRONTEND
// =============================================
add_action( 'init', function() {
    if ( ! is_admin() ) {
        wp_deregister_script( 'heartbeat' );
    }
});

// =============================================
// 11. HTML OUTPUT BUFFER: FONTS + CLS FIXES + IMAGE FIXES
// =============================================
// Consolidates Google Fonts, fixes CLS-causing elements, adds image dimensions.

if ( ! is_admin() ) {
    add_action( 'template_redirect', function() {
        if ( is_user_logged_in() ) return;
        if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) return;
        if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) return;
        if ( defined( 'WP_CLI' ) && WP_CLI ) return;

        ob_start( 'mm_perf_output_buffer_handler' );
    });
}

function mm_perf_output_buffer_handler( $html ) {
    if ( empty( $html ) || strlen( $html ) < 500 ) return $html;

    // ---- FONT CONSOLIDATION ----

    // Remove ALL Google Fonts <link> tags (stylesheet and preload)
    $html = preg_replace( '/<link[^>]*href=[\'"][^"\']*fonts\.googleapis\.com\/css[^"\']*[\'"][^>]*>\s*/i', '', $html );

    // Remove noscript fallbacks for fonts
    $html = preg_replace( '/<noscript>\s*<link[^>]*fonts\.googleapis\.com[^>]*>\s*<\/noscript>\s*/i', '', $html );

    // Remove @import url() directives for Google Fonts
    $html = preg_replace( '/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\)\s*;/i', '', $html );

    // Remove ALL preconnect/dns-prefetch for fonts.googleapis
    $html = preg_replace( '/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/i', '', $html );

    // Build single combined Google Fonts URL
    $combined = 'https://fonts.googleapis.com/css2?'
        . 'family=Inter:wght@300;400;500;600;700;800;900'
        . '&family=Poppins:wght@300;400;500;600;700'
        . '&family=Oswald:wght@300;400;500;600;700'
        . '&family=Yanone+Kaffeesatz:wght@300;400;500;600;700'
        . '&family=Space+Grotesk:wght@400;500;600;700'
        . '&display=optional';

    // v3.3: Fonts loaded via JS after DOMContentLoaded to avoid CLS.
    $font_tags = "\n"
        . '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>' . "\n"
        . '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n"
        . '<script>addEventListener("DOMContentLoaded",function(){var l=document.createElement("link");l.rel="stylesheet";l.href="' . $combined . '";l.crossOrigin="anonymous";document.head.appendChild(l)});</script>' . "\n";

    $html = preg_replace( '/<head([^>]*)>/i', '<head$1>' . $font_tags, $html, 1 );

    // ---- MOVE BODY <style> BLOCKS TO START OF <body> ----
    // ROOT CAUSE of CLS 0.875: inline <style> blocks appear hundreds of
    // thousands of chars AFTER the elements they style. The browser
    // paints elements unstyled, then reflows when the late CSS parses.
    //
    // v3.3 hoisted ALL body styles into </head>, but that bloated the
    // head to 516KB causing progressive-rendering CLS (0.44).
    //
    // v3.4 fix: move body styles to right after <body> tag instead.
    // This keeps them BEFORE the elements they style (no late-parse CLS)
    // without bloating the head (no progressive-render CLS).
    $body_tag_match = preg_match( '/<body[^>]*>/i', $html, $body_match, PREG_OFFSET_CAPTURE );
    if ( $body_tag_match ) {
        $body_tag_end = $body_match[0][1] + strlen( $body_match[0][0] );
        $body_html = substr( $html, $body_tag_end );

        // Extract all <style> blocks from body content
        $collected_css = '';
        $body_html = preg_replace_callback(
            '/<style[^>]*>(.*?)<\/style>\s*/is',
            function( $matches ) use ( &$collected_css ) {
                $collected_css .= $matches[1] . "\n";
                return ''; // Remove from original position
            },
            $body_html
        );

        if ( ! empty( $collected_css ) ) {
            // Re-inject as single block at the very start of body
            $body_html = '<style id="mm-body-styles-early">' . $collected_css . '</style>' . "\n" . $body_html;
        }

        $html = substr( $html, 0, $body_tag_end ) . $body_html;
    }

    if ( is_front_page() ) {
        $html = mm_perf_strip_homepage_payload_bloat( $html );
    }

    if ( is_page( 5686 ) || is_page( 'mission-residency' ) ) {
        $html = mm_perf_strip_mission_residency_payload_bloat( $html );
    }

    // ---- PRE-MOVE HERO TO MATCH FINAL DOM (CLS FIX) ----
    // ROOT CAUSE: Elementor frontend JS moves section.mm107-hero from inside
    // its widget wrapper (c43967c, child of container 41b02fe) to be a direct
    // child of .elementor-3305 at ~600ms. This DOM manipulation shifts 41b02fe
    // from y=107,h=833 to y=767,h=173 causing CLS 0.43.
    // FIX: Do the same move server-side so the source HTML matches the final
    // DOM state. When JS runs, the hero is already in place = no shift.
    if ( preg_match( '/<section\s[^>]*class="mm107-hero"[^>]*>.*?<\/section>/is', $html, $hero_match, PREG_OFFSET_CAPTURE ) ) {
        $hero_html = $hero_match[0][0];
        $hero_pos  = $hero_match[0][1];

        // Find the .elementor-3305 container opening tag
        $e3305_pos = strpos( $html, 'class="elementor elementor-3305"' );
        if ( $e3305_pos !== false ) {
            $e3305_tag_end = strpos( $html, '>', $e3305_pos ) + 1;

            // Only move if hero is deeper inside the container (not already first child)
            if ( $hero_pos > $e3305_tag_end + 100 ) {
                // Remove hero from its current position
                $html = substr( $html, 0, $hero_pos ) . substr( $html, $hero_pos + strlen( $hero_html ) );
                // Insert as first child of .elementor-3305
                $html = substr( $html, 0, $e3305_tag_end ) . $hero_html . substr( $html, $e3305_tag_end );
            }
        }
    }

    // ---- REMOVE HIDDEN DUPLICATE HERO SECTION ----
    // Two <section class="mm107-hero"> exist; the hidden one (display:none)
    // can cause CLS if JS toggles it. Remove from DOM entirely.
    $html = preg_replace(
        '/<section[^>]*class=["\']mm107-hero["\'][^>]*style=["\'][^"\']*display\s*:\s*none[^"\']*["\'][^>]*>.*?<\/section>/is',
        '<!-- mm-perf: hidden hero removed -->',
        $html,
        1
    );

    // ---- IMAGE DIMENSION FIXES ----

    // ---- HERO IMAGE OPTIMIZATION ----
    // Replace Unsplash hero URL with self-hosted WebP (380KB vs 566KB JPEG).
    // Same-origin + Kinsta CDN edge = faster delivery + preload match.
    if ( strpos( $html, 'images.unsplash.com/photo-1579684385127-1ef15d508118' ) !== false ) {
        $html = preg_replace(
            '#https?://images\.unsplash\.com/photo-1579684385127-1ef15d508118[^"\')\s]*#',
            '/wp-content/uploads/2026/06/hero-bg-optimized.webp',
            $html
        );
    }

    // ---- IMAGE DIMENSION FIXES ----

    // Add width/height to Mission_Class_Screenshot (2560x1655)
    // GTmetrix flagged this for missing explicit dimensions (CLS contributor)
    if ( strpos( $html, 'Mission_Class_Screenshot' ) !== false ) {
        $html = preg_replace(
            '/(<img\s[^>]*src="[^"]*Mission_Class_Screenshot[^"]*-scaled\.png[^"]*"[^>]*?)(\s*\/?>)/i',
            '$1 width="2560" height="1655" $2',
            $html
        );
    }

    // Add width/height to footer logo (448x171 from filename)
    if ( strpos( $html, '448x171.png' ) !== false ) {
        $html = preg_replace(
            '/(<img\s[^>]*src="[^"]*448x171\.png[^"]*"[^>]*?)(\s*\/?>)/i',
            '$1 width="448" height="171" $2',
            $html
        );
    }

    // ---- HTML MINIFICATION (reduce 1.5MB payload) ----
    // Strip Elementor data-* attributes that are only used in the editor.
    // Keep data-id (used by frontend JS), data-element_type, data-widget_type.
    $html = preg_replace( '/\s+data-settings=\'[^\']*\'/i', '', $html );
    $html = preg_replace( '/\s+data-settings="[^"]*"/i', '', $html );

    // Remove HTML comments (except conditional IE comments and our markers)
    $html = preg_replace( '/<!--(?!\[if|<!|mm-perf)[^>]*?-->\s*/s', '', $html );

    // Collapse runs of whitespace between tags
    $html = preg_replace( '/>\s{2,}</', '> <', $html );

    // Remove blank lines
    $html = preg_replace( '/\n\s*\n/', "\n", $html );

    return $html;
}

// Prevent Elementor from enqueuing its own Google Fonts
add_filter( 'elementor/frontend/print_google_fonts', '__return_false' );

// =============================================
// 11. REMOVE ELEMENTOR FONT-AWESOME IF NOT USED
// =============================================
add_action( 'elementor/frontend/after_register_styles', function() {
    if ( is_user_logged_in() || is_admin() ) return;
    foreach ( array( 'elementor-icons-fa-solid', 'elementor-icons-fa-regular', 'elementor-icons-fa-brands' ) as $handle ) {
        wp_dequeue_style( $handle );
        wp_deregister_style( $handle );
    }
}, 20 );
