<?php
/**
 * Plugin Name: MissionMed ExamPrep Enrollment Experience
 * Description: Source-grounded ExamPrep enrollment hierarchy and sanitized Matrix Calendar schedule projection.
 * Version: 1.1.0
 */

defined( 'ABSPATH' ) || exit;

const MMEEP_VERSION = '1.1.0';
const MMEEP_PAGE_ID = 5687;

function mmeep_schedule_permission() {
	return true;
}

/**
 * Public read-only projection of system-authored Dr. J calendar sessions.
 * No meeting links, attendees, user identities, descriptions, or metadata are exposed.
 */
function mmeep_live_schedule() {
	global $wpdb;
	$table = $wpdb->prefix . 'mmed_events';
	$start = current_time( 'mysql', true );
	$end   = gmdate( 'Y-m-d H:i:s', strtotime( $start . ' +32 days' ) );
	$sql   = $wpdb->prepare(
		"SELECT id, event_type, title, start_at, end_at, category, meta_json
		FROM {$table}
		WHERE user_id = 0
		AND source = 'system'
		AND status = 'active'
		AND event_type IN ('drill_step1','drill_step23')
		AND category IN ('drill_step1','drill_step23')
		AND start_at >= %s
		AND start_at < %s
		ORDER BY start_at ASC
		LIMIT 40",
		$start,
		$end
	);
	$rows = $wpdb->get_results( $sql, ARRAY_A );
	$events = array();
	foreach ( (array) $rows as $row ) {
		$meta = json_decode( (string) $row['meta_json'], true );
		if ( ! is_array( $meta ) || empty( $meta['drj_default'] ) ) {
			continue;
		}
		$events[] = array(
			'id'    => absint( $row['id'] ),
			'title' => sanitize_text_field( (string) $row['title'] ),
			'topic' => sanitize_text_field( (string) ( $meta['topic'] ?? '' ) ),
			'track' => sanitize_text_field( (string) ( $meta['subtitle'] ?? ( 'drill_step1' === $row['event_type'] ? 'Step 1 / COMLEX Level 1' : 'Step 2 & 3 / COMLEX Level 2 & 3' ) ) ),
			'start' => gmdate( 'c', strtotime( $row['start_at'] . ' UTC' ) ),
			'end'   => gmdate( 'c', strtotime( $row['end_at'] . ' UTC' ) ),
		);
	}
	$response = rest_ensure_response(
		array(
			'events'          => $events,
			'timezone_source' => 'UTC',
			'display_rule'    => 'Browser local time',
			'generated_at'    => gmdate( 'c' ),
		)
	);
	$response->header( 'Cache-Control', 'public, max-age=60, s-maxage=60' );
	return $response;
}

function mmeep_register_routes() {
	register_rest_route(
		'missionmed/v1',
		'/examprep/live-schedule',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'mmeep_live_schedule',
			'permission_callback' => 'mmeep_schedule_permission',
		)
	);
}
add_action( 'rest_api_init', 'mmeep_register_routes' );

function mmeep_is_courses_page() {
	return ! is_admin() && function_exists( 'is_page' ) && is_page( MMEEP_PAGE_ID );
}

