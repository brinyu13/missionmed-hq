<?php
/**
 * Plugin Name: MissionMed Purchase Success
 * Description: Shared, purchase-aware WooCommerce order confirmation experience.
 * Version: 2026.09.21
 */

defined( 'ABSPATH' ) || exit;

const MMPS_VERSION = '2026.09.21';

function mmps_logo_url() {
	return 'https://missionmedinstitute.com/wp-content/uploads/2026/02/cropped-608a69b125647f6e63b56f87b823b1e60dbdaebf4916b1d5d5edcc408b8ab3fe-448x171.png';
}

function mmps_urls() {
	return array(
		'account'  => home_url( '/my-account/' ),
		'arena'    => home_url( '/arena/' ),
		'matrix'   => home_url( '/member-dashboard/#dashboard' ),
		'calendar' => home_url( '/member-dashboard/#calendar' ),
		'terms'    => home_url( '/terms-of-agreement/' ),
		'refunds'  => home_url( '/refund-cancellation-policy/' ),
	);
}

function mmps_product_ids_for_item( $item ) {
	$ids = array();
	if ( $item && method_exists( $item, 'get_product_id' ) ) {
		$ids[] = absint( $item->get_product_id() );
	}
	if ( $item && method_exists( $item, 'get_variation_id' ) ) {
		$ids[] = absint( $item->get_variation_id() );
	}
	$product = $item && method_exists( $item, 'get_product' ) ? $item->get_product() : false;
	if ( $product && method_exists( $product, 'get_parent_id' ) ) {
		$ids[] = absint( $product->get_parent_id() );
	}
	return array_values( array_unique( array_filter( $ids ) ) );
}

function mmps_family_for_item( $item ) {
	$families = array();
	foreach ( mmps_product_ids_for_item( $item ) as $product_id ) {
		$exact = array(
			'examprep'         => array( 3651, 3652, 3668, 6321, 6360, 9015, 9016, 9017, 9109 ),
			'mission_residency' => array( 3520, 3522, 3525, 3575, 3576, 3577, 5504, 5511, 5512, 5513, 5734, 5735, 5862, 5863, 5864, 5865, 5866, 5867, 5868, 5869, 5870, 5871, 5872, 5873, 6319 ),
			'usce'             => array( 3784, 3785, 3786, 3787, 3788, 3789, 3790, 6323, 6503, 6538 ),
		);
		foreach ( $exact as $family => $ids ) {
			if ( in_array( $product_id, $ids, true ) ) {
				$families[ $family ] = true;
			}
		}
		$declared = sanitize_key( (string) get_post_meta( $product_id, '_missionmed_product_family', true ) );
		if ( in_array( $declared, array( 'examprep', 'mission_residency', 'usce' ), true ) ) {
			$families[ $declared ] = true;
		}
		$slugs = wp_get_post_terms( $product_id, 'product_cat', array( 'fields' => 'slugs' ) );
		if ( is_wp_error( $slugs ) ) {
			continue;
		}
		foreach ( $slugs as $slug ) {
			if ( in_array( $slug, array( 'test-prep', 'exam-prep', 'examprep', 'usmle', 'comlex', 'dr-j', 'drills', 'medpass' ), true ) ) {
				$families['examprep'] = true;
			} elseif ( in_array( $slug, array( 'mission-residency', 'residency', 'interview-prep' ), true ) ) {
				$families['mission_residency'] = true;
			} elseif ( in_array( $slug, array( 'mission-clinicals', 'usce', 'clinical', 'clinicals', 'clinical-rotations', 'rotation', 'rotations' ), true ) ) {
				$families['usce'] = true;
			}
		}
	}
	return 1 === count( $families ) ? array_key_first( $families ) : 'generic';
}

function mmps_classify_order( $order ) {
	if ( ! $order || ! method_exists( $order, 'get_items' ) ) {
		return 'generic';
	}
	$owner = sanitize_key( (string) $order->get_meta( '_missionmed_stripe_owner', true ) );
	$route = sanitize_key( (string) $order->get_meta( '_missionmed_stripe_router', true ) );
	$stamped = array(
		'dr_j|examprep'          => 'examprep',
		'brian|mission_residency' => 'mission_residency',
		'phil|usce_clinicals'     => 'usce',
	);
	if ( isset( $stamped[ $owner . '|' . $route ] ) ) {
		return $stamped[ $owner . '|' . $route ];
	}
	$families = array();
	foreach ( $order->get_items( 'line_item' ) as $item ) {
		$family = mmps_family_for_item( $item );
		if ( 'generic' !== $family ) {
			$families[ $family ] = true;
		}
	}
	if ( 1 === count( $families ) ) {
		return array_key_first( $families );
	}
	if ( count( $families ) > 1 ) {
		return 'generic';
	}
	$map   = array( 'dr_j' => 'examprep', 'brian' => 'mission_residency', 'phil' => 'usce' );
	return isset( $map[ $owner ] ) ? $map[ $owner ] : 'generic';
}

