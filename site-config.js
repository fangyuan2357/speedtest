/**
 * LibreSpeed 站点配置动态应用脚本
 *
 * 页面加载后请求 site-config.php?action=config，服务端返回站点配置
 * （标题/页脚/校徽/邮箱/校园网段标签表），本脚本将其动态应用到页面：
 *  - 新版 index.html / index-modern.html：直接更新 logo、主标题、页脚与 <title>
 *  - 经典页 index-classic.html：更新 data-site-* 属性后调用
 *    window.ClassicChrome.refreshBrandingCopy() 按当前语言刷新
 *
 * 任何失败（网络错误 / 接口 5xx / JSON 异常）都静默忽略，
 * 页面保留服务端静态注入的默认配置，不影响测速功能。
 */
(function () {
  'use strict';

  /** 动态品牌接口地址（cb 参数防止浏览器缓存） */
  var API_URL = 'site-config.php?action=config&cb=' + encodeURIComponent(Date.now());
  /** 接口超时（毫秒），超时即放弃动态化，保留静态默认 */
  var TIMEOUT_MS = 4000;

  /**
   * 清理文案：去首尾空白；空值或未替换占位符统一视为空。
   * @param {*} value 原始值
   * @returns {string} 清理后的文本
   */
  function cleanText(value) {
    if (typeof value !== 'string') return '';
    var text = value.trim();
    if (text.indexOf('__LIBRESPEED') === 0) return '';
    return text;
  }

  /**
   * 当前页面语言是否为英文（经典页经典 Chrome 也会设置 data-lang 属性）。
   * @returns {boolean}
   */
  function isEnglishPage() {
    return document.documentElement.lang === 'en' ||
      document.documentElement.getAttribute('data-lang') === 'en';
  }

  /**
   * 按当前页面语言取标题文本（经典页由 ClassicChrome 接管，这里只服务新版页）。
   * @param {Object} rule 品牌规则
   * @returns {string} 标题文本
   */
  function titleForLang(rule) {
    var isEn = isEnglishPage();
    return cleanText(isEn ? rule.titleEn : rule.titleZh) || cleanText(isEn ? rule.titleZh : rule.titleEn);
  }

  /**
   * 更新校徽图片（宽高交由 CSS 自适应，去除内联尺寸属性避免变形；
   * 未配置校徽文件导致加载失败时自动隐藏，避免显示破图）。
   * @param {Object} rule 站点配置对象
   */
  /**
   * 按配置显示或隐藏页眉校徽。
   * 未配置 logo 时去掉 src，避免继续显示浏览器缓存的旧校徽。
   * @param {Object} rule 站点配置对象
   */
  function applyLogo(rule) {
    var logoUrl = cleanText(rule.logoUrl);
    var imgs = document.querySelectorAll('.site-brand-logo');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!img.dataset.scErrorBound) {
        img.dataset.scErrorBound = '1';
        img.addEventListener('error', function () {
          this.removeAttribute('src');
          this.style.display = 'none';
        });
      }
      if (logoUrl) {
        img.src = logoUrl;
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.alt = cleanText(rule.name) || 'logo';
      }
    }
  }

  /**
   * 新版页面（index.html / index-modern.html）品牌应用。
   * @param {Object} rule 品牌规则
   */
  function applyModern(rule) {
    var title = titleForLang(rule);
    if (title) {
      var h1 = document.querySelector('main > h1');
      if (h1) h1.textContent = title;
      document.title = title;
    }
    var foot = document.getElementById('site-footer-notice');
    if (foot) {
      var isEn = isEnglishPage();
      foot.textContent = cleanText(isEn ? rule.footerEn : rule.footerZh) ||
        cleanText(isEn ? rule.footerZh : rule.footerEn) || '';
    }
  }

  /**
   * 经典页（index-classic.html）品牌应用：更新 data 属性后触发既有刷新逻辑。
   * @param {Object} rule 品牌规则
   */
  function applyClassic(rule) {
    var h1 = document.getElementById('site-brand-title');
    if (h1) {
      h1.setAttribute('data-site-title-zh', cleanText(rule.titleZh));
      h1.setAttribute('data-site-title-en', cleanText(rule.titleEn));
    }
    var foot = document.getElementById('site-footer-notice');
    if (foot) {
      foot.setAttribute('data-site-footer-zh', cleanText(rule.footerZh));
      foot.setAttribute('data-site-footer-en', cleanText(rule.footerEn));
    }
    if (window.ClassicChrome && typeof window.ClassicChrome.refreshBrandingCopy === 'function') {
      window.ClassicChrome.refreshBrandingCopy();
    }
  }

  /**
   * 处理隐私政策联系邮箱：替换页面上所有 mailto 链接的目标与占位文本。
   * 经典页语言切换会重写链接文本，因此由 ClassicChrome.applyI18n 兜底重设。
   * @param {string} privacyEmail 联系邮箱
   */
  function applyPrivacyEmail(privacyEmail) {
    var email = cleanText(privacyEmail);
    if (!email) return;
    window.__librespeedPrivacyEmail = email;
    var links = document.querySelectorAll('a[href^="mailto:"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      link.href = 'mailto:' + email;
      var text = link.textContent || '';
      if (/TO BE FILLED|PUT@YOUR_EMAIL|填写邮箱|deployment email/i.test(text)) {
        link.textContent = email;
      }
    }
  }

  /**
   * 注入校园网段标签表（经典页"IP - 校园网标签"展示用，语言切换后自动重算）。
   * @param {Array} segments 网段标签数组 [{cidr, zh, en}]
   */
  function applyIpSegments(segments) {
    window.__librespeedIpSegments = Array.isArray(segments) ? segments : [];
  }

  /**
   * 注入最近测速表格列。列由 site-config.json 的 recentColumns 决定，
   * 单节点时服务端已去掉 node。
   * @param {Array<string>|undefined} columns 列标识
   */
  function applyRecentColumns(columns) {
    window.__librespeedRecentColumns = Array.isArray(columns) ? columns : null;
    if (window.ClassicChrome && typeof window.ClassicChrome.loadRecentTestsTable === "function") {
      window.ClassicChrome.loadRecentTestsTable();
    }
  }

  /**
   * 将站点配置应用到当前页面（接口返回为扁平字段，直接作为配置对象使用）。
   * @param {Object} data 接口返回的整体数据
   */
  function apply(data) {
    var cfg = data;
    applyIpSegments(cfg.ipSegments);
    applyRecentColumns(cfg.recentColumns);
    applyLogo(cfg);
    applyModern(cfg);
    applyClassic(cfg);
    applyPrivacyEmail(cleanText(cfg.privacyEmail));
  }

  /**
   * 拉取动态品牌配置并应用。
   */
  function run() {
    if (!window.fetch) return;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    fetch(API_URL, {
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) apply(data);
      })
      .catch(function () {
        // 静默降级：保留服务端静态默认品牌
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();