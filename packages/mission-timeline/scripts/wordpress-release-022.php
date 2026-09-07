<?php
/** Timeline-only immutable install and private backup. Read-only unless explicitly executed. */
function tl022_require($condition, $code) {
    if (!$condition) { throw new RuntimeException($code); }
}
function tl022_json($file) {
    $value = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    tl022_require(is_array($value), 'JSON_OBJECT_REQUIRED');
    return $value;
}
function tl022_paths() {
    return [
        'wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php',
        'wp-content/plugins/missionmed-timeline-sso/includes/workspace-022.php',
        'wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js',
        'wp-content/mu-plugins/missionmed-timeline-route.php',
    ];
}
function tl022_nonsecret_settings($settings) {
    // Secrets belong to the existing environment/constant binding, never this
    // option snapshot. Unknown keys stop for reconciliation instead of stripping.
    $allowed = ['timeline_enabled','rollout_stage','canary_wp_user_ids','eligibility_verified',
        'entitlement_version','consent_version','ai_processing_mode','ai_consent_version',
        'founder_standard_manager_wp_user_ids','base_path','matrix_url','api_origin','issuer',
        'audience','active_key_id','token_ttl_seconds','rate_limit_requests',
        'rate_limit_window_seconds','matrix_menu_locations'];
    tl022_require(is_array($settings) && array_diff(array_keys($settings), $allowed) === [], 'SETTINGS_UNKNOWN_OR_SECRET_KEY');
    foreach ($settings as $key => $value) {
        if (in_array($key, ['canary_wp_user_ids','founder_standard_manager_wp_user_ids'], true)) {
            tl022_require(is_array($value) && count($value) <= 10, 'SETTINGS_VALUE_INVALID');
            foreach ($value as $id) { tl022_require(is_int($id) && $id > 0, 'SETTINGS_VALUE_INVALID'); }
        } elseif ($key === 'matrix_menu_locations') {
            tl022_require(is_array($value) && count($value) <= 10, 'SETTINGS_VALUE_INVALID');
            foreach ($value as $location) { tl022_require(is_string($location) && preg_match('/^[a-z0-9_-]{1,80}$/D', $location), 'SETTINGS_VALUE_INVALID'); }
        } elseif (in_array($key, ['timeline_enabled','eligibility_verified'], true)) {
            tl022_require(is_bool($value) || $value === 0 || $value === 1 || $value === '0' || $value === '1', 'SETTINGS_VALUE_INVALID');
        } elseif (in_array($key, ['token_ttl_seconds','rate_limit_requests','rate_limit_window_seconds'], true)) {
            tl022_require((is_int($value) && $value >= 0 && $value <= 3600) || (is_string($value) && preg_match('/^[0-9]{1,4}$/D', $value) && (int)$value <= 3600), 'SETTINGS_VALUE_INVALID');
        } elseif (in_array($key, ['matrix_url','api_origin','issuer'], true)) {
            $url = is_string($value) ? parse_url($value) : false;
            tl022_require(is_array($url) && ($url['scheme'] ?? '') === 'https' && !empty($url['host']) && !isset($url['user']) && !isset($url['pass']) && !isset($url['query']) && !isset($url['fragment']), 'SETTINGS_URL_CREDENTIAL_OR_INVALID');
        } elseif ($key === 'base_path') {
            tl022_require($value === '/timeline/', 'SETTINGS_VALUE_INVALID');
        } else {
            tl022_require(is_string($value) && preg_match('/^[a-zA-Z0-9._:-]{0,128}$/D', $value), 'SETTINGS_VALUE_INVALID');
        }
    }
    return $settings;
}
function tl022_safe_file($root, $relative) {
    tl022_require(in_array($relative, tl022_paths(), true) || preg_match('#^wp-content/mu-plugins/missionmed-timeline-runtime/releases/timeline-wp-[a-f0-9]{16}/release\.php$#D', $relative), 'PATH_DENIED');
    $full = $root . '/' . $relative;
    $ancestor = dirname($full);
    while (!file_exists($ancestor) && !is_link($ancestor)) { $ancestor = dirname($ancestor); }
    $parent = realpath($ancestor);
    tl022_require($parent === $ancestor && str_starts_with($parent . '/', $root . '/') && !is_link($full), 'PATH_ESCAPE_OR_SYMLINK');
    return $full;
}
function tl022_inventory($root, $settings) {
    $runtime = $root . '/wp-content/mu-plugins/missionmed-timeline-runtime';
    tl022_require(is_link($runtime . '/current'), 'CURRENT_NOT_SYMLINK');
    $pointer = readlink($runtime . '/current');
    tl022_require(preg_match('#^releases/timeline-wp-[a-f0-9]{16}$#D', $pointer), 'CURRENT_TARGET_DENIED');
    $files = [];
    foreach ([...tl022_paths(), 'wp-content/mu-plugins/missionmed-timeline-runtime/' . $pointer . '/release.php'] as $rel) {
        $full = tl022_safe_file($root, $rel);
        if (!file_exists($full) && $rel === 'wp-content/plugins/missionmed-timeline-sso/includes/workspace-022.php') {
            $files[$rel] = ['exists' => false, 'sha256' => null, 'bytes' => 0]; continue;
        }
        tl022_require(is_file($full), 'CURRENT_FILE_MISSING');
        $files[$rel] = ['exists' => true, 'sha256' => hash_file('sha256', $full), 'bytes' => filesize($full)];
    }
    return ['observed_at' => gmdate('c'), 'pointer' => $pointer, 'files' => $files,
        'settings_sha256' => hash('sha256', json_encode($settings, JSON_UNESCAPED_SLASHES)),
        'admission_off' => empty($settings['timeline_enabled']) && ($settings['rollout_stage'] ?? '') === 'off'];
}
function tl022_same_baseline($actual, $expected) {
    tl022_require($actual['pointer'] === ($expected['pointer'] ?? null) && $actual['files'] === ($expected['files'] ?? null), 'BASELINE_DRIFT');
}
function tl022_atomic_file($destination, $bytes, $mode = 0644) {
    if (!is_dir(dirname($destination))) { tl022_require(mkdir(dirname($destination), 0755), 'OWNED_DIRECTORY_CREATE_FAILED'); }
    $temp = dirname($destination) . '/.timeline022-' . bin2hex(random_bytes(12));
    $handle = fopen($temp, 'x');
    tl022_require($handle !== false, 'STAGE_CREATE_FAILED');
    try {
        tl022_require(fwrite($handle, $bytes) === strlen($bytes), 'STAGE_WRITE_FAILED');
        fflush($handle); fclose($handle); $handle = null;
        tl022_require(chmod($temp, $mode) && hash_file('sha256', $temp) === hash('sha256', $bytes), 'STAGE_VERIFY_FAILED');
        tl022_require(rename($temp, $destination), 'ATOMIC_REPLACE_FAILED');
    } finally {
        if (is_resource($handle)) { fclose($handle); }
        if (is_file($temp)) { unlink($temp); }
    }
}
function tl022_pointer($root, $pointer) {
    tl022_require(preg_match('#^releases/timeline-wp-[a-f0-9]{16}$#D', $pointer), 'POINTER_DENIED');
    $runtime = $root . '/wp-content/mu-plugins/missionmed-timeline-runtime';
    $temp = $runtime . '/.current022-' . bin2hex(random_bytes(12));
    tl022_require(symlink($pointer, $temp), 'POINTER_STAGE_FAILED');
    tl022_require(rename($temp, $runtime . '/current'), 'POINTER_REPLACE_FAILED');
}
function tl022_validate_backup($directory) {
    $receipt = tl022_json($directory . '/receipt.json');
    tl022_require(($receipt['schema_version'] ?? '') === 'd1-022-wordpress-backup.1', 'BACKUP_SCHEMA_INVALID');
    $baselineExpected = [...tl022_paths(), 'wp-content/mu-plugins/missionmed-timeline-runtime/' . ($receipt['baseline']['pointer'] ?? '') . '/release.php'];
    $baselineActual = array_keys($receipt['baseline']['files'] ?? []); sort($baselineExpected); sort($baselineActual);
    tl022_require($baselineExpected === $baselineActual, 'BACKUP_BASELINE_FILE_SET_INVALID');
    $expected = ['settings.json'];
    foreach ($receipt['baseline']['files'] ?? [] as $rel => $entry) { if ($entry['exists'] ?? true) { $expected[] = 'files/' . $rel; } }
    $actual = array_keys($receipt['saved_files'] ?? []); sort($expected); sort($actual);
    tl022_require(count($expected) >= 5 && count($expected) <= 6 && $expected === $actual, 'BACKUP_FILE_SET_INVALID');
    foreach ($receipt['saved_files'] as $rel => $entry) {
        tl022_require(preg_match('#^(?:files/[a-zA-Z0-9_./-]+|settings\.json)$#D', $rel) && !str_contains($rel, '..'), 'BACKUP_PATH_DENIED');
        $full = $directory . '/' . $rel;
        tl022_require(is_file($full) && !is_link($full) && hash_file('sha256', $full) === $entry['sha256'] && filesize($full) === $entry['bytes'], 'BACKUP_HASH_MISMATCH');
    }
    tl022_require(isset($receipt['saved_files']['settings.json']), 'BACKUP_SETTINGS_MISSING');
    tl022_nonsecret_settings(tl022_json($directory . '/settings.json'));
    return $receipt;
}
function tl022_operation($mode, $plan, $root, $private, $settings, $execute = false) {
    tl022_require(realpath($root) === $root && realpath($private) === $private, 'ROOT_IDENTITY_INVALID');
    tl022_require(($plan['schema_version'] ?? '') === 'd1-022-wordpress-operation.1', 'PLAN_SCHEMA_INVALID');
    tl022_require(($plan['authority_ticket_sha256'] ?? '') === 'e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c', 'AUTHORITY_INVALID');
    tl022_nonsecret_settings($settings);
    $before = tl022_inventory($root, $settings);
    if ($mode === 'inspect') { return ['status' => 'READ_ONLY', 'inventory' => $before]; }
    tl022_require($execute === true, 'EXPLICIT_EXECUTION_REQUIRED');
    tl022_require(in_array($mode, ['backup', 'install', 'rollback'], true), 'OPERATION_DENIED');
    tl022_require(preg_match('/^022-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/D', $plan['snapshot_id'] ?? ''), 'SNAPSHOT_ID_INVALID');
    $directory = $private . '/d1-timeline-022-backups/' . $plan['snapshot_id'];
    if ($mode === 'backup') {
        tl022_same_baseline($before, $plan['baseline'] ?? []);
        tl022_require(!file_exists($directory) && !is_link($directory), 'BACKUP_ALREADY_EXISTS');
        $parent = dirname($directory);
        if (!file_exists($parent)) { tl022_require(mkdir($parent, 0700), 'BACKUP_PARENT_CREATE_FAILED'); }
        tl022_require(realpath($parent) === $parent && !is_link($parent), 'BACKUP_PARENT_ESCAPE');
        tl022_require(mkdir($directory, 0700), 'BACKUP_CREATE_FAILED');
        $saved = [];
        foreach ($before['files'] as $rel => $entry) {
            if (!$entry['exists']) { continue; }
            $to = $directory . '/files/' . $rel;
            tl022_require(mkdir(dirname($to), 0700, true) || is_dir(dirname($to)), 'BACKUP_PATH_CREATE_FAILED');
            tl022_require(copy(tl022_safe_file($root, $rel), $to) && chmod($to, 0600), 'BACKUP_COPY_FAILED');
            tl022_require(hash_file('sha256', $to) === $entry['sha256'], 'BACKUP_SOURCE_CHANGED');
            $saved['files/' . $rel] = $entry;
        }
        $settingsBytes = json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        tl022_require(file_put_contents($directory . '/settings.json', $settingsBytes, LOCK_EX) === strlen($settingsBytes), 'BACKUP_SETTINGS_WRITE_FAILED');
        chmod($directory . '/settings.json', 0600);
        $saved['settings.json'] = ['sha256' => hash('sha256', $settingsBytes), 'bytes' => strlen($settingsBytes)];
        $receipt = ['schema_version' => 'd1-022-wordpress-backup.1', 'snapshot_id' => $plan['snapshot_id'], 'created_at' => gmdate('c'), 'baseline' => $before, 'saved_files' => $saved];
        file_put_contents($directory . '/receipt.json', json_encode($receipt, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)); chmod($directory . '/receipt.json', 0600);
        tl022_validate_backup($directory);
        // Reconstruct into a separate private directory, never over the live WordPress root.
        $restore = $directory . '/isolated-restore'; tl022_require(mkdir($restore, 0700), 'REHEARSAL_CREATE_FAILED');
        foreach ($saved as $rel => $entry) {
            $to = $restore . '/' . $rel;
            if (!is_dir(dirname($to))) { tl022_require(mkdir(dirname($to), 0700, true), 'REHEARSAL_PATH_CREATE_FAILED'); }
            tl022_require(copy($directory . '/' . $rel, $to) && chmod($to, 0600) && hash_file('sha256', $to) === $entry['sha256'], 'REHEARSAL_HASH_MISMATCH');
        }
        tl022_same_baseline(tl022_inventory($root, $settings), $before);
        return ['status' => 'BACKUP_VERIFIED', 'directory' => $directory, 'receipt_sha256' => hash_file('sha256', $directory . '/receipt.json'), 'files' => count($saved), 'isolated_file_restore' => true, 'live_changed' => false];
    }
    tl022_require(realpath($directory) === $directory && !is_link($directory), 'BACKUP_DIRECTORY_INVALID');
    $backup = tl022_validate_backup($directory);
    tl022_require(hash_file('sha256', $directory . '/receipt.json') === ($plan['backup_receipt_sha256'] ?? ''), 'BACKUP_RECEIPT_IDENTITY_MISMATCH');
    tl022_require($before['admission_off'], 'ADMISSION_MUST_BE_OFF');
    if ($mode === 'rollback') {
        tl022_same_baseline($before, $plan['installed_inventory'] ?? []);
        foreach (tl022_paths() as $rel) {
            $full = tl022_safe_file($root, $rel);
            if (!$backup['baseline']['files'][$rel]['exists']) {
                tl022_require(hash_file('sha256', $full) === $plan['installed_inventory']['files'][$rel]['sha256'] && unlink($full), 'NEW_FILE_ROLLBACK_IDENTITY_MISMATCH');
            } else { tl022_atomic_file($full, file_get_contents($directory . '/files/' . $rel)); }
        }
        tl022_pointer($root, $backup['baseline']['pointer']);
        $after = tl022_inventory($root, $settings); tl022_same_baseline($after, $backup['baseline']);
        return ['status' => 'ROLLED_BACK_ADMISSION_OFF', 'inventory' => $after];
    }
    tl022_same_baseline($before, $backup['baseline']);
    tl022_require(time() - strtotime($backup['created_at']) <= 14400, 'BACKUP_TOO_OLD');
    $candidate = $plan['candidate'] ?? [];
    tl022_require(($candidate['mode'] ?? '') === 'release' && preg_match('/^[a-f0-9]{40}$/D', $candidate['source_commit'] ?? ''), 'SEALED_RELEASE_REQUIRED');
    tl022_require(preg_match('/^timeline-wp-[a-f0-9]{16}$/D', $candidate['release_id'] ?? ''), 'CANDIDATE_ID_INVALID');
    $runtimeRel = 'wp-content/mu-plugins/missionmed-timeline-runtime/releases/' . $candidate['release_id'] . '/release.php';
    $expected = [...tl022_paths(), $runtimeRel]; sort($expected);
    $provided = array_keys($candidate['files'] ?? []); sort($provided); tl022_require($expected === $provided, 'CANDIDATE_FILE_SET_DENIED');
    $decoded = [];
    foreach ($candidate['files'] as $rel => $entry) {
        $bytes = base64_decode($entry['data'] ?? '', true);
        tl022_require(is_string($bytes) && strlen($bytes) === ($entry['bytes'] ?? null) && hash('sha256', $bytes) === ($entry['sha256'] ?? null), 'CANDIDATE_HASH_MISMATCH');
        $decoded[$rel] = $bytes;
    }
    tl022_require(str_contains($decoded[$runtimeRel], "'release_id' => '" . $candidate['release_id'] . "'") && str_contains($decoded[$runtimeRel], "'source_commit' => '" . $candidate['source_commit'] . "'"), 'RUNTIME_DECLARATION_MISMATCH');
    $releaseDirectory = dirname($root . '/' . $runtimeRel);
    if (file_exists($releaseDirectory) || is_link($releaseDirectory)) {
        tl022_require(realpath($releaseDirectory) === $releaseDirectory && is_file($releaseDirectory . '/release.php') && hash_file('sha256', $releaseDirectory . '/release.php') === $candidate['files'][$runtimeRel]['sha256'], 'IMMUTABLE_RELEASE_COLLISION');
    } else {
        tl022_require(mkdir($releaseDirectory, 0755), 'IMMUTABLE_RELEASE_CREATE_FAILED');
        tl022_atomic_file(tl022_safe_file($root, $runtimeRel), $decoded[$runtimeRel]);
    }
    foreach ($decoded as $rel => $bytes) {
        if (str_ends_with($rel, '.php')) {
            $lint = tempnam($directory, 'lint-'); file_put_contents($lint, $bytes); chmod($lint, 0600);
            exec(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($lint) . ' 2>&1', $unused, $code); unlink($lint);
            tl022_require($code === 0, 'CANDIDATE_PHP_LINT_FAILED');
        }
    }
    try {
        foreach (tl022_paths() as $rel) { tl022_atomic_file(tl022_safe_file($root, $rel), $decoded[$rel]); }
        tl022_pointer($root, 'releases/' . $candidate['release_id']);
        $after = tl022_inventory($root, $settings);
        foreach ($candidate['files'] as $rel => $entry) { tl022_require($after['files'][$rel]['sha256'] === $entry['sha256'], 'INSTALLED_READBACK_MISMATCH'); }
        return ['status' => 'INSTALLED_ADMISSION_OFF', 'inventory' => $after];
    } catch (Throwable $error) {
        foreach (tl022_paths() as $rel) {
            $full = tl022_safe_file($root, $rel);
            if (!$backup['baseline']['files'][$rel]['exists']) {
                if (file_exists($full)) { tl022_require(hash_file('sha256', $full) === $candidate['files'][$rel]['sha256'] && unlink($full), 'NEW_FILE_COMPENSATION_IDENTITY_MISMATCH'); }
            } else { tl022_atomic_file($full, file_get_contents($directory . '/files/' . $rel)); }
        }
        tl022_pointer($root, $backup['baseline']['pointer']);
        tl022_same_baseline(tl022_inventory($root, $settings), $backup['baseline']);
        throw new RuntimeException('INSTALL_FAILED_RESTORED_ADMISSION_OFF');
    }
}
if (!defined('D1_022_LIBRARY_ONLY')) {
    try {
        tl022_require(PHP_SAPI === 'cli', 'CLI_ONLY');
        $root = '/www/theresidencyacademy_209/public';
        $private = '/www/theresidencyacademy_209/private';
        tl022_require(realpath($root) === $root, 'PRODUCTION_ROOT_MISMATCH');
        define('ABSPATH', $root . '/');
        require $root . '/wp-load.php';
        $plan = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
        $result = tl022_operation($argv[1] ?? 'inspect', $plan, $root, $private, get_option('missionmed_timeline_settings', []), ($argv[2] ?? '') === '--execute');
        echo json_encode($result, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) {
        $code = $error instanceof RuntimeException ? $error->getMessage() : 'DETAILS_SUPPRESSED';
        fwrite(STDERR, json_encode(['status' => 'STOP_SAFE', 'code' => $code]) . "\n"); exit(1);
    }
}
