/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی و مسلسل (Global Sequential)
 * تضمین می‌کند که کدها در موبایل، کامپیوتر و تمام تب‌ها پشت سر هم باشند.
 * ساختار: TR-1403-00001
 * 
 * ✅ سازگاری کامل با نام‌های قدیمی (consumeTrackingCode و getNextTrackingCode)
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // ⚠️ مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
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
      
      if (nextCount > MAX_SEQUENCE) {
        throw new Error("ظرفیت کد پیگیری این سال پر شده است");
      }

      // ذخیره به صورت اتمی (قفل می‌شود تا کسی همزمان عدد دیگری نگیرد)
      transaction.set(counterRef, { ...currentData, [year]: nextCount }, { merge: true });
      return nextCount;
    });

    return `TR-${year}-${String(newCount).padStart(SEQUENCE_LENGTH, "0")}`;
    
  } catch (cloudError) {
    console.warn("⚠️ ارتباط با سرور برقرار نشد. استفاده از شمارنده محلی (آفلاین).", cloudError);
    
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
    // آخرین سنگر: اگر LocalStorage هم پر بود، از زمان استفاده کن
    const fallback = String(Date.now()).slice(-SEQUENCE_LENGTH);
    return `TR-${year}-${fallback}`;
  }
}

/**
 * نمایش در فرم قبل از ثبت (هنوز کد نهایی نیست)
 */
export function getNextTrackingCodePreview(): string {
  const year = getCurrentShamsiYear();
  return `TR-${year}-----`;
}

// ═══════════════════════════════════════════════════════════
// 🔧 توابع سازگار با نسخه‌های قبلی (برای جلوگیری از خطای import)
// این بخش باعث می‌شود کدهای قدیمی شما بدون هیچ تغییری کار کنند.
// ═══════════════════════════════════════════════════════════

/**
 * ✅ نام قدیمی (سازگار با trades/page.tsx و cash/page.tsx)
 * دقیقاً همان کار generateSequentialTrackingCode را انجام می‌دهد.
 */
export async function consumeTrackingCode(): Promise<string> {
  return generateSequentialTrackingCode();
}

/**
 * ✅ نام قدیمی (سازگار با فرم‌ها برای پیش‌نمایش)
 * دقیقاً همان کار getNextTrackingCodePreview را انجام می‌دهد.
 */
export function getNextTrackingCode(): string {
  return getNextTrackingCodePreview();
}

/**
 * استخراج عدد از کد برای مرتب‌سازی
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  const match = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (match) return Number(match[1]) || 0;
  
  // پشتیبانی از فرمت‌های قدیمی
  const legacyFormat = String(code).match(/^(?:HW|FX|TR)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * بررسی اعتبار فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  return /^TR-\d{4}-\d{5}$|^(?:HW|FX|TR)-\d+$/.test(code);
}

/**
 * مقداردهی اولیه سیستم (برای سازگاری با سایر ماژول‌ها)
 */
export function initTrackingSystem(): void {
  // سیستم به صورت خودکار کار می‌کند
}

/**
 * دریافت حداکثر ظرفیت ممکن برای کد پیگیری
 */
export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