function mmeep_render_enrollment_experience() {
	if ( ! mmeep_is_courses_page() ) {
		return;
	}
	$schedule_url = rest_url( 'missionmed/v1/examprep/live-schedule' );
	$daily_image  = wp_get_attachment_image_url( 9136, 'full' );
	$arena_image  = wp_get_attachment_image_url( 9137, 'full' );
	?>
	<style id="mmeep-styles">
		:root{--ep-navy:#061a31;--ep-navy2:#0a2748;--ep-panel:#102f53;--ep-gold:#e1b34f;--ep-teal:#55e4ce;--ep-ink:#f4f8fc;--ep-muted:#b9c8d9;--ep-line:rgba(225,179,79,.3)}
		body.page-id-5687 #mm-mobile-notice{display:none!important}
		.mm0921{background:var(--ep-navy);color:var(--ep-ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
		.mm0921 *{box-sizing:border-box}.mm0921 a{color:inherit}.mm0921-shell{width:min(1180px,calc(100% - 40px));margin:auto}.mm0921-eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--ep-gold);font-weight:800;font-size:12px;letter-spacing:.16em;text-transform:uppercase}.mm0921-eyebrow:before{content:"";width:30px;height:2px;background:var(--ep-gold)}
		.mm0921-hero{position:relative;isolation:isolate;padding:92px 0 66px;background:linear-gradient(90deg,rgba(5,21,39,.99) 0%,rgba(6,27,51,.96) 48%,rgba(7,31,57,.78) 100%),linear-gradient(145deg,#051527,#0a2a4d)}.mm0921-hero:before{content:"";position:absolute;z-index:-1;inset:0 0 0 46%;background-image:linear-gradient(90deg,#061b33 0%,rgba(6,27,51,.34) 34%,rgba(6,27,51,.2) 100%),var(--mmeep-hero-image);background-position:center;background-size:cover;opacity:.46;filter:saturate(.88) contrast(1.08)}.mm0921-hero:after{content:"";position:absolute;inset:auto 0 0;height:1px;background:linear-gradient(90deg,transparent,var(--ep-gold),transparent)}.mm0921-hero-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:52px;align-items:center}.mm0921 h1{margin:18px 0 18px;font-size:clamp(44px,6vw,78px);line-height:.98;letter-spacing:-.045em;color:#fff}.mm0921 h1 em{display:block;color:var(--ep-gold);font-style:normal}.mm0921-lede{max-width:720px;margin:0;color:#e6eef6;font-size:19px;line-height:1.7}.mm0921-hero-card{padding:28px;border:1px solid rgba(225,179,79,.48);border-radius:24px;background:linear-gradient(150deg,rgba(17,48,82,.94),rgba(4,20,38,.97));box-shadow:0 28px 70px rgba(0,0,0,.38);backdrop-filter:blur(8px)}.mm0921-hero-card strong{display:block;font-size:20px}.mm0921-hero-card ul{display:grid;gap:13px;margin:20px 0 0;padding:0;list-style:none;color:#dce7f1}.mm0921-hero-card li{display:flex;gap:10px}.mm0921-hero-card li:before{content:"✓";color:var(--ep-teal);font-weight:900}
		.mm0921-paths{padding:54px 0 74px}.mm0921-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#041322}.mm0921-tab{min-height:58px;border:0;border-radius:12px;background:transparent;color:#aebed0;font:800 13px/1 Inter,sans-serif;letter-spacing:.13em;text-transform:uppercase;cursor:pointer}.mm0921-tab[aria-selected="true"]{background:linear-gradient(135deg,var(--ep-gold),#f0cb6c);color:#07182b;box-shadow:0 10px 26px rgba(225,179,79,.25)}.mm0921-panel{display:none;padding-top:34px}.mm0921-panel.is-active{display:block}.mm0921-product-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:24px}.mm0921-card{border:1px solid rgba(255,255,255,.13);border-radius:22px;background:linear-gradient(155deg,rgba(18,48,82,.94),rgba(7,27,49,.96));overflow:hidden}.mm0921-card-body{padding:30px}.mm0921-card h2,.mm0921-section h2{margin:8px 0 12px;color:#fff;font-size:clamp(30px,4vw,46px);line-height:1.05;letter-spacing:-.035em}.mm0921-price{display:flex;align-items:baseline;gap:8px;margin:20px 0;color:var(--ep-gold)}.mm0921-price b{font-size:45px;letter-spacing:-.04em}.mm0921-price span{color:var(--ep-muted)}.mm0921-badge{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(85,228,206,.12);color:var(--ep-teal);font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.mm0921-list{display:grid;gap:12px;margin:22px 0;padding:0;list-style:none;color:#d5e0eb}.mm0921-list li{padding-left:26px;position:relative}.mm0921-list li:before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--ep-teal);box-shadow:0 0 0 4px rgba(85,228,206,.1)}
		.mm0921-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.mm0921-btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 21px;border:1px solid var(--ep-gold);border-radius:10px;text-decoration:none!important;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.mm0921-btn--primary{background:linear-gradient(135deg,var(--ep-gold),#f0c964);color:#07182b!important}.mm0921-btn--ghost{color:#fff!important}.mm0921-btn:focus-visible,.mm0921-tab:focus-visible,.mm0921-faq summary:focus-visible{outline:3px solid var(--ep-teal);outline-offset:4px}.mm0921-note{margin-top:18px;padding:14px 16px;border-left:3px solid var(--ep-gold);background:rgba(225,179,79,.08);color:#cad7e5;font-size:14px;line-height:1.55}
		.mm0921-schedule{padding:30px}.mm0921-schedule-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.mm0921-schedule-head h3{margin:5px 0;color:#fff;font-size:24px}.mm0921-schedule-head a{color:var(--ep-gold);font-weight:800;font-size:12px;text-transform:uppercase}.mm0921-events{display:grid;gap:10px;margin-top:18px}.mm0921-event{display:grid;grid-template-columns:82px 1fr;gap:14px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(1,14,28,.42)}.mm0921-event time{color:var(--ep-gold);font-weight:800;font-size:12px;text-transform:uppercase}.mm0921-event b{display:block;color:#fff;font-size:15px}.mm0921-event small{color:var(--ep-muted)}.mm0921-schedule-status{padding:22px;border:1px dashed rgba(255,255,255,.2);border-radius:14px;color:var(--ep-muted)}
		.mm0921-media-card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.mm0921-media-card .mm0921-card-body{padding:24px 26px}.mm0921-on-demand-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:24px}.mm0921-lock{position:relative;border-color:rgba(225,179,79,.42);background:linear-gradient(155deg,rgba(19,45,73,.98),rgba(7,23,40,.98))}.mm0921-lock img{filter:saturate(.62) brightness(.68)}.mm0921-lock-mark{display:inline-flex;gap:8px;align-items:center;color:#f3ca6d;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.mm0921-lock .mm0921-section-intro{color:#d2deea}.mm0921-mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.mm0921-mini{padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:rgba(255,255,255,.035)}.mm0921-mini b{display:block;color:#fff;margin-bottom:5px}.mm0921-mini span{color:var(--ep-muted);font-size:14px;line-height:1.45}
		.mm0921-services{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.mm0921-service{padding:25px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(13,43,75,.8)}.mm0921-service h3{margin:10px 0;color:#fff;font-size:23px}.mm0921-service p{color:var(--ep-muted);line-height:1.55}.mm0921-service .mm0921-price b{font-size:34px}
		.mm0921-section{padding:76px 0;border-top:1px solid rgba(255,255,255,.08)}.mm0921-section--alt{background:#041525}.mm0921-section-intro{max-width:760px;margin-bottom:34px;color:var(--ep-muted);font-size:17px;line-height:1.65}.mm0921-compare{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.mm0921-compare article{padding:26px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:linear-gradient(180deg,rgba(18,52,88,.88),rgba(6,24,44,.94))}.mm0921-compare h3{margin:8px 0 18px;color:#fff;font-size:23px}.mm0921-fact{padding:12px 0;border-top:1px solid rgba(255,255,255,.09)}.mm0921-fact small{display:block;color:#7f96ae;font-weight:800;text-transform:uppercase;letter-spacing:.09em}.mm0921-fact span{display:block;margin-top:5px;color:#eef5fb;line-height:1.45}
		.mm0921-method{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.mm0921-method article{position:relative;min-height:190px;padding:25px;border:1px solid var(--ep-line);border-radius:20px;background:linear-gradient(155deg,#10375d,#071d35)}.mm0921-method .num{color:var(--ep-gold);font-size:12px;font-weight:900;letter-spacing:.16em}.mm0921-method h3{margin:28px 0 9px;color:#fff;font-size:23px}.mm0921-method p{margin:0;color:var(--ep-muted);line-height:1.55}.mm0921-method-note{margin-top:22px;padding:22px;border-radius:16px;background:rgba(85,228,206,.07);color:#d5e4ed;line-height:1.65}
		.mm0921-faq{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.mm0921-faq details{border:1px solid rgba(255,255,255,.12);border-radius:15px;background:rgba(10,39,72,.55)}.mm0921-faq summary{padding:18px 20px;color:#fff;font-weight:800;cursor:pointer}.mm0921-faq p{margin:0;padding:0 20px 20px;color:var(--ep-muted);line-height:1.65}.mm0921-final{padding:68px 0;text-align:center;background:radial-gradient(circle at 50% 0,rgba(225,179,79,.18),transparent 48%),#061a31}.mm0921-final p{max-width:680px;margin:0 auto 24px;color:var(--ep-muted)}.mm0921-final .mm0921-actions{justify-content:center}
		@media(max-width:900px){.mm0921-hero:before{inset:0;background-image:linear-gradient(180deg,rgba(5,21,39,.97) 0%,rgba(6,27,51,.86) 58%,rgba(6,27,51,.96) 100%),var(--mmeep-hero-image);opacity:.36}.mm0921-hero-grid,.mm0921-product-grid,.mm0921-on-demand-grid{grid-template-columns:1fr}.mm0921-services,.mm0921-compare{grid-template-columns:1fr}.mm0921-method{grid-template-columns:repeat(2,1fr)}}
		@media(max-width:600px){.mm0921-shell{width:min(100% - 28px,1180px)}.mm0921-hero{padding:60px 0 45px}.mm0921 h1{font-size:45px}.mm0921-lede{font-size:17px}.mm0921-tabs{grid-template-columns:1fr}.mm0921-tab{min-height:49px}.mm0921-card-body,.mm0921-schedule{padding:21px}.mm0921-mini-grid,.mm0921-method,.mm0921-faq{grid-template-columns:1fr}.mm0921-actions{display:grid}.mm0921-btn{width:100%}.mm0921-event{grid-template-columns:1fr}.mm0921-section{padding:58px 0}.mm0921-services{grid-template-columns:1fr}.mm0921-price b{font-size:39px}body.page-id-5687 .mm-ep-stickybar{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding:8px 10px!important;min-height:62px!important;height:auto!important}body.page-id-5687 .mm-ep-stickybar-msg{display:none!important}body.page-id-5687 .mm-ep-stickybtn{min-width:0!important;min-height:44px!important;padding:10px 8px!important;font-size:11px!important;text-align:center!important}}
	</style>
	<template id="mmeep-template">
		<main class="mm-pg mm0921" data-mmeep-version="<?php echo esc_attr( MMEEP_VERSION ); ?>">
			<section class="mm0921-hero" style="--mmeep-hero-image:url('<?php echo esc_url( $arena_image ); ?>')">
				<div class="mm0921-shell mm0921-hero-grid">
					<div><span class="mm0921-eyebrow">MissionMed ExamPrep</span><h1>Train the way <em>you will perform.</em></h1><p class="mm0921-lede">Choose live coaching, on-demand Daily Rounds, or focused 1-on-1 work. Each path is distinct, transparent, and built around Dr. J’s active reasoning method—not passive question-count chasing.</p><div class="mm0921-actions"><a class="mm0921-btn mm0921-btn--primary" href="#training-paths">Compare your paths</a><a class="mm0921-btn mm0921-btn--ghost" href="/product/team-drilling-sessions/">Start Live Drills</a></div></div>
					<aside class="mm0921-hero-card"><span class="mm0921-badge">Choose with confidence</span><strong>Three clear ways to train</strong><ul><li>Live Drills: structure, participation, and real-time correction</li><li>Daily Rounds: on-demand Arena practice at your pace</li><li>1-on-1: private work on a specific gap or plan</li></ul></aside>
				</div>
			</section>

			<section class="mm0921-paths" id="training-paths">
				<div class="mm0921-shell">
					<div class="mm0921-tabs" role="tablist" aria-label="ExamPrep enrollment paths">
						<button class="mm0921-tab" id="mmeep-tab-live" role="tab" aria-selected="true" aria-controls="mmeep-panel-live" data-panel="live">Live Training</button>
						<button class="mm0921-tab" id="mmeep-tab-demand" role="tab" aria-selected="false" aria-controls="mmeep-panel-demand" data-panel="demand">On-Demand</button>
						<button class="mm0921-tab" id="mmeep-tab-private" role="tab" aria-selected="false" aria-controls="mmeep-panel-private" data-panel="private">1-on-1</button>
					</div>

					<div class="mm0921-panel is-active" id="mmeep-panel-live" role="tabpanel" aria-labelledby="mmeep-tab-live">
						<div class="mm0921-product-grid">
							<article class="mm0921-card"><div class="mm0921-card-body"><span class="mm0921-eyebrow">Live Training</span><h2>Live Group Drilling</h2><span class="mm0921-badge">First week free</span><div class="mm0921-price"><b>$300</b><span>/ month after trial</span></div><p class="mm0921-section-intro">Work questions out loud with Dr. J, get corrected in the moment, and build a repeatable reasoning process with the accountability of a live group.</p><ul class="mm0921-list"><li>Live weekday drilling for Step/Level 1 and Step/Level 2/3</li><li>Active participation, guided technique, and immediate coaching</li><li>Structured repetition with audios and notes</li><li>One free week: up to five consecutive weekday sessions</li></ul><div class="mm0921-note"><strong>Trial terms:</strong> card required at checkout. Cancel before the 7-day trial ends to avoid the first $300 charge. If you continue, the subscription renews monthly from the first billing date.</div><div class="mm0921-note"><strong>Optional:</strong> add the same Daily Rounds access normally $99.99/month for $19.99/month while eligible for Live Drills. The option is never preselected and appears on the Live enrollment page.</div><div class="mm0921-actions"><a class="mm0921-btn mm0921-btn--primary" href="/product/team-drilling-sessions/">Start free week</a><a class="mm0921-btn mm0921-btn--ghost" href="#live-schedule">View schedule</a></div></div></article>
							<aside class="mm0921-card mm0921-schedule" id="live-schedule"><div class="mm0921-schedule-head"><div><span class="mm0921-eyebrow">Matrix Calendar</span><h3>Upcoming Live Drills</h3></div><a href="/member-dashboard/#calendar">Open calendar</a></div><p style="color:var(--ep-muted);font-size:14px">Published Matrix events, shown in your local time.</p><div class="mm0921-events" data-mmeep-events><div class="mm0921-schedule-status">Loading the next published sessions…</div></div></aside>
						</div>
					</div>

					<div class="mm0921-panel" id="mmeep-panel-demand" role="tabpanel" aria-labelledby="mmeep-tab-demand" hidden>
						<div class="mm0921-on-demand-grid">
							<article class="mm0921-card mm0921-media-card"><img src="<?php echo esc_url( $daily_image ); ?>" alt="Dr. J Daily Rounds on-demand player with video prompt, scoring controls, and performance panel"><div class="mm0921-card-body"><span class="mm0921-eyebrow">On-Demand</span><h2>Drills: Daily Rounds</h2><div class="mm0921-price"><b>$99.99</b><span>/ month</span></div><p class="mm0921-section-intro">Enter Arena for focused topic rounds with Dr. J video prompts, self-marked answer controls, pressure modes, and visible performance feedback.</p><div class="mm0921-mini-grid"><div class="mm0921-mini"><b>Practice actively</b><span>Lock in Correct, Missed, or Out of Time as you work.</span></div><div class="mm0921-mini"><b>Adjust pressure</b><span>Use Normal, Fast, or Extreme modes inside the current player.</span></div><div class="mm0921-mini"><b>See the pattern</b><span>Revisit focused topic prompts to reinforce recognition.</span></div><div class="mm0921-mini"><b>Track the round</b><span>Performance counters and progress stay visible while training.</span></div></div><div class="mm0921-note">Daily Rounds access only. Live Dr. J sessions, STAT, TournaMed, and Arena Pro tools are not included.</div><div class="mm0921-actions"><a class="mm0921-btn mm0921-btn--primary" href="/product/dr-j-drills-on-call/">Choose Daily Rounds</a></div></div></article>
							<article class="mm0921-card mm0921-media-card mm0921-lock"><img src="<?php echo esc_url( $arena_image ); ?>" alt="MissionMed Arena lobby preview for the future Arena Pro tier"><div class="mm0921-card-body"><span class="mm0921-lock-mark">🔒 Locked preview</span><h2>ExamPrep: Arena Pro</h2><div class="mm0921-price"><b>$149.99</b><span>/ month when released</span></div><p class="mm0921-section-intro">The broader premium Arena tier is visible for what is coming next, but checkout and premium entitlements remain disabled.</p><span class="mm0921-btn mm0921-btn--ghost" role="link" aria-disabled="true">Coming Soon</span></div></article>
						</div>
					</div>

					<div class="mm0921-panel" id="mmeep-panel-private" role="tabpanel" aria-labelledby="mmeep-tab-private" hidden>
						<div class="mm0921-services">
							<article class="mm0921-service"><span class="mm0921-eyebrow">Private Coaching</span><h3>Master Level Tutoring</h3><div class="mm0921-price"><b>$85</b><span>/ hour</span></div><p>Bring the reasoning gap or topic that keeps stopping you. Dr. J works it with you privately in real time.</p><a class="mm0921-btn mm0921-btn--primary" href="/product/1-on-1-tutoring-master-level/">Book a session</a></article>
							<article class="mm0921-service"><span class="mm0921-eyebrow">Private Package</span><h3>10 Full Sessions</h3><div class="mm0921-price"><b>$800</b><span>one time</span></div><p>Ten one-hour private tutoring sessions for students who want a sustained, targeted coaching arc.</p><a class="mm0921-btn mm0921-btn--primary" href="/product/dr-j-tutoring-10-full-sessions/">Choose 10 sessions</a></article>
							<article class="mm0921-service"><span class="mm0921-eyebrow">Planning</span><h3>Study Planning</h3><div class="mm0921-price"><b>$50</b><span>/ 30 minutes</span></div><p>A focused planning session for priorities, sequencing, workload, and recovery—not a tutoring hour.</p><a class="mm0921-btn mm0921-btn--primary" href="/product/dr-j-study-planning-30-minutes/">Build my plan</a></article>
						</div>
					</div>
				</div>
			</section>

			<section class="mm0921-section mm0921-section--alt"><div class="mm0921-shell"><span class="mm0921-eyebrow">Compare the experience</span><h2>Different formats. One active method.</h2><p class="mm0921-section-intro">No artificial winner badge. Choose based on whether you need live accountability, on-demand repetition, or private focus.</p><div class="mm0921-compare">
				<article><span class="mm0921-badge">Live Training</span><h3>Live Group Drilling</h3><div class="mm0921-fact"><small>Format</small><span>Live weekday group sessions with Dr. J</span></div><div class="mm0921-fact"><small>Accountability</small><span>Answer aloud, participate, receive immediate correction</span></div><div class="mm0921-fact"><small>Resources</small><span>Live drills, audios, notes; Daily Rounds optional at $19.99/month</span></div><div class="mm0921-fact"><small>Investment</small><span>First week free, then $300/month</span></div><div class="mm0921-fact"><small>Best suited for</small><span>Students who want structure, repetition, and real-time coaching</span></div></article>
				<article><span class="mm0921-badge">On-Demand</span><h3>Daily Rounds</h3><div class="mm0921-fact"><small>Format</small><span>On-demand focused rounds inside Arena</span></div><div class="mm0921-fact"><small>Accountability</small><span>Self-directed practice with visible scoring and pressure modes</span></div><div class="mm0921-fact"><small>Resources</small><span>Daily Rounds only; no Live sessions, STAT, TournaMed, or Arena Pro</span></div><div class="mm0921-fact"><small>Investment</small><span>$99.99/month standalone</span></div><div class="mm0921-fact"><small>Best suited for</small><span>Students who need flexible, repeatable practice on their own schedule</span></div></article>
				<article><span class="mm0921-badge">1-on-1</span><h3>Private Work</h3><div class="mm0921-fact"><small>Format</small><span>Private tutoring or a focused study-planning session</span></div><div class="mm0921-fact"><small>Accountability</small><span>Direct coaching around your specific gap or plan</span></div><div class="mm0921-fact"><small>Options</small><span>$85/hour, $800 for ten sessions, $50/30-minute planning</span></div><div class="mm0921-fact"><small>Schedule</small><span>By appointment</span></div><div class="mm0921-fact"><small>Best suited for</small><span>Students who need targeted diagnosis or a personalized plan</span></div></article>
			</div></div></section>

			<section class="mm0921-section"><div class="mm0921-shell"><span class="mm0921-eyebrow">How Dr. J wants you to study</span><h2>Learn the pattern. Drill it. Repeat it. Test it.</h2><p class="mm0921-section-intro">Dr. J’s approach prioritizes quality over quantity: use questions as learning tools, examine why an answer was missed, revisit patterns, and separate deliberate studying from deliberate testing.</p><div class="mm0921-method"><article><span class="num">01 · LEARN</span><h3>Learn the pattern</h3><p>Build a topic list, work questions in reverse, and connect clues to the clinical presentation.</p></article><article><span class="num">02 · DRILL</span><h3>Drill it</h3><p>Practice recognizing the presentation and choosing the answer efficiently—without pretending drilling is the full exam process.</p></article><article><span class="num">03 · REPEAT</span><h3>Repeat it</h3><p>Revisit audios, notes, and question patterns. Finishing a bank is not the goal; durable recognition is.</p></article><article><span class="num">04 · TEST</span><h3>Test it</h3><p>Use planned testing periods to measure technique, knowledge, and confidence under pressure.</p></article></div><div class="mm0921-method-note">Study plans should adapt to the student, the exam date, and real life. Dr. J also emphasizes active participation, planned recovery, and a day off instead of building an endless backlog of “makeup” work.</div></div></section>

			<section class="mm0921-section mm0921-section--alt"><div class="mm0921-shell"><span class="mm0921-eyebrow">Straight answers</span><h2>ExamPrep FAQ</h2><div class="mm0921-faq">
				<details><summary>What is the difference between Live Drills and Daily Rounds?</summary><p>Live Drills are scheduled group sessions with Dr. J, live participation, accountability, and real-time correction. Daily Rounds are self-directed, on-demand drills inside Arena.</p></details>
				<details><summary>What do Live students pay for Daily Rounds?</summary><p>Eligible active Live Drills students may add Daily Rounds for $19.99/month. The add-on is optional and not preselected.</p></details>
				<details><summary>Can I buy Daily Rounds without Live Drills?</summary><p>Yes. Standalone Daily Rounds access is $99.99/month.</p></details>
				<details><summary>What exactly is Daily Rounds?</summary><p>It is the current on-demand Drills mode inside Arena, with Dr. J video prompts, answer-state controls, pressure modes, topic focus, progress, and performance feedback.</p></details>
				<details><summary>What is Arena Pro?</summary><p>Arena Pro is the planned $149.99/month premium digital ExamPrep tier. It is visible as a locked preview and cannot be purchased yet.</p></details>
				<details><summary>Are STAT or TournaMed included with Daily Rounds?</summary><p>No. Standalone Daily Rounds and the Live student add-on grant Daily Rounds only. STAT, TournaMed, and other Arena Pro tools remain locked unless separately entitled.</p></details>
				<details><summary>How does Dr. J recommend drilling?</summary><p>Connect the correct answer to the presentation and pattern, then move efficiently. Drilling is pattern practice; it is not the same as fully answering every real exam question.</p></details>
				<details><summary>What does “quality over quantity” mean?</summary><p>Deeply examine a smaller set of questions, the wording, the clues, and why you missed them instead of treating question-bank completion as the goal.</p></details>
				<details><summary>How does Live Drills help with accountability?</summary><p>You participate, answer aloud, and receive immediate guidance in a structured group environment rather than studying alone without feedback.</p></details>
				<details><summary>How often does Live meet?</summary><p>Published weekday sessions and topics are shown above directly from Matrix Calendar. Open Matrix Calendar for the complete current schedule.</p></details>
				<details><summary>Is there a free trial?</summary><p>Yes. Live Group Drilling has one free week—up to five consecutive weekday sessions. A card is required. Cancel before the 7-day trial ends to avoid the first $300 charge.</p></details>
				<details><summary>What if I need 1-on-1 help?</summary><p>Choose Master Level Tutoring at $85/hour for a private session focused on a specific reasoning gap.</p></details>
				<details><summary>What is the 10-session option?</summary><p>It is a one-time $800 package covering ten full one-hour private tutoring sessions with Dr. J.</p></details>
				<details><summary>How might a study week be structured?</summary><p>Dr. J adapts plans to the student and exam proximity, often moving between one-, two-, and three-topic days, with repeated audio, notes, questions, planned testing, and recovery time.</p></details>
				<details><summary>Must I finish an entire question bank?</summary><p>No. Dr. J explicitly teaches that finishing a bank does not guarantee a pass. The aim is to learn patterns, technique, and why answers were missed.</p></details>
				<details><summary>Are there special Daily Rounds rates?</summary><p>Approved Exam Guarantee, UCC, and MUL students may receive a private account-bound $49.99/month offer from Dr. J. It is not a public coupon or general discount.</p></details>
			</div></div></section>

			<section class="mm0921-final"><div class="mm0921-shell"><span class="mm0921-eyebrow">Ready when you are</span><h2>Choose the training that fits the work ahead.</h2><p>Live structure, on-demand repetition, or private focus—every path is clear before checkout.</p><div class="mm0921-actions"><a class="mm0921-btn mm0921-btn--primary" href="/product/team-drilling-sessions/">Start Live Drills</a><a class="mm0921-btn mm0921-btn--ghost" href="/product/dr-j-drills-on-call/">Choose Daily Rounds</a><a class="mm0921-btn mm0921-btn--ghost" href="/product/1-on-1-tutoring-master-level/">Book 1-on-1</a></div></div></section>
		</main>
	</template>
	<script id="mmeep-script">
	(function(){
		var endpoint=<?php echo wp_json_encode( $schedule_url ); ?>;
		function mount(){
			if(document.querySelector('.mm0921'))return true;
			var template=document.getElementById('mmeep-template');
			var old=document.querySelector('.mm-pg');
			var host=document.querySelector('.elementor.elementor-<?php echo absint( MMEEP_PAGE_ID ); ?>')||document.querySelector('main.site-main')||document.querySelector('main');
			if(!template||(!old&&!host))return false;
			var root=template.content.firstElementChild.cloneNode(true);
			if(old){old.replaceWith(root);}else{Array.from(host.children).forEach(function(child){if(child!==template){child.style.display='none';}});host.appendChild(root);}
			wireTabs(root);loadSchedule(root);repairSticky();
			return true;
		}
		function wireTabs(root){
			var tabs=Array.from(root.querySelectorAll('[role="tab"]'));
			tabs.forEach(function(tab){tab.addEventListener('click',function(){var name=tab.dataset.panel;tabs.forEach(function(t){var selected=t===tab;t.setAttribute('aria-selected',selected?'true':'false');});root.querySelectorAll('[role="tabpanel"]').forEach(function(panel){var active=panel.id==='mmeep-panel-'+name;panel.hidden=!active;panel.classList.toggle('is-active',active);});});tab.addEventListener('keydown',function(e){if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();var i=tabs.indexOf(tab);tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length].focus();});});
		}
		function loadSchedule(root){
			var target=root.querySelector('[data-mmeep-events]');if(!target)return;
			fetch(endpoint,{credentials:'omit',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw new Error('schedule');return r.json();}).then(function(data){var events=Array.isArray(data.events)?data.events.slice(0,8):[];if(!events.length){target.innerHTML='<div class="mm0921-schedule-status">No published Live Drills sessions are available in the next 32 days. Check Matrix Calendar for updates.</div>';return;}target.innerHTML=events.map(function(event){var start=new Date(event.start),end=new Date(event.end);var day=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(start);var time=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(start);var title=escapeHtml(event.topic||event.title);return '<article class="mm0921-event"><time datetime="'+escapeHtml(event.start)+'">'+escapeHtml(day)+'<br>'+escapeHtml(time)+'</time><div><b>'+title+'</b><small>'+escapeHtml(event.track||'Live Drills')+'</small></div></article>';}).join('');}).catch(function(){target.innerHTML='<div class="mm0921-schedule-status">The public schedule is temporarily unavailable. <a href="/member-dashboard/#calendar">Open Matrix Calendar</a> for the current sessions.</div>';});
		}
		function escapeHtml(value){var d=document.createElement('div');d.textContent=String(value||'');return d.innerHTML;}
		function repairSticky(){var bar=document.querySelector('.mm-ep-stickybar');if(!bar)return;var msg=bar.querySelector('.mm-ep-stickybar-msg');var links=bar.querySelectorAll('a');if(msg)msg.innerHTML='<small>MissionMed ExamPrep</small>Live • On-Demand • 1-on-1';if(links[0]){links[0].href='#training-paths';links[0].textContent='Explore Programs';}if(links[1]){links[1].href='/product/dr-j-drills-on-call/';links[1].textContent='Daily Rounds';}}
		var tries=0;function start(){if(mount())return;if(++tries<40)setTimeout(start,50);}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}setTimeout(repairSticky,500);
	})();
	</script>
	<?php
}
add_action( 'wp_footer', 'mmeep_render_enrollment_experience', 99999 );
