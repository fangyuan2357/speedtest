/**
 * @file 为 LibreSpeed 经典测速页（index-classic.html）提供右上角浅色/深色主题切换与中英文切换。
 * @see index-classic.html
 */
(function () {
  "use strict";

  var STORAGE_THEME = "speedtest-classic-theme";
  var STORAGE_LANG = "speedtest-classic-lang";

  var THEME_LIGHT = "light";
  var THEME_DARK = "dark";
  var LANG_EN = "en";
  var LANG_ZH = "zh";

  /** @type {Record<string, Record<string, string>>} */
  var STRINGS = {
    en: {
      docTitle: "LibreSpeed",
      themeToLight: "Switch to light mode",
      themeToDark: "Switch to dark mode",
      langToggleHint: "Switch language (CN / EN)",
      langToggleAria: "Switch language",
      langToggleToEn: "Switch to English (EN)",
      langToggleToZh: "Switch to Chinese (CN)",
      toolbarLabel: "Display options",
      loadingSelectServer: "Selecting a server...",
      noServers: "No servers available",
      btnStart: "Start",
      btnAbort: "Abort",
      serverLabel: "Server:",
      ping: "Ping",
      jitter: "Jitter",
      download: "Download",
      upload: "Upload",
      unitMbps: "Mbit/s",
      clientIpLabel: "Local IP",
      shareResults: "Share results",
      testIdLabel: "Test ID:",
      recentTestsTitle: "Recent tests (last 7 days)",
      recentTestsEmpty: "No records in the last week.",
      recentTestsError: "Could not load recent test data.",
      recentColTime: "Time",
      recentColIp: "Local IP",
      recentColNode: "Test node",
      recentColDl: "Download (Mbit/s)",
      recentColUl: "Upload (Mbit/s)",
      recentColPing: "Ping (ms)",
      recentColJitter: "Jitter (ms)",
      privacyTitle: "Privacy Policy",
      privacyIntro: "This HTML5 speed test server is configured with telemetry enabled.",
      privacyHWhat: "What data we collect",
      privacyCollectLead: "At the end of the test, the following data is collected and stored:",
      privacyLi1: "Test ID",
      privacyLi2: "Time of testing",
      privacyLi3: "Test results (download and upload speed, ping and jitter)",
      privacyLi4: "IP address",
      privacyLi5: "ISP information",
      privacyLi6: "Approximate location (inferred from IP address, not GPS)",
      privacyLi7: "User agent and browser locale",
      privacyLi8: "Test log (contains no personal information)",
      privacyHUse: "How we use the data",
      privacyUseLead: "Data collected through this service is used to:",
      privacyUseLi1: "Allow sharing of test results (sharable image for forums, etc.)",
      privacyUseLi2: "To improve the service offered to you (for instance, to detect problems on our side)",
      privacyNoShare: "No personal information is disclosed to third parties.",
      privacyHConsent: "Your consent",
      privacyConsent: "By starting the test, you consent to the terms of this privacy policy.",
      privacyHRemoval: "Data removal",
      privacyRemoval:
        "If you want to have your information deleted, you need to provide either the ID of the test or your IP address. This is the only way to identify your data, without this information we won't be able to comply with your request.",
      privacyRemovalContact: "Contact this email address for all deletion requests:",
      privacyEmailPlaceholder: "TO BE FILLED BY DEVELOPER",
      privacyClose: "Close",
      linkCopied: "Link copied",
      ariaStart: "Start",
      ariaAbort: "Abort"
    },
    zh: {
      docTitle: "LibreSpeed",
      themeToLight: "切换到浅色模式",
      themeToDark: "切换到深色模式",
      langToggleHint: "切换语言（CN / EN）",
      langToggleAria: "切换界面语言",
      langToggleToEn: "切换到 English（EN）",
      langToggleToZh: "切换到中文（CN）",
      toolbarLabel: "显示选项",
      loadingSelectServer: "正在选择服务器…",
      noServers: "没有可用服务器",
      btnStart: "开始",
      btnAbort: "中止",
      serverLabel: "服务器：",
      ping: "延迟",
      jitter: "抖动",
      download: "下载",
      upload: "上传",
      unitMbps: "Mbit/s",
      clientIpLabel: "本机IP地址",
      shareResults: "分享结果",
      testIdLabel: "测试 ID：",
      recentTestsTitle: "最近 7 日测速记录（最多 10 条）",
      recentTestsEmpty: "最近一周暂无测速记录。",
      recentTestsError: "无法加载最近测速数据。",
      recentColTime: "测试时间",
      recentColIp: "本机 IP",
      recentColNode: "测速节点",
      recentColDl: "下行 (Mbit/s)",
      recentColUl: "上行 (Mbit/s)",
      recentColPing: "延迟 (ms)",
      recentColJitter: "抖动 (ms)",
      privacyTitle: "隐私政策",
      privacyIntro: "本 HTML5 测速服务已启用遥测。",
      privacyHWhat: "我们收集哪些数据",
      privacyCollectLead: "在每次测试结束时，会收集并保存以下数据：",
      privacyLi1: "测试 ID",
      privacyLi2: "测试时间",
      privacyLi3: "测试结果（下载/上传速率、延迟与抖动）",
      privacyLi4: "IP 地址",
      privacyLi5: "运营商（ISP）信息",
      privacyLi6: "大致地理位置（由 IP 推断，非 GPS）",
      privacyLi7: "浏览器 User-Agent 与语言区域",
      privacyLi8: "测试日志（不含个人身份信息）",
      privacyHUse: "我们如何使用这些数据",
      privacyUseLead: "通过本服务收集的数据将用于：",
      privacyUseLi1: "生成可分享的测速结果图（例如论坛展示）",
      privacyUseLi2: "改进向您提供的服务（例如排查我方故障）",
      privacyNoShare: "不会向第三方披露个人身份信息。",
      privacyHConsent: "您的同意",
      privacyConsent: "开始测试即表示您同意本隐私政策的条款。",
      privacyHRemoval: "数据删除",
      privacyRemoval:
        "若需删除与您相关的数据，请提供测试 ID 或您的 IP 地址；这是定位您数据的唯一方式，没有这些信息我们将无法处理请求。",
      privacyRemovalContact: "所有删除请求请联系以下邮箱：",
      privacyEmailPlaceholder: "由部署者填写邮箱",
      privacyClose: "关闭",
      linkCopied: "链接已复制",
      ariaStart: "开始测速",
      ariaAbort: "中止测速"
    }
  };

  var lang = LANG_ZH;
  var theme = THEME_LIGHT;
  var lastClientIpRaw = "";

  /**
   * @param {string} key
   * @returns {string}
   */
  function t(key) {
    var pack = STRINGS[lang] || STRINGS[LANG_EN];
    return pack[key] || STRINGS[LANG_EN][key] || key;
  }

  function loadPrefs() {
    try {
      var th = localStorage.getItem(STORAGE_THEME);
      if (th === THEME_LIGHT || th === THEME_DARK) theme = th;
      var ln = localStorage.getItem(STORAGE_LANG);
      if (ln === LANG_ZH || ln === LANG_EN) lang = ln;
    } catch (e) {
      /* 忽略 */
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_THEME, theme);
      localStorage.setItem(STORAGE_LANG, lang);
    } catch (e) {
      /* 忽略 */
    }
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme);
    var sun = document.getElementById("classic-theme-icon-sun");
    var moon = document.getElementById("classic-theme-icon-moon");
    var btn = document.getElementById("classic-theme-toggle");
    if (sun && moon && btn) {
      var isDark = theme === THEME_DARK;
      sun.classList.toggle("classic-icon--hidden", !isDark);
      moon.classList.toggle("classic-icon--hidden", isDark);
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      var hint = t(isDark ? "themeToLight" : "themeToDark");
      btn.setAttribute("title", hint);
      btn.setAttribute("aria-label", hint);
    }
  }

  function toggleTheme() {
    theme = theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    savePrefs();
    applyTheme();
  }

  function toggleLang() {
    lang = lang === LANG_EN ? LANG_ZH : LANG_EN;
    savePrefs();
    applyI18n();
  }

  /**
   * 主测速按钮文案（不再使用 CSS :before）
   * @param {"start"|"abort"} mode
   */
  function setMainButtonLabel(mode) {
    var btn = document.getElementById("startStopBtn");
    if (!btn) return;
    if (mode === "abort") {
      btn.textContent = t("btnAbort");
      btn.setAttribute("aria-label", t("ariaAbort"));
    } else {
      btn.textContent = t("btnStart");
      btn.setAttribute("aria-label", t("ariaStart"));
    }
  }

  /**
   * 根据是否正在测速刷新主按钮文字
   */
  function syncMainButtonFromDom() {
    var btn = document.getElementById("startStopBtn");
    if (!btn) return;
    if (btn.classList.contains("running")) {
      setMainButtonLabel("abort");
    } else {
      setMainButtonLabel("start");
    }
  }

  /**
   * 读取由服务端注入的 data-* 文案（占位符未替换时视为空）。
   * @param {Element|null} el
   * @param {string} name
   * @returns {string}
   */
  function readSiteAttr(el, name) {
    if (!el) return "";
    var v = el.getAttribute(name);
    if (v == null) return "";
    if (v.indexOf("__LIBRESPEED") === 0) return "";
    return v;
  }

  /**
   * 根据当前语言更新页眉标题、页脚说明与 document.title（与 Docker 环境变量注入的中英文对应）。
   */
  function applySiteBrandingCopy() {
    var h1 = document.getElementById("site-brand-title");
    var foot = document.getElementById("site-footer-notice");
    var tZh = readSiteAttr(h1, "data-site-title-zh");
    var tEn = readSiteAttr(h1, "data-site-title-en");
    var titleText = "";
    if (lang === LANG_ZH) {
      titleText = tZh || tEn;
    } else {
      titleText = tEn || tZh;
    }
    if (h1) {
      if (titleText) {
        h1.textContent = titleText;
        h1.setAttribute("aria-label", titleText);
      } else {
        var curT = h1.textContent || "";
        if (curT.indexOf("__LIBRESPEED") !== -1) {
          h1.textContent = "LibreSpeed";
          h1.setAttribute("aria-label", "LibreSpeed");
        }
      }
    }
    document.title = titleText || (h1 && h1.textContent ? h1.textContent.trim() : "") || t("docTitle");

    if (foot) {
      var fZh = readSiteAttr(foot, "data-site-footer-zh");
      var fEn = readSiteAttr(foot, "data-site-footer-en");
      var footText = lang === LANG_ZH ? fZh || fEn : fEn || fZh;
      foot.textContent = footText || "";
      foot.classList.toggle("site-footer-notice--hidden", !footText.trim());
    }
  }

  /**
   * 应用隐私政策联系邮箱（href 与占位文本）；语言切换后由 applyI18n 兜底重设。
   * 邮箱值由 site-config.js 写入 window.__librespeedPrivacyEmail。
   * @param {string} email 联系邮箱
   */
  function applyPrivacyEmail(email) {
    if (!email) return;
    var links = document.querySelectorAll('a[href^="mailto:"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      link.href = "mailto:" + email;
      var text = link.textContent || "";
      if (/TO BE FILLED|PUT@YOUR_EMAIL|填写邮箱|deployment email/i.test(text)) {
        link.textContent = email;
      }
    }
  }

  /**
   * 语言切换按钮无障碍文案（可见 EN/CN 由 CSS 根据 data-lang 渲染）。
   */
  function syncLangToggleButton() {
    var langBtn = document.getElementById("classic-lang-toggle");
    if (!langBtn) return;
    langBtn.setAttribute("title", t("langToggleHint"));
    langBtn.setAttribute(
      "aria-label",
      lang === LANG_ZH ? t("langToggleToEn") : t("langToggleToZh")
    );
  }

  function applyI18n() {
    document.documentElement.lang = lang === LANG_ZH ? "zh-Hans" : "en";
    document.documentElement.setAttribute("data-lang", lang);

    syncLangToggleButton();

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    document.querySelectorAll('#test .unit[data-i18n="unitMbps"]').forEach(function (el) {
      el.textContent = t("unitMbps");
    });

    var tb = document.getElementById("classic-chrome-toolbar");
    if (tb) tb.setAttribute("aria-label", t("toolbarLabel"));

    syncMainButtonFromDom();
    renderClientIpLabel();
    applySiteBrandingCopy();
    applyPrivacyEmail(window.__librespeedPrivacyEmail || "");
    applyTheme();
    loadRecentTestsTable();
  }

  function bindToolbar() {
    var themeBtn = document.getElementById("classic-theme-toggle");
    var langBtn = document.getElementById("classic-lang-toggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
    if (langBtn) langBtn.addEventListener("click", toggleLang);
  }

  /**
   * 结果链接复制后的提示（供 input onclick 调用）
   */
  function alertLinkCopied() {
    window.alert(t("linkCopied"));
  }

  /**
   * 将客户端 IP 附带描述按当前语言进行转换（例如 private IPv4 access）。
   * @param {string} raw
   * @returns {string}
   */
  function localizeClientIpRaw(raw) {
    var text = String(raw || "");
    if (lang === LANG_ZH) {
      return text
        .replace(/\bprivate IPv4 access\b/gi, "私有 IPv4 访问")
        .replace(/\bprivate IPv6 access\b/gi, "私有 IPv6 访问")
        .replace(/\bpublic IPv4 access\b/gi, "公网 IPv4 访问")
        .replace(/\bpublic IPv6 access\b/gi, "公网 IPv6 访问");
    }
    return text;
  }

  /**
   * 校园网段标签表：由 site-config.js 从 site-config.json 的 ipSegments 注入
   * （如未注入则无标签显示，不影响测速功能）。
   * @returns {Array<{cidr:string, zh:string, en:string}>}
   */
  function campusSegments() {
    return Array.isArray(window.__librespeedIpSegments) ? window.__librespeedIpSegments : [];
  }

  /**
   * 解析 IPv4 文本为 32 位整数。
   * @param {string} ip
   * @returns {number|null}
   */
  function ipv4ToInt(ip) {
    var m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    var a = Number(m[1]);
    var b = Number(m[2]);
    var c = Number(m[3]);
    var d = Number(m[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return null;
    }
    return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
  }

  /**
   * 判断某 IPv4 是否命中 CIDR。
   * @param {string} ip
   * @param {string} cidr
   * @returns {boolean}
   */
  function ipv4InCidr(ip, cidr) {
    var parts = cidr.split("/");
    if (parts.length !== 2) return false;
    var baseInt = ipv4ToInt(parts[0]);
    var ipInt = ipv4ToInt(ip);
    var prefix = Number(parts[1]);
    if (baseInt == null || ipInt == null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    var mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }

  /**
   * 从客户端 IP 原始文本中提取 IPv4。
   * @param {string} raw
   * @returns {string}
   */
  function extractIpv4(raw) {
    var m = String(raw || "").match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    return m ? m[0] : "";
  }

  /**
   * 将 IPv6 文本解析为 8 段 16 位无符号整数（不支持以 IPv4 点分十进制结尾的映射形式）。
   * @param {string} raw
   * @returns {number[]|null}
   */
  function ipv6ToHextets(raw) {
    var ip = String(raw || "")
      .trim()
      .toLowerCase();
    var zi = ip.indexOf("%");
    if (zi !== -1) ip = ip.slice(0, zi);
    if (/(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return null;
    }
    if (ip.indexOf(":") < 0) return null;

    var double = ip.indexOf("::");
    if (double === -1) {
      var parts = ip.split(":").filter(Boolean);
      if (parts.length !== 8) return null;
      var full = [];
      for (var f = 0; f < 8; f++) {
        var vf = parseInt(parts[f], 16);
        if (vf !== vf || vf < 0 || vf > 65535) return null;
        full.push(vf);
      }
      return full;
    }

    var head = ip.slice(0, double);
    var tail = ip.slice(double + 2);
    var left = head
      ? head.split(":").filter(function (x) {
          return x.length;
        })
      : [];
    var right = tail
      ? tail.split(":").filter(function (x) {
          return x.length;
        })
      : [];
    var missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    var mid = [];
    for (var mi = 0; mi < missing; mi++) mid.push("0");
    var all = left.concat(mid).concat(right);
    if (all.length !== 8) return null;
    var out = [];
    for (var j = 0; j < 8; j++) {
      var h = all[j] === "" ? 0 : parseInt(all[j], 16);
      if (h !== h || h < 0 || h > 65535) return null;
      out.push(h);
    }
    return out;
  }

  /**
   * 判断某 IPv6 是否命中 CIDR（前缀长度 0–128）。
   * @param {string} ip
   * @param {string} cidr
   * @returns {boolean}
   */
  function ipv6InCidr(ip, cidr) {
    var parts = String(cidr || "").split("/");
    if (parts.length !== 2) return false;
    var prefix = Number(parts[1]);
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 128) return false;
    var netH = ipv6ToHextets(parts[0]);
    var ipH = ipv6ToHextets(ip);
    if (!netH || !ipH) return false;
    var bits = prefix;
    for (var i = 0; i < 8; i++) {
      var need = bits < 16 ? bits : 16;
      if (need <= 0) return true;
      var mask = need === 16 ? 0xffff : (0xffff ^ (((1 << (16 - need)) - 1) >>> 0)) & 0xffff;
      if ((netH[i] & mask) >>> 0 !== (ipH[i] & mask) >>> 0) {
        return false;
      }
      bits -= need;
    }
    return true;
  }

  /**
   * 从测速端返回的原始字符串中提取 IPv6 地址。
   * @param {string} raw
   * @returns {string}
   */
  function extractIpv6(raw) {
    var s = String(raw || "");
    if (s.indexOf(":") < 0) return "";
    var chunks = s.split(/\s+-\s+/);
    for (var t = 0; t < chunks.length; t++) {
      var cand = chunks[t].trim().replace(/^\[+|\]+$/g, "");
      if (ipv6ToHextets(cand)) return cand;
    }
    var re =
      /\b((?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}|(?:[0-9a-fA-F]{1,4}:){1,6}(?::[0-9a-fA-F]{1,4}){1,6}|::)\b/i;
    var m = s.match(re);
    if (m && ipv6ToHextets(m[1])) return m[1];
    return "";
  }

  /**
   * 根据 IPv6 段映射返回校园网络标签（按当前语言）。
   * @param {string} ip
   * @returns {string}
   */
  function campusLabelByIpv6(ip) {
    var segs = campusSegments();
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (ipv6InCidr(ip, seg.cidr)) {
        return lang === LANG_ZH ? seg.zh : seg.en;
      }
    }
    return "";
  }

  /**
   * 根据客户端原始 IP 文本匹配 IPv4/IPv6 校园网段并返回说明标签。
   * @param {string} raw
   * @returns {string}
   */
  function campusLabelForClient(raw) {
    var v4 = extractIpv4(raw);
    var segs = campusSegments();
    if (v4) {
      for (var i = 0; i < segs.length; i++) {
        var seg4 = segs[i];
        if (ipv4InCidr(v4, seg4.cidr)) {
          return lang === LANG_ZH ? seg4.zh : seg4.en;
        }
      }
    }
    var v6 = extractIpv6(raw);
    if (v6) {
      return campusLabelByIpv6(v6);
    }
    return "";
  }

  /**
   * 将测速端返回的客户端 IP/运营商信息渲染为「本机 IP」一行说明。
   */
  function renderClientIpLabel() {
    var ipEl = document.getElementById("ip");
    if (!ipEl) return;
    if (!lastClientIpRaw) {
      ipEl.textContent = "";
      return;
    }
    var localizedIp = localizeClientIpRaw(lastClientIpRaw);
    var campusLabel = campusLabelForClient(lastClientIpRaw);
    var v4 = extractIpv4(lastClientIpRaw);
    var v6 = extractIpv6(lastClientIpRaw);
    if (campusLabel) {
      var dispIp = v4 || v6 || "";
      localizedIp = dispIp ? dispIp + " - " + campusLabel : localizedIp + " - " + campusLabel;
    }
    ipEl.textContent = t("clientIpLabel") + ": " + localizedIp;
  }

  /**
   * 设置并刷新客户端 IP 展示文案（会随语言切换自动重渲染）。
   * @param {string} raw
   */
  function setClientIp(raw) {
    lastClientIpRaw = raw || "";
    renderClientIpLabel();
  }

  /**
   * 把测速记录里的 extra 格式化为测速节点文案：名称（主机名或地址）。
   * 旧记录只有名称时只显示名称；没有节点信息时显示破折号。
   * @param {string|undefined|null} extra 遥测 extra 字段，JSON 字符串
   * @returns {string}
   */
  function formatRecentNode(extra) {
    if (extra == null || extra === "") return "—";
    var obj = null;
    try {
      obj = JSON.parse(String(extra));
    } catch (e) {
      return "—";
    }
    if (!obj || typeof obj !== "object") return "—";
    var name = typeof obj.server === "string" ? obj.server.trim() : "";
    var host = typeof obj.host === "string" ? obj.host.trim() : "";
    if (name && host) return name + "（" + host + "）";
    return name || host || "—";
  }

  /**
   * 将遥测返回的时间字段格式化为本地可读字符串。
   * @param {string|undefined|null} raw
   * @returns {string}
   */
  function formatRecentTimestamp(raw) {
    if (raw == null || raw === "") return "—";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    var loc = lang === LANG_ZH ? "zh-CN" : "en-GB";
    return d.toLocaleString(loc, { hour12: false });
  }

  /** 未拿到 site-config 时的表格列：时间、本机 IP、下行、上行。 */
  var DEFAULT_RECENT_COLUMNS = ["time", "clientIp", "dl", "ul"];
  /** 最近记录请求序号，丢弃被新一次加载取代的响应。 */
  var recentLoadSeq = 0;

  /** @type {Record<string, string>} */
  var RECENT_COLUMN_LABELS = {
    time: "recentColTime",
    clientIp: "recentColIp",
    node: "recentColNode",
    dl: "recentColDl",
    ul: "recentColUl",
    ping: "recentColPing",
    jitter: "recentColJitter"
  };

  /**
   * 读取站点配置下发的表格列。单节点时服务端已去掉 node。
   * @returns {string[]}
   */
  function recentColumns() {
    var cols = window.__librespeedRecentColumns;
    if (!Array.isArray(cols) || cols.length === 0) return DEFAULT_RECENT_COLUMNS.slice();
    return cols.filter(function (col) {
      return Object.prototype.hasOwnProperty.call(RECENT_COLUMN_LABELS, col);
    });
  }

  /**
   * 按列标识取出一条记录的展示文本。
   * clientIp 是测速用户的地址，不是测速节点地址。
   * @param {string} col 列标识
   * @param {Object} row 记录
   * @returns {string}
   */
  function recentCellText(col, row) {
    if (col === "time") return formatRecentTimestamp(row.timestamp);
    if (col === "clientIp") return row.ip != null && row.ip !== "" ? String(row.ip) : "—";
    if (col === "node") return formatRecentNode(row.extra);
    if (col === "dl" || col === "ul" || col === "ping" || col === "jitter") {
      var value = row[col];
      return value != null && value !== "" ? String(value) : "—";
    }
    return "—";
  }

  /**
   * 按当前列配置重写表头。
   * @param {string[]} cols 列标识
   */
  function renderRecentHead(cols) {
    var head = document.getElementById("recentTestsHead");
    if (!head) return;
    head.innerHTML = "";
    cols.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = t(RECENT_COLUMN_LABELS[col]);
      head.appendChild(th);
    });
  }

  /**
   * 从 results/recent_week.php 拉取最近一周最多 10 条记录并填充表格。
   */
  function loadRecentTestsTable() {
    var body = document.getElementById("recentTestsBody");
    var status = document.getElementById("recentTestsStatus");
    if (!body) return;
    body.innerHTML = "";
    if (status) {
      status.textContent = "";
      status.classList.add("recent-tests-status--hidden");
    }

    var seq = ++recentLoadSeq;
    var cols = recentColumns();
    if (cols.length === 0) cols = DEFAULT_RECENT_COLUMNS.slice();
    renderRecentHead(cols);

    fetch("results/recent_week.php")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (seq !== recentLoadSeq) return;
        if (!data || !data.ok || !Array.isArray(data.rows)) {
          if (status) {
            status.textContent = t("recentTestsError");
            status.classList.remove("recent-tests-status--hidden");
          }
          return;
        }
        if (data.rows.length === 0) {
          var tr0 = document.createElement("tr");
          var td0 = document.createElement("td");
          td0.colSpan = cols.length;
          td0.className = "recent-tests-empty";
          td0.textContent = t("recentTestsEmpty");
          tr0.appendChild(td0);
          body.appendChild(tr0);
          return;
        }
        data.rows.forEach(function (row) {
          var tr = document.createElement("tr");
          cols.forEach(function (col) {
            var td = document.createElement("td");
            td.textContent = recentCellText(col, row);
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
      })
      .catch(function () {
        if (seq !== recentLoadSeq) return;
        if (status) {
          status.textContent = t("recentTestsError");
          status.classList.remove("recent-tests-status--hidden");
        }
      });
  }

  function init() {
    loadPrefs();
    bindToolbar();
    applyI18n();
  }

  window.ClassicChrome = {
    init: init,
    t: t,
    applyI18n: applyI18n,
    refreshBrandingCopy: applySiteBrandingCopy,
    syncPrivacyEmail: applyPrivacyEmail,
    setMainButtonLabel: setMainButtonLabel,
    syncMainButtonFromDom: syncMainButtonFromDom,
    noServersMessage: function () {
      return t("noServers");
    },
    setClientIp: setClientIp,
    alertLinkCopied: alertLinkCopied,
    loadRecentTestsTable: loadRecentTestsTable
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