function mmps_order_product_rows( $order ) {
	$rows = array();
	if ( ! $order || ! method_exists( $order, 'get_items' ) ) {
		return $rows;
	}
	foreach ( $order->get_items( 'line_item' ) as $item ) {
		$rows[] = array(
			'name' => method_exists( $item, 'get_name' ) ? (string) $item->get_name() : 'MissionMed program',
			'qty'  => method_exists( $item, 'get_quantity' ) ? max( 1, absint( $item->get_quantity() ) ) : 1,
			'ids'  => mmps_product_ids_for_item( $item ),
		);
	}
	return $rows;
}

function mmps_order_product_ids( $rows ) {
	$ids = array();
	foreach ( $rows as $row ) {
		$ids = array_merge( $ids, isset( $row['ids'] ) ? (array) $row['ids'] : array() );
	}
	return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
}

function mmps_subscriptions( $order ) {
	if ( ! $order || ! function_exists( 'wcs_get_subscriptions_for_order' ) ) {
		return array();
	}
	$subscriptions = wcs_get_subscriptions_for_order( $order->get_id(), array( 'order_type' => 'any' ) );
	return is_array( $subscriptions ) ? array_values( $subscriptions ) : array();
}

function mmps_date( $timestamp ) {
	return $timestamp ? wp_date( get_option( 'date_format' ), $timestamp ) : '';
}

function mmps_subscription_summary( $subscriptions ) {
	$result = array(
		'subscription_status' => '',
		'next_billing'        => '',
		'trial_end'           => '',
		'renewal'             => '',
		'active'              => false,
	);
	if ( empty( $subscriptions ) ) {
		return $result;
	}
	$labels = array();
	foreach ( $subscriptions as $subscription ) {
		if ( ! is_object( $subscription ) || ! method_exists( $subscription, 'get_status' ) ) {
			continue;
		}
		$status   = (string) $subscription->get_status();
		$labels[] = function_exists( 'wcs_get_subscription_status_name' ) ? wcs_get_subscription_status_name( $status ) : ucfirst( $status );
		if ( method_exists( $subscription, 'has_status' ) && $subscription->has_status( array( 'active', 'pending-cancel' ) ) ) {
			$result['active'] = true;
		}
		if ( ! $result['next_billing'] && method_exists( $subscription, 'get_time' ) ) {
			$result['next_billing'] = mmps_date( $subscription->get_time( 'next_payment' ) );
			$result['trial_end']    = mmps_date( $subscription->get_time( 'trial_end' ) );
		}
		if ( ! $result['renewal'] && method_exists( $subscription, 'get_total' ) ) {
			$total    = wc_price( $subscription->get_total(), array( 'currency' => $subscription->get_currency() ) );
			$period   = method_exists( $subscription, 'get_billing_period' ) ? $subscription->get_billing_period() : '';
			$interval = method_exists( $subscription, 'get_billing_interval' ) ? absint( $subscription->get_billing_interval() ) : 1;
			$suffix   = $period ? ( 1 === $interval ? ' / ' . $period : ' every ' . $interval . ' ' . $period . 's' ) : '';
			$result['renewal'] = wp_strip_all_tags( $total ) . $suffix;
		}
	}
	$result['subscription_status'] = implode( ', ', array_unique( array_filter( $labels ) ) );
	return $result;
}

