<?php

/**
 * 返回最近一周内（默认 7 天）的若干条测速记录，供经典测速页表格展示。
 */

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once 'telemetry_settings.php';
require_once 'telemetry_db.php';

$rows = getRecentSpeedtestUsersLastWeek(10, 7);

if ($rows === false) {
    echo json_encode(['ok' => false, 'rows' => []]);
    exit;
}

if (isset($redact_ip_addresses) && true === $redact_ip_addresses) {
    foreach ($rows as $i => $_) {
        $rows[$i]['ip'] = '0.0.0.0';
    }
}

echo json_encode(['ok' => true, 'rows' => $rows], JSON_UNESCAPED_UNICODE);
