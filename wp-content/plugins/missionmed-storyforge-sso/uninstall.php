<?php

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$keys = get_option('missionmed_storyforge_rate_keys', array());
foreach ((array) $keys as $key) {
    delete_transient((string) $key);
}
delete_option('missionmed_storyforge_rate_keys');
delete_option('missionmed_storyforge_settings');
