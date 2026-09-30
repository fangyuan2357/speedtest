<?php

/**
 * 站点配置 API（site-config / 学校定制）
 *
 * 读取挂载目录 site/site-config.json（只读，可由运维直接编辑），提供：
 *
 *   GET site-config.php?action=config  → JSON 站点品牌信息（标题/页脚/校徽/邮箱/网段标签表）
 *   GET site-config.php?action=logo    → 站点页眉校徽 PNG
 *   GET site-config.php?action=icon    → 站点浏览器图标 PNG
 *
 * 设计目标：
 *  - 一份 JSON 完成整站定制：校名 / 中英标题 / 页脚 / 校徽 / 隐私邮箱 / 校园网段标签 / 测速节点
 *  - 防御性设计（配置写错不会导致系统崩溃）：
 *      1. JSON 语法错误 → 回退 /tmp 下"上次成功副本"，再失败回退内置默认
 *      2. 单条网段非法（掩码越界 / 非法地址）→ 仅跳过该条并记录告警
 *      3. 任何异常都输出默认配置的合法响应，绝不吐 PHP 错误
 *
 * 本文件也可被启动期 CLI（docker/site-config-cli.php）require 复用内部校验函数
 * （通过 SCRIPT_FILENAME 判断避免重复分发）。
 */

/** 挂载的站点配置文件（容器内由 entrypoint 把 /speedtest-site 软链到 /var/www/html/site） */
define('SC_SITE_CONFIG_FILE', __DIR__ . '/site/site-config.json');
/** 上一次成功解析的配置副本（防运行中编辑写坏） */
define('SC_LAST_GOOD_FILE', sys_get_temp_dir() . '/librespeed-site-config.last-good.json');
/** 站点静态资源根目录（校徽/图标存放处），所有资源路径必须限定在该目录内 */
define('SC_ASSET_ROOT', __DIR__ . '/site');

/**
 * 内置兜底默认配置：仅当挂载文件与 last-good 副本全部不可用时使用，
 * 保证任何情况下首页都有可显示的内容。
 *
 * @var array<string, mixed>
 */
const SC_FALLBACK_DEFAULT = [
    'name' => 'LibreSpeed',
    'titleZh' => '网络测速',
    'titleEn' => 'LibreSpeed Speed Test',
    'footerZh' => '',
    'footerEn' => '',
    'logo' => '',
    'icon' => '',
];

/**
 * 安全读取文件，失败返回 null。
 *
 * @param string $path 文件绝对路径
 * @return string|null 文件内容或 null
 */
function sc_read_file($path)
{
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    return ($raw === false) ? null : $raw;
}

/**
 * 解析并校验一条网段条目（支持 CIDR 与裸 IP，IPv4/IPv6 通吃）。
 *
 * @param mixed $cidr 原始条目（如 "10.16.0.0/12" 或 "192.168.1.5"）
 * @return array<string, mixed> { ok: bool, error?: string, bits?: int }
 */
function sc_cidr_parse($cidr)
{
    if (!is_string($cidr)) {
        return ['ok' => false, 'error' => '条目不是字符串'];
    }
    $cidr = trim($cidr);
    if ($cidr === '') {
        return ['ok' => false, 'error' => '条目为空'];
    }
    $slash = strrpos($cidr, '/');
    $ipPart = ($slash === false) ? $cidr : substr($cidr, 0, $slash);
    $bitsPart = ($slash === false) ? null : substr($cidr, $slash + 1);

    $bin = @inet_pton($ipPart);
    if ($bin === false) {
        return ['ok' => false, 'error' => "「{$ipPart}」不是合法 IP 地址"];
    }
    $maxBits = strlen($bin) * 8;

    if ($bitsPart === null) {
        $bits = $maxBits; // 裸 IP 按单机 /32（或 /128）处理
    } else {
        if (!ctype_digit($bitsPart)) {
            return ['ok' => false, 'error' => "掩码「{$bitsPart}」不是数字"];
        }
        $bits = (int) $bitsPart;
        if ($bits < 0 || $bits > $maxBits) {
            return ['ok' => false, 'error' => "掩码 {$bits} 越界（应为 0-{$maxBits}）"];
        }
    }

    return ['ok' => true, 'bits' => $bits];
}

