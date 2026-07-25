const { chromium } = require('playwright');

const EMAIL = process.env.KATABUMP_EMAIL;
const PASSWORD = process.env.KATABUMP_PASSWORD;
const SERVER_URL = process.env.KATABUMP_SERVER_URL; // رابط صفحة السيرفر (زي: https://dashboard.katabump.com/servers/xxxx)

if (!EMAIL || !PASSWORD || !SERVER_URL) {
  console.error('❌ ناقصة متغيرات: KATABUMP_EMAIL / KATABUMP_PASSWORD / KATABUMP_SERVER_URL');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 جاري تسجيل الدخول...');
    await page.goto('https://dashboard.katabump.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // نجرب أكثر من محدد شائع لحقل الإيميل وكلمة السر (الصفحة ما نعرفش تفاصيلها بالضبط)
    const emailSelector = 'input[type="email"], input[name="email"], input[name="username"]';
    const passwordSelector = 'input[type="password"], input[name="password"]';

    await page.waitForSelector(emailSelector, { timeout: 20000 });
    await page.fill(emailSelector, EMAIL);
    await page.fill(passwordSelector, PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")'),
    ]);

    console.log('✅ تم تسجيل الدخول (على الأرجح)، جاري الانتقال لصفحة السيرفر...');
    await page.goto(SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // نضغط زر Renew الأول باش تفتح النافذة المنبثقة (Modal)
    const openRenewButton = page.locator('button:has-text("Renew"), a:has-text("Renew")').first();
    const exists = await openRenewButton.count();

    if (exists === 0) {
      console.log('⚠️ ما لقيناش زر Renew في الصفحة. ناخد لقطة شاشة للتشخيص.');
      await page.screenshot({ path: 'debug-no-renew-button.png', fullPage: true });
      process.exit(1);
    }

    const isDisabled = await openRenewButton.isDisabled().catch(() => false);
    if (isDisabled) {
      console.log('ℹ️ زر Renew موجود لكنه غير مفعّل حاليًا (يمكن السيرفر لسا بعيد عن وقت التجديد). تجاهلنا هالمرة.');
      process.exit(0);
    }

    await openRenewButton.click();
    console.log('🪟 جاري انتظار ظهور نافذة التأكيد...');
    await page.waitForSelector('text=This will extend the life of your server', { timeout: 15000 });
    await page.screenshot({ path: 'debug-modal-opened.png', fullPage: true });

    // نضغط صندوق الكابتشا (ALTCHA) وننتظر تحققها تلقائيًا (حساب رياضي بسيط، بلا تدخل بشري)
    console.log('🔐 جاري حل الكابتشا (ALTCHA)...');
    const captchaCheckbox = page.locator('input[type="checkbox"]').first();
    await captchaCheckbox.click();

    // ننتظر لحد ما الصندوق يتحقق (altcha يبدل شكله لـ "Verified" أو يصير checked فعليًا)
    await page.waitForFunction(() => {
      const checkbox = document.querySelector('input[type="checkbox"]');
      return checkbox && checkbox.checked;
    }, { timeout: 30000 }).catch(() => {
      console.log('⚠️ ما تأكدناش من نجاح الكابتشا تلقائيًا، بس راح نكمل ونجرب الضغط على Renew.');
    });

    await page.waitForTimeout(2000); // وقت إضافي للتأكد
    await page.screenshot({ path: 'debug-captcha-solved.png', fullPage: true });

    // نضغط زر Renew الأزرق داخل النافذة المنبثقة للتأكيد النهائي
    const confirmRenewButton = page.locator('div:has-text("This will extend the life") >> button:has-text("Renew"), button.btn-primary:has-text("Renew")').last();
    await confirmRenewButton.click();
    await page.waitForTimeout(4000); // نعطيو وقت للطلب يتنفذ

    console.log('✅ تم الضغط على زر التجديد بنجاح.');
    await page.screenshot({ path: 'debug-after-renew.png', fullPage: true });

  } catch (err) {
    console.error('❌ حدث خطأ:', err.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: true }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
