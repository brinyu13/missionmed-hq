<?php
/** Configure the existing withdrawn canary page as an admin-only private page. */

$content = <<<'HTML'
<iframe
  title="MissionMed RankListIQ protected canary"
  src="https://missionmedinstitute.com/rlq-dualmode-0921a-canary.php?mode=application"
  style="display:block;width:100%;min-height:1000px;border:0"
  loading="eager"
></iframe>
HTML;

$result = wp_update_post(
    [
        'ID' => 9174,
        'post_status' => 'private',
        'post_content' => $content,
    ],
    true
);

if (is_wp_error($result)) {
    WP_CLI::error($result->get_error_message());
}

WP_CLI::success('Configured protected RankListIQ canary post ' . (string) $result);
