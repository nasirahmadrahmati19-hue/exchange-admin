/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری یکتا
 * ساختار: TR-1405-00001
 * - TR: پیشوند ثابت (Transaction)
 * - 1405: سال هجری شمسی (خودکار)
 * - 00001: شماره مسلسل ۵ رقمی (ریست در سال جدید)
 * ظرفیت: 99,999 تراکنش در سال
 * 
 * ✅ نسخه اصلاح‌شده:
 * - کد پیگیری بر اساس تعداد معاملات موجود محاسبه می‌شود
 * - وقتی معامله حذف می‌شود، جای خالی پر می‌شود
 * - وقتی همه معاملات حذف شوند، از ۱ شروع می‌شود
 * ═══════════════════════════════════════════════════════════
 */

const SEQUENCE_LENGTH = 5; // ✅ 5 رقم برای ظرفیت بیشتر

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
 * گرفتن شماره از کد پیگیری (برای مرتب‌سازی)
 * ✅ هم فرمت جدید TR-1405-00001 و هم فرمت‌های قدیمی HW-0001, FX-0001 را شناسایی می‌کند
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت جدید: TR-1405-00001 یا TR-1405-99999
  const newFormat = String(code).match(/^TR-\d{4}-(\d{4,5})$/);
  if (newFormat) return Number(newFormat[1]) || 0;
  
  // فرمت‌های قدیمی: HW-0001 یا FX-0001
  const oldFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (oldFormat) return Number(oldFormat[1]) || 0;
  
  return 0;
}

/**
 * جمع‌آوری تمام کدهای پیگیری استفاده‌شده از همه بخش‌ها
 */
function collectUsedTrackingNumbers(): Set<number> {
  const usedNumbers = new Set<number>();
  
  // بررسی معاملات (transactions)
  try {
    const rawTx = localStorage.getItem("fx-transactions");
    if (rawTx) {
      const txs = JSON.parse(rawTx);
      if (Array.isArray(txs)) {
        for (const tx of txs) {
          const num = getTrackingNumberValue(tx.trackingCode || tx.number || "");
          if (num > 0) usedNumbers.add(num);
        }
      }
    }
  } catch {}
  
  // بررسی حواله‌ها (hawalas)
  try {
    const rawHw = localStorage.getItem("hawalas");
    if (rawHw) {
      const hws = JSON.parse(rawHw);
      if (Array.isArray(hws)) {
        for (const hw of hws) {
          const num = getTrackingNumberValue(hw.number || "");
          if (num > 0) usedNumbers.add(num);
        }
      }
    }
  } catch {}
  
  // بررسی اسناد صندوق (cash entries)
  try {
    const rawCe = localStorage.getItem("cash-entries");
    if (rawCe) {
      const ces = JSON.parse(rawCe);
      if (Array.isArray(ces)) {
        for (const ce of ces) {
          const num = getTrackingNumberValue(ce.trackingCode || "");
          if (num > 0) usedNumbers.add(num);
        }
      }
    }
  } catch {}
  
  return usedNumbers;
}

/**
 * پیش‌نمایش کد پیگیری بعدی (بدون افزایش شمارنده)
 * برای نمایش در فرم‌ها قبل از ثبت
 * 
 * ✅ روش جدید: پیدا کردن اولین جای خالی در شماره‌ها
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const usedNumbers = collectUsedTrackingNumbers();
  
  // پیدا کردن اولین جای خالی
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }
  
  return `TR-${year}-${String(nextNumber).padStart(SEQUENCE_LENGTH, "0")}`;
}

/**
 * تولید و مصرف کد پیگیری (با افزایش شمارنده)
 * برای ثبت نهایی تراکنش
 * 
 * ✅ روش جدید: چون getNextTrackingCode بر اساس معاملات موجود کار می‌کند،
 * consumeTrackingCode فقط همان کد را برمی‌گرداند
 */
export function consumeTrackingCode(): string {
  return getNextTrackingCode();
}

/**
 * مقداردهی اولیه سیستم
 * ✅ دیگر نیازی به ذخیره شمارنده نیست
 */
export function initTrackingSystem(): void {
  // هیچ کاری لازم نیست انجام شود
  // سیستم به صورت خودکار بر اساس معاملات موجود کار می‌کند
}

/**
 * اعتبارسنجی فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  const regex = /^TR-\d{4}-\d{5}$/;
  return regex.test(code);
}

/**
 * حداکثر ظرفیت سالانه
 */
export function getMaxCapacity(): number {
  return Math.pow(10, SEQUENCE_LENGTH) - 1; // 99999
}