function mmps_family_config( $family, $product_ids, $subscription ) {
	$urls       = mmps_urls();
	$is_daily   = (bool) array_intersect( $product_ids, array( 6360, 9109 ) );
	$is_live    = (bool) array_intersect( $product_ids, array( 3651, 3668 ) );
	$is_tutor   = (bool) array_intersect( $product_ids, array( 3652, 9015, 9016 ) );
	$is_locked  = (bool) array_intersect( $product_ids, array( 9017 ) );
	$configs    = array(
		'examprep' => array(
			'kicker'       => 'ExamPrep enrollment confirmed',
			'headline'     => "YOU'RE IN.",
			'subheadline'  => 'YOUR EXAMPREP ENROLLMENT IS CONFIRMED.',
			'intro'        => 'Your payment and enrollment are confirmed. Your exact purchase and access details are summarized here.',
			'support'      => 'drj@missionmedinstitute.com',
			'support_team' => 'Dr J and the ExamPrep team',
			'primary'      => array( 'label' => 'OPEN MY EXAMPREP ACCOUNT', 'url' => $urls['account'] ),
			'secondary'    => array( 'label' => 'ENTER ARENA', 'url' => $urls['arena'] ),
			'steps'        => array(
				array( 'Enrollment Confirmed', 'Your payment and purchased ExamPrep program are recorded.' ),
				array( 'Review Your Access', 'Open your account to review billing, subscription, and enrollment details.' ),
				array( 'Open Your ExamPrep Tools', 'Use the action above to enter the training experience included with your purchase.' ),
				array( 'Start Training', 'Begin your program or review the schedule for live services.' ),
			),
			'billing'      => 'Manage orders and subscriptions in My Account. Product-specific refund and cancellation terms remain controlling.',
		),
		'mission_residency' => array(
			'kicker'       => 'Mission Residency enrollment confirmed',
			'headline'     => "YOU'RE IN.",
			'subheadline'  => 'YOUR MISSION RESIDENCY PROGRAM IS CONFIRMED.',
			'intro'        => 'Your enrollment is confirmed. Matrix Dashboard v2.0 is your home for your program, schedule, and resources.',
			'support'      => 'info@missionmedinstitute.com',
			'support_team' => 'Mission Residency team',
			'primary'      => array( 'label' => 'ENTER MATRIX DASHBOARD', 'url' => $urls['matrix'] ),
			'secondary'    => array( 'label' => 'VIEW MY ACCOUNT', 'url' => $urls['account'] ),
			'steps'        => array(
				array( 'Enrollment Confirmed', 'Your purchased Mission Residency program is recorded.' ),
				array( 'Enter Matrix Dashboard', 'Open Matrix Dashboard v2.0 for your program workspace.' ),
				array( 'Review Your Program', 'Review the schedule, resources, and current next steps shown for your tier.' ),
				array( 'Begin Your Program', 'Continue from the live tasks and resources in Matrix.' ),
			),
			'billing'      => 'Manage orders and payment plans in My Account. Your purchased program terms remain controlling.',
		),
		'usce' => array(
			'kicker'       => 'Clinical enrollment confirmed',
			'headline'     => 'CONGRATULATIONS!',
			'subheadline'  => 'YOUR CLINICAL TRAINING IS SECURED.',
			'intro'        => 'Your clinical experience purchase is confirmed. Use Matrix for onboarding and site-specific requirements.',
			'support'      => 'clinicals@missionmedinstitute.com',
			'support_team' => 'MissionMed Clinicals team',
			'primary'      => array( 'label' => 'ENTER MATRIX DASHBOARD', 'url' => $urls['matrix'] ),
			'secondary'    => array( 'label' => 'VIEW MY ACCOUNT', 'url' => $urls['account'] ),
			'steps'        => array(
				array( 'Training Secured', 'Your enrollment is confirmed for the purchased clinical experience.' ),
				array( 'Enter Matrix Dashboard', 'Open Matrix to review messages, deadlines, and rotation updates.' ),
				array( 'Complete Hospital Paperwork', 'Submit the required clinical-site documents by the posted deadlines.' ),
				array( 'Prepare For Rotation', 'Watch Matrix for schedule details, orientation notes, and final site instructions.' ),
			),
			'billing'      => 'Clinical placement, cancellation, paperwork, and deadline terms shown in your agreement remain controlling.',
		),
		'generic' => array(
			'kicker'       => 'Purchase confirmed',
			'headline'     => 'THANK YOU.',
			'subheadline'  => 'YOUR MISSIONMED ORDER IS CONFIRMED.',
			'intro'        => 'Your payment is confirmed. Review your order and account for the next steps tied to your purchase.',
			'support'      => 'info@missionmedinstitute.com',
			'support_team' => 'MissionMed support team',
			'primary'      => array( 'label' => 'VIEW MY ACCOUNT', 'url' => $urls['account'] ),
			'secondary'    => array( 'label' => 'CONTACT SUPPORT', 'url' => 'mailto:info@missionmedinstitute.com' ),
			'steps'        => array(
				array( 'Payment Confirmed', 'Your MissionMed order has been received.' ),
				array( 'Review Your Order', 'Open My Account to see the products and billing details attached to this purchase.' ),
				array( 'Follow Product Instructions', 'Use only the next steps shown for your purchased product.' ),
			),
			'billing'      => 'Manage orders in My Account. The terms attached to your purchased product remain controlling.',
		),
	);
	$config = isset( $configs[ $family ] ) ? $configs[ $family ] : $configs['generic'];
	if ( 'examprep' === $family && $is_daily ) {
		$config['primary']   = array( 'label' => 'ENTER ARENA / START DAILY ROUNDS', 'url' => $urls['arena'] );
		$config['secondary'] = array( 'label' => 'VIEW MY EXAMPREP ACCOUNT', 'url' => $urls['account'] );
		$config['steps'][2]  = array( 'Enter Arena', 'Open Arena and choose Drills: Daily Rounds.' );
		$config['steps'][3]  = array( 'Start Daily Rounds', 'Begin your on-demand reasoning practice when your access is active.' );
	} elseif ( 'examprep' === $family && $is_live ) {
		$config['primary']   = array( 'label' => 'VIEW LIVE DRILLS SCHEDULE', 'url' => $urls['calendar'] );
		$config['secondary'] = array( 'label' => 'VIEW MY EXAMPREP ACCOUNT', 'url' => $urls['account'] );
		$config['steps'][2]  = array( 'Review The Live Schedule', 'Open your Matrix calendar for upcoming Live Group Drilling sessions.' );
		$config['steps'][3]  = array( 'Join Your Session', 'Use the session details supplied in your account and calendar.' );
	} elseif ( 'examprep' === $family && $is_tutor ) {
		$config['primary']   = array( 'label' => 'OPEN MATRIX SCHEDULER', 'url' => home_url( '/member-dashboard/#scheduler' ) );
		$config['secondary'] = array( 'label' => 'VIEW MY EXAMPREP ACCOUNT', 'url' => $urls['account'] );
		$config['steps'][2]  = array( 'Confirm Scheduling', 'Open Matrix Scheduler for the next available session and current instructions.' );
		$config['steps'][3]  = array( 'Begin Focused Coaching', 'Bring the topic or reasoning pattern you want to target.' );
	} elseif ( 'examprep' === $family && $is_locked ) {
		$config['primary']   = array( 'label' => 'VIEW MY EXAMPREP ACCOUNT', 'url' => $urls['account'] );
		$config['secondary'] = array( 'label' => 'CONTACT DR J', 'url' => 'mailto:drj@missionmedinstitute.com' );
		$config['steps'][2]  = array( 'Contact ExamPrep Support', 'Arena Pro is locked until the active release is confirmed for your account.' );
		$config['steps'][3]  = array( 'Wait For Access Confirmation', 'Do not rely on an Arena Pro access link until support confirms activation.' );
	}
	if ( ! empty( $subscription['subscription_status'] ) && ! $subscription['active'] ) {
		$config['intro'] .= ' The subscription is no longer active; the original payment record remains confirmed.';
	}
	return $config;
}

