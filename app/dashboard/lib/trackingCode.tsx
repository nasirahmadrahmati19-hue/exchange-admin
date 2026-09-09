/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی و ۱۰۰٪ ضد تداخل)
 * ✅ تضمین عدم تکرار بین تمامی دستگاه‌ها (موبایل، تبلت و کامپیوتر)
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_LAST_CODE = "fx_last_tracking_code";

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch {
    return "1403";
  }
}

/**
 * مصرف و تولید یک کد پیگیری یکتا (به صورت آنلاین و مستقیم از سرور)
 * این تابع تضمین می‌کند که موبایل و کامپیوتر هرگز کد تکرار دریافت نکنند.
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);

  try {
    // استفاده از Transaction فایربیس برای جلوگیری از تداخل هم‌زمان (Concurrency Control)
    const trackingCode = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const currentData = counterDoc.exists() ? counterDoc.data() : {};
      
      // دریافت آخرین عدد ثبت‌شده برای سال جاری (پیش‌فرض 0)
      const currentCount = currentData[year] || 0;

      if (currentCount >= MAX_SEQUENCE) {
        throw new Error("ظرفیت کدهای پیگیری برای این سال به اتمام رسیده است!");
      }

      const nextCount = currentCount + 1;

      // ذخیره عدد جدید در فایربیس
      transaction.set(
        counterRef, 
        { ...currentData, [year]: nextCount }, 
        { merge: true }
      );

      const formattedSeq = String(nextCount).padStart(SEQUENCE_LENGTH, "0");
      return `TR-${year}-${formattedSeq}`;
    });

    // ذخیره آخرین کد موفق در لوکال‌استوری برای نمایش در پیش‌نمایش
    try {
      localStorage.setItem(LS_LAST_CODE, trackingCode);
    } catch {}

    console.log(`✅ کد پیگیری یکتا صادر شد: ${trackingCode}`);
    return trackingCode;

  } catch (error) {
    console.error("❌ خطا در تولید کد پیگیری یکتا:", error);
    throw new Error("خطا در ارتباط با سرور برای تولید کد پیگیری. لطفاً اینترنت خود را بررسی کنید.");
  }
}

/**
 * پیش‌نمایش کد پیگیری بعدی (جهت نمایش در فرم‌ها قبل از ثبت نهایی)
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  try {
    const lastCode = localStorage.getItem(LS_LAST_CODE);
    if (lastCode && lastCode.startsWith(`TR-${year}-`)) {
      const match = lastCode.match(/(\d+)$/);
      if (match) {
        const nextNum = Number(match[1]) + 1;
        return `TR-${year}-${String(nextNum).padStart(SEQUENCE_LENGTH, "0")}`;
      }
    }
  } catch {}
  
  return `TR-${year}-00001`;
}

/**
 * استخراج عدد از کد پیگیری (جهت مرتب‌سازی در جدول‌ها)
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  const match = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (match) return Number(match[1]) || 0;
  
  const legacyFormat = String(code).match(/^(?:HW|FX|TR)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * اعتبارسنجی فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  return /^TR-\d{4}-\d{5}$|^(?:HW|FX|TR)-\d+$/.test(code);
}

export function initTrackingSystem(): void {
  // سیستم به صورت خودکار و سرور-بیس کار می‌کند
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
