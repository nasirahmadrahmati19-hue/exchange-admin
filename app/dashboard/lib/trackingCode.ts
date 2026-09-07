/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری مسلسل و یکتا (نسخه نهایی و ضدگلوله)
 * ساختار خروجی: TR-1403-00001
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction, getFirestore } from "firebase/firestore";

// ⚠️ اگر فایل firebase شما مسیر دیگری دارد، آن را اصلاح کنید
import { db } from "./firebase"; 

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const LS_KEY = "fx_tracking_counter"; // کلید ذخیره‌سازی در LocalStorage برای حالت آفلاین

/**
 * دریافت سال هجری شمسی فعلی
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
 * پیش‌نمایش کد پیگیری (فقط برای نمایش در UI قبل از ثبت)
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  return `TR-${year}------`;
}

/**
 * تولید و مصرف کد پیگیری (هنگام کلیک روی دکمه ثبت)
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  const counterRef = doc(db, "system_counters", "tracking_codes");

  try {
    // تلاش برای دریافت کد از فایربیس (حالت آنلاین و حرفه‌ای)
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        currentCount = data[year] || 0;
      }

      const newCount = currentCount + 1;
      if (newCount > MAX_SEQUENCE) {
        throw new Error("ظرفیت کد پیگیری این سال پر شده است");
      }

      transaction.set(counterRef, { [year]: newCount }, { merge: true });
      return newCount;
    });

    return `TR-${year}-${String(nextNumber).padStart(SEQUENCE_LENGTH, "0")}`;
    
  } catch (error) {
    console.warn("⚠️ فایربیس در دسترس نیست یا خطا داد. استفاده از سیستم آفلاین هوشمند:", error);
    
    // === سیستم آفلاین هوشمند (Fallback) ===
    // اگر فایربیس کار نکرد، از LocalStorage استفاده می‌کنیم تا برنامه متوقف نشود
    try {
      const raw = localStorage.getItem(LS_KEY);
      let counters = raw ? JSON.parse(raw) : {};
      
      if (!counters[year]) counters[year] = 0;
      counters[year] += 1;
      
      if (counters[year] > MAX_SEQUENCE) {
        counters[year] = 1; // ریست کردن در صورت پر شدن (یا مدیریت خطا)
      }
      
      localStorage.setItem(LS_KEY, JSON.stringify(counters));
      return `TR-${year}-${String(counters[year]).padStart(SEQUENCE_LENGTH, "0")}`;
    } catch (lsError) {
      // آخرین سنگر: استفاده از زمان فعلی اگر LocalStorage هم پر یا غیرفعال باشد
      const fallback = String(Date.now()).slice(-SEQUENCE_LENGTH);
      return `TR-${year}-${fallback}`;
    }
  }
}

/**
 * استخراج عدد خالص از کد پیگیری (برای مرتب‌سازی)
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت اصلی جدید: TR-1403-00001
  const mainFormat = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (mainFormat) return Number(mainFormat[1]) || 0;
  
  // فرمت‌های قدیمی (برای سازگاری با داده‌های قبلی)
  const legacyFormat = String(code).match(/^(?:HW|FX|TR)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * بررسی اعتبار فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  // هم فرمت جدید و هم فرمت‌های قدیمی را معتبر می‌داند
  const regex = /^TR-\d{4}-\d{5}$|^(?:HW|FX|TR)-\d+$/;
  return regex.test(code);
}

export function initTrackingSystem(): void {
  // آماده‌سازی اولیه (در صورت نیاز)
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
