![LibreSpeed Logo](https://github.com/librespeed/speedtest/blob/master/.logo/logo3.png?raw=true)

# LibreSpeed

**简体中文** 👈 ｜ [English](README_EN.md)

---

## 二开说明（校园网定制版）

本仓库基于 LibreSpeed v6.0.2 二次开发，核心新增 **站点配置定制系统**：学校/机构的品牌信息（校名、中英标题、页脚、校徽、隐私邮箱、校园网段标签、测速节点列表）**全部由一份挂载的 `site-config.json` 驱动**，不需要改代码、不需要重建镜像。已打包成通用镜像，任意高校克隆后放上自己的配置文件即可使用。

**关键设计：**

- 镜像内置**空白通用模板**（`docker/default-site/`，无任何学校文案与图片）；未挂载配置时以通用品牌运行
- 一校一目录：复制模板 → 填 `site-config.json` → 放校徽 → 挂载 → 重启容器，即完成定制
- 写错配置**不会崩**：JSON 语法错误自动回退"上次成功配置"或内置默认；单条网段写错只跳过该条并在启动日志告警
- 支持复杂场景：校园网段标签（测速完成后 IP 旁显示"校园网"中文标签）、多测速节点下拉选择、最近测速记录表格

### 快速开始（Docker）

```bash
# 1. 复制空白模板为你学校的目录（也可直接参考 docker/site-config.example.json 完整示例）
cp -r docker/default-site docker/site

# 2. 编辑 docker/site/site-config.json，填入学校信息；把校徽放到同目录（logo.png / icon.png）

# 3. 修改 docker/test/docker-compose.yml 中的占位密码，然后构建启动
cd docker/test
docker compose -p speedtest up -d --build

# 4. 之后每次改配置，重启即可生效（无需重建镜像）
docker compose -p speedtest restart speedtest-debian-pg
```

### site-config.json 完整字段

```json
{
  "default": {
    "name": "示例机构",
    "titleZh": "示例机构网络测速",
    "titleEn": "Example Institution Network Speed Test",
    "footerZh": "本测速服务器由示例机构提供",
    "footerEn": "Speed test server provided by Example Institution.",
    "logo": "logo.png",
    "icon": "icon.png"
  },
  "privacyEmail": "netadmin@example.edu.cn",
  "ipSegments": [
    { "cidr": "192.0.2.0/24", "zh": "校园网 A 区", "en": "Campus Network A" }
  ],
  "recentColumns": ["time", "clientIp", "node", "dl", "ul", "ping", "jitter"],
  "serverList": [
    { "name": "重庆测速点", "server": "http://speedtest-chq-001.sec.edu.cn/backend" },
    { "name": "本机节点", "server": "/backend" }
  ]
}
```

| 字段 | 必填 | 作用 |
|---|---|---|
| `default.name` | ✅ | 学校显示名（校徽 alt 等） |
| `default.titleZh` | ✅ | 中文标题（页面大标题、浏览器标签） |
| `default.titleEn` | 可选 | 英文标题；缺省用 `titleZh` |
| `default.footerZh`/`footerEn` | 可选 | 页脚说明（中/英），留空则不显示 |
| `default.logo`/`icon` | 可选 | 页眉校徽 / 浏览器图标，相对部署目录的路径；留空不显示 |
| `privacyEmail` | 可选 | 隐私政策联系邮箱 |
| `ipSegments` | 可选 | 校园网段标签表（`cidr` 支持 IPv4/IPv6、裸 IP 按 `/32` 处理），测速完成后 IP 旁显示对应中文标签 |
| `recentColumns` | 可选 | 最近测速表格列，合法值：`time`/`clientIp`/`node`/`dl`/`ul`/`ping`/`jitter`；单节点时自动隐藏 `node` |
| `serverList` | 可选 | 测速节点列表 `[{ "name": 节点名, "server": 后端地址 }]`；`server` 支持完整 URL、`//域名` 协议相对地址、`/backend` 本机相对路径；可对单条节点补 `dlURL`/`ulURL`/`pingURL`/`getIpURL` 覆盖默认脚本路径；缺省为本机单节点 |

### 多个校园网段的配置（多校区 / 多网段）

同一学校有多个校区网段时，在 `ipSegments` 中逐条列出，测速完成后"本机 IP"旁会显示对应网段的中文标签：

```json
"ipSegments": [
  { "cidr": "10.10.0.0/16",       "zh": "主校区校园网",   "en": "Main Campus Network" },
  { "cidr": "10.20.0.0/16",       "zh": "东校区校园网",   "en": "East Campus Network" },
  { "cidr": "2001:db8:10::/48",   "zh": "主校区校园网 IPv6", "en": "Main Campus IPv6 Network" },
  { "cidr": "203.0.113.5",        "zh": "信息中心专线",   "en": "IT Center Dedicated Line" }
]
```

要点：

- `cidr` 支持 IPv4 / IPv6，也支持裸 IP（按单机 `/32` 或 `/128` 处理）
- 网段条目之间没有优先级、互不影响，各条独立生效；某条写错（如 `10.0.0.256/24`）只会被跳过并在启动日志告警，**不影响其他网段和页面显示**
- 网段标签只作用于"IP 旁的校园网中文标签"展示，不会限制谁能测速、也不会影响测速结果

### 多个测速节点的配置（多节点测速）

一个机构有多个测速服务器（如本地节点 + 赛尔网络部署的异地节点）时，在 `serverList` 中逐个列出。前端启动时会探测各节点延迟、自动选中最优节点，用户也可用页面上的"服务器"下拉框手动切换：

```json
"serverList": [
  { "name": "重庆测速点", "server": "http://speedtest-chq-001.sec.edu.cn/backend" },
  { "name": "本机节点",   "server": "/backend" }
]
```

要点：

- `server` 支持三种写法：**完整 URL**（`http://域名/backend`）、**协议相对**（`//域名/backend`，自动跟随页面 http/https）、**本机相对路径**（`/backend`，自动补全为当前站点地址）
- 远端节点需要已部署运行同一镜像（该节点 `MODE=backend` 仅提供测速后端，或完整模式均可）；每个节点默认使用 `garbage.php`/`empty.php`/`getIP.php` 标准路径，一般无需额外配置
- 只配置一个节点时，前端会自动隐藏"服务器"下拉框，不干扰普通用户
- 修改 `serverList` 后需**重启容器**生效（启动时重新生成 `server-list.json`，日志打印"N 个测速节点"）
- 测速记录会写入所选节点名称与节点域名，可在 `recentColumns` 中加入 `node` 列在最近测速表格中展示

### 常用环境变量

| 变量 | 默认 | 来源 | 作用 |
|---|---|---|---|
| `TELEMETRY` | `false` | 上游自带 | 开启测速记录入库（需配下面 DB_* 变量） |
| `DB_TYPE` / `DB_HOSTNAME` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | — | 上游自带 | 测速记录数据库（postgresql / mysql / sqlite / mssql） |
| `ENABLE_STATS` | `false` | 二开新增 | 是否启用在线统计页 `/results/stats.php`（登录密码为 `PASSWORD`） |
| `PASSWORD` | `password` | 上游自带 | 统计页 / 分享编辑等受保护页面的登录密码 |
| `TITLE` | `LibreSpeed` | 上游自带 | 页面标题（单语；经典页中文场景建议用 `TITLE_ZH`） |
| `TITLE_ZH` / `TITLE_EN` | 空 | 二开新增 | 中/英分语言标题（经典页随语言切换）；优先于 `TITLE` |
| `FOOTER_NOTICE` / `FOOTER_NOTICE_ZH` / `FOOTER_NOTICE_EN` | 空 | 二开新增 | 页脚通知（中/英） |
| `MODE` | `standalone` | 上游自带 | 部署模式：`standalone` / `frontend` / `backend` / `dual` |
| `WEBPORT` | `8080` | 上游自带 | Apache 监听端口 |
| `USE_NEW_DESIGN` | `false` | 上游自带 | 保持默认即可：首页默认进入经典测速页面（本二开的定制功能均基于该页面） |

> 来源说明：**上游自带** = LibreSpeed v6.0.2 原有变量；**二开新增** = 本仓库新增的变量。`TITLE_ZH`/`TITLE_EN`/`FOOTER_NOTICE_*` 仅在没有挂载 `site-config.json` 时作为品牌回退值使用，正常定制请直接配置 `site-config.json`。

### 详细文档

- [English version](README_EN.md)
- `docker/test/README.md` —— 完整配置文档：多测速节点配置、生效方式、容错机制、排障接口
- `docker/site-config.example.json` —— 所有字段的完整填写示例（可复制修改）
- 上游文档：`doc_docker.md`（Docker 部署）、`doc.md`（PHP 手动部署）、`DEVELOPMENT.md`（开发）

---

## License

Copyright (C) 2016-2024 Federico Dossena

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.