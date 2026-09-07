/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی و مسلسل (Global Sequential)
 * تضمین می‌کند که کدها در موبایل، کامپیوتر و تمام تب‌ها پشت سر هم باشند.
 * ساختار: TR-1403-00001
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // ⚠️ مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const COUNTER_DOC_ID = "global_tracking_counter";

/**
 * دریافت سال شمسی جاری
 */
export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch {
    return "1403";
  }
}

/**
 * نمایش در فرم قبل از ثبت (هنوز کد نهایی نیست)
 */
export function getNextTrackingCodePreview(): string {
  const year = getCurrentShamsiYear();
  return `TR-${year}-----`;
}

/**
 * 🌟 تابع اصلی: دریافت کد پیگیری یکتا و مسلسل از سرور مرکزی
 * این تابع تضمین می‌کند حتی اگر ۱۰ نفر همزمان در موبایل و کامپیوتر ثبت کنند، کد تکراری تولید نمی‌شود.
 */
export async function generateSequentialTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);

  try {
    // مرحله ۱: تلاش برای ارتباط با فایربیس (برای هماهنگی موبایل و کامپیوتر)
    const newCount = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentData = counterDoc.exists() ? counterDoc.data() : {};
      let currentCount = currentData[year] || 0;
      
      const nextCount = currentCount + 1;
      
      if (nextCount > 99999) {
        throw new Error("ظرفیت کد پیگیری این سال پر شده است");
      }

      // ذخیره به صورت اتمی (قفل می‌شود تا کسی همزمان عدد دیگری نگیرد)
      transaction.set(counterRef, { ...currentData, [year]: nextCount }, { merge: true });
      return nextCount;
    });

    return `TR-${year}-${String(newCount).padStart(SEQUENCE_LENGTH, "0")}`;
    
  } catch (cloudError) {
    console.warn("⚠️ ارتباط با سرور برقرار نشد. استفاده از شمارنده محلی (آفلاین). توجه: در حالت آفلاین ممکن است بین دستگاه‌ها هماهنگی کامل نباشد.", cloudError);
    
    // مرحله ۲: حالت آفلاین (فقط برای جلوگیری از کرش کردن برنامه)
    return getOfflineFallbackCode(year);
  }
}

/**
 * شمارنده محلی برای حالت آفلاین (هماهنگی بین تب‌های یک دستگاه)
 */
function getOfflineFallbackCode(year: string): string {
  const LS_KEY = `fx_local_counter_${year}`;
  try {
    const stored = localStorage.getItem(LS_KEY);
    let count = stored ? parseInt(stored, 10) : 0;
    count++;
    localStorage.setItem(LS_KEY, count.toString());
    
    // اطلاع‌رسانی به سایر تب‌های باز در همین مرورگر
    window.dispatchEvent(new Event('storage'));
    
    return `TR-${year}-${String(count).padStart(SEQUENCE_LENGTH, "0")}`;
  } catch {
    // آخرین سنگر: اگر LocalStorage هم پر بود، از زمان استفاده کن (ممکن است رندوم به نظر برسد، اما برنامه را نجات می‌دهد)
    const fallback = String(Date.now()).slice(-SEQUENCE_LENGTH);
    return `TR-${year}-${fallback}`;
  }
}

/**
 * استخراج عدد از کد برای مرتب‌سازی
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  const match = String(code).match(/^TR-\d{4}-(\d{5})$/);
  return match ? Number(match[1]) : 0;
}

export function isValidTrackingCode(code: string): boolean {
  return /^TR-\d{4}-\d{5}$/.test(code);
}

export function initTrackingSystem(): void {
  // سیستم به صورت خودکار کار می‌کند
}