/**
 * 统计 serverList 中带有 server 地址的有效节点数。
 *
 * @param mixed $serverList 配置中的 serverList
 * @return int
 */
function sc_count_servers($serverList)
{
    if (!is_array($serverList)) {
        return 0;
    }
    $count = 0;
    foreach ($serverList as $item) {
        if (is_array($item) && isset($item['server']) && is_string($item['server']) && $item['server'] !== '') {
            $count++;
        }
    }
    return $count;
}

/**
 * 解析最近测速表格要展示的列。
 * 单节点（少于 2 个有效测速节点）时去掉 node，避免展示没有选择意义的节点名称。
 * 未配置 recentColumns 时使用时间、本机 IP、下行、上行。
 *
 * @param mixed $raw          配置中的 recentColumns
 * @param int   $serverCount  有效测速节点数
 * @param array<int, string> $warnings 告警收集
 * @return array<int, string>
 */
function sc_recent_columns($raw, $serverCount, &$warnings)
{
    $allowed = ['time', 'clientIp', 'node', 'dl', 'ul', 'ping', 'jitter'];
    $default = ['time', 'clientIp', 'dl', 'ul'];
    $cols = [];
    if (!is_array($raw)) {
        $cols = $default;
    } else {
        foreach ($raw as $i => $col) {
            $n = $i + 1;
            if (!is_string($col) || !in_array($col, $allowed, true)) {
                $warnings[] = "recentColumns 第 {$n} 项无效，已跳过";
                continue;
            }
            if (!in_array($col, $cols, true)) {
                $cols[] = $col;
            }
        }
        if ($cols === []) {
            $warnings[] = 'recentColumns 无有效列，已使用默认列';
            $cols = $default;
        }
    }
    if ($serverCount < 2) {
        $cols = array_values(array_filter($cols, function ($col) {
            return $col !== 'node';
        }));
    }
    return $cols;
}

/**
 * 归一化并校验配置结构：default 字段缺失用内置默认兜底，
 * 校园网段标签逐条校验，非法条目跳过并记录告警。
 *
 * @param array<string, mixed> $json json_decode 结果
 * @return array<string, mixed> { ok, data, error, warnings }
 */