function mmps_item_meta( $item, $wanted ) {
	if ( ! $item || ! method_exists( $item, 'get_meta_data' ) ) {
		return '';
	}
	foreach ( $item->get_meta_data() as $meta ) {
		$key = isset( $meta->key ) ? sanitize_key( str_replace( array( 'attribute_', 'pa_' ), '', (string) $meta->key ) ) : '';
		if ( in_array( $key, $wanted, true ) && isset( $meta->value ) && is_scalar( $meta->value ) ) {
			return sanitize_text_field( (string) $meta->value );
		}
	}
	return '';
}

function mmps_usce_details( $order ) {
	$details = array();
	if ( ! $order ) {
		return $details;
	}
	foreach ( $order->get_items( 'line_item' ) as $item ) {
		if ( 'usce' !== mmps_family_for_item( $item ) ) {
			continue;
		}
		$details[] = array(
			'program'   => method_exists( $item, 'get_name' ) ? (string) $item->get_name() : 'US Clinical Experience',
			'location'  => mmps_item_meta( $item, array( 'location' ) ),
			'specialty' => mmps_item_meta( $item, array( 'specialty' ) ),
		);
	}
	return $details;
}

function mmps_model_for_order( $order ) {
	$rows          = mmps_order_product_rows( $order );
	$product_ids   = mmps_order_product_ids( $rows );
	$subscriptions = mmps_subscriptions( $order );
	$subscription  = mmps_subscription_summary( $subscriptions );
	$family        = mmps_classify_order( $order );
	$config        = mmps_family_config( $family, $product_ids, $subscription );
	$paid          = method_exists( $order, 'is_paid' ) && $order->is_paid();
	$status        = $paid ? 'Payment confirmed' : 'Payment pending';
	$access        = $paid ? 'Ready for next steps' : 'Inactive — payment pending';
	if ( ! empty( $subscriptions ) && ! $subscription['active'] ) {
		$access = 'Inactive — subscription ended';
	}
	if ( $paid && $subscription['active'] && array_intersect( $product_ids, array( 6360, 9109 ) ) ) {
		$user_id     = absint( $order->get_user_id() );
		$course_ok   = $user_id && function_exists( 'sfwd_lms_has_access' ) && sfwd_lms_has_access( 6357, $user_id );
		$capability  = $user_id && user_can( $user_id, 'missionmed_access_drj_drills' );
		$access      = $course_ok || $capability ? 'Active — Daily Rounds ready' : 'Inactive — access needs review';
	}
	if ( 'examprep' === $family && array_intersect( $product_ids, array( 6360, 9109 ) ) && 0 !== strpos( $access, 'Active' ) ) {
		$config['primary']   = array( 'label' => 'VIEW MY EXAMPREP ACCOUNT', 'url' => mmps_urls()['account'] );
		$config['secondary'] = array( 'label' => 'CONTACT DR J', 'url' => 'mailto:drj@missionmedinstitute.com' );
	}
	return array(
		'family'       => $family,
		'config'       => $config,
		'products'     => $rows,
		'order_number' => method_exists( $order, 'get_order_number' ) ? $order->get_order_number() : $order->get_id(),
		'order_status' => $status,
		'access'       => $access,
		'subscription' => $subscription,
		'usce'         => 'usce' === $family ? mmps_usce_details( $order ) : array(),
	);
}

