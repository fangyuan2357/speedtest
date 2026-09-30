const { test, expect } = require('@playwright/test');
const { baseUrls } = require('./helpers/env');

// 规则乙：页面标题唯一来源是 site-config.json 的 titleZh/titleEn。
// 1) 未挂载自定义 site-config 时（standalone，尽管设置了 TITLE 环境变量），
//    标题 = 镜像内置空白模板 docker/default-site/site-config.json 的值：
//    titleZh="LibreSpeed 网络测速" / titleEn="LibreSpeed Speed Test"
const templateTitleZh = 'LibreSpeed 网络测速';
const templateTitleEn = 'LibreSpeed Speed Test';
// 2) 挂载自定义 site-config 时（standalone-new），标题 = 该文件 titleZh/titleEn
//    （含 umlaut 与引号，保留本测试"特殊字符"的验证主题）
const customTitleZh = 'Grüße 中文「引号」測速站';
const customTitleEn = 'Grüße "Tempo" \'Österreich\' - Custom Site';

test.describe('页面标题唯一来源 site-config.json（规则乙：TITLE 已废弃）', () => {
  test('未挂载 site-config 时，设置 TITLE 不影响现代页标题（= 空白模板 titleEn）', async ({ page }) => {
    await page.goto(`${baseUrls.standalone}/index-modern.html`);
    await expect(page).toHaveTitle(templateTitleEn);
    await expect(page.locator('main > h1')).toHaveText(templateTitleEn);
  });

  test('未挂载 site-config 时，设置 TITLE 不影响经典页标题（= 空白模板 titleZh）', async ({ page }) => {
    await page.goto(`${baseUrls.standalone}/index-classic.html`);
    await expect(page.locator('h1').first()).toHaveText(templateTitleZh);
  });

  test('未挂载 site-config 时，静态 HTML 中只有空白模板标题（TITLE 不参与静态注入）', async ({ request }) => {
    const modern = await request.get(`${baseUrls.standalone}/index-modern.html`);
    const modernHtml = await modern.text();
    expect(modernHtml).toContain(`<title>${templateTitleEn} - Free and Open Source Speedtest</title>`);
    expect(modernHtml).toContain(`<h1>${templateTitleEn}</h1>`);

    const classic = await request.get(`${baseUrls.standalone}/index-classic.html`);
    const classicHtml = await classic.text();
    expect(classicHtml).toContain(`data-site-title-zh="${templateTitleZh}"`);
    expect(classicHtml).toContain(`data-site-title-en="${templateTitleEn}"`);
  });

  test('挂载自定义 site-config 后，现代页标题 = 文件 titleEn（含特殊字符），而非 TITLE', async ({ page }) => {
    await page.goto(`${baseUrls.standaloneNew}/index-modern.html`);
    await expect(page).toHaveTitle(customTitleEn);
    await expect(page.locator('main > h1')).toHaveText(customTitleEn);
  });

  test('挂载自定义 site-config 后，经典页标题 = 文件 titleZh（含特殊字符），而非 TITLE', async ({ page }) => {
    await page.goto(`${baseUrls.standaloneNew}/index-classic.html`);
    await expect(page.locator('h1').first()).toHaveText(customTitleZh);
  });
});
