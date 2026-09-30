The files in this folder represent a simple end to end test.
At the moment it is interactive, so you need to run `docker compose up` in the folder and watch the output for errors.
Sometimes the mysql container needs more than 15 seconds, so the test_script fails.
Just try it again.

## 学校站点定制（全部通过文件配置，不改代码、不重建镜像）

每所学校的定制信息（品牌文案、校徽、网段标签、测速节点）全部放在部署目录（示例：`docker/site/`，已挂载到容器 `/speedtest-site`，只读）：

```
docker/site/                ← 部署目录（可整体替换/复制给不同学校）
├── site-config.json   ← 站点配置（唯一入口）
├── logo.png           ← 页眉校徽（文件名随意，在 JSON 中引用；不配置则不显示）
└── icon.png           ← 浏览器/手机图标
```

镜像内置一份**通用默认模板**（`docker/default-site/`，无任何学校文案与图片）：
未挂载部署目录时站点按通用模板运行（标题为环境变量 `TITLE` 等生成，无校徽、默认 favicon）。
给新学校部署时：复制 `docker/default-site/` 为你的学校目录并按下方说明填写，然后挂载它。

### site-config.json 结构

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
    { "cidr": "192.0.2.0/24", "zh": "校园网 A 区", "en": "Campus Network A" },
    { "cidr": "198.51.100.0/24", "zh": "校园网 B 区", "en": "Campus Network B" }
  ],
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
| `default.titleEn` | 可选 | 英文标题（中文页面切换英文时显示）；缺省用 `titleZh` |
| `default.footerZh` / `footerEn` | 可选 | 页脚说明（中/英），留空则不显示 |
| `default.logo` | 可选 | 页眉校徽，相对部署目录的路径；留空则页面不显示校徽（不留破图） |
| `default.icon` | 可选 | 浏览器/手机图标；留空则用镜像默认 favicon |
| `privacyEmail` | 可选 | 隐私政策联系邮箱（留空则页面保留占位文案，不影响功能） |
| `ipSegments` | 可选 | **校园网段标签表**：测速完成后"本机 IP"旁显示对应网段的中英标签（如"IP 192.0.2.23 - 校园网 A 区"）。不配置则只显示后端英文 ISP 信息。写错某条只跳过该条并告警 |
| `serverList` | 可选 | 测速节点列表（可多个，见下节）；缺省为本机单节点。**重启容器生效** |

### 多测速节点配置

学校有多个测速节点（如本地节点 + 赛尔网络部署的异地节点）时，在 `serverList` 中逐个列出：

```json
"serverList": [
  { "name": "重庆测速点", "server": "http://speedtest-chq-001.sec.edu.cn/backend" },
  { "name": "本机节点",   "server": "/backend" }
]
```

- `server` 是**节点测速后端地址前缀**，三种写法都支持：
  `http://域名/backend`（完整 URL）、`//域名/backend`（协议相对，自动跟随页面协议）、
  `/backend`（相对路径，自动补全为当前站点地址，即本机节点）。
- **默认测速页面（经典页）会读取本列表并显示节点下拉**；只有一个节点时下拉自动隐藏。
  测速会自动打开跨域模式，远程节点无需额外配置 CORS。
- 每个节点的四个测速脚本（`garbage.php` / `empty.php` / `getIP.php`）默认按相对路径自动拼接，一般无需填写；
  若节点目录结构特殊，可对单条节点补 `dlURL` / `ulURL` / `pingURL` / `getIpURL` 字段覆盖默认值。
- `name` 会显示在页面的服务器下拉/列表中，建议写明节点所在城市/位置，方便用户选择。
- 修改后重启容器（`docker compose restart speedtest-debian-pg`）即可生效，生成 `server-list.json`；
  启动日志会打印 `已生成 server-list.json：N 个测速节点` 供确认。
- 注意：只列出**节点**，不含主站；各节点需自行部署同一镜像（`MODE=backend` 或全套都可）。

### 生效方式

1. 编辑 `docker/site/site-config.json`、替换校徽文件
2. `docker compose up -d --force-recreate`（或 `docker compose restart speedtest-debian-pg`，无需动数据库）
3. 启动日志中会打印配置校验结果（`[site]` 前缀）：缺失的校徽文件、非法的网段、JSON 语法错误都会以 WARN/ERROR 列出

### 写错配置不会崩

- JSON 语法错误 → 自动回退"上次成功配置"，再兜底镜像内置默认，页面照常打开
- 单条网段非法（如 `10.0.0.256/24`、掩码越界）→ 只跳过该条，其余正常
- 所有错误输出到启动日志，修正后重启即可恢复

### 统计页（results/stats.php）

默认**禁用**（`ENABLE_STATS=false`，访问返回 404）。需要在线查看测速记录时，在
docker-compose.yml 的 `speedtest-env` 中设置 `ENABLE_STATS: "true"` 并重启
（登录密码为 `PASSWORD`）。测速记录的采集写入（telemetry）不受此开关影响。

### 配置接口（供排障）

- `GET /site-config.php?action=config` → 站点配置 JSON（标题/页脚/校徽地址/邮箱/网段标签表）
- `GET /site-config.php?action=logo` → 站点页眉校徽 PNG（未配置校徽时返回 404，页面自动隐藏该位置）
- `GET /site-config.php?action=icon` → 站点图标 PNG（未配置时返回 404，浏览器显示默认图标）