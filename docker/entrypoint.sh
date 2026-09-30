#!/bin/bash

echo "Setting up docker env..."
echo "MODE: $MODE"
echo "USE_NEW_DESIGN: $USE_NEW_DESIGN"
echo "SERVER_LIST_URL: $SERVER_LIST_URL"
echo "WEBPORT: $WEBPORT"
echo "REDACT_IP_ADDRESSES: $REDACT_IP_ADDRESSES"
echo "DB_TYPE: $DB_TYPE"
echo "ENABLE_ID_OBFUSCATION: $ENABLE_ID_OBFUSCATION"
echo "GDPR_EMAIL: $GDPR_EMAIL"

set -e
#set -x

is_alpine() {
  [ -f /etc/alpine-release ]
}

html_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&#39;/g"
}

sed_escape() {
  printf '%s\n' "$1" | sed 's/[&/\\]/\\&/g; s/\$/\\$/g'
}

# Cleanup
rm -rf /var/www/html/*

# Copy frontend files
cp /speedtest/*.js /var/www/html/

# 站点配置系统：动态配置 API（配置由 site/ 目录挂载提供，启动时生成默认配置）
cp /speedtest/site-config.php /var/www/html/

# Copy design switch files
cp /speedtest/config.json /var/www/html/
cp /speedtest/design-switch.js /var/www/html/

# Copy favicon
cp /speedtest/favicon.ico /var/www/html/

# Set custom webroot on alpine
if is_alpine; then
  echo "ALPINE IMAGE"
  sed -i "s#\"/var/www/localhost/htdocs\"#\"/var/www/html\"#g" /etc/apache2/httpd.conf
else
  echo "DEBIAN IMAGE"
fi


# Set up backend side for standlone modes
if [[ "$MODE" == "standalone" || "$MODE" == "dual" ]]; then
  cp -r /speedtest/backend/ /var/www/html/backend
  if [ ! -z "$IPINFO_APIKEY" ]; then
    sed -i s/\$IPINFO_APIKEY\ =\ \'\'/\$IPINFO_APIKEY\ =\ \'$IPINFO_APIKEY\'/g /var/www/html/backend/getIP_ipInfo_apikey.php
  fi
fi

if [ "$MODE" == "backend" ]; then
  cp -r /speedtest/backend/* /var/www/html
  if [ ! -z "$IPINFO_APIKEY" ]; then
    sed -i s/\$IPINFO_APIKEY\ =\ \'\'/\$IPINFO_APIKEY\ =\ \'$IPINFO_APIKEY\'/g /var/www/html/getIP_ipInfo_apikey.php
  fi
fi

# Set up index.php for frontend-only or standalone modes
if [[ "$MODE" == "frontend" || "$MODE" == "dual" ||  "$MODE" == "standalone" ]]; then
  # Copy design files (switcher + both designs)
  cp /speedtest/index.html /var/www/html/
  cp /speedtest/index-classic.html /var/www/html/
  cp /speedtest/index-modern.html /var/www/html/
  
  # Copy frontend assets directly to root-level subdirectories (no frontend/ parent dir)
  mkdir -p /var/www/html/styling /var/www/html/javascript /var/www/html/images /var/www/html/fonts
  cp -a /speedtest/frontend/styling/* /var/www/html/styling/
  cp -a /speedtest/frontend/javascript/* /var/www/html/javascript/
  cp -a /speedtest/frontend/images/* /var/www/html/images/
  cp -a /speedtest/frontend/fonts/* /var/www/html/fonts/ 2>/dev/null || true
  
  # Copy frontend config files
  cp /speedtest/frontend/settings.json /var/www/html/settings.json 2>/dev/null || true
  if [ -f /servers.json ]; then
    echo "using mounted /servers.json for server-list.json"
    cp /servers.json /var/www/html/server-list.json
  else
    echo "no /servers.json found, create one for local host"
    # generate config for just the local server
    echo '[{"name":"local","server":"/backend",  "dlURL": "garbage.php", "ulURL": "empty.php", "pingURL": "empty.php", "getIpURL": "getIP.php", "sponsorName": "", "sponsorURL": "", "id":1 }]' > /var/www/html/server-list.json
  fi
  if [ ! -z "$SERVER_LIST_URL" ]; then
    echo "using SERVER_LIST_URL for frontend server list"
    SERVER_LIST_URL_ESCAPED=$(printf '%s\n' "$SERVER_LIST_URL" | sed 's/[&/\\]/\\&/g; s/\$/\\$/g')
    sed -i "s/var SPEEDTEST_SERVERS = \"server-list.json\";/var SPEEDTEST_SERVERS = \"$SERVER_LIST_URL_ESCAPED\";/" /var/www/html/index-modern.html
    sed -i "s/var SPEEDTEST_SERVERS = \\[/var SPEEDTEST_SERVERS = \"$SERVER_LIST_URL_ESCAPED\";\\n\\t\\t\\/\\*/" /var/www/html/index-classic.html
  fi

  # 标题：经典页支持中英（规则乙：唯一来源 = site-config.json 的 default.titleZh / default.titleEn）
  # 读取顺序：/var/www/html/site/site-config.json（SiteConfig 段稍后就位：优先软链挂载目录
  # /speedtest-site，否则复制镜像内置模板 /speedtest/docker-site，两种情况文件都存在）→
  # 挂载目录 /speedtest-site/site-config.json → 镜像内置模板 /speedtest/docker-site/site-config.json。
  # TITLE / TITLE_ZH / TITLE_EN 环境变量已废弃：设置它们不再影响页面标题。
  SC_TT_FILE=/var/www/html/site/site-config.json
  if [ ! -f "$SC_TT_FILE" ] && [ -f /speedtest-site/site-config.json ]; then
    SC_TT_FILE=/speedtest-site/site-config.json
  fi
  if [ ! -f "$SC_TT_FILE" ] && [ -f /speedtest/docker-site/site-config.json ]; then
    SC_TT_FILE=/speedtest/docker-site/site-config.json
  fi
  # 用 PHP 解析 JSON（容器内有 PHP 8）：titleZh 缺省回退 name，titleEn 缺省回退 titleZh，
  # 与 site-config.php 的归一化规则一致；值内换行替换为空格（单行注入场景）。
  SC_TITLES=$(php -r '
    $file = $argv[1];
    // 兜底：镜像内置空白模板值（与 docker/default-site/site-config.json 保持一致）
    $zh = "LibreSpeed 网络测速"; $en = "LibreSpeed Speed Test";
    $raw = @file_get_contents($file);
    if ($raw !== false) {
      $j = json_decode($raw, true);
      if (is_array($j) && isset($j["default"]) && is_array($j["default"])) {
        $d = $j["default"];
        $name = isset($d["name"]) && is_string($d["name"]) ? trim($d["name"]) : "";
        if (isset($d["titleZh"]) && is_string($d["titleZh"]) && trim($d["titleZh"]) !== "") {
          $zh = $d["titleZh"];
        } elseif ($name !== "") {
          $zh = $name;
        }
        if (isset($d["titleEn"]) && is_string($d["titleEn"]) && trim($d["titleEn"]) !== "") {
          $en = $d["titleEn"];
        } else {
          $en = $zh;
        }
      }
    }
    $zh = trim(str_replace(array("\r", "\n"), " ", $zh));
    $en = trim(str_replace(array("\r", "\n"), " ", $en));
    printf("%s\n%s", $zh, $en);
  ' "$SC_TT_FILE")
  TITLE_ZH_EFFECTIVE=$(printf '%s\n' "$SC_TITLES" | sed -n '1p')
  TITLE_EN_EFFECTIVE=$(printf '%s\n' "$SC_TITLES" | sed -n '2p')
  TITLE_VISIBLE="$TITLE_ZH_EFFECTIVE"

  TITLE_ZH_HTML=$(html_escape "$TITLE_ZH_EFFECTIVE")
  TITLE_EN_HTML=$(html_escape "$TITLE_EN_EFFECTIVE")
  TITLE_VISIBLE_HTML=$(html_escape "$TITLE_VISIBLE")
  TZ_ESC=$(sed_escape "$TITLE_ZH_HTML")
  TE_ESC=$(sed_escape "$TITLE_EN_HTML")
  TV_ESC=$(sed_escape "$TITLE_VISIBLE_HTML")
  TITLE_PAGE_HTML=$(html_escape "$TITLE_VISIBLE")
  TT_ESC=$(sed_escape "$TITLE_PAGE_HTML")

  CLASSIC_IC=/var/www/html/index-classic.html
  if [ -f "$CLASSIC_IC" ]; then
    sed -i "s|__LIBRESPEED_TITLE_ZH__|$TZ_ESC|g;s|__LIBRESPEED_TITLE_EN__|$TE_ESC|g;s|__LIBRESPEED_TITLE_VISIBLE__|$TV_ESC|g" "$CLASSIC_IC"
    sed -i "s|<title>LibreSpeed</title>|<title>$TT_ESC</title>|g" "$CLASSIC_IC"
  fi
  if [ -f /var/www/html/index.html ]; then
    sed -i "s|<title>LibreSpeed</title>|<title>$TT_ESC</title>|g" /var/www/html/index.html
  fi

  # 新版页（html lang="en"）使用英文标题 titleEn；总是从 site-config.json 注入（含空白模板场景）
  TITLE_MODERN_RAW="$TITLE_EN_EFFECTIVE"
  TITLE_MODERN_ONE=${TITLE_MODERN_RAW//$'\r'/}
  TITLE_MODERN_ONE=${TITLE_MODERN_ONE//$'\n'/ }
  TITLE_MODERN_HTML=$(html_escape "$TITLE_MODERN_ONE")
  TITLE_MODERN_ESC=$(sed_escape "$TITLE_MODERN_HTML")
  sed -i "s/<title>LibreSpeed - Free and Open Source Speedtest<\\/title>/<title>$TITLE_MODERN_ESC - Free and Open Source Speedtest<\\/title>/g; s/<h1>Free and Open Source Speedtest\\.<\\/h1>/<h1>$TITLE_MODERN_ESC<\\/h1>/g" /var/www/html/index-modern.html

  # Support legacy EMAIL env var as fallback for GDPR_EMAIL
  if [ -z "$GDPR_EMAIL" ] && [ ! -z "$EMAIL" ]; then
    echo "WARNING: EMAIL env var is deprecated, please use GDPR_EMAIL instead" >&2
    GDPR_EMAIL="$EMAIL"
    echo "GDPR_EMAIL: $GDPR_EMAIL"
  fi

  # Replace GDPR email placeholder if GDPR_EMAIL is set
  if [ ! -z "$GDPR_EMAIL" ]; then
    # Escape special sed characters: & (replacement), / (delimiter), \ (escape), $ (variable)
    GDPR_EMAIL_ESCAPED=$(printf '%s\n' "$GDPR_EMAIL" | sed 's/[&/\\]/\\&/g; s/\$/\\$/g')
    
    for html_file in /var/www/html/index-modern.html /var/www/html/index-classic.html; do
      if [ -f "$html_file" ]; then
        sed -i "s/TO BE FILLED BY DEVELOPER/$GDPR_EMAIL_ESCAPED/g; s/PUT@YOUR_EMAIL.HERE/$GDPR_EMAIL_ESCAPED/g" "$html_file"
      fi
    done
  fi

  # 页脚：经典页中英（FOOTER_NOTICE / FOOTER_NOTICE_ZH / FOOTER_NOTICE_EN）；新版仍为单行
  FZ_RAW="${FOOTER_NOTICE_ZH:-$FOOTER_NOTICE}"
  FOOTER_ZH_EFFECTIVE="${FZ_RAW//$'\r'/}"
  FOOTER_ZH_EFFECTIVE="${FOOTER_ZH_EFFECTIVE//$'\n'/ }"
  FE_RAW="${FOOTER_NOTICE_EN:-$FOOTER_NOTICE}"
  FOOTER_EN_EFFECTIVE="${FE_RAW//$'\r'/}"
  FOOTER_EN_EFFECTIVE="${FOOTER_EN_EFFECTIVE//$'\n'/ }"

  FZ_HTML=$(html_escape "$FOOTER_ZH_EFFECTIVE")
  FE_HTML=$(html_escape "$FOOTER_EN_EFFECTIVE")
  FZ_ESC=$(sed_escape "$FZ_HTML")
  FE_ESC=$(sed_escape "$FE_HTML")
  FV_HTML=$(html_escape "$FOOTER_ZH_EFFECTIVE")
  FV_ESC=$(sed_escape "$FV_HTML")

  if [ -f "$CLASSIC_IC" ]; then
    sed -i "s|__LIBRESPEED_FOOTER_ZH__|$FZ_ESC|g;s|__LIBRESPEED_FOOTER_EN__|$FE_ESC|g;s|__LIBRESPEED_FOOTER_VISIBLE__|$FV_ESC|g" "$CLASSIC_IC"
  fi

  FOOTER_MODERN_RAW="${FOOTER_NOTICE:-${FOOTER_NOTICE_ZH:-$FOOTER_NOTICE_EN}}"
  FOOTER_MODERN_ONE=${FOOTER_MODERN_RAW//$'\r'/}
  FOOTER_MODERN_ONE=${FOOTER_MODERN_ONE//$'\n'/ }
  if [ -n "$FOOTER_MODERN_ONE" ]; then
    FOOTER_MODERN_HTML=$(html_escape "$FOOTER_MODERN_ONE")
    FOOTER_MODERN_ESC=$(sed_escape "$FOOTER_MODERN_HTML")
    if [ -f /var/www/html/index-modern.html ]; then
      sed -i "s|__LIBRESPEED_FOOTER_NOTICE__|$FOOTER_MODERN_ESC|g" /var/www/html/index-modern.html
    fi
  else
    if [ -f /var/www/html/index-modern.html ]; then
      sed -i 's|__LIBRESPEED_FOOTER_NOTICE__||g' /var/www/html/index-modern.html
    fi
  fi
fi

# 站点配置：校徽/图标资源 + site-config.json（便于 Docker 卷替换）
# 优先使用挂载目录 /speedtest-site（与 compose 中 docker/site 对应）；否则使用镜像内 /speedtest/docker-site
if [ -d /var/www/html ]; then
  rm -rf /var/www/html/site 2>/dev/null || true
  if [ -d /speedtest-site ] && [ -n "$(ls -A /speedtest-site 2>/dev/null)" ]; then
    echo "SiteConfig: using volume mount /speedtest-site -> /var/www/html/site"
    ln -sfn /speedtest-site /var/www/html/site
  elif [ -d /speedtest/docker-site ] && [ -n "$(ls -A /speedtest/docker-site 2>/dev/null)" ]; then
    echo "SiteConfig: copying defaults from /speedtest/docker-site"
    mkdir -p /var/www/html/site
    cp -a /speedtest/docker-site/. /var/www/html/site/
  else
    echo "SiteConfig: no docker/site assets found, skipping /var/www/html/site"
  fi
  # 兼容直接请求 /favicon.ico 的浏览器与爬虫：用站点 icon 覆盖（PNG 内容，多数客户端可识别）
  if [ -f /var/www/html/site/icon.png ]; then
    cp -f /var/www/html/site/icon.png /var/www/html/favicon.ico
    echo "SiteConfig: synced site/icon.png -> /var/www/html/favicon.ico"
  fi

  # 站点配置：若无挂载 site-config.json，生成默认配置（向后兼容纯环境变量部署）。
  # 规则乙：标题字段不再读取 TITLE/TITLE_ZH/TITLE_EN（已废弃），改为引用镜像内置空白模板
  # docker/default-site/site-config.json 的标题，确保与未挂载场景的页面标题一致；
  # 页脚字段仍按原样由 FOOTER_NOTICE_* 环境变量提供（页脚行为未变）。
  if [ ! -f /var/www/html/site/site-config.json ]; then
    echo "SiteConfig: no site-config.json mounted, generating defaults (title from built-in template, footer from env)"
    php -r '
      $tpl = @file_get_contents("/speedtest/docker-site/site-config.json");
      $tplObj = $tpl !== false ? json_decode($tpl, true) : null;
      $t = (is_array($tplObj) && isset($tplObj["default"]) && is_array($tplObj["default"]))
          ? $tplObj["default"] : array("titleZh" => "LibreSpeed 网络测速", "titleEn" => "LibreSpeed Speed Test");
      $tz = isset($t["titleZh"]) && is_string($t["titleZh"]) && $t["titleZh"] !== "" ? $t["titleZh"] : "LibreSpeed 网络测速";
      $te = isset($t["titleEn"]) && is_string($t["titleEn"]) && trim($t["titleEn"]) !== "" ? $t["titleEn"] : $tz;
      $fz = getenv("FOOTER_NOTICE_ZH") ?: getenv("FOOTER_NOTICE") ?: "";
      $fe = getenv("FOOTER_NOTICE_EN") ?: $fz;
      $d = array("default" => array("name" => $tz, "titleZh" => $tz, "titleEn" => $te, "footerZh" => $fz, "footerEn" => $fe, "logo" => "", "icon" => ""), "privacyEmail" => "", "ipSegments" => array());
      file_put_contents("/var/www/html/site/site-config.json", json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    '
  fi

  # 站点配置健康检查：写错配置不阻塞启动，校验结果输出到容器启动日志
  if [ -f /var/www/html/site/site-config.json ]; then
    php /speedtest/site-config-cli.php validate /var/www/html/site/site-config.json
  fi

  # 若 site-config.json 配置了 serverList（多测速节点），覆盖默认的本机节点列表（重启生效）
  if [ -f /var/www/html/site/site-config.json ]; then
    php /speedtest/site-config-cli.php serverlist /var/www/html/site/site-config.json /var/www/html/server-list.json
  fi
fi

# Configure design preference via config.json
if [ "$USE_NEW_DESIGN" == "true" ]; then
  sed -i 's/"useNewDesign": false/"useNewDesign": true/' /var/www/html/config.json
fi

# Apply Telemetry settings when running in standalone or frontend mode and telemetry is enabled
if [[ "$TELEMETRY" == "true" && ("$MODE" == "frontend" || "$MODE" == "standalone" || "$MODE" == "dual") ]]; then
  cp -r /speedtest/results /var/www/html/results
  sed -i 's/telemetry_level": ".*"/telemetry_level": "basic"/' /var/www/html/settings.json

  # 统计页开关：默认禁用 stats.php（查看测速记录用；ENABLE_STATS=true 时启用，登录密码为 PASSWORD）
  if [ "$ENABLE_STATS" == "true" ]; then
    echo "Stats: stats.php enabled (ENABLE_STATS=true)"
  else
    rm -f /var/www/html/results/stats.php
    echo "Stats: stats.php disabled (ENABLE_STATS=false)"
  fi

  if [ "$MODE" == "frontend" ]; then
    mkdir /var/www/html/backend
    cp /speedtest/backend/getIP_util.php /var/www/html/backend
  fi

  if [ "$DB_TYPE" == "mysql" ]; then
    sed -i 's/$db_type = '\''.*'\''/$db_type = '\'$DB_TYPE\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$MySql_username = '\''.*'\''/$MySql_username = '\'$DB_USERNAME\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$MySql_password = '\''.*'\''/$MySql_password = '\'$DB_PASSWORD\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$MySql_hostname = '\''.*'\''/$MySql_hostname = '\'$DB_HOSTNAME\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$MySql_databasename = '\''.*'\''/$MySql_databasename = '\'$DB_NAME\''/g' /var/www/html/results/telemetry_settings.php
    if [ "$DB_PORT" != "" ]; then
      sed -i 's/$MySql_port = '\''.*'\''/$MySql_port = '\'$DB_PORT\''/g' /var/www/html/results/telemetry_settings.php
    fi
  elif [ "$DB_TYPE" == "postgresql" ]; then
    sed -i 's/$db_type = '\''.*'\''/$db_type = '\'$DB_TYPE\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$PostgreSql_username = '\''.*'\''/$PostgreSql_username = '\'$DB_USERNAME\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$PostgreSql_password = '\''.*'\''/$PostgreSql_password = '\'$DB_PASSWORD\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$PostgreSql_hostname = '\''.*'\''/$PostgreSql_hostname = '\'$DB_HOSTNAME\''/g' /var/www/html/results/telemetry_settings.php
    sed -i 's/$PostgreSql_databasename = '\''.*'\''/$PostgreSql_databasename = '\'$DB_NAME\''/g' /var/www/html/results/telemetry_settings.php
  else
    sed -i s/\$db_type\ =\ \'.*\'/\$db_type\ =\ \'sqlite\'\/g /var/www/html/results/telemetry_settings.php
  fi

  # Override SQLite database path for Docker environment
  # In Docker, we use /database/db.sql which is outside the web-accessible directory
  sed -i s/\$Sqlite_db_file\ =\ .*\'/\$Sqlite_db_file=\'\\\/database\\\/db.sql\'/g /var/www/html/results/telemetry_settings.php
  sed -i s/\$stats_password\ =\ \'.*\'/\$stats_password\ =\ \'$PASSWORD\'/g /var/www/html/results/telemetry_settings.php

  if [ "$ENABLE_ID_OBFUSCATION" == "true" ]; then
    sed -i s/\$enable_id_obfuscation\ =\ .*\;/\$enable_id_obfuscation\ =\ true\;/g /var/www/html/results/telemetry_settings.php
    if [ ! -z "$OBFUSCATION_SALT" ]; then
      if [[ "$OBFUSCATION_SALT" =~ ^0x[0-9a-fA-F]+$ ]]; then
        echo "<?php" > /var/www/html/results/idObfuscation_salt.php
        echo "\$OBFUSCATION_SALT = $OBFUSCATION_SALT;" >> /var/www/html/results/idObfuscation_salt.php
      else
        echo "WARNING: Invalid OBFUSCATION_SALT format. It must be a hex string (e.g., 0x1234abcd). Using random salt." >&2
      fi
    fi
  fi

  if [ "$REDACT_IP_ADDRESSES" == "true" ]; then
    sed -i s/\$redact_ip_addresses\ =\ .*\;/\$redact_ip_addresses\ =\ true\;/g /var/www/html/results/telemetry_settings.php
  fi

  mkdir -p /database/
  if is_alpine; then
    chown -R apache /database/
  else
    chown -R www-data /database/
  fi
fi

if is_alpine; then
  chown -R apache /var/www/html/*
else
  chown -R www-data /var/www/html/*
fi

# Allow selection of Apache port for network_mode: host
if [ "$WEBPORT" != "80" ]; then
  if is_alpine; then
    sed -i "s/^Listen 80\$/Listen $WEBPORT/g" /etc/apache2/httpd.conf
  else
    sed -i "s/^Listen 80\$/Listen $WEBPORT/g" /etc/apache2/ports.conf
    sed -i "s/*:80>/*:$WEBPORT>/g" /etc/apache2/sites-available/000-default.conf
  fi
fi

echo "Done, Starting APACHE"

# This runs apache
if is_alpine; then
  exec httpd -DFOREGROUND
else
  exec apache2-foreground
fi
