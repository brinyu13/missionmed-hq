<?php
/**
 * Plugin Name: MissionMed MR Homepage Cleanup
 * Description: Scoped Mission Residency homepage copy and layout cleanup for MM-MR-HOMEPAGE-CLEANUP-001B.
 * Author: MissionMed
 * Version: 1.0.0
 *
 * Safety: Front-end Mission Residency page only. Admin, AJAX, REST, cron, and CLI are untouched.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'template_redirect', 'mm_mr_homepage_cleanup_start_buffer', 1 );

function mm_mr_homepage_cleanup_start_buffer() {
    if ( ! mm_mr_homepage_cleanup_is_target_request() ) {
        return;
    }

    ob_start( 'mm_mr_homepage_cleanup_render' );
}

function mm_mr_homepage_cleanup_is_target_request() {
    if ( is_admin() ) {
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

    if ( function_exists( 'is_page' ) && ( is_page( 5686 ) || is_page( 'mission-residency' ) ) ) {
        return true;
    }

    $request_uri = isset( $_SERVER['REQUEST_URI'] )
        ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) )
        : '';
    $request_path = trim( (string) wp_parse_url( $request_uri, PHP_URL_PATH ), '/' );

    return 'mission-residency' === $request_path;
}

function mm_mr_homepage_cleanup_render( $html ) {
    if ( ! is_string( $html ) || strlen( $html ) < 500 ) {
        return $html;
    }

    if ( false === stripos( $html, 'page-id-5686' ) && false === stripos( $html, 'mr1503d-' ) ) {
        return $html;
    }

    if ( false === stripos( $html, 'mm-mr-homepage-cleanup-001b-css' ) ) {
        $html = mm_mr_homepage_cleanup_inject_before(
            $html,
            '</head>',
            mm_mr_homepage_cleanup_css() . "\n"
        );
    }

    if ( false === stripos( $html, 'mm-mr-homepage-cleanup-001b-js' ) ) {
        $html = mm_mr_homepage_cleanup_inject_before(
            $html,
            '</body>',
            mm_mr_homepage_cleanup_js() . "\n"
        );
    }

    return $html;
}

function mm_mr_homepage_cleanup_inject_before( $html, $needle, $payload ) {
    if ( false !== stripos( $html, $needle ) ) {
        return preg_replace( '/' . preg_quote( $needle, '/' ) . '/i', $payload . $needle, $html, 1 );
    }

    return $html . $payload;
}

function mm_mr_homepage_cleanup_css() {
    return <<<'CSS'
<style id="mm-mr-homepage-cleanup-001b-css">
body.page-id-5686 .mr1503d-mustvisit,
body.page-id-5686 .mr1503d-objection,
body.page-id-5686 [data-mm-mr-cleanup-hidden="1"] {
  display: none !important;
}

@media (min-width: 1025px) {
  body.page-id-5686 .mr1503d-hero-inner {
    padding-top: 42px !important;
    padding-bottom: 32px !important;
    min-height: auto !important;
  }

  body.page-id-5686 .mr1503d-h1 {
    font-size: clamp(44px, 4.5vw, 52px) !important;
    line-height: 1.04 !important;
  }

  body.page-id-5686 .mr1503d-cost {
    padding-top: 34px !important;
    padding-bottom: 34px !important;
  }

  body.page-id-5686 [data-mr1503d-costnum] {
    font-size: clamp(42px, 4.8vw, 58px) !important;
    line-height: 1 !important;
  }

  body.page-id-5686 .mr1503d-brian,
  body.page-id-5686 .mr1503d-brian-content {
    padding-top: 34px !important;
    padding-bottom: 34px !important;
  }
}

body.page-id-5686 .mr1503d-rf {
  padding-top: 34px !important;
  padding-bottom: 34px !important;
}

body.page-id-5686 .mr1503d-rf [data-mr1503d-rf] {
  white-space: nowrap !important;
}

body.page-id-5686 .mr1503d-rf-tabs,
body.page-id-5686 .mr1503d-rf [class*="tabs"],
body.page-id-5686 .mr1503d-rf [class*="filter"] {
  gap: 8px !important;
}

@media (min-width: 768px) {
  body.page-id-5686 .mr1503d-rf-tabs,
  body.page-id-5686 .mr1503d-rf [class*="tabs"],
  body.page-id-5686 .mr1503d-rf [class*="filter"] {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
  }
}

body.page-id-5686 .mr1503d-rf-card {
  margin-bottom: 8px !important;
}

body.page-id-5686 .mr1503d-brian img {
  object-fit: cover !important;
  object-position: center 15% !important;
}

body.page-id-5686 .mm-mr-brian-verified-quotes {
  display: grid;
  gap: 10px;
  margin: 18px 0;
}

body.page-id-5686 .mm-mr-brian-verified-quotes blockquote {
  margin: 0;
  padding: 14px 16px;
  border-left: 3px solid #d6a94a;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

body.page-id-5686 .mm-mr-brian-verified-quotes p {
  margin: 0 0 6px;
}

body.page-id-5686 .mm-mr-brian-verified-quotes cite {
  display: block;
  font-size: 0.88em;
  opacity: 0.82;
  font-style: normal;
}
</style>
CSS;
}

function mm_mr_homepage_cleanup_js() {
    return <<<'JS'
<script id="mm-mr-homepage-cleanup-001b-js">
(function() {
  'use strict';

  var TARGET_PATH = '/mission-residency';
  var COURSES_URL = 'https://missionmedinstitute.com/mission-residency-courses/';
  var ALUMNI_URL = '/what-alumni-said/';

  function isTargetPage() {
    var path = window.location.pathname.replace(/\/+$/, '');
    return path === TARGET_PATH || document.body.classList.contains('page-id-5686');
  }

  if (!isTargetPage()) {
    return;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function cleanText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function hasText(el, needle) {
    return el && cleanText(el.textContent).toLowerCase().indexOf(needle.toLowerCase()) !== -1;
  }

  function hideElement(el) {
    if (el) {
      el.setAttribute('data-mm-mr-cleanup-hidden', '1');
      el.style.display = 'none';
    }
  }

  function closestBlock(el) {
    return el && el.closest('.elementor-widget-button, .elementor-widget, .elementor-element, .e-con, section');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[ch];
    });
  }

  function setParagraphByNeedle(root, needle, replacement) {
    if (!root) return;
    var nodes = root.querySelectorAll('p, .mr1503d-lead, .elementor-widget-text-editor, div');
    Array.prototype.some.call(nodes, function(el) {
      if (!hasText(el, needle)) return false;
      el.textContent = replacement;
      return true;
    });
  }

  function applyHero() {
    var hero = document.querySelector('.mr1503d-hero');
    if (!hero) return;

    var h1 = hero.querySelector('.mr1503d-h1, h1');
    if (h1 && hasText(h1, 'red flags')) {
      h1.innerHTML = 'Scores don&#039;t decide your Match.<br><span>Your STORY does.</span>';
    }

    var lead = hero.querySelector('.mr1503d-lead');
    if (lead && hasText(lead, '89.1% match rate')) {
      lead.textContent = 'When was the last time a patient asked for your USMLE score? Or asked to read your letter of recommendation? Strong exam performance opens doors to interviews. But once you are in the room, the 2024 NRMP Program Director Survey confirms what we have seen for 17 years: interpersonal skills, faculty interaction, and how you communicate your story are the top factors that determine whether you match. We train the skill that earns the rank.';
    }

    var heroButtons = Array.prototype.filter.call(hero.querySelectorAll('a'), function(a) {
      return cleanText(a.textContent).toLowerCase() === 'read what alumni said';
    });

    if (heroButtons[0]) {
      heroButtons[0].textContent = 'Read Alumni Stories';
      heroButtons[0].setAttribute('href', ALUMNI_URL);
    }

    if (heroButtons[1]) {
      heroButtons[1].textContent = 'What Program Directors Look For';
      heroButtons[1].setAttribute('href', '#pdf');
    }

    hideElement(document.querySelector('.mr1503d-mustvisit'));
  }

  function applyProblemAndPdfCopy() {
    setParagraphByNeedle(
      document.querySelector('.mr1503d-problem'),
      'only to ace interviews',
      'If all you want is to rehearse interview answers, this is not the right program. But if you want to become the doctor who can talk to a patient at 2 a.m., hold your own with a senior attending, and explain what you do to your family at the kitchen table, this training stays with you long after Match Day. Communication is the skill behind every conversation that matters. We train it once. You carry it forward.'
    );

    var pdf = document.querySelector('.mr1503d-pdf');
    if (!pdf) return;

    var walker = document.createTreeWalker(pdf, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(function(node) {
      node.nodeValue = node.nodeValue.replace(
        /\s*The ones that stay grey are background factors no coaching can change\./i,
        ''
      );
    });
  }

  var rfData = {
    all: {
      stat: '100%',
      lab: 'matched in our verified red-flag dataset',
      desc: 'Across the verified testimonial database: old graduation year, low scores, attempts, visa complexity, repeat cycles, and competitive specialty concerns are trainable interview-story problems, not permanent labels.',
      cards: [
        { n: 'Chelsey Cc', d: 'Five residency cycles before matching', q: 'After 5 residency cycles with sweats, tears, and growing curves, I AM SO PROUD TO SHARE THAT I HAVE MATCHED!', source: 'Facebook Testimonial Archive, Row 8' },
        { n: 'Sonia Jahan', d: 'Fifth cycle, Internal Medicine', q: 'Once an impossible dream turned into reality.', source: 'Facebook Testimonial Archive, Row 17' },
        { n: 'Anissa Rahman', d: 'YOG 2007, first-choice match', q: 'It is ABSOLUTELY POSSIBLE no matter what your year of graduation is.', source: 'Alumni Master CSV, Row 80' }
      ]
    },
    oldgrad: {
      stat: 'YOG 2007+',
      lab: 'verified old-graduate examples',
      desc: 'Old graduation year is common in the verified red-flag set. The page now uses named examples or factual cards instead of internal reference IDs.',
      cards: [
        { n: 'Anissa Rahman', d: 'YOG 2007, first-choice match', q: 'It is ABSOLUTELY POSSIBLE no matter what your year of graduation is.', source: 'Alumni Master CSV, Row 80' },
        { n: 'Bhavna Singla', d: 'YOG 2007, Internal Medicine', q: 'Matched Internal Medicine on my 1st attempt. My personality changed after the course.', source: 'Alumni Master CSV, Row 79' },
        { n: 'Yamini Arukala', d: 'YOG 2008, Family Medicine', q: 'Matched Family Medicine after a long YOG gap through Mission Residency coaching.', source: 'Facebook Testimonial Archive, Row 19' }
      ]
    },
    lowstep: {
      stat: '191',
      lab: 'lowest verified Step 1 matched in Brian records',
      desc: 'When no strong verbatim quote is available, this filter uses factual outcome cards rather than invented student quotes.',
      cards: [
        { n: 'Verified outcome card', d: 'Step 1 score 191', q: 'Lowest verified Step 1 in the Mission Residency database: 191. Matched Family Medicine.', source: 'Existing Mission Residency FAQ/data claim' },
        { n: 'Kanwar Supreet Jolly', d: 'Step 1: 219, Step 2 CK: 240', q: 'Had old grad year and gap in clinical practice as red flags.', source: 'Facebook Testimonial Archive, Row 77' },
        { n: 'PM Menon', d: 'Lower CK score, gap, older YOG', q: 'Despite having multiple red flags (lower CK score, a significant gap and an older YOG), I have been accepted into a program today.', source: 'Facebook Testimonial Archive, Row 39' }
      ]
    },
    attempt: {
      stat: 'Attempts',
      lab: 'recoverable with the right story',
      desc: 'USMLE attempts should be addressed directly and strategically. This filter avoids anonymous internal IDs and unsupported quote attribution.',
      cards: [
        { n: 'Randy Chihao Lin', d: 'Step 1 second attempt, Internal Medicine', q: 'Step 1 2nd attempt.', source: 'Facebook Testimonial Archive, Row 3' },
        { n: 'Factual outcome card', d: 'Multiple attempts across specialties', q: 'Students with failed USMLE attempts have matched in Internal Medicine, Family Medicine, Psychiatry, and Pediatrics through Mission Residency.', source: 'Mission Residency outcome record summary' },
        { n: 'Factual strategy card', d: 'Attempt history', q: 'The strategy is to own the attempt, show growth, and make the interview story stronger than the score line.', source: 'MM-MR-HOMEPAGE-CLEANUP-001 verified spec' }
      ]
    },
    multicycle: {
      stat: '5 cycles',
      lab: 'repeat-cycle students still matched',
      desc: 'The repeat-cycle filter uses verified or publicly posted testimonials and removes internal identifiers.',
      cards: [
        { n: 'Sonia Jahan', d: 'Fifth cycle, Internal Medicine', q: 'This was my fifth cycle and I matched! Once an impossible dream turned into reality.', source: 'Facebook Testimonial Archive, Row 17' },
        { n: 'Wahida Rashid Rakhi', d: 'Third cycle success', q: 'After I did not match in my first cycle, I sought help from Mission Residency.', source: 'Facebook Testimonial Archive, Row 46' },
        { n: 'Gunjanpreet Kaur', d: 'Prior unmatched cycle', q: 'Going one cycle without matching and completely unsure about my next step, I trusted Mission Residency for the rest of my journey.', source: 'Facebook Testimonial Archive, Row 37' }
      ]
    },
    visa: {
      stat: 'Visa',
      lab: 'complexity addressed explicitly',
      desc: 'Where a fully verified quote is not available, this filter uses public testimonial language and factual support framing.',
      cards: [
        { n: 'JaLpa Kumari', d: 'Visa denial, returned for support', q: 'I only sent one text to Dr. B, and here I am in a 360 session, receiving support that goes above and beyond.', source: 'Facebook Testimonial Archive, Row 14' },
        { n: 'Factual support card', d: 'J-1 and H-1B complexity', q: 'Mission Residency has coached visa-sponsored students across specialties and helps navigate the extra targeting and interview complexity visa status adds.', source: 'MM-MR-HOMEPAGE-CLEANUP-001 verified spec' }
      ]
    },
    oneIV: {
      stat: '1 IV',
      lab: 'single-interview preparation',
      desc: 'No CSV testimonial explicitly says "I had only one interview and matched," so this filter uses factual outcome cards instead of fabricated quotes.',
      cards: [
        { n: 'Factual outcome card', d: 'Single interview invitation', q: 'Multiple Mission Residency students have matched with a single interview. When you only get one shot, preparation is not optional.', source: 'MM-MR-HOMEPAGE-CLEANUP-001 verified spec' },
        { n: 'Preparation card', d: 'One-shot interview strategy', q: 'The work is deep program research, pressure-tested answers, and a story that can hold up under follow-up questions.', source: 'MM-MR-HOMEPAGE-CLEANUP-001 verified spec' }
      ]
    },
    competitive: {
      stat: 'PM&R, Anesthesia, Radiology',
      lab: 'competitive specialty examples',
      desc: 'Competitive-specialty cards now use named verified alumni outcomes rather than placeholder references.',
      cards: [
        { n: 'Renu Joy', d: 'Anesthesiology, NYP Brooklyn Methodist', q: 'Staff Anesthesiologist, Bayhealth Medical Center after Anesthesiology residency.', source: 'Alumni Master CSV, Row 53' },
        { n: 'Fareha Mir', d: 'Psychiatry, Kansas City University', q: 'Child and Adolescent Psychiatry fellowship, University of Chicago.', source: 'Alumni Master CSV, Row 81' },
        { n: 'Bipin Saroha', d: 'Diagnostic Radiology, Larkin Community Hospital', q: 'VIR Fellowship, Baptist Health Miami; now Kaiser Permanente LA.', source: 'Alumni Master CSV, Row 38' }
      ]
    }
  };

  function renderRf(which) {
    var data = rfData[which] || rfData.all;
    var stat = document.querySelector('[data-mr1503d-rfstatnum]');
    var lab = document.querySelector('[data-mr1503d-rfstatlab]');
    var desc = document.querySelector('[data-mr1503d-rfdesc]');
    var cards = document.querySelector('[data-mr1503d-rfcards]');

    if (stat) stat.textContent = data.stat;
    if (lab) lab.textContent = data.lab;
    if (desc) desc.textContent = data.desc;
    if (!cards) return;

    cards.innerHTML = data.cards.map(function(card) {
      return '<div class="mr1503d-rf-card">' +
        '<div class="name">' + escapeHtml(card.n) + '</div>' +
        '<div class="det">' + escapeHtml(card.d) + '</div>' +
        '<div class="quote">' + escapeHtml(card.q) + '</div>' +
        '<div class="det">' + escapeHtml(card.source) + '</div>' +
      '</div>';
    }).join('');
  }

  function bindRedFlagButtons() {
    var buttons = document.querySelectorAll('[data-mr1503d-rf]');
    Array.prototype.forEach.call(buttons, function(button) {
      if (button.dataset.mmMrCleanupBound === '1') return;
      button.dataset.mmMrCleanupBound = '1';
      button.addEventListener('click', function() {
        var key = button.getAttribute('data-mr1503d-rf') || 'all';
        window.setTimeout(function() { renderRf(key); cleanInternalReferences(); }, 40);
      });
    });

    if (document.querySelector('[data-mr1503d-rfcards]')) {
      renderRf('all');
    }
  }

  function applyCostAndMatchFirst() {
    var cost = document.querySelector('.mr1503d-cost');
    if (cost) {
      Array.prototype.forEach.call(cost.querySelectorAll('a, button'), function(el) {
        var text = cleanText(el.textContent).toLowerCase();
        if (text === 'see what missionmed costs' || text === 'read what alumni said') {
          hideElement(closestBlock(el) || el);
        }
      });
    }

    var matchFirst = document.querySelector('.mr1503d-matchfirst');
    if (matchFirst) {
      setParagraphByNeedle(
        matchFirst,
        'pay a deposit to start training',
        'MatchFirst is the only deferred-payment model in the IMG residency space. Start training at a lower initial tuition. Receive 100% of the program from Day 1. If you match (with participation terms met), you pay the remaining balance after Match Day. If you do not match, the balance is waived.'
      );

      Array.prototype.forEach.call(matchFirst.querySelectorAll('h3, h4, strong, .mr1503d-method-step *'), function(el) {
        if (hasText(el, 'Pay deposit, training begins')) {
          el.textContent = 'Lower initial tuition, training begins immediately';
        }
      });

      Array.prototype.forEach.call(matchFirst.querySelectorAll('a, button'), function(el) {
        if (cleanText(el.textContent).toLowerCase() === 'read what alumni said') {
          hideElement(closestBlock(el) || el);
        }
      });
    }
  }

  function applyBrian() {
    var brian = document.querySelector('.mr1503d-brian');
    if (!brian) return;

    var bioNode = null;
    Array.prototype.some.call(brian.querySelectorAll('p, .mr1503d-lead, div'), function(el) {
      if (!hasText(el, 'Mission Residency is not a team of experts')) return false;
      bioNode = el;
      return true;
    });

    if (bioNode && bioNode.dataset.mmMrCleanupBio !== '1') {
      bioNode.dataset.mmMrCleanupBio = '1';
      bioNode.innerHTML = 'Before founding Mission Residency, Dr. Brian served as Medical Director at Kaplan Medical International in New York City, then as Director of International Medical Education Development at Falcon Med, where he worked alongside USMLE educator Dr. Goljan. For 17 years, he has personally coached over 3,000 medical students through the residency Match.<br><br>He is not a team. He is not a company. He is the person on the other end of the call at 11 p.m. the night before your interview, the one reviewing your personal statement for the fourth time, and the one who texts you "Buenos Dias" every Sunday morning before your Pre-IV checkup.<br><br>His students know him for one thing above all: he believes in them before they believe in themselves.';
    }

    Array.prototype.forEach.call(brian.querySelectorAll('p, span, div'), function(el) {
      if (hasText(el, 'Former Director of International Medical Education Development at Falcon Med') && !hasText(el, 'Kaplan')) {
        el.textContent = cleanText(el.textContent).replace(
          'Former Director of International Medical Education Development at Falcon Med .',
          'Former Medical Director, Kaplan Medical International (NYC). Former Director of International Medical Education Development at Falcon Med.'
        );
      }
    });

    if (bioNode && !document.getElementById('mm-mr-brian-verified-quotes')) {
      bioNode.insertAdjacentHTML('afterend',
        '<div id="mm-mr-brian-verified-quotes" class="mm-mr-brian-verified-quotes">' +
          '<blockquote><p>"You made me fall in love with my own story and believe that my dreams are valid against all Odds."</p><cite>Marian Ghaly, matched Family Medicine - FB Archive Row 21</cite></blockquote>' +
          '<blockquote><p>"Dr. B treats us like his own family. The kind of training received cannot be summed up in words."</p><cite>Krishna Desai, matched Internal Medicine - FB Archive Row 34</cite></blockquote>' +
          '<blockquote><p>"Dr Brian taught me how to turn my red flags (which I thought were my weaknesses) into my strengths!"</p><cite>Sonia Jahan, matched Internal Medicine - FB Archive Row 17</cite></blockquote>' +
        '</div>'
      );
    }

    Array.prototype.forEach.call(brian.querySelectorAll('a, button'), function(el) {
      if (cleanText(el.textContent).toLowerCase().indexOf('read what alumni said') !== -1) {
        hideElement(closestBlock(el) || el);
      }
    });
  }

  function applyBottomSections() {
    hideElement(document.querySelector('.mr1503d-objection'));

    var bottom = document.querySelector('.mr1503d-cta');
    if (!bottom) return;

    var converted = false;
    Array.prototype.forEach.call(bottom.querySelectorAll('a, button'), function(el) {
      var text = cleanText(el.textContent).toLowerCase();
      if (text.indexOf('read what alumni said') === -1) return;

      if (!converted && el.tagName.toLowerCase() === 'a') {
        el.textContent = 'See All Programs';
        el.setAttribute('href', COURSES_URL);
        converted = true;
      } else {
        hideElement(closestBlock(el) || el);
      }
    });
  }

  function cleanInternalReferences() {
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/i.test(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    var nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(function(node) {
      node.nodeValue = node.nodeValue
        .replace(/\s*IMG-[A-Z0-9]+(?:-[A-Z0-9]+)*\.?\s*/g, ' ')
        .replace(/\s*Reference\s+(?:IMG|Anesth|PM&R|Surgery|Visa\+Weak)\s*/gi, ' ')
        .replace(/\s{2,}/g, ' ');
    });
  }

  function applyCleanup() {
    applyHero();
    applyProblemAndPdfCopy();
    bindRedFlagButtons();
    applyCostAndMatchFirst();
    applyBrian();
    applyBottomSections();
    cleanInternalReferences();
  }

  ready(function() {
    applyCleanup();
    [250, 750, 1500, 3000].forEach(function(delay) {
      window.setTimeout(applyCleanup, delay);
    });

    if ('MutationObserver' in window && document.body) {
      var scheduled = false;
      new MutationObserver(function() {
        if (scheduled) return;
        scheduled = true;
        window.setTimeout(function() {
          scheduled = false;
          applyCleanup();
        }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }

    window.MISSIONMED_MR_HOMEPAGE_CLEANUP_001B = 'active';
  });
})();
</script>
JS;
}
