<?php
/**
 * Plugin Name: MissionMed USCE Tracker CTA
 * Description: Adds the USCE tracker CTA below the Clinicals hero and the approved-seat handoff popup on the USCE product page.
 * Author: MissionMed
 * Version: 2026.05.13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'wp_footer',
	function () {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		$normalized  = is_string( $path ) ? trim( $path, '/' ) : '';

		$is_usce_home    = 'usce' === $normalized;
		$is_usce_product = 'product/usce-clinical-rotations' === $normalized;

		if ( ! $is_usce_home && ! $is_usce_product ) {
			return;
		}
		?>
		<style id="missionmed-usce-tracker-cta-20260513">
			#mm-usce-applied-cta {
				background: #061c2f;
				color: #fff;
				padding: clamp(24px, 4vw, 44px) 18px;
				border-top: 1px solid rgba(244, 211, 106, .3);
				border-bottom: 1px solid rgba(244, 211, 106, .25);
			}
			#mm-usce-applied-cta .mm-usce-cta-inner {
				max-width: 1160px;
				margin: 0 auto;
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				gap: 22px;
				align-items: center;
				background: linear-gradient(135deg, rgba(15, 106, 148, .72), rgba(3, 24, 43, .94));
				border: 1px solid rgba(255, 255, 255, .16);
				border-radius: 22px;
				padding: clamp(22px, 3vw, 34px);
				box-shadow: 0 24px 70px rgba(0, 0, 0, .24);
			}
			#mm-usce-applied-cta .mm-usce-cta-kicker,
			.mm-usce-seat-modal .mm-usce-seat-kicker {
				color: #f4d36a;
				font-size: 12px;
				font-weight: 900;
				letter-spacing: .16em;
				text-transform: uppercase;
			}
			#mm-usce-applied-cta h2 {
				margin: 8px 0 10px;
				color: #fff;
				font-size: clamp(30px, 4vw, 52px);
				line-height: .98;
				font-weight: 900;
			}
			#mm-usce-applied-cta p {
				margin: 0;
				color: rgba(255, 255, 255, .84);
				font-size: clamp(16px, 1.55vw, 20px);
				line-height: 1.5;
			}
			#mm-usce-applied-cta .mm-usce-cta-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
				justify-content: flex-end;
			}
			#mm-usce-applied-cta a,
			.mm-usce-seat-modal a,
			.mm-usce-seat-modal button {
				border: 0;
				border-radius: 999px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-height: 48px;
				padding: 0 20px;
				font-size: 13px;
				font-weight: 900;
				letter-spacing: .08em;
				text-decoration: none;
				text-transform: uppercase;
				cursor: pointer;
			}
			#mm-usce-applied-cta .mm-usce-cta-primary,
			.mm-usce-seat-modal .mm-usce-seat-primary {
				background: linear-gradient(135deg, #f7d45f, #f3a72c);
				color: #061c2f;
				box-shadow: 0 14px 30px rgba(244, 211, 106, .28);
			}
			#mm-usce-applied-cta .mm-usce-cta-secondary,
			.mm-usce-seat-modal .mm-usce-seat-secondary {
				background: rgba(255, 255, 255, .1);
				color: #fff;
				border: 1px solid rgba(255, 255, 255, .24);
			}
			.mm-usce-seat-backdrop {
				position: fixed;
				inset: 0;
				z-index: 999998;
				background: rgba(1, 11, 22, .72);
				backdrop-filter: blur(8px);
			}
			.mm-usce-seat-modal {
				position: fixed;
				left: 50%;
				top: 50%;
				z-index: 999999;
				width: min(640px, calc(100vw - 32px));
				transform: translate(-50%, -50%);
				background: linear-gradient(145deg, #08243c, #051524);
				color: #fff;
				border: 1px solid rgba(244, 211, 106, .45);
				border-radius: 24px;
				padding: clamp(24px, 4vw, 38px);
				box-shadow: 0 30px 90px rgba(0, 0, 0, .45);
			}
			.mm-usce-seat-modal h2 {
				margin: 8px 0 12px;
				color: #fff;
				font-size: clamp(30px, 4vw, 48px);
				line-height: 1;
			}
			.mm-usce-seat-modal p {
				color: rgba(255, 255, 255, .86);
				font-size: 17px;
				line-height: 1.55;
			}
			.mm-usce-seat-modal .mm-usce-seat-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
				margin-top: 22px;
			}
			@media (max-width: 760px) {
				#mm-usce-applied-cta .mm-usce-cta-inner {
					grid-template-columns: 1fr;
				}
				#mm-usce-applied-cta .mm-usce-cta-actions {
					justify-content: flex-start;
				}
			}
		</style>
		<script id="missionmed-usce-tracker-cta-20260513-js">
			(function () {
				var trackerUrl = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_status_tracker.html';
				var requestUrl = 'https://missionmedinstitute.com/rotation-request';
				var path = window.location.pathname.replace(/\/+$/, '');

				function insertTrackerCta() {
					if (path !== '/usce' || document.getElementById('mm-usce-applied-cta')) return;
					var hero = document.querySelector('.cl1403c-a-hero') || document.querySelector('main section') || document.querySelector('.elementor section');
					var cta = document.createElement('section');
					cta.id = 'mm-usce-applied-cta';
					cta.setAttribute('aria-label', 'Track an existing USCE application');
					cta.innerHTML = '<div class="mm-usce-cta-inner"><div><div class="mm-usce-cta-kicker">Request tracker</div><h2>Already applied for rotations?</h2><p>Track your status, follow updates, and return to your request from the same email you used to apply.</p></div><div class="mm-usce-cta-actions"><a class="mm-usce-cta-primary" href="' + trackerUrl + '">Track your status</a><a class="mm-usce-cta-secondary" href="' + requestUrl + '">Submit a request</a></div></div>';
					if (hero && hero.parentNode) {
						hero.insertAdjacentElement('afterend', cta);
					} else if (document.body) {
						document.body.insertAdjacentElement('afterbegin', cta);
					}
				}

				function showApprovedSeatModal() {
					var params = new URLSearchParams(window.location.search);
					if (path !== '/product/usce-clinical-rotations' || params.get('usce_offer_approved') !== '1' || document.querySelector('.mm-usce-seat-modal')) return;
					var backdrop = document.createElement('div');
					backdrop.className = 'mm-usce-seat-backdrop';
					var modal = document.createElement('div');
					modal.className = 'mm-usce-seat-modal';
					modal.setAttribute('role', 'dialog');
					modal.setAttribute('aria-modal', 'true');
					modal.setAttribute('aria-labelledby', 'mm-usce-seat-title');
					modal.innerHTML = '<div class="mm-usce-seat-kicker">Rotation seat approved</div><h2 id="mm-usce-seat-title">Congrats. You have a rotation seat approved.</h2><p>You now have 48 hours to secure it before the seat is released. Select the location and specialty you were approved for, then complete enrollment on this page.</p><div class="mm-usce-seat-actions"><a class="mm-usce-seat-primary" href="#product-3784">Select location and specialty</a><button type="button" class="mm-usce-seat-secondary">I understand</button></div>';
					function closeModal() {
						backdrop.remove();
						modal.remove();
					}
					backdrop.addEventListener('click', closeModal);
					modal.querySelector('button').addEventListener('click', closeModal);
					modal.querySelector('a').addEventListener('click', function () {
						closeModal();
						var target = document.querySelector('form.variations_form') || document.querySelector('.product');
						if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
					});
					document.body.appendChild(backdrop);
					document.body.appendChild(modal);
				}

				if (document.readyState === 'loading') {
					document.addEventListener('DOMContentLoaded', function () {
						insertTrackerCta();
						showApprovedSeatModal();
					});
				} else {
					insertTrackerCta();
					showApprovedSeatModal();
				}
			})();
		</script>
		<?php
	},
	30
);
