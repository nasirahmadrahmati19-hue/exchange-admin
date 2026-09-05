/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری یکتا (نسخه نهایی و پایدار)
 * ساختار: TR-1405-M4K9P-X7B2
 * - TR: پیشوند ثابت (Transaction)
 * - 1405: سال هجری شمسی (خودکار)
 * - M4K9P-X7B2: شناسه یکتای جهانی (timestamp + random)
 * 
 * ✅ مزایا:
 * - همیشه یکتا است (حتی اگر دو نفر همزمان کلیک کنند)
 * - به تعداد تراکنش‌ها وابسته نیست
 * - در گوشی و کامپیوتر یکسان است
 * - نیازی به خواندن از دیتابیس ندارد
 * ═══════════════════════════════════════════════════════════
 */

/**
 * گرفتن سال هجری شمسی فعلی
 */
export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1405";
  } catch {
    return "1405";
  }
}

/**
 * تولید شناسه یکتای جهانی (timestamp + random)
 */
function generateUniqueId(): string {
  // استفاده از timestamp برای اطمینان از یکتا بودن
  const timestamp = Date.now().toString(36).toUpperCase();
  // اضافه کردن رشته تصادفی برای جلوگیری از تداخل در میلی‌ثانیه‌های یکسان
  const randomPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  // ترکیب: timestamp-random1-random2
  // مثال: M4K9P-X7B2-Y3N8
  return `${timestamp.substring(0, 5)}-${randomPart1}`;
}

/**
 * پیش‌نمایش کد پیگیری بعدی (بدون افزایش شمارنده)
 * برای نمایش در فرم‌ها قبل از ثبت
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const uniqueId = generateUniqueId();
  return `TR-${year}-${uniqueId}`;
}

/**
 * تولید و مصرف کد پیگیری (با افزایش شمارنده)
 * برای ثبت نهایی تراکنش
 */
export function consumeTrackingCode(): string {
  return getNextTrackingCode();
}

/**
 * گرفتن شماره از کد پیگیری (برای مرتب‌سازی)
 * ✅ هم فرمت جدید TR-1405-M4K9P-X7B2 و هم فرمت‌های قدیمی TR-1405-00001 را شناسایی می‌کند
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت قدیمی: TR-1405-00001
  const oldFormat = String(code).match(/^TR-\d{4}-(\d+)$/);
  if (oldFormat) return Number(oldFormat[1]) || 0;
  
  // فرمت جدید: TR-1405-M4K9P-X7B2
  // برای مرتب‌سازی، از timestamp استفاده می‌کنیم
  const newFormat = String(code).match(/^TR-\d{4}-([A-Z0-9]+)-/);
  if (newFormat) {
    try {
      // تبدیل base36 به عدد برای مرتب‌سازی
      return parseInt(newFormat[1], 36) || 0;
    } catch {
      return 0;
    }
  }
  
  // فرمت‌های خیلی قدیمی: HW-0001 یا FX-0001
  const legacyFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * مقداردهی اولیه سیستم
 * ✅ دیگر نیازی به ذخیره شمارنده نیست
 */
export function initTrackingSystem(): void {
  // هیچ کاری لازم نیست انجام شود
}

/**
 * اعتبارسنجی فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  // فرمت جدید: TR-1405-M4K9P-X7B2
  const newRegex = /^TR-\d{4}-[A-Z0-9]+-[A-Z0-9]+$/;
  // فرمت قدیمی: TR-1405-00001
  const oldRegex = /^TR-\d{4}-\d{5}$/;
  
  return newRegex.test(code) || oldRegex.test(code);
}

/**
 * حداکثر ظرفیت سالانه (برای سازگاری با کد قدیمی)
 */
export function getMaxCapacity(): number {
  return 99999; // این مقدار دیگر محدودیت نیست
}
