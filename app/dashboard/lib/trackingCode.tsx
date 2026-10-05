/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی با پشتیبانی آفلاین)
 * ✅ آنلاین: TR-1405-00001
 * ✅ آفلاین: OF-1405-00001
 * ✅ ریست خودکار شمارنده با تغییر سال شمسی
 * ✅ بدون نیاز به تغییر در هیچ بخش دیگری از برنامه
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const ONLINE_PREFIX = "TR";
const OFFLINE_PREFIX = "OF";
const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_LAST_CODE = "fx_last_tracking_code";
const LS_OFFLINE_COUNTER_PREFIX = "fx_offline_counter_";

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1405";
  } catch {
    return "1405";
  }
}

function isOnline(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

// ✅ تولید کد با پیشوند OF برای حالت آفلاین
function generateOfflineTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const storageKey = `${LS_OFFLINE_COUNTER_PREFIX}${year}`;
  
  let localCounter = 1;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      localCounter = parseInt(stored, 10) + 1;
    }
    // ذخیره شمارنده مخصوص همین سال (با تغییر سال، کلید تغییر کرده و از ۱ شروع می‌شود)
    localStorage.setItem(storageKey, localCounter.toString());
  } catch (e) {
    console.warn("⚠️ خطا در ذخیره شمارنده آفلاین:", e);
  }

  const finalCode = `${OFFLINE_PREFIX}-${year}-${String(localCounter).padStart(SEQUENCE_LENGTH, "0")}`;

  try {
    localStorage.setItem(LS_LAST_CODE, finalCode);
  } catch {}

  console.log(`📡 کد پیگیری آفلاین تولید شد: ${finalCode}`);
  return finalCode;
}

export async function consumeTrackingCode(): Promise<string> {
  // ✅ خط دفاعی اول: اگر اینترنت قطع است، فوراً کد با پیشوند OF تولید کن
  if (!isOnline()) {
    console.warn("⚠️ اینترنت قطع است. تولید کد آفلاین (OF)...");
    return generateOfflineTrackingCode();
  }

  const year = getCurrentShamsiYear();
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);

  try {
    // ✅ خط دفاعی دوم: تلاش با Timeout کوتاه (۳ ثانیه)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT_AFTER_3_SECONDS")), 3000)
    );

    const transactionPromise = runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const currentData = counterDoc.exists() ? counterDoc.data() : {};
      const currentCount = currentData[year] || 0;

      if (currentCount >= MAX_SEQUENCE) {
        throw new Error("ظرفیت کدهای پیگیری برای این سال به اتمام رسیده است!");
      }

      const nextCount = currentCount + 1;
      transaction.set(counterRef, { ...currentData, [year]: nextCount }, { merge: true });

      return `${ONLINE_PREFIX}-${year}-${String(nextCount).padStart(SEQUENCE_LENGTH, "0")}`;
    });

    const trackingCode = await Promise.race([transactionPromise, timeoutPromise]);
    
    try {
      localStorage.setItem(LS_LAST_CODE, trackingCode);
    } catch {}
    
    console.log(`✅ کد پیگیری آنلاین صادر شد: ${trackingCode}`);
    return trackingCode;

  } catch (error: any) {
    const errorMessage = error?.message || "";
    const errorCode = error?.code || "";
    
    console.warn(`⚠️ خطا در دریافت کد از سرور (${errorCode || errorMessage}). سوئیچ به حالت آفلاین (OF)...`);
    
    // ✅ خط دفاعی سوم: در صورت هرگونه خطای سرور، کد آفلاین با پیشوند OF برگردان
    return generateOfflineTrackingCode();
  }
}

export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const prefix = isOnline() ? ONLINE_PREFIX : OFFLINE_PREFIX;
  
  try {
    const lastCode = localStorage.getItem(LS_LAST_CODE);
    if (lastCode && lastCode.startsWith(`${prefix}-${year}-`)) {
      const match = lastCode.match(/-(\d+)$/);
      if (match) {
        const nextNum = Number(match[1]) + 1;
        return `${prefix}-${year}-${String(nextNum).padStart(SEQUENCE_LENGTH, "0")}`;
      }
    }
  } catch {}
  
  // اگر کد قبلی وجود نداشت یا مربوط به سال دیگری بود، از ۱ شروع کن
  return `${prefix}-${year}-00001`;
}

// ✅ به‌روزرسانی شده برای شناسایی صحیح هم TR و هم OF جهت مرتب‌سازی در جداول
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // استخراج عدد از فرمت‌های استاندارد (هم TR و هم OF)
  const match = String(code).match(/^(?:TR|OF)-\d{4}-(\d+)$/);
  if (match) return Number(match[1]) || 0;
  
  // پشتیبانی از فرمت‌های قدیمی در صورت وجود در دیتابیس
  const legacyFormat = String(code).match(/^(?:HW|FX|TR|OF)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

// ✅ به‌روزرسانی شده برای قبول کردن هر دو پیشوند TR و OF
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  return /^(?:TR|OF)-\d{4}-\d{5}$|^(?:HW|FX|TR|OF)-\d+$/.test(code);
}

export function initTrackingSystem(): void {
  // مقداردهی اولیه شمارنده محلی برای سال جاری در صورت عدم وجود
  if (typeof window !== "undefined") {
    const year = getCurrentShamsiYear();
    const storageKey = `${LS_OFFLINE_COUNTER_PREFIX}${year}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, "0");
    }
  }
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
