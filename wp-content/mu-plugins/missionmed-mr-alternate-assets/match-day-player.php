<?php
defined('ABSPATH') || exit;
// Fail closed until this exact recording has publication clearance and a ready Stream asset.
$matchDayMedia = json_decode(file_get_contents(__DIR__ . '/match-day-media.json'), true);
$matchDayReady = ($matchDayMedia['enabled'] ?? false) === true
    && ($matchDayMedia['provider'] ?? '') === 'cloudflare-stream'
    && preg_match('/^[a-f0-9]{32}$/D', $matchDayMedia['streamUid'] ?? '')
    && is_string($matchDayMedia['publicUseAuthority'] ?? null)
    && trim($matchDayMedia['publicUseAuthority']) !== ''
    && ($matchDayMedia['masterSha256'] ?? '') === '6ca321397fabd28d69c5e98a621c7b5d4fa7705f99d93a60daff2a5fc79d1398';
if (!$matchDayReady) return;
$matchDaySource = 'https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com/' . $matchDayMedia['streamUid'] . '/manifest/video.m3u8';
?>
<button type="button" class="mm-match-play" data-match-day-source="<?php echo esc_html($matchDaySource); ?>" aria-haspopup="dialog" aria-controls="mm-match-dialog"><span aria-hidden="true">&#9654;</span> Watch the moment it became real</button>
<dialog id="mm-match-dialog" class="mm-match-dialog" aria-labelledby="mm-match-dialog-title" aria-describedby="mm-match-dialog-description">
  <div class="mm-match-dialog-heading"><h2 id="mm-match-dialog-title">Match Day at Mission Residency</h2><button type="button" class="mm-match-close" aria-label="Close Match Day video" autofocus>Close <span aria-hidden="true">&#215;</span></button></div>
  <p id="mm-match-dialog-description">Real students. Their Match Day moments. Use the player controls for sound, pause, seeking and fullscreen.</p>
  <div class="mm-match-stage" data-poster="<?php echo $asset('media/montage-1702.webp'); ?>" data-hls-library="<?php echo $asset('vendor/hls-1.7.3.min.js'); ?>"></div>
  <p class="mm-match-status" role="status" aria-live="polite"></p>
</dialog>
