/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (کار در تمام تب‌ها - آنلاین و آفلاین)
 * ✅ در حالت آفلاین: بلافاصله از localStorage استفاده می‌کند
 * ✅ در حالت آنلاین: از فایربیس استفاده می‌کند (هماهنگ بین موبایل و کامپیوتر)
 * ✅ در تمام تب‌ها به صورت خودکار کار می‌کند
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_KEY_PREFIX = "fx_local_counter_";

/**
 * دریافت سال شمسی جاری
 */
export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1405";
  } catch {
    return "1405";
  }
}

/**
 * بررسی وضعیت اینترنت
 */
function isOnline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine !== false;
}

/**
 * 🔥 تولید کد از localStorage (سریع و بدون انتظار - برای حالت آفلاین)
 */
function generateFromLocalStorage(year: string): string {
  const LS_KEY = `${LS_KEY_PREFIX}${year}`;
  try {
    const stored = localStorage.getItem(LS_KEY);
    let count = stored ? parseInt(stored, 10) : 0;
    
    if (!Number.isFinite(count) || count < 0) count = 0;
    count++;
    
    if (count > MAX_SEQUENCE) {
      console.warn(`⚠️ ظرفیت کد پیگیری سال ${year} پر شد. ریست به 1`);
      count = 1;
    }
    
    localStorage.setItem(LS_KEY, count.toString());
    
    // اطلاع به سایر تب‌های مرورگر
    try { window.dispatchEvent(new Event('storage')); } catch {}
    
    const code = `TR-${year}-${String(count).padStart(SEQUENCE_LENGTH, "0")}`;
    console.log(`✅ کد پیگیری آفلاین تولید شد: ${code}`);
    return code;
  } catch (err) {
    console.error("❌ خطا در localStorage:", err);
    // آخرین سنگر: استفاده از زمان
    const fallback = String(Date.now()).slice(-SEQUENCE_LENGTH);
    return `TR-${year}-${fallback}`;
  }
}

/**
 * 🌟 تابع اصلی: دریافت کد پیگیری (در تمام تب‌ها کار می‌کند)
 * ✅ اول اینترنت را چک می‌کند
 * ✅ اگر آفلاین باشد، بلافاصله از localStorage استفاده می‌کند
 * ✅ اگر آنلاین باشد، از فایربیس استفاده می‌کند (با timeout)
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  
  // ✅ اگر آفلاین هستیم، مستقیم از localStorage استفاده کن (بدون انتظار)
  if (!isOnline()) {
    console.log("📡 حالت آفلاین - استفاده از شمارنده محلی");
    return generateFromLocalStorage(year);
  }
  
  // ✅ اگر آنلاین هستیم، از فایربیس استفاده کن (با timeout 5 ثانیه)
  try {
    const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);
    
    // timeout برای جلوگیری از هنگ کردن
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: فایربیس پاسخ نداد")), 5000);
    });
    
    const transactionPromise = runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentData = counterDoc.exists() ? counterDoc.data() : {};
      let currentCount = currentData[year] || 0;
      
      const nextCount = currentCount + 1;
      if (nextCount > MAX_SEQUENCE) {
        throw new Error("ظرفیت کد پیگیری این سال پر شده است");
      }
      
      transaction.set(counterRef, { ...currentData, [year]: nextCount }, { merge: true });
      return nextCount;
    });
    
    const newCount = await Promise.race([transactionPromise, timeoutPromise]);
    const code = `TR-${year}-${String(newCount).padStart(SEQUENCE_LENGTH, "0")}`;
    console.log(`✅ کد پیگیری آنلاین تولید شد: ${code}`);
    return code;
    
  } catch (cloudError) {
    console.warn("⚠️ فایربیس در دسترس نیست. استفاده از حالت آفلاین:", (cloudError as Error).message);
    // ✅ اگر فایربیس کار نکرد، به localStorage برو
    return generateFromLocalStorage(year);
  }
}

/**
 * پیش‌نمایش کد (برای نمایش در فرم قبل از ثبت)
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  
  // سعی کن آخرین عدد را از localStorage بخوانی برای پیش‌نمایش دقیق‌تر
  try {
    const LS_KEY = `${LS_KEY_PREFIX}${year}`;
    const stored = localStorage.getItem(LS_KEY);
    const count = stored ? parseInt(stored, 10) + 1 : 1;
    if (Number.isFinite(count) && count > 0) {
      return `TR-${year}-${String(count).padStart(SEQUENCE_LENGTH, "0")}`;
    }
  } catch {}
  
  return `TR-${year}------`;
}

/**
 * نام‌های سازگار با نسخه‌های قبلی
 */
export async function generateSequentialTrackingCode(): Promise<string> {
  return consumeTrackingCode();
}

export function getNextTrackingCodePreview(): string {
  return getNextTrackingCode();
}

/**
 * استخراج عدد از کد برای مرتب‌سازی
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  const match = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (match) return Number(match[1]) || 0;
  
  const legacyFormat = String(code).match(/^(?:HW|FX|TR)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  return /^TR-\d{4}-\d{5}$|^(?:HW|FX|TR)-\d+$/.test(code);
}

export function initTrackingSystem(): void {
  // سیستم به صورت خودکار کار می‌کند
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
