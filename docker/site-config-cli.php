<?php

/**
 * 站点配置命令行工具（容器启动时由 entrypoint 调用）
 *
 * 用法（均为只读操作，任何情况退出码均为 0，绝不阻塞容器启动）：
 *   php site-config-cli.php validate <site-config.json 路径>
 *       校验并打印配置健康状况（ERROR/WARN/OK 逐行输出，供启动日志展示）
 *   php site-config-cli.php serverlist <site-config.json 路径> <server-list.json 输出路径>
 *       若配置含 serverList 数组则生成前端测速节点列表文件；无则不做任何写入
 */

error_reporting(0);
ini_set('display_errors', '0');

// 兼容镜像布局（/speedtest/ 下同级）与仓库开发布局（docker/ 与根目录同级）
if (is_file(__DIR__ . '/site-config.php')) {
    require_once __DIR__ . '/site-config.php';
} else {
    require_once __DIR__ . '/../site-config.php';
}
// 注意：site-config.php 在 CLI 下不会触发请求分发（SCRIPT_FILENAME 不存在）

/**
 * 输出一条带前缀的日志行。
 *
 * @param string $level ERROR / WARN / OK / INFO
 * @param string $msg   内容
 * @return void
 */
function scc_log($level, $msg)
{
    echo "[site] {$level} {$msg}\n";
}

/**
 * validate 子命令：加载配置并逐行打印校验结果。
 *
 * @param string $jsonPath site-config.json 路径
 * @return void
 */
function scc_validate($jsonPath)
{
    if (!is_file($jsonPath)) {
        scc_log('WARN', "配置文件不存在：{$jsonPath}（将使用镜像内置默认品牌）");
        return;
    }
    $raw = sc_read_file($jsonPath);
    if ($raw === null) {
        scc_log('WARN', '配置文件不可读：' . $jsonPath);
        return;
    }
    $json = json_decode($raw, true);
    if (!is_array($json)) {
        scc_log('ERROR', 'JSON 语法错误：' . json_last_error_msg() . '。容器将回退上次成功配置或内置默认品牌，请修正后重启');
        return;
    }

    $norm = sc_normalize($json);
    $data = $norm['data'];
    $default = $data['default'];

    scc_log('INFO', '配置加载成功：站点「' . $default['name'] . '」');

    // 隐私邮箱（可选）
    if ($data['privacyEmail'] === '') {
        scc_log('INFO', '未配置 privacyEmail（页面隐私政策保留占位文案，不影响功能）');
    } else {
        scc_log('OK', '隐私联系邮箱：' . $data['privacyEmail']);
    }

    // 资源文件存在性（logo/icon）
    foreach (['logo', 'icon'] as $asset) {
        $rel = $default[$asset];
        $full = realpath(dirname($jsonPath) . '/' . $rel);
        if ($full === false || !is_file($full)) {
            scc_log('WARN', "{$asset} 文件缺失：{$rel}（建议补齐）");
        } else {
            scc_log('OK', "{$asset}：{$rel}");
        }
    }

    // 校园网段标签表
    $segCount = count($data['ipSegments']);
    if ($segCount === 0) {
        scc_log('INFO', '校园网段标签表（ipSegments）：0 条（测速页 IP 无中文校园网标签，可补充）');
    } else {
        scc_log('OK', "校园网段标签表（ipSegments）：{$segCount} 条");
        foreach ($data['ipSegments'] as $seg) {
            scc_log('OK', "  网段 {$seg['cidr']} → {$seg['zh']}" . ($seg['en'] !== '' ? " / {$seg['en']}" : ''));
        }
    }

    $cols = isset($data['recentColumns']) && is_array($data['recentColumns']) ? $data['recentColumns'] : [];
    scc_log('OK', '最近测速表格列：' . ($cols === [] ? '（默认）' : implode(', ', $cols)));

    foreach ($norm['warnings'] as $w) {
        scc_log('WARN', $w);
    }
    if ($norm['error'] !== '') {
        scc_log('ERROR', $norm['error']);
    }
    scc_log('OK', '校验完成，配置可正常加载');
}

/**
 * serverlist 子命令：从配置中读取 serverList 并生成前端节点列表文件。
 *
 * @param string $jsonPath site-config.json 路径
 * @param string $outPath  server-list.json 输出路径
 * @return void
 */
function scc_serverlist($jsonPath, $outPath)
{
    if (!is_file($jsonPath)) {
        scc_log('INFO', '无配置文件，跳过 serverList 生成');
        return;
    }
    $raw = sc_read_file($jsonPath);
    $json = $raw === null ? null : json_decode($raw, true);
    if (!is_array($json) || !isset($json['serverList']) || !is_array($json['serverList'])) {
        scc_log('INFO', '配置未包含 serverList（将使用默认本机节点）');
        return;
    }

    $out = [];
    $id = 1;
    foreach ($json['serverList'] as $item) {
        if (!is_array($item) || empty($item['server']) || !is_string($item['server'])) {
            scc_log('WARN', 'serverList 中存在缺少 server 地址的条目，已跳过');
            continue;
        }
        $out[] = [
            'name' => isset($item['name']) && is_string($item['name']) && $item['name'] !== '' ? $item['name'] : 'node' . $id,
            'server' => $item['server'],
            'dlURL' => isset($item['dlURL']) && is_string($item['dlURL']) ? $item['dlURL'] : 'garbage.php',
            'ulURL' => isset($item['ulURL']) && is_string($item['ulURL']) ? $item['ulURL'] : 'empty.php',
            'pingURL' => isset($item['pingURL']) && is_string($item['pingURL']) ? $item['pingURL'] : 'empty.php',
            'getIpURL' => isset($item['getIpURL']) && is_string($item['getIpURL']) ? $item['getIpURL'] : 'getIP.php',
            'sponsorName' => isset($item['sponsorName']) && is_string($item['sponsorName']) ? $item['sponsorName'] : '',
            'sponsorURL' => isset($item['sponsorURL']) && is_string($item['sponsorURL']) ? $item['sponsorURL'] : '',
            'id' => $id,
        ];
        $id++;
    }

    if (empty($out)) {
        scc_log('WARN', 'serverList 无有效条目（将使用默认本机节点）');
        return;
    }
    $written = @file_put_contents($outPath, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    if ($written === false) {
        scc_log('ERROR', '写入 server-list.json 失败：' . $outPath);
        return;
    }
    scc_log('OK', '已生成 server-list.json：' . count($out) . ' 个测速节点');
}

// ---- 命令行分发 ----
$cmd = isset($argv[1]) ? $argv[1] : '';
switch ($cmd) {
    case 'validate':
        scc_validate(isset($argv[2]) ? $argv[2] : '');
        break;
    case 'serverlist':
        scc_serverlist(isset($argv[2]) ? $argv[2] : '', isset($argv[3]) ? $argv[3] : '');
        break;
    default:
        scc_log('ERROR', '未知命令：' . ($cmd === '' ? '(空)' : $cmd) . '（支持 validate / serverlist）');
        break;
}
exit(0);