(function (window, document) {
  'use strict';

  var root = window.MMED_OS;
  var config = root && root.study_schedule_v1;
  var modes = ['V1_ACTIVE_READ_WRITE', 'V1_DEGRADED_READ_ONLY'];

  if (!config || config.contract_version !== 1) return;
  if (modes.indexOf(config.mode) === -1) return;
  if (!config.entitlement || config.entitlement.allowed !== true) return;
  if (!config.exposure || config.exposure.allowed !== true) return;
  if (!config.reader || config.reader.allowed !== true) return;
  if (!config.release || !/^[a-f0-9]{64}$/.test(config.release.digest || '')) return;
  if (!/^[a-f0-9]{64}$/.test(config.release.asset_digest || '')) return;

  var script = document.currentScript;
  var source = script && typeof script.src === 'string' ? script.src : '';
  var match = source.match(/v1-study-loader\.([a-f0-9]{16})\.js(?:[?#].*)?$/);
  if (!match || config.release.asset_digest.slice(0, 16) !== match[1]) return;

  if (root.study_schedule_v1_bootstrapped === config.release.digest) return;
  root.study_schedule_v1_bootstrapped = config.release.digest;

  var event;
  try {
    event = new window.CustomEvent('mmed:v1-study:bootstrap', { detail: config });
  } catch (error) {
    root.study_schedule_v1_bootstrapped = null;
    return;
  }

  // 8010C intentionally performs no fetch, mount, navigation, storage write,
  // or DOM mutation. The product slice may consume this event only after 8010D.
  window.dispatchEvent(event);
})(window, document);
