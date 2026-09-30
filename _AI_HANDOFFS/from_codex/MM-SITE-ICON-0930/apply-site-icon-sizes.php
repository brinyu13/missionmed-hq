<?php

if (!defined('ABSPATH')) {
    exit(1);
}

$attachmentId = (int) getenv('MM_SITE_ICON_ATTACHMENT_ID');
if ($attachmentId <= 0 || (int) get_option('site_icon') !== $attachmentId) {
    throw new RuntimeException('The expected canonical site-icon attachment is not active.');
}

$attachedFile = get_attached_file($attachmentId);
$metadata = wp_get_attachment_metadata($attachmentId);
if (!is_string($attachedFile) || !is_file($attachedFile) || !is_array($metadata)) {
    throw new RuntimeException('The canonical site-icon source or metadata is unavailable.');
}

$directory = dirname($attachedFile);
$basename = pathinfo($attachedFile, PATHINFO_FILENAME);
$assetDirectory = WPMU_PLUGIN_DIR . '/missionmed-site-icon-assets';
$exactSizes = [
    32 => $assetDirectory . '/missionmed-favicon-32.png',
    180 => $assetDirectory . '/missionmed-favicon-180.png',
    192 => $assetDirectory . '/missionmed-favicon-192.png',
];

foreach ($exactSizes as $size => $source) {
    if (!is_file($source)) {
        throw new RuntimeException('Missing exact site-icon source: ' . $source);
    }

    $filename = $basename . '-' . $size . 'x' . $size . '.png';
    $destination = $directory . '/' . $filename;
    $temporary = $destination . '.tmp';

    if (!copy($source, $temporary) || !rename($temporary, $destination)) {
        @unlink($temporary);
        throw new RuntimeException('Unable to install exact site-icon derivative: ' . $filename);
    }
    chmod($destination, 0644);

    $metadata['sizes']['site_icon-' . $size] = [
        'file' => $filename,
        'width' => $size,
        'height' => $size,
        'mime-type' => 'image/png',
        'filesize' => filesize($destination),
    ];
}

$size = 270;
$filename = $basename . '-' . $size . 'x' . $size . '.png';
$destination = $directory . '/' . $filename;
$temporary = $directory . '/' . $basename . '-' . $size . 'x' . $size . '.tmp.png';
$editor = wp_get_image_editor($attachedFile);
if (is_wp_error($editor)) {
    throw new RuntimeException($editor->get_error_message());
}
$resized = $editor->resize($size, $size, true);
if (is_wp_error($resized)) {
    throw new RuntimeException($resized->get_error_message());
}
$saved = $editor->save($temporary, 'image/png');
if (is_wp_error($saved) || !is_file($temporary) || !rename($temporary, $destination)) {
    @unlink($temporary);
    throw new RuntimeException('Unable to install the 270px site-icon derivative.');
}
chmod($destination, 0644);
$metadata['sizes']['site_icon-270'] = [
    'file' => $filename,
    'width' => $size,
    'height' => $size,
    'mime-type' => 'image/png',
    'filesize' => filesize($destination),
];

if (!wp_update_attachment_metadata($attachmentId, $metadata)) {
    throw new RuntimeException('WordPress rejected the updated site-icon metadata.');
}

echo wp_json_encode(
    [
        'attachment_id' => $attachmentId,
        'file' => $metadata['file'],
        'site_icon_sizes' => array_intersect_key(
            $metadata['sizes'],
            array_flip(['site_icon-32', 'site_icon-180', 'site_icon-192', 'site_icon-270'])
        ),
    ],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
