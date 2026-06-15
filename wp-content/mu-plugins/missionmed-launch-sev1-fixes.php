<?php
/**
 * Plugin Name: MissionMed Launch SEV1 Fixes
 * Description: Surgical public launch fixes for legal pages, SEO descriptions, naming, pricing copy, and trust leaks.
 * Author: MissionMed
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_launch_sev1_is_frontend' ) ) {
	function mm_launch_sev1_is_frontend() {
		return ! is_admin() && ! wp_doing_ajax();
	}
}

if ( ! function_exists( 'mm_launch_sev1_request_slug' ) ) {
	function mm_launch_sev1_request_slug() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		$path        = is_string( $path ) ? strtolower( trim( $path, '/' ) ) : '';
		return '' === $path ? 'home' : $path;
	}
}

if ( ! function_exists( 'mm_launch_sev1_slug_is' ) ) {
	function mm_launch_sev1_slug_is( $slugs ) {
		$current = mm_launch_sev1_request_slug();
		foreach ( (array) $slugs as $slug ) {
			if ( $current === strtolower( trim( (string) $slug, '/' ) ) ) {
				return true;
			}
		}
		return false;
	}
}

if ( ! function_exists( 'mm_launch_sev1_meta_descriptions' ) ) {
	function mm_launch_sev1_meta_descriptions() {
		return array(
			'home'                       => 'MissionMed Institute helps IMG and medical students prepare for residency, interviews, USMLE/COMLEX exams, USCE, and clinical reasoning.',
			'mission-residency'          => 'Residency strategy for IMGs and reapplicants: IV Prep Essentials, Match Prep Pro, and 360 Match Mentorship with Dr. Brian and MatchFirst options.',
			'examprep'                   => 'MissionMed ExamPrep builds live USMLE and COMLEX reasoning through team drills, question analysis, quizzes, notes, feedback, and coaching support.',
			'examprep/courses'           => 'Choose MissionMed ExamPrep subscriptions for weekly live drilling, async quizzes, notes, coaching, and USMLE or COMLEX study support.',
			'usce'                       => 'Request USCE and clinical placement guidance from MissionMed: rotation fit, availability, documentation, next steps, and support for IMG applicants.',
			'homepage-arena'             => 'MissionMed Arena helps students practice medicine through drills, duels, timed rounds, streaks, notes, MEDPASS progress, and free profile access.',
			'mission-residency-courses'  => 'Compare Mission Residency courses, pricing, MatchFirst options, and enrollment paths for IV Prep Essentials, Match Prep Pro, and 360 Mentorship today.',
			'compare-programs'           => 'Compare IV Prep Essentials, Match Prep Pro, and 360 Match Mentorship by fit, features, pricing, guarantee, and MatchFirst payment options today online.',
			'red-flag-match-stories'     => 'Read real IMG match stories from applicants with exam attempts, old YOG, failed cycles, visa concerns, and other red flags MissionMed helps fix today.',
			'contact'                    => 'Contact MissionMed Institute about residency advising, ExamPrep, USCE clinical placements, Arena accounts, enrollment, payments, and student support.',
			'privacy-policy'             => 'Learn how MissionMed Institute handles student accounts, payments, communications, uploaded files, analytics, cookies, SMS, and privacy requests.',
			'terms-of-agreement'         => 'Review MissionMed Institute terms for programs, accounts, payments, course access, clinical placement inquiries, Arena, ExamPrep, and USCE services.',
			'refund-cancellation-policy' => 'Review MissionMed Institute refund and cancellation terms for programs, MatchFirst, ExamPrep, USCE inquiries, payments, course access, and support.',
		);
	}
}

if ( ! function_exists( 'mm_launch_sev1_current_meta_description' ) ) {
	function mm_launch_sev1_current_meta_description() {
		$descriptions = mm_launch_sev1_meta_descriptions();
		$slug         = mm_launch_sev1_request_slug();
		return isset( $descriptions[ $slug ] ) ? $descriptions[ $slug ] : '';
	}
}

if ( ! function_exists( 'mm_launch_sev1_filter_meta_description' ) ) {
	function mm_launch_sev1_filter_meta_description( $description ) {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return $description;
		}
		$fixed = mm_launch_sev1_current_meta_description();
		return '' !== $fixed ? $fixed : $description;
	}
}

add_filter( 'wpseo_metadesc', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );
add_filter( 'wpseo_opengraph_desc', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );
add_filter( 'wpseo_twitter_description', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );
add_filter( 'rank_math/frontend/description', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );
add_filter( 'rank_math/opengraph/facebook/description', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );
add_filter( 'rank_math/opengraph/twitter/description', 'mm_launch_sev1_filter_meta_description', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_canonicalize_title_text' ) ) {
	function mm_launch_sev1_canonicalize_title_text( $title ) {
		return strtr(
			(string) $title,
			array(
				'IV Prep Complete Masterclass' => 'IV Prep Essentials',
				'IV Prep Masterclass'          => 'IV Prep Essentials',
				'Interview Prep Foundation'    => 'IV Prep Essentials',
				'Interview Prep Complete'      => 'Match Prep Pro',
				'Match Prep Complete'          => 'Match Prep Pro',
				'360 Elite'                    => '360 Match Mentorship',
				'360 Mentorship'               => '360 Match Mentorship',
			)
		);
	}
}

if ( ! function_exists( 'mm_launch_sev1_filter_document_title' ) ) {
	function mm_launch_sev1_filter_document_title( $title ) {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return $title;
		}
		return mm_launch_sev1_canonicalize_title_text( $title );
	}
}

add_filter( 'the_title', 'mm_launch_sev1_filter_document_title', PHP_INT_MAX );
add_filter( 'wpseo_title', 'mm_launch_sev1_filter_document_title', PHP_INT_MAX );
add_filter( 'wpseo_opengraph_title', 'mm_launch_sev1_filter_document_title', PHP_INT_MAX );
add_filter( 'wpseo_twitter_title', 'mm_launch_sev1_filter_document_title', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_policy_html' ) ) {
	function mm_launch_sev1_policy_html( $policy ) {
		$policies = array(
			'terms-of-agreement' => <<<'HTML'
<section class="mm-launch-policy">
  <p class="mm-policy-kicker">MissionMed Institute</p>
  <h1>Terms of Agreement</h1>
  <p class="mm-policy-updated">Last updated: June 15, 2026</p>
  <p>These Terms of Agreement govern your use of MissionMed Institute websites, accounts, programs, course materials, digital products, clinical placement inquiry workflows, and related services. MissionMed Institute includes Mission Residency, ExamPrep, USCE or clinical placement inquiry services, Arena, Matrix, account portals, and related educational offerings.</p>
  <h2>1. Educational Services</h2>
  <p>MissionMed Institute provides educational coaching, exam preparation, residency strategy, interview preparation, clinical placement inquiry support, digital tools, and account-based learning experiences. We do not provide medical care, legal advice, immigration advice, employment guarantees, or residency placement guarantees unless a specific written program guarantee expressly says otherwise.</p>
  <h2>2. Accounts And Access</h2>
  <p>You are responsible for the accuracy of the information you provide and for maintaining the confidentiality of your login credentials. Account access may include Mission Residency courses, ExamPrep materials, Arena or Matrix activity, file uploads, notes, saved progress, payment records, and communications. You may not share, resell, copy, scrape, or redistribute course materials, videos, downloads, prompts, tools, or private program communications.</p>
  <h2>3. Payments, Enrollment, And MatchFirst</h2>
  <p>Program access may require payment through WooCommerce, Stripe, Zelle, invoice, payment plan, MatchFirst, or another approved method. Prices, deposits, installment schedules, discounts, and included services are shown at checkout or in your written enrollment confirmation. MatchFirst or deferred-payment arrangements apply only when offered in writing and may require participation, attendance, communication, and documentation requirements.</p>
  <h2>4. Refunds And Cancellations</h2>
  <p>Refunds, cancellations, failed-payment handling, access removal, and USCE or clinical placement inquiry terms are governed by the Refund &amp; Cancellation Policy. If a written enrollment agreement or payment plan contains more specific terms, those terms control for that enrollment.</p>
  <h2>5. USCE And Clinical Placement Inquiries</h2>
  <p>USCE or clinical placement inquiry services help collect information, evaluate fit, coordinate next steps, and support communication around potential clinical opportunities. MissionMed Institute does not guarantee that a specific rotation, site, specialty, date, preceptor, hospital affiliation, letter, visa outcome, school approval, or residency result will be available or approved.</p>
  <h2>6. Student Conduct</h2>
  <p>You agree to communicate professionally, provide accurate information, respect instructors and other students, avoid harassment or abuse, and use services only for lawful educational purposes. MissionMed Institute may suspend or terminate access for misuse, nonpayment, fraud, harassment, content theft, security abuse, or conduct that risks other students, staff, partners, or systems.</p>
  <h2>7. Uploaded Files And Student Content</h2>
  <p>You may upload or submit CVs, ERAS drafts, personal statements, exam history, clinical documents, videos, audio, notes, assignments, and other materials. You retain ownership of your materials, but you grant MissionMed Institute permission to process, review, store, annotate, and use them to provide services, support, quality control, and account administration.</p>
  <h2>8. Email, SMS, And Communications</h2>
  <p>By submitting forms, creating an account, enrolling, or requesting information, you agree that MissionMed Institute may contact you by email, SMS, phone, portal message, or other reasonable channels about your account, programs, enrollment, payments, scheduling, support, and relevant educational updates. You may opt out of promotional messages where required by law, but transactional messages may still be sent.</p>
  <h2>9. Arena, Matrix, And Digital Tools</h2>
  <p>Arena, Matrix, quizzes, dashboards, drills, timers, notes, progress data, streaks, XP, MEDPASS status, and similar tools are educational aids. They may change, pause, or be updated as the systems improve. Scores, analytics, recommendations, and progress indicators are not medical, licensing, academic, employment, or residency guarantees.</p>
  <h2>10. Intellectual Property</h2>
  <p>MissionMed Institute content, frameworks, videos, diagrams, templates, copy, software, systems, dashboards, course materials, and brand assets are owned by MissionMed Institute or its licensors. Limited personal access does not transfer ownership. Unauthorized copying, public posting, resale, or derivative use is prohibited.</p>
  <h2>11. Disclaimers And Limitation Of Liability</h2>
  <p>Services are provided for educational and advisory purposes. Outcomes depend on many factors outside MissionMed Institute's control, including applicant history, exam performance, application quality, timing, specialty competitiveness, program decisions, visa status, institutional rules, and participation. To the fullest extent permitted by law, MissionMed Institute is not liable for indirect, incidental, consequential, special, punitive, or lost-opportunity damages.</p>
  <h2>12. International Users</h2>
  <p>MissionMed Institute serves users in the United States and internationally. By using the services, you understand that your information may be processed in the United States or by service providers that support MissionMed Institute operations.</p>
  <h2>13. Changes To These Terms</h2>
  <p>We may update these terms as services, laws, or operations change. The posted version applies to use after the listed update date. Material enrollment-specific terms will be handled through checkout, invoice, or written agreement when applicable.</p>
  <h2>14. Contact</h2>
  <p>Questions about these terms may be sent to <a href="mailto:info@missionmedinstitute.com">info@missionmedinstitute.com</a>.</p>
</section>
HTML,
			'refund-cancellation-policy' => <<<'HTML'
<section class="mm-launch-policy">
  <p class="mm-policy-kicker">MissionMed Institute</p>
  <h1>Refund &amp; Cancellation Policy</h1>
  <p class="mm-policy-updated">Last updated: June 15, 2026</p>
  <p>This Refund &amp; Cancellation Policy explains how MissionMed Institute handles refunds, cancellations, payment plans, deferred payments, course access, ExamPrep, Mission Residency, USCE or clinical placement inquiries, Arena, Matrix, and related services.</p>
  <h2>1. General Policy</h2>
  <p>Because MissionMed Institute provides time-sensitive educational services, live coaching, digital course access, account tools, document review, strategy work, and limited-capacity program seats, refund eligibility depends on the program, timing, access already granted, live sessions attended, work already performed, and any written enrollment terms.</p>
  <h2>2. Mission Residency Programs</h2>
  <p>Mission Residency enrollment may include IV Prep Essentials, Match Prep Pro, 360 Match Mentorship, MatchFirst, payment plans, Zelle options, live workshops, mock interviews, personal statement work, ERAS review, coaching calls, and private communications. Unless a written agreement states otherwise, refund requests must be submitted promptly and before substantial program access, live coaching, document work, or personalized strategy has been delivered.</p>
  <h2>3. MatchFirst And Deferred Payments</h2>
  <p>MatchFirst is a specific deferred-payment arrangement when offered in writing. Deposits, post-match balances, participation requirements, attendance requirements, communication requirements, and unmatched-cycle terms are controlled by the MatchFirst enrollment terms shown at checkout, invoice, or written confirmation. Failure to meet participation or payment requirements may affect continued access or deferred-payment eligibility.</p>
  <h2>4. ExamPrep</h2>
  <p>ExamPrep may include live drilling, quizzes, recordings, notes, coaching, group sessions, and 1-on-1 support. Refunds may be limited once live sessions, recordings, private materials, account access, or instructor time have been used. Missed live sessions are generally not refundable unless MissionMed Institute cancels the session and no reasonable replacement is offered.</p>
  <h2>5. USCE And Clinical Placement Inquiries</h2>
  <p>USCE and clinical placement inquiries may involve intake review, availability checks, document handling, site communication, administrative coordination, invoices, deposits, and third-party timing. Refunds and cancellations may vary by rotation type, site, timing, documentation status, and whether a placement, offer, confirmation, or administrative work has begun. Site-specific or written confirmation terms control when more specific.</p>
  <h2>6. Digital Access, Arena, Matrix, And Uploaded Files</h2>
  <p>Digital access may include Arena, Matrix, dashboards, quizzes, video libraries, notes, downloadable materials, uploaded files, progress data, and account tools. Refunds may be limited after digital access is granted or substantial use occurs. Cancellation may remove access to paid materials, private tools, and program-specific account features.</p>
  <h2>7. Payment Plans, Failed Payments, And Chargebacks</h2>
  <p>Students using installments or payment plans remain responsible for payments according to the agreed schedule. Failed payments may pause access until resolved. Please contact MissionMed Institute before initiating a chargeback so we can review the issue, correct billing errors, or document the applicable policy.</p>
  <h2>8. How To Request A Refund Or Cancellation</h2>
  <p>Email <a href="mailto:info@missionmedinstitute.com">info@missionmedinstitute.com</a> with your name, account email, program, payment date, requested action, and reason. MissionMed Institute may request additional information to verify the account, payment, access history, and services already delivered.</p>
  <h2>9. Processing Timeline</h2>
  <p>Approved refunds are normally processed back to the original payment method when possible. Bank, card, Stripe, WooCommerce, or payment-provider timelines may vary. Zelle, manual invoices, or special payment arrangements may require additional coordination.</p>
  <h2>10. Contact</h2>
  <p>Questions about refunds or cancellations may be sent to <a href="mailto:info@missionmedinstitute.com">info@missionmedinstitute.com</a>.</p>
</section>
HTML,
			'privacy-policy' => <<<'HTML'
<section class="mm-launch-policy">
  <p class="mm-policy-kicker">MissionMed Institute</p>
  <h1>Privacy Policy</h1>
  <p class="mm-policy-updated">Last updated: June 15, 2026</p>
  <p>This Privacy Policy explains how MissionMed Institute collects, uses, shares, and protects information when you use our websites, accounts, programs, forms, course materials, clinical placement inquiry workflows, Arena, Matrix, ExamPrep, Mission Residency, USCE services, and related tools.</p>
  <h2>1. Who We Are</h2>
  <p>MissionMed Institute operates educational programs and digital services for medical students, IMGs, residency applicants, exam-prep students, and clinical placement inquiries. You can contact us at <a href="mailto:info@missionmedinstitute.com">info@missionmedinstitute.com</a>.</p>
  <h2>2. Information We Collect</h2>
  <p>We may collect your name, email, phone number, country, training stage, school or program information, exam history, graduation year, application history, specialty interests, visa-related information you choose to provide, payment records, account credentials, support requests, form submissions, uploaded files, videos, audio, notes, assignments, quiz activity, Arena or Matrix activity, device information, analytics, cookies, and communications with our team.</p>
  <h2>3. Mission Residency, ExamPrep, And USCE Information</h2>
  <p>For Mission Residency and ExamPrep, we may process application materials, interview preparation notes, exam-prep performance, live-session participation, recordings, homework, and coaching history. For USCE or clinical placement inquiries, we may process rotation interests, availability, documents, coordinator notes, offer status, payment status, confirmation status, and related communications.</p>
  <h2>4. Arena, Matrix, And Account Data</h2>
  <p>Arena, Matrix, dashboards, and related tools may store account identity, progress, XP, streaks, mode history, notes, MEDPASS progress, quiz or drill attempts, saved preferences, authentication events, and technical logs used to operate and improve the services.</p>
  <h2>5. Payments</h2>
  <p>Payments may be processed through WooCommerce, Stripe, Zelle, invoices, or other approved payment providers. We may store order records, product enrollment, payment status, refunds, invoices, plan status, and transaction identifiers. We do not intentionally store full card numbers on MissionMed Institute systems when payments are handled by third-party payment processors.</p>
  <h2>6. Email, SMS, And Communications</h2>
  <p>We may use your information to send account messages, enrollment updates, support replies, payment notices, scheduling messages, program reminders, course updates, marketing communications, and SMS or phone communications when you provide a number or otherwise consent. You may opt out of promotional messages where required by law.</p>
  <h2>7. Cookies, Analytics, And Advertising</h2>
  <p>Our site may use cookies, pixels, analytics tools, embedded media, performance tools, fraud prevention, security monitoring, and advertising or measurement services. These help us operate the site, remember preferences, understand traffic, protect accounts, improve pages, and measure campaign performance.</p>
  <h2>8. How We Use Information</h2>
  <p>We use information to provide services, manage accounts, process payments, deliver courses, review files, support clinical placement inquiries, personalize coaching, operate Arena and Matrix, communicate with you, prevent fraud, maintain security, improve products, comply with legal obligations, and document business operations.</p>
  <h2>9. How We Share Information</h2>
  <p>We may share information with service providers that support hosting, WordPress, WooCommerce, Stripe, email, SMS, analytics, storage, video, scheduling, security, customer support, and operations. For USCE or clinical placement inquiries, information may be shared with coordinators, placement partners, sites, or other parties reasonably needed to evaluate or coordinate an inquiry. We may also share information when required by law, to protect rights and safety, or as part of a business transfer.</p>
  <h2>10. Uploaded Files</h2>
  <p>Uploaded files may include sensitive educational, application, exam, identity, or clinical-placement materials. Please upload only what is needed for the service. We use reasonable safeguards, but no online system is perfectly secure.</p>
  <h2>11. Retention</h2>
  <p>We retain information for as long as needed to provide services, manage accounts, document payments, comply with legal or tax obligations, resolve disputes, improve products, and support legitimate business operations. Retention periods vary by data type and service.</p>
  <h2>12. International Users</h2>
  <p>MissionMed Institute serves users from the United States and other countries. Your information may be processed in the United States or by service providers in other locations. By using the services, you understand that privacy laws may differ from those in your country.</p>
  <h2>13. Your Choices And Requests</h2>
  <p>You may request access, correction, deletion, or export of certain personal information by contacting us. We may need to verify your identity and may retain information where legally required or reasonably necessary for payments, security, disputes, or business records.</p>
  <h2>14. Children</h2>
  <p>MissionMed Institute services are intended for adults and professional students, not children under 13. We do not knowingly collect personal information from children under 13.</p>
  <h2>15. Changes To This Policy</h2>
  <p>We may update this policy as services, laws, or operations change. The posted version applies after the listed update date.</p>
  <h2>16. Contact</h2>
  <p>Privacy questions and requests may be sent to <a href="mailto:info@missionmedinstitute.com">info@missionmedinstitute.com</a>.</p>
</section>
HTML,
		);

		return isset( $policies[ $policy ] ) ? $policies[ $policy ] : '';
	}
}

if ( ! function_exists( 'mm_launch_sev1_render_virtual_policy_page' ) ) {
	function mm_launch_sev1_render_virtual_policy_page() {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return;
		}

		$slug = mm_launch_sev1_request_slug();
		if ( ! in_array( $slug, array( 'privacy-policy', 'terms-of-agreement', 'refund-cancellation-policy' ), true ) ) {
			return;
		}

		$titles      = array(
			'privacy-policy'             => 'Privacy Policy',
			'terms-of-agreement'         => 'Terms of Agreement',
			'refund-cancellation-policy' => 'Refund & Cancellation Policy',
		);
		$title       = $titles[ $slug ];
		$description = mm_launch_sev1_current_meta_description();

		status_header( 200 );
		header( 'Content-Type: text/html; charset=' . get_option( 'blog_charset' ) );
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( $title ); ?> - MissionMed Institute</title>
	<meta name="description" content="<?php echo esc_attr( $description ); ?>">
	<meta property="og:title" content="<?php echo esc_attr( $title ); ?> - MissionMed Institute">
	<meta property="og:description" content="<?php echo esc_attr( $description ); ?>">
	<meta property="og:type" content="article">
	<meta property="og:url" content="<?php echo esc_url( home_url( '/' . $slug . '/' ) ); ?>">
	<meta name="twitter:card" content="summary">
	<?php mm_launch_sev1_policy_styles(); ?>
</head>
<body class="mm-launch-policy-body">
	<main>
		<?php echo mm_launch_sev1_policy_html( $slug ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	</main>
</body>
</html>
		<?php
		exit;
	}
}

add_action( 'template_redirect', 'mm_launch_sev1_render_virtual_policy_page', 0 );

if ( ! function_exists( 'mm_launch_sev1_policy_styles' ) ) {
	function mm_launch_sev1_policy_styles() {
		?>
		<style id="mm-launch-policy-css">
			:root{--mm-navy:#0f2a44;--mm-ink:#172033;--mm-gold:#c8963e;--mm-soft:#f7f3ea;--mm-line:#e4dccd}
			body.mm-launch-policy-body{margin:0;background:var(--mm-soft);color:var(--mm-ink);font-family:Inter,Arial,sans-serif;line-height:1.65}
			.mm-launch-policy{max-width:960px;margin:0 auto;padding:64px 24px 80px}
			.mm-policy-kicker{margin:0 0 8px;color:var(--mm-gold);font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
			.mm-launch-policy h1{margin:0 0 6px;color:var(--mm-navy);font-size:clamp(34px,5vw,56px);line-height:1.05}
			.mm-policy-updated{margin:0 0 30px;color:#637083;font-weight:700}
			.mm-launch-policy h2{margin:30px 0 8px;color:var(--mm-navy);font-size:22px;line-height:1.25}
			.mm-launch-policy p{margin:0 0 14px}
			.mm-launch-policy a{color:var(--mm-navy);font-weight:800}
			.mm-launch-policy ul{padding-left:22px}
			.mm-launch-policy li{margin:6px 0}
		</style>
		<?php
	}
}

if ( ! function_exists( 'mm_launch_sev1_replace_privacy_policy_content' ) ) {
	function mm_launch_sev1_replace_privacy_policy_content( $content ) {
		if ( ! mm_launch_sev1_is_frontend() || ! mm_launch_sev1_slug_is( 'privacy-policy' ) ) {
			return $content;
		}
		ob_start();
		mm_launch_sev1_policy_styles();
		$styles = ob_get_clean();
		return $styles . mm_launch_sev1_policy_html( 'privacy-policy' );
	}
}

add_filter( 'the_content', 'mm_launch_sev1_replace_privacy_policy_content', 1 );

if ( ! function_exists( 'mm_launch_sev1_price_presentation' ) ) {
	function mm_launch_sev1_price_presentation( $regular_price, $early_price, $savings, $label = 'Early Enrollment' ) {
		return sprintf(
			'<div class="mm-launch-price-presentation"><div class="mm-launch-price-regular"><span>Regular Price</span> <s>%1$s</s></div><div class="mm-launch-price-current">%2$s <span>%4$s</span></div><div class="mm-launch-price-save">Save %3$s</div><div class="mm-launch-price-deadline">Price increases July 1.</div></div>',
			esc_html( $regular_price ),
			esc_html( $early_price ),
			esc_html( $savings ),
			esc_html( $label )
		);
	}
}

if ( ! function_exists( 'mm_launch_sev1_pricing_styles' ) ) {
	function mm_launch_sev1_pricing_styles() {
		if ( ! mm_launch_sev1_is_frontend() || ! mm_launch_sev1_slug_is( array( 'mission-residency', 'mission-residency-courses', 'compare-programs' ) ) ) {
			return;
		}
		?>
		<style id="mm-launch-pricing-css">
			.mm-launch-price-presentation{display:grid;gap:6px;align-content:start}
			.mm-launch-price-regular{font-size:15px;font-weight:800;color:#667085}
			.mm-launch-price-regular s{color:#8a5a18;text-decoration-thickness:2px}
			.mm-launch-price-current{font-size:clamp(28px,4vw,42px);line-height:1;font-weight:900;color:#0f2a44}
			.mm-launch-price-current span{display:block;margin-top:5px;font-size:13px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;color:#8a5a18}
			.mm-launch-price-save{font-size:16px;font-weight:900;color:#146c43}
			.mm-launch-price-deadline{font-size:13px;font-weight:800;color:#344054}
			.mm-launch-current-pricing-panel{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#172033;padding:42px 22px;border-top:1px solid #e6e9ef;border-bottom:1px solid #e6e9ef}
			.mm-launch-current-pricing-panel .wrap{max-width:1120px;margin:0 auto}
			.mm-launch-current-pricing-panel .eyebrow{font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#8a5a18;margin-bottom:8px}
			.mm-launch-current-pricing-panel h2{font-size:clamp(28px,4vw,42px);line-height:1.1;margin:0 0 10px;color:#0f2a44}
			.mm-launch-current-pricing-panel p{max-width:760px;margin:0 0 24px;color:#475467}
			.mm-launch-current-pricing-panel .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
			.mm-launch-current-pricing-panel article{background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:20px}
			.mm-launch-current-pricing-panel h3{margin:0 0 14px;color:#0f2a44;font-size:20px}
			.mm-launch-current-pricing-panel .cta{display:inline-flex;margin-top:22px;padding:13px 20px;border-radius:999px;background:#c8963e;color:#0f2a44;font-weight:900;text-decoration:none}
			@media(max-width:820px){.mm-launch-current-pricing-panel .grid{grid-template-columns:1fr}}
		</style>
		<?php
	}
}

add_action( 'wp_head', 'mm_launch_sev1_pricing_styles', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_watch_item_styles' ) ) {
	function mm_launch_sev1_watch_item_styles() {
		if ( ! mm_launch_sev1_is_frontend() || ! mm_launch_sev1_slug_is( array( 'red-flag-match-stories' ) ) ) {
			return;
		}
		?>
		<style id="mm-launch-sev1-watch-css">
			@media(max-width:767px){
				html,body{max-width:100%;overflow-x:hidden}
				.score-table,
				table.score-table,
				.score-table-wrap,
				.elementor-widget-container .score-table{
					display:block;
					max-width:100%;
					overflow-x:auto;
					-webkit-overflow-scrolling:touch;
				}
				.score-table table,
				table.score-table{
					min-width:560px;
					width:max-content;
					max-width:none;
					white-space:nowrap;
				}
			}
		</style>
		<?php
	}
}

add_action( 'wp_head', 'mm_launch_sev1_watch_item_styles', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_current_pricing_panel' ) ) {
	function mm_launch_sev1_current_pricing_panel() {
		return '<section class="mm-launch-current-pricing-panel" id="current-early-enrollment-pricing"><div class="wrap"><div class="eyebrow">Current Early Enrollment Pricing</div><h2>Enroll before the July 1 price increase.</h2><p>MissionMed is using intentional early-season pricing for launch enrollment. Checkout pricing should remain unchanged unless WooCommerce architecture is separately approved.</p><div class="grid"><article><h3>IV Prep Essentials</h3>' . mm_launch_sev1_price_presentation( '$1,699', '$1,499', '$200' ) . '</article><article><h3>Match Prep Pro</h3>' . mm_launch_sev1_price_presentation( '$3,749', '$2,799', '$950' ) . '</article><article><h3>360 Match Mentorship</h3>' . mm_launch_sev1_price_presentation( '$5,499', '$3,999', '$1,500' ) . '</article></div><a class="cta" href="/mission-residency-courses/">View Courses And Enrollment</a></div></section>';
	}
}

if ( ! function_exists( 'mm_launch_sev1_text_replacements' ) ) {
	function mm_launch_sev1_text_replacements( $content ) {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return $content;
		}

		$slug         = mm_launch_sev1_request_slug();
		$launch_pages = array(
			'home',
			'mission-residency',
			'mission-residency-courses',
			'compare-programs',
			'mission-residency-waitlist',
			'red-flag-match-stories',
			'examprep',
			'examprep/courses',
			'usce',
			'homepage-arena',
			'contact',
			'my-account',
		);

		if ( ! in_array( $slug, $launch_pages, true ) && 0 !== strpos( $slug, 'product/' ) ) {
			return $content;
		}

		$global_replacements = array(
			'IV Prep Complete Masterclass'     => 'IV Prep Essentials',
			'IV Prep Complete'                 => 'IV Prep Essentials',
			'IV Prep Masterclass'              => 'IV Prep Essentials',
			'Interview Prep Foundation'        => 'IV Prep Essentials',
			'Interview Prep Complete'          => 'Match Prep Pro',
			'Match Prep Complete'              => 'Match Prep Pro',
			'360 Elite'                        => '360 Match Mentorship',
			'360 Mentorship'                   => '360 Match Mentorship',
			'MatchLab'                         => 'Arena',
			'Complete adds'                    => 'Match Prep Pro adds',
			'Choose Complete'                  => 'Choose Match Prep Pro',
			'Foundation or Complete'           => 'IV Prep Essentials or Match Prep Pro',
			'info@missionresidency.com'        => 'info@missionmedinstitute.com',
			'mailto:info@missionresidency.com' => 'mailto:info@missionmedinstitute.com',
			'href="#">Refund Policy</a>'       => 'href="/refund-cancellation-policy/">Refund Policy</a>',
			'href="#">Privacy Policy</a>'      => 'href="/privacy-policy/">Privacy Policy</a>',
			'href="#">Terms of Agreement</a>'  => 'href="/terms-of-agreement/">Terms of Agreement</a>',
			'href="#">Terms</a>'               => 'href="/terms-of-agreement/">Terms</a>',
			'href="/?page_id=3"'               => 'href="/privacy-policy/"',
			'href="https://missionmedinstitute.com/?page_id=3"' => 'href="https://missionmedinstitute.com/privacy-policy/"',
			'href="MR-1503C2_WhatIsMissionResidency_OnePage.html"' => 'href="/what-alumni-said/"',
			'href="/mission-residency/MR-1503C2_WhatIsMissionResidency_OnePage.html"' => 'href="/what-alumni-said/"',
			'href="https://missionmedinstitute.com/mission-residency/MR-1503C2_WhatIsMissionResidency_OnePage.html"' => 'href="https://missionmedinstitute.com/what-alumni-said/"',
		);

		$content = strtr( $content, $global_replacements );

		if ( 'mission-residency' === $slug ) {
			$content = strtr(
				$content,
				array(
					'goes to $1,699 July 1 or after 50 enrollments' => 'regular price $1,699 after July 1',
					'goes to $3,199 July 1 or after 50 enrollments' => 'regular price $3,749 after July 1',
					'goes to $4,499 July 1 or after 50 enrollments' => 'regular price $5,499 after July 1',
					'is $1,499 (goes to $1,699)' => 'is $1,499 Early Enrollment (regular $1,699 after July 1)',
					'is $2,799 (goes to $3,199)' => 'is $2,799 Early Enrollment (regular $3,749 after July 1)',
					'is $3,999 (goes to $4,499)' => 'is $3,999 Early Enrollment (regular $5,499 after July 1)',
				)
			);
			$content = str_replace(
				array(
					'<div class="mr1503d-tier-price"><span class="currency">$</span><span class="num">1,499</span></div>',
					'<div class="mr1503d-tier-price"><span class="currency">$</span><span class="num">2,799</span></div>',
					'<div class="mr1503d-tier-price"><span class="currency">$</span><span class="num">3,999</span></div>',
				),
				array(
					mm_launch_sev1_price_presentation( '$1,699', '$1,499', '$200' ),
					mm_launch_sev1_price_presentation( '$3,749', '$2,799', '$950' ),
					mm_launch_sev1_price_presentation( '$5,499', '$3,999', '$1,500' ),
				),
				$content
			);
		}

		if ( 'mission-residency-courses' === $slug ) {
			$content = strtr(
				$content,
				array(
					'Choose IV Prep Masterclass' => 'Choose IV Prep Essentials',
					'IV Prep Masterclass is best' => 'IV Prep Essentials is best',
				)
			);
			if ( false === strpos( $content, 'mm-launch-current-pricing-panel' ) ) {
				$content = mm_launch_sev1_current_pricing_panel() . $content;
			}
		}

		if ( 'examprep' === $slug ) {
			$content = str_replace( array( 'ismissing', 'is missing' ), '', $content );
		}

		if ( 'examprep/courses' === $slug ) {
			$content = str_replace( array( 'Design Version:', 'V1: Command', 'V2: Split', 'V3: Cinematic', 'V4: Tactical', 'V5: Studio' ), '', $content );
		}

		if ( 'usce' === $slug ) {
			$content = str_replace( array( '```html', '```HTML', '```' ), '', $content );
			$content = str_replace( array( '&#8220;`html', '&#8220;`', '`html' ), '', $content );
		}

		if ( 'homepage-arena' === $slug ) {
			$content = strtr(
				$content,
				array(
					'Create Free Player Profile' => 'Enter Arena Preview',
					'Create Player Profile'      => 'Enter Arena Preview',
					'Create Free Profile'        => 'Enter Arena Preview',
					'Start your Arena file.'     => 'Enter the Arena preview.',
					'This concept preview does not create a real account. It only shows the confirmation message below.' => 'Arena preview access is available through the live Arena entry point; account features may require cohort enrollment.',
					'Concept demo only. No account was created.' => 'Arena preview available. Account creation may require cohort enrollment.',
					'concept demo only'           => 'Arena preview',
					'Concept demo only'           => 'Arena preview',
				)
			);
		}

		if ( 'compare-programs' === $slug && false === strpos( $content, 'mm-launch-pricing-bridge' ) ) {
			$content .= mm_launch_sev1_compare_pricing_bridge();
		}

		return $content;
	}
}

add_filter( 'the_content', 'mm_launch_sev1_text_replacements', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_compare_pricing_bridge' ) ) {
	function mm_launch_sev1_compare_pricing_bridge() {
		return <<<'HTML'
<section class="mm-launch-pricing-bridge" id="pricing">
  <style>
    .mm-launch-pricing-bridge{font-family:Inter,Arial,sans-serif;background:#0f2a44;color:#fff;padding:56px 22px}
    .mm-launch-pricing-bridge .wrap{max-width:1120px;margin:0 auto}
    .mm-launch-pricing-bridge .eyebrow{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e0bd66;margin-bottom:10px}
    .mm-launch-pricing-bridge h2{font-size:clamp(28px,4vw,44px);line-height:1.1;margin:0 0 12px;color:#fff}
    .mm-launch-pricing-bridge p{color:#dbe3ee;max-width:760px;margin:0 0 26px}
    .mm-launch-pricing-bridge .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .mm-launch-pricing-bridge article{border:1px solid rgba(224,189,102,.35);border-radius:8px;padding:22px;background:rgba(255,255,255,.05)}
    .mm-launch-pricing-bridge h3{margin:0 0 12px;font-size:22px;color:#fff}
    .mm-launch-pricing-bridge .regular{font-size:14px;font-weight:800;color:#dbe3ee;margin-bottom:5px}
    .mm-launch-pricing-bridge .regular s{color:#e0bd66;text-decoration-thickness:2px}
    .mm-launch-pricing-bridge .price{font-size:34px;line-height:1;font-weight:900;color:#fff;margin-bottom:8px}
    .mm-launch-pricing-bridge .price span{display:block;margin-top:5px;font-size:12px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;color:#e0bd66}
    .mm-launch-pricing-bridge .save{font-size:16px;font-weight:900;color:#7ee0a6;margin-bottom:3px}
    .mm-launch-pricing-bridge .deadline{font-size:13px;font-weight:800;color:#dbe3ee;margin-bottom:12px}
    .mm-launch-pricing-bridge .fit{font-size:14px;color:#dbe3ee}
    .mm-launch-pricing-bridge .cta{display:inline-flex;margin-top:22px;padding:13px 20px;border-radius:999px;background:#c8963e;color:#0f2a44;font-weight:800;text-decoration:none}
    @media(max-width:820px){.mm-launch-pricing-bridge .grid{grid-template-columns:1fr}}
  </style>
  <div class="wrap">
    <div class="eyebrow">Current Early Enrollment Pricing</div>
    <h2>Compare the three Mission Residency tiers by price.</h2>
    <p>MissionMed is using intentional early-season pricing for launch enrollment. Price increases July 1; checkout product data should remain unchanged unless WooCommerce architecture is separately approved.</p>
    <div class="grid">
      <article><h3>IV Prep Essentials</h3><div class="regular">Regular Price <s>$1,699</s></div><div class="price">$1,499 <span>Early Enrollment</span></div><div class="save">Save $200</div><div class="deadline">Price increases July 1.</div><div class="fit">Best for applicants with an interview coming up fast and no major red flags.</div></article>
      <article><h3>Match Prep Pro</h3><div class="regular">Regular Price <s>$3,749</s></div><div class="price">$2,799 <span>Early Enrollment</span></div><div class="save">Save $950</div><div class="deadline">Price increases July 1.</div><div class="fit">Best for full-season interview support, re-applicants, and one-cycle unmatched students.</div></article>
      <article><h3>360 Match Mentorship</h3><div class="regular">Regular Price <s>$5,499</s></div><div class="price">$3,999 <span>Early Enrollment</span></div><div class="save">Save $1,500</div><div class="deadline">Price increases July 1.</div><div class="fit">Best for multi-cycle applicants, critical red flags, or full-year 1-on-1 mentorship.</div></article>
    </div>
    <a class="cta" href="/mission-residency-courses/">View Courses And Enrollment</a>
  </div>
</section>
HTML;
	}
}

if ( ! function_exists( 'mm_launch_sev1_fix_menu_labels' ) ) {
	function mm_launch_sev1_fix_menu_labels( $items ) {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return $items;
		}

		foreach ( (array) $items as $item ) {
			$title = isset( $item->title ) ? wp_strip_all_tags( (string) $item->title ) : '';
			$url   = isset( $item->url ) ? (string) $item->url : '';

			if ( false !== stripos( $title, 'MatchLab' ) || false !== stripos( $url, '/matchlab' ) ) {
				$item->title = 'Arena';
				$item->url   = home_url( '/arena/' );
			}

			if ( false !== stripos( $title, 'Refund Policy' ) ) {
				$item->url = home_url( '/refund-cancellation-policy/' );
			} elseif ( false !== stripos( $title, 'Privacy Policy' ) ) {
				$item->url = home_url( '/privacy-policy/' );
			} elseif ( false !== stripos( $title, 'Terms' ) ) {
				$item->url = home_url( '/terms-of-agreement/' );
			}
		}

		return $items;
	}
}

add_filter( 'wp_nav_menu_objects', 'mm_launch_sev1_fix_menu_labels', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_hide_legacy_product_from_store_api_collections' ) ) {
	function mm_launch_sev1_hide_legacy_product_from_store_api_collections( $query ) {
		if ( is_admin() || ! ( $query instanceof WP_Query ) ) {
			return;
		}

		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		$path        = is_string( $path ) ? strtolower( $path ) : '';

		if ( false === strpos( $path, '/wp-json/wc/store/v1/products' ) ) {
			return;
		}

		if ( preg_match( '#/wp-json/wc/store/v1/products/\d+/?$#', $path ) ) {
			return;
		}

		$post_type = $query->get( 'post_type' );
		if ( ! empty( $post_type ) && ! in_array( 'product', (array) $post_type, true ) ) {
			return;
		}

		$post__not_in = array_map( 'absint', (array) $query->get( 'post__not_in' ) );
		$post__not_in[] = 3577;
		$query->set( 'post__not_in', array_values( array_unique( $post__not_in ) ) );
	}
}

add_action( 'pre_get_posts', 'mm_launch_sev1_hide_legacy_product_from_store_api_collections', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_privacy_policy_url' ) ) {
	function mm_launch_sev1_privacy_policy_url( $url ) {
		return home_url( '/privacy-policy/' );
	}
}

add_filter( 'privacy_policy_url', 'mm_launch_sev1_privacy_policy_url', PHP_INT_MAX );

if ( ! function_exists( 'mm_launch_sev1_footer_link_repair_script' ) ) {
	function mm_launch_sev1_footer_link_repair_script() {
		if ( ! mm_launch_sev1_is_frontend() ) {
			return;
		}
		?>
		<script id="mm-launch-sev1-link-repair">
		(function(){
			var slug = <?php echo wp_json_encode( mm_launch_sev1_request_slug() ); ?>;
			var policyMap = {
				'refund policy': '/refund-cancellation-policy/',
				'privacy policy': '/privacy-policy/',
				'terms of agreement': '/terms-of-agreement/',
				'terms': '/terms-of-agreement/'
			};
			function setLink(anchor, href, label) {
				anchor.setAttribute('href', href);
				if (label) {
					anchor.textContent = label;
				}
			}
			function cleanVisibleText(root) {
				var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
					acceptNode: function(textNode) {
						var parent = textNode.parentElement;
						if (!parent || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/i.test(parent.tagName)) {
							return NodeFilter.FILTER_REJECT;
						}
						return NodeFilter.FILTER_ACCEPT;
					}
				});
				var nodes = [];
				var node;
				while ((node = walker.nextNode())) {
					nodes.push(node);
				}
				nodes.forEach(function(textNode){
					textNode.nodeValue = textNode.nodeValue
						.replace(/360 Elite/g, '360 Match Mentorship')
						.replace(/Create Free Profile/g, 'Enter Arena Preview')
						.replace(/Create Free Player Profile/g, 'Enter Arena Preview')
						.replace(/Start your Arena file\./g, 'Enter the Arena preview.');
				});
			}
			cleanVisibleText(document.body);
			document.querySelectorAll('a').forEach(function(anchor){
				var text = (anchor.textContent || '').trim().toLowerCase();
				var href = anchor.getAttribute('href') || '';
				if (href === '/?page_id=3' || href === 'https://missionmedinstitute.com/?page_id=3') {
					anchor.setAttribute('href', '/privacy-policy/');
				}
				if ((href === '#' || href === '') && policyMap[text]) {
					anchor.setAttribute('href', policyMap[text]);
				}
				if (text === 'matchlab') {
					setLink(anchor, '/arena/', 'Arena');
				}
				if (slug === 'mission-residency' && href.indexOf('MR-1503C2_WhatIsMissionResidency_OnePage.html') !== -1) {
					setLink(anchor, '/what-alumni-said/', 'Read What Alumni Said');
				}
				if (slug === 'homepage-arena' && /start drills|enter a duel|create .*profile|join .*interest|arena preview/.test(text)) {
					setLink(anchor, '/arena/', 'Enter Arena Preview');
				}
				if (slug === 'homepage-arena' && /missionmed-registration|member-dashboard/.test(href) && /preview|profile|duel|drills|notified|interrogation/.test(text)) {
					setLink(anchor, '/arena/', 'Enter Arena Preview');
				}
				if (slug === 'compare-programs' && href.indexOf('/contact') !== -1) {
					setLink(anchor, '/mission-residency-courses/', 'View Courses And Enrollment');
				}
				if (slug === 'red-flag-match-stories' && /alumni|story|stories/.test(text)) {
					setLink(anchor, '/what-alumni-said/', 'Read What Alumni Said');
				}
				if (slug === 'red-flag-match-stories' && href.indexOf('/contact') !== -1 && /book|call|strategy|apply|enroll|start/.test(text)) {
					setLink(anchor, '/mission-residency-courses/', 'View Courses And Enrollment');
				}
				if (slug === 'usce' && (href === '#a-form' || href === '#request' || href === '/rotation-request')) {
					setLink(anchor, '/rotation-request/');
				}
			});
			if (slug === 'homepage-arena') {
				document.querySelectorAll('button[data-open-signup], button, [role="button"]').forEach(function(button){
					var text = (button.textContent || '').trim().toLowerCase();
					if (!/enter arena preview|create .*profile|start .*arena|join .*interest/.test(text)) {
						return;
					}
					button.textContent = 'Enter Arena Preview';
					button.setAttribute('type', 'button');
					if (button.dataset.mmLaunchSev1ArenaConverted === '1') {
						return;
					}
					var link = document.createElement('a');
					link.href = '/arena/';
					link.className = button.className;
					link.textContent = 'Enter Arena Preview';
					link.setAttribute('role', 'button');
					link.dataset.mmLaunchSev1ArenaConverted = '1';
					button.replaceWith(link);
					return;
				});
				document.querySelectorAll('form').forEach(function(form){
					var formText = (form.textContent || '').trim().toLowerCase();
					if (formText.indexOf('arena') === -1 && formText.indexOf('profile') === -1) {
						return;
					}
					form.addEventListener('submit', function(event){
						event.preventDefault();
						window.location.href = '/arena/';
					}, true);
				});
			}
			if (slug === 'examprep/courses') {
				document.querySelectorAll('section,div,nav').forEach(function(node){
					var text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
					if (text.indexOf('design version') !== -1 && text.indexOf('v1: command') !== -1 && text.length < 1200) {
						node.remove();
					}
				});
			}
			function repairLateLaunchItems() {
				cleanVisibleText(document.body);
				document.querySelectorAll('a').forEach(function(anchor){
					var text = (anchor.textContent || '').trim().toLowerCase();
					var href = anchor.getAttribute('href') || '';
					if (slug === 'mission-residency' && href.indexOf('MR-1503C2_WhatIsMissionResidency_OnePage.html') !== -1) {
						setLink(anchor, '/what-alumni-said/', 'Read What Alumni Said');
					}
					if (slug === 'homepage-arena' && /arena preview/.test(text)) {
						setLink(anchor, '/arena/', 'Enter Arena Preview');
					}
					if (slug === 'homepage-arena' && /missionmed-registration|member-dashboard/.test(href) && /preview|profile|duel|drills|notified|interrogation/.test(text)) {
						setLink(anchor, '/arena/', 'Enter Arena Preview');
					}
				});
				if (slug === 'homepage-arena') {
					document.querySelectorAll('button[data-open-signup], button, [role="button"]').forEach(function(button){
						var text = (button.textContent || '').trim().toLowerCase();
						if (!/enter arena preview|create .*profile|start .*arena|join .*interest/.test(text)) {
							return;
						}
						if (button.dataset.mmLaunchSev1ArenaConverted === '1') {
							return;
						}
						var link = document.createElement('a');
						link.href = '/arena/';
						link.className = button.className;
						link.textContent = 'Enter Arena Preview';
						link.setAttribute('role', 'button');
						link.dataset.mmLaunchSev1ArenaConverted = '1';
						button.replaceWith(link);
					});
					return;
				}
			}
			[250, 1000, 3000, 6000].forEach(function(delay){
				window.setTimeout(repairLateLaunchItems, delay);
			});
			if ('MutationObserver' in window && document.body) {
				var repairTimer;
				new MutationObserver(function(){
					window.clearTimeout(repairTimer);
					repairTimer = window.setTimeout(repairLateLaunchItems, 120);
				}).observe(document.body, { childList: true, subtree: true });
			}
		})();
		</script>
		<?php
	}
}

add_action( 'wp_footer', 'mm_launch_sev1_footer_link_repair_script', PHP_INT_MAX );
