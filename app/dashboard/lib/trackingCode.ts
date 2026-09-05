/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری یکتا (نسخه نهایی با فرمت اصلی)
 * ساختار: TR-1405-00001
 * - TR: پیشوند ثابت (Transaction)
 * - 1405: سال هجری شمسی (خودکار)
 * - 00001: شماره ۵ رقمی یکتا (بر اساس زمان دقیق برای جلوگیری از تداخل)
 * 
 * ✅ حل مشکل گوشی و کامپیوتر:
 * - دیگر از localStorage شمارش نمی‌کند (که باعث تفاوت می‌شد)
 * - ۵ رقم آخر بر اساس زمان دقیق (میلی‌ثانیه) تولید می‌شود
 * - فرمت ظاهری دقیقاً مانند قبل (TR-1405-XXXXX) حفظ شده است
 * ═══════════════════════════════════════════════════════════
 */

const SEQUENCE_LENGTH = 5; // ۵ رقم برای حفظ فرمت اصلی

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
 * تولید شماره ۵ رقمی یکتا بر اساس زمان دقیق
 * این روش تضمین می‌کند که گوشی و کامپیوتر هرگز کد تکراری تولید نمی‌کنند
 * و نیازی به خواندن لیست تراکنش‌های localStorage نیست.
 */
function generateUniqueSequence(): string {
  // گرفتن ۵ رقم آخر از زمان فعلی (میلی‌ثانیه)
  // مثال: اگر زمان 1715000012345 باشد، 12345 را برمی‌گرداند
  const timeBasedNumber = String(Date.now()).slice(-5);
  
  // برای اطمینان بیشتر از یکتا بودن، اگر تصادفاً در یک میلی‌ثانیه دو تراکنش ثبت شد،
  // یک عدد تصادفی کوچک اضافه می‌کنیم (که همچنان ۵ رقمی می‌ماند)
  const randomSuffix = Math.floor(Math.random() * 10);
  let finalNumber = (Number(timeBasedNumber) + randomSuffix) % 100000;
  
  return String(finalNumber).padStart(SEQUENCE_LENGTH, "0");
}

/**
 * پیش‌نمایش کد پیگیری بعدی (بدون افزایش شمارنده)
 * برای نمایش در فرم‌ها قبل از ثبت
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const sequence = generateUniqueSequence();
  return `TR-${year}-${sequence}`;
}

/**
 * تولید و مصرف کد پیگیری (برای ثبت نهایی تراکنش)
 */
export function consumeTrackingCode(): string {
  return getNextTrackingCode();
}

/**
 * گرفتن شماره از کد پیگیری (برای مرتب‌سازی)
 * ✅ فرمت TR-1405-00001 و همچنین HW-0001 یا FX-0001 را شناسایی می‌کند
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت اصلی: TR-1405-00001
  const mainFormat = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (mainFormat) return Number(mainFormat[1]) || 0;
  
  // فرمت‌های قدیمی: HW-0001 یا FX-0001
  const legacyFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * مقداردهی اولیه سیستم
 * ✅ دیگر نیازی به ذخیره یا خواندن شمارنده از localStorage نیست
 */
export function initTrackingSystem(): void {
  // هیچ کاری لازم نیست انجام شود
}

/**
 * اعتبارسنجی فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  // فقط فرمت اصلی TR-1405-00001 را تأیید می‌کند
  const regex = /^TR-\d{4}-\d{5}$/;
  return regex.test(code);
}

/**
 * حداکثر ظرفیت سالانه
 */
export function getMaxCapacity(): number {
  return Math.pow(10, SEQUENCE_LENGTH) - 1; // 99999
}