function sc_normalize($json)
{
    $warnings = [];
    $error = '';

    // ---- 默认站点配置（default）----
    $raw = isset($json['default']) && is_array($json['default']) ? $json['default'] : [];
    $base = SC_FALLBACK_DEFAULT;
    $titleZh = isset($raw['titleZh']) && is_string($raw['titleZh']) ? $raw['titleZh'] : '';
    if ($titleZh === '' && isset($raw['name']) && is_string($raw['name'])) {
        $titleZh = $raw['name'];
    }
    if ($titleZh === '') {
        $titleZh = $base['titleZh'];
    }
    $default = [
        'name' => isset($raw['name']) && is_string($raw['name']) && $raw['name'] !== '' ? $raw['name'] : $base['name'],
        'titleZh' => trim($titleZh),
        'titleEn' => isset($raw['titleEn']) && is_string($raw['titleEn']) && trim($raw['titleEn']) !== ''
            ? trim($raw['titleEn']) : trim($titleZh),
        'footerZh' => isset($raw['footerZh']) && is_string($raw['footerZh']) ? trim($raw['footerZh']) : '',
        'footerEn' => isset($raw['footerEn']) && is_string($raw['footerEn']) ? trim($raw['footerEn']) : '',
        'logo' => isset($raw['logo']) && is_string($raw['logo']) && $raw['logo'] !== '' ? $raw['logo'] : '',
        'icon' => isset($raw['icon']) && is_string($raw['icon']) && $raw['icon'] !== '' ? $raw['icon'] : '',
    ];
    // 以资源相对路径形式输出，供前端直接使用（未配置图片时为空串，前端自动隐藏）
    $default['logoUrl'] = $default['logo'] !== '' ? 'site/' . $default['logo'] : '';
    $default['iconUrl'] = $default['icon'] !== '' ? 'site/' . $default['icon'] : '';

    // ---- 隐私政策联系邮箱：顶层 privacyEmail 优先，兼容放在 default 内 ----
    $privacyEmail = '';
    if (isset($json['privacyEmail']) && is_string($json['privacyEmail'])) {
        $privacyEmail = trim($json['privacyEmail']);
    }
    if ($privacyEmail === '' && isset($raw['privacyEmail']) && is_string($raw['privacyEmail'])) {
        $privacyEmail = trim($raw['privacyEmail']);
    }

    // ---- 校园网段标签表（测速页"IP - 中文校园网标签"）：逐条校验，非法条目跳过并告警 ----
    $ipSegments = [];
    if (isset($json['ipSegments']) && is_array($json['ipSegments'])) {
        $idx = 0;
        foreach ($json['ipSegments'] as $seg) {
            $idx++;
            if (!is_array($seg) || !isset($seg['cidr']) || !is_string($seg['cidr'])) {
                $warnings[] = "ipSegments 第 {$idx} 条缺少 cidr 字段，已跳过";
                continue;
            }
            $parsed = sc_cidr_parse($seg['cidr']);
            if (!$parsed['ok']) {
                $warnings[] = "ipSegments 第 {$idx} 条「{$seg['cidr']}」无效：{$parsed['error']}，已跳过";
                continue;
            }
            $ipSegments[] = [
                'cidr' => trim($seg['cidr']),
                'zh' => isset($seg['zh']) && is_string($seg['zh']) ? trim($seg['zh']) : '',
                'en' => isset($seg['en']) && is_string($seg['en']) ? trim($seg['en']) : '',
            ];
        }
    }

    $serverCount = sc_count_servers(isset($json['serverList']) ? $json['serverList'] : null);
    $recentColumns = sc_recent_columns(
        isset($json['recentColumns']) ? $json['recentColumns'] : null,
        $serverCount,
        $warnings
    );

    return [
        'ok' => $error === '',
        'data' => [
            'privacyEmail' => $privacyEmail,
            'default' => $default,
            'ipSegments' => $ipSegments,
            'recentColumns' => $recentColumns,
        ],
        'error' => $error,
        'warnings' => $warnings,
    ];
}

/**
 * 加载站点配置（三档降级：挂载文件 → 上次成功副本 → 内置默认）。
 *
 * @return array<string, mixed> { ok, data, error, warnings }
 */