function mmps_render_styles() {
	?>
	<style>
	body.woocommerce-order-received .woocommerce{max-width:none!important}
	body.woocommerce-order-received #mm-mobile-notice{display:none!important}
	body.woocommerce-order-received.mmps-rendered .entry-title,body.woocommerce-order-received.mmps-rendered h1.entry-title{display:none!important}
	.mmps-shell,.mmps-shell *{box-sizing:border-box}
	.mmps-shell{--navy:#071526;--panel:#0d2943;--panel2:#123754;--gold:#edbd4d;--gold2:#ffd66c;--mint:#55e4ce;--text:#fff;--muted:#d8e6f4;width:100vw;max-width:100vw;margin:0 calc(50% - 50vw);padding:clamp(14px,2.3vw,34px) clamp(14px,3.4vw,52px) clamp(36px,4vw,62px);overflow:hidden;color:var(--text);font:16px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 82% 8%,rgba(85,228,206,.18),transparent 30%),radial-gradient(circle at 10% 30%,rgba(237,189,77,.12),transparent 28%),linear-gradient(150deg,#061220,#0b2943 58%,#071526)}
	.mmps-stage,.mmps-below{width:min(1420px,100%);margin:0 auto}
	.mmps-stage{overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:26px;background:rgba(6,17,31,.82);box-shadow:0 26px 74px rgba(0,0,0,.34)}
	.mmps-brand{display:flex;align-items:center;min-height:82px;padding:10px 24px;background:#fff;border-bottom:1px solid rgba(6,17,31,.12)}
	.mmps-brand img{width:min(220px,68vw);height:auto;max-height:68px;object-fit:contain}
	.mmps-hero-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(330px,.85fr);gap:18px;padding:18px}
	.mmps-hero,.mmps-summary,.mmps-card{border:1px solid rgba(255,255,255,.17);border-radius:21px;background:linear-gradient(145deg,rgba(10,31,51,.98),rgba(14,46,72,.96));box-shadow:0 16px 44px rgba(0,0,0,.24)}
	.mmps-hero{padding:clamp(24px,3.3vw,48px);background:radial-gradient(circle at 88% 8%,rgba(237,189,77,.2),transparent 28%),linear-gradient(140deg,rgba(5,17,31,.99),rgba(10,42,65,.98))}
	.mmps-kicker{display:inline-flex;margin:0 0 13px;padding:7px 12px;border:1px solid rgba(85,228,206,.38);border-radius:999px;color:var(--mint)!important;background:rgba(85,228,206,.09);font-size:12px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
	.mmps-hero h1{margin:0;color:#fff!important;font-size:clamp(38px,5vw,68px);line-height:.96;font-weight:950;letter-spacing:-.035em;text-wrap:balance}
	.mmps-hero h1 span{display:block}.mmps-hero h1 span:last-child{margin-top:7px;color:var(--gold2)!important;font-size:.6em;line-height:1.05;letter-spacing:-.02em}
	.mmps-intro{max-width:760px;margin:18px 0 0;color:#f2f7fc!important;font-size:clamp(17px,1.7vw,21px);font-weight:650;line-height:1.4}
	.mmps-shell .mmps-kicker{color:#55e4ce!important;opacity:1!important}
	.mmps-shell .mmps-intro{color:#f2f7fc!important;opacity:1!important}
	.mmps-shell .mmps-product,.mmps-shell .mmps-fact dd,.mmps-shell .mmps-step h3,.mmps-shell .mmps-step p,.mmps-shell .mmps-card p{color:#f3f8fd!important;opacity:1!important}
	.mmps-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:24px}
	.mmps-button{display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:14px 22px;border:1px solid rgba(255,255,255,.26);border-radius:14px;color:#fff!important;background:rgba(255,255,255,.08);font-weight:950;text-decoration:none!important;letter-spacing:.02em;text-align:center}
	.mmps-button--primary{border-color:var(--gold);color:#071526!important;background:var(--gold);box-shadow:0 13px 30px rgba(237,189,77,.24)}
	.mmps-button:hover,.mmps-button:focus{transform:translateY(-1px);outline:3px solid rgba(255,255,255,.25);outline-offset:2px}.mmps-button--primary:hover{background:var(--gold2);color:#071526!important}
	.mmps-summary{padding:25px;background:linear-gradient(180deg,rgba(18,55,84,.98),rgba(7,25,43,.98))}
	.mmps-summary h2,.mmps-card h2{margin:0 0 16px;color:#fff!important;font-size:clamp(21px,2vw,27px);font-weight:900}
	.mmps-products{display:grid;gap:9px;margin:0 0 18px}.mmps-product{padding:12px 13px;border-radius:13px;background:rgba(255,255,255,.075);color:#fff;font-weight:850}.mmps-product small{color:var(--muted);font-weight:650}
	.mmps-facts{display:grid;gap:0;margin:0}.mmps-fact{display:grid;grid-template-columns:minmax(105px,.8fr) minmax(0,1.3fr);gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.12)}.mmps-fact dt{color:#a9bed1;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.mmps-fact dd{margin:0;color:#fff;font-weight:850;overflow-wrap:anywhere}.mmps-fact--good dd{color:var(--mint)}
	.mmps-below{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr);gap:20px;margin-top:20px}.mmps-card{padding:clamp(20px,2.2vw,30px)}
	.mmps-timeline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mmps-step{display:grid;grid-template-columns:52px minmax(0,1fr);gap:13px;padding:15px;border:1px solid rgba(255,255,255,.13);border-radius:15px;background:rgba(255,255,255,.06)}.mmps-num{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;color:#071526;background:var(--gold);font-size:12px;font-weight:950}.mmps-step h3{margin:0 0 5px;color:#fff!important;font-size:17px;font-weight:900}.mmps-step p,.mmps-card p,.mmps-card li{margin:0;color:#e8f1f9!important;font-size:15px;line-height:1.5}
	.mmps-stack{display:grid;gap:20px}.mmps-support a{color:var(--gold2)!important;font-weight:900;overflow-wrap:anywhere}.mmps-policy-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.mmps-policy-links a{color:var(--mint)!important;font-weight:850}
	.mmps-usce{margin-top:14px;padding:13px;border:1px solid rgba(237,189,77,.3);border-radius:14px;background:rgba(237,189,77,.06)}.mmps-usce strong{display:block;color:var(--gold2)}.mmps-usce span{color:#fff}
	@media(max-width:840px){.mmps-shell{padding:10px}.mmps-hero-grid,.mmps-below{grid-template-columns:1fr}.mmps-hero-grid{padding:10px;gap:10px}.mmps-brand{justify-content:center}.mmps-summary{order:2}.mmps-timeline{grid-template-columns:1fr}.mmps-actions{display:grid}.mmps-button{width:100%}.mmps-hero h1{font-size:clamp(34px,10vw,48px)}.mmps-fact{grid-template-columns:1fr;gap:4px}.mmps-stage,.mmps-below{width:100%;max-width:100%}}
	@media(max-width:420px){.mmps-shell{font-size:16px}.mmps-hero,.mmps-summary,.mmps-card{padding:18px 16px}.mmps-step{grid-template-columns:44px minmax(0,1fr);padding:13px}.mmps-num{width:40px;height:40px}.mmps-brand img{width:min(190px,70vw)}}
	@media(prefers-reduced-motion:reduce){.mmps-button{transition:none!important}.mmps-button:hover,.mmps-button:focus{transform:none!important}}
	</style>
	<script>document.body&&document.body.classList.add('mmps-rendered');</script>
	<?php
}

function mmps_render( $model ) {
	$config = $model['config'];
	$sub    = $model['subscription'];
	?>
	<div class="mmps-shell" role="region" aria-label="MissionMed purchase confirmation" data-purchase-family="<?php echo esc_attr( $model['family'] ); ?>" data-mmps-version="<?php echo esc_attr( MMPS_VERSION ); ?>">
		<?php mmps_render_styles(); ?>
		<section class="mmps-stage">
			<div class="mmps-brand"><img src="<?php echo esc_url( mmps_logo_url() ); ?>" alt="MissionMed Institute" width="220" height="84"></div>
			<div class="mmps-hero-grid">
				<section class="mmps-hero">
					<p class="mmps-kicker"><?php echo esc_html( $config['kicker'] ); ?></p>
					<h1><span><?php echo esc_html( $config['headline'] ); ?></span><span><?php echo esc_html( $config['subheadline'] ); ?></span></h1>
					<p class="mmps-intro"><?php echo esc_html( $config['intro'] ); ?></p>
					<div class="mmps-actions">
						<a class="mmps-button mmps-button--primary" href="<?php echo esc_url( $config['primary']['url'] ); ?>"><?php echo esc_html( $config['primary']['label'] ); ?></a>
						<a class="mmps-button" href="<?php echo esc_url( $config['secondary']['url'] ); ?>"><?php echo esc_html( $config['secondary']['label'] ); ?></a>
					</div>
				</section>
				<aside class="mmps-summary" aria-label="Your enrollment summary">
					<h2>Your Enrollment</h2>
					<div class="mmps-products">
						<?php foreach ( $model['products'] as $product ) : ?>
							<div class="mmps-product"><?php echo esc_html( $product['name'] ); ?><?php if ( $product['qty'] > 1 ) : ?> <small>&times; <?php echo esc_html( $product['qty'] ); ?></small><?php endif; ?></div>
						<?php endforeach; ?>
					</div>
					<dl class="mmps-facts">
						<div class="mmps-fact"><dt>Order</dt><dd>#<?php echo esc_html( $model['order_number'] ); ?></dd></div>
						<div class="mmps-fact mmps-fact--good"><dt>Payment</dt><dd><?php echo esc_html( $model['order_status'] ); ?></dd></div>
						<div class="mmps-fact"><dt>Access</dt><dd><?php echo esc_html( $model['access'] ); ?></dd></div>
						<?php if ( $sub['subscription_status'] ) : ?><div class="mmps-fact"><dt>Subscription</dt><dd><?php echo esc_html( $sub['subscription_status'] ); ?></dd></div><?php endif; ?>
						<?php if ( $sub['renewal'] ) : ?><div class="mmps-fact"><dt>Renewal</dt><dd><?php echo esc_html( $sub['renewal'] ); ?></dd></div><?php endif; ?>
						<?php if ( $sub['next_billing'] ) : ?><div class="mmps-fact"><dt>Next billing</dt><dd><?php echo esc_html( $sub['next_billing'] ); ?></dd></div><?php endif; ?>
						<?php if ( $sub['trial_end'] ) : ?><div class="mmps-fact"><dt>Trial ends</dt><dd><?php echo esc_html( $sub['trial_end'] ); ?></dd></div><?php endif; ?>
						<div class="mmps-fact"><dt>Support</dt><dd><a href="mailto:<?php echo esc_attr( $config['support'] ); ?>"><?php echo esc_html( $config['support'] ); ?></a></dd></div>
					</dl>
					<?php foreach ( $model['usce'] as $detail ) : ?>
						<div class="mmps-usce"><strong><?php echo esc_html( $detail['program'] ); ?></strong><?php if ( $detail['specialty'] ) : ?><span><?php echo esc_html( $detail['specialty'] ); ?></span><?php endif; ?><?php if ( $detail['location'] ) : ?><span> &middot; <?php echo esc_html( $detail['location'] ); ?></span><?php endif; ?></div>
					<?php endforeach; ?>
				</aside>
			</div>
		</section>
		<div class="mmps-below">
			<section class="mmps-card"><h2>What Happens Next</h2><div class="mmps-timeline">
				<?php foreach ( $config['steps'] as $index => $step ) : ?><article class="mmps-step"><div class="mmps-num">STEP <?php echo esc_html( $index + 1 ); ?></div><div><h3><?php echo esc_html( $step[0] ); ?></h3><p><?php echo esc_html( $step[1] ); ?></p></div></article><?php endforeach; ?>
			</div></section>
			<aside class="mmps-stack">
				<section class="mmps-card mmps-support"><h2>Need Help?</h2><p><?php echo esc_html( $config['support_team'] ); ?> is ready to help.</p><p><a href="mailto:<?php echo esc_attr( $config['support'] ); ?>"><?php echo esc_html( $config['support'] ); ?></a></p></section>
				<section class="mmps-card"><h2>Billing &amp; Policies</h2><p><?php echo esc_html( $config['billing'] ); ?></p><div class="mmps-policy-links"><a href="<?php echo esc_url( mmps_urls()['terms'] ); ?>">Terms</a><a href="<?php echo esc_url( mmps_urls()['refunds'] ); ?>">Refund &amp; cancellation policy</a></div></section>
			</aside>
		</div>
	</div>
	<?php
}

function mmps_rendered( $set = false ) {
	static $rendered = false;
	if ( $set ) {
		$rendered = true;
	}
	return $rendered;
}

function mmps_render_order( $order_id ) {
	if ( mmps_rendered() || ! function_exists( 'wc_get_order' ) ) {
		return false;
	}
	$order = wc_get_order( absint( $order_id ) );
	if ( ! $order || $order->has_status( 'failed' ) ) {
		return false;
	}
	mmps_rendered( true );
	mmps_render( mmps_model_for_order( $order ) );
	return true;
}

function mmps_request_order_id() {
	$order_id = absint( get_query_var( 'order-received' ) );
	if ( $order_id ) {
		return $order_id;
	}
	global $wp;
	if ( isset( $wp->query_vars['order-received'] ) ) {
		return absint( $wp->query_vars['order-received'] );
	}
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	return preg_match( '#/checkout/order-received/([0-9]+)/?#', $request_uri, $matches ) ? absint( $matches[1] ) : 0;
}

function mmps_authorized_order() {
	if ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() || ! function_exists( 'wc_get_order' ) ) {
		return false;
	}
	$order = wc_get_order( mmps_request_order_id() );
	if ( ! $order || $order->has_status( 'failed' ) ) {
		return false;
	}
	$key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';
	if ( $key && hash_equals( (string) $order->get_order_key(), $key ) ) {
		return $order;
	}
	if ( is_user_logged_in() && absint( $order->get_user_id() ) === get_current_user_id() ) {
		return $order;
	}
	return current_user_can( 'manage_woocommerce' ) ? $order : false;
}

function mmps_footer_fallback() {
	if ( mmps_rendered() ) {
		return;
	}
	$order = mmps_authorized_order();
	if ( ! $order ) {
		return;
	}
	?><div id="mmps-fallback"><?php mmps_render_order( $order->get_id() ); ?></div><script>(function(){var h=document.getElementById('mmps-fallback'),s=h&&h.querySelector('.mmps-shell'),t=document.querySelector('.woocommerce-order')||document.querySelector('.woocommerce')||document.querySelector('main');if(s&&t)t.insertBefore(s,t.firstChild);if(h&&!h.querySelector('.mmps-shell'))h.remove()}());</script><?php
}

add_action( 'woocommerce_before_thankyou', 'mmps_render_order', 1, 1 );
add_action( 'woocommerce_thankyou', 'mmps_render_order', 1, 1 );
add_action( 'wp_footer', 'mmps_footer_fallback', 5 );

add_action(
	'wp_loaded',
	function () {
		if ( function_exists( 'mm_mr_0914_post_enrollment_expectations' ) ) {
			remove_action( 'woocommerce_thankyou', 'mm_mr_0914_post_enrollment_expectations', 5 );
		}
	},
	99
);