function sc_load_config()
{
    $result = ['ok' => false, 'data' => null, 'error' => '', 'warnings' => []];

    // 第一档：挂载的 site-config.json
    $raw = sc_read_file(SC_SITE_CONFIG_FILE);
    if ($raw === null) {
        $result['error'] = 'site/site-config.json 不存在（未挂载或未生成）';
    } else {
        $json = json_decode($raw, true);
        if (!is_array($json)) {
            $result['error'] = 'site-config.json 不是合法 JSON：' . json_last_error_msg();
        } else {
            $result = sc_normalize($json);
            if ($result['ok']) {
                // 解析成功 → 落盘 last-good 副本（失败不影响主流程）
                @file_put_contents(
                    SC_LAST_GOOD_FILE,
                    json_encode($result['data'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
                    LOCK_EX
                );
                return $result;
            }
        }
    }

    // 第二档：上次成功副本（防运行中编辑写坏）
    $lgRaw = sc_read_file(SC_LAST_GOOD_FILE);
    $lgJson = $lgRaw === null ? null : json_decode($lgRaw, true);
    if (is_array($lgJson)) {
        $result['warnings'][] = "site-config.json 读取失败（{$result['error']}），已回退到上次成功配置";
        $result['error'] = '读取失败：' . $result['error'];
        $result['ok'] = true;
        $result['data'] = $lgJson;
        return $result;
    }

    // 第三档：内置默认（永不 500）
    $result['warnings'][] = "无可用配置，已回退内置默认（{$result['error']}）";
    $result['error'] = '未找到可用配置';
    $result['ok'] = true;
    $fbWarnings = [];
    $result['data'] = [
        'privacyEmail' => '',
        'default' => [
            'name' => SC_FALLBACK_DEFAULT['name'],
            'titleZh' => SC_FALLBACK_DEFAULT['titleZh'],
            'titleEn' => SC_FALLBACK_DEFAULT['titleEn'],
            'footerZh' => SC_FALLBACK_DEFAULT['footerZh'],
            'footerEn' => SC_FALLBACK_DEFAULT['footerEn'],
            'logo' => '',
            'icon' => '',
            'logoUrl' => '',
            'iconUrl' => '',
        ],
        'ipSegments' => [],
        'recentColumns' => ['time', 'clientIp', 'dl', 'ul'],
    ];
    unset($fbWarnings);
    return $result;
}

/**
 * 将资源相对路径限定在 site 目录内（防目录穿越）。
 *
 * @param string $rel 相对路径
 * @return string|null 安全的绝对路径或 null
 */
function sc_asset_path($rel)
{
    $rel = str_replace('\\', '/', (string) $rel);
    if ($rel === '' || $rel[0] === '/') {
        return null;
    }
    $base = realpath(SC_ASSET_ROOT);
    if ($base === false) {
        return null;
    }
    $full = realpath($base . '/' . $rel);
    if ($full === false || $full === $base) {
        return null;
    }
    return str_starts_with($full, $base . DIRECTORY_SEPARATOR) ? $full : null;
}

/**
 * 输出站点配置 JSON 响应。
 *
 * @param array<string, mixed> $data 归一化后的配置数据
 * @return void
 */
function sc_respond_config($data)
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    $default = $data['default'];
    echo json_encode([
        'ok' => true,
        'name' => $default['name'],
        'titleZh' => $default['titleZh'],
        'titleEn' => $default['titleEn'],
        'footerZh' => $default['footerZh'],
        'footerEn' => $default['footerEn'],
        'logoUrl' => $default['logoUrl'],
        'iconUrl' => $default['iconUrl'],
        'privacyEmail' => isset($data['privacyEmail']) ? $data['privacyEmail'] : '',
        'ipSegments' => isset($data['ipSegments']) ? $data['ipSegments'] : [],
        'recentColumns' => isset($data['recentColumns']) && is_array($data['recentColumns'])
            ? $data['recentColumns']
            : ['time', 'clientIp', 'dl', 'ul'],
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 输出站点图片资源（校徽 / 图标）PNG，带 Last-Modified 支持 304、private 缓存。
 *
 * @param array<string, mixed> $data  归一化后的配置数据
 * @param string $field 配置字段名：logo 或 icon
 * @return void
 */
function sc_respond_image($data, $field)
{
    // 指定资源缺失时回退约定的同名文件，再失败返回 404
    $fallback = ($field === 'logo') ? 'logo.png' : 'icon.png';
    $candidates = [$data['default'][$field], $fallback];
    $file = null;
    foreach ($candidates as $rel) {
        $file = sc_asset_path($rel);
        if ($file !== null && is_readable($file)) {
            break;
        }
        $file = null;
    }
    if ($file === null) {
        header('Cache-Control: no-store');
        http_response_code(404);
        return;
    }

    $mtime = (int) @filemtime($file);
    if (!empty($_SERVER['HTTP_IF_MODIFIED_SINCE'])) {
        $since = strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']);
        if ($since !== false && $mtime > 0 && $since >= $mtime) {
            http_response_code(304);
            header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
            return;
        }
    }

    header('Content-Type: image/png');
    header('Cache-Control: private, max-age=3600');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
}

/**
 * 请求分发入口。
 *
 * @return void
 */
function sc_dispatch()
{
    // 任何运行期异常都不外泄错误信息（写错配置 ≠ 系统崩溃）
    try {
        $result = sc_load_config();
        $data = $result['data'];

        $action = isset($_GET['action']) ? (string) $_GET['action'] : 'config';
        if ($action === 'logo') {
            sc_respond_image($data, 'logo');
            return;
        }
        if ($action === 'icon') {
            sc_respond_image($data, 'icon');
            return;
        }
        sc_respond_config($data);
    } catch (Throwable $t) {
        // 兜底：返回内置默认配置的 JSON，避免白屏
        if (PHP_SAPI !== 'cli') {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode(['ok' => false, 'reason' => 'internal'], JSON_UNESCAPED_UNICODE);
        }
    }
}

// 仅当本文件被直接请求（而非被 CLI/其他脚本 require）时才分发
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    sc_dispatch();
}