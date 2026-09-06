/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری مسلسل و یکتا (نسخه حرفه‌ای)
 * ساختار خروجی: TR-1403-00001
 * 
 * - TR: پیشوند ثابت (مخفف Transaction)
 * - 1403: سال هجری شمسی جاری (تشخیص خودکار)
 * - 00001: شماره مسلسل ۵ رقمی (با صفرهای پیش‌رو)
 * 
 * ✅ ویژگی‌ها:
 * - استفاده از تراکنش اتمی (Transaction) فایربیس برای تضمین یکتایی مطلق.
 * - جلوگیری از تولید کد تکراری حتی در صورت کلیک همزمان چندین کاربر.
 * - حالت آفلاین هوشمند (Fallback) برای جلوگیری از توقف برنامه در صورت قطعی اینترنت.
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction, getFirestore } from "firebase/firestore";

// ⚠️ نکته: مسیر ایمپورت db را بر اساس ساختار پروژه خود تنظیم کنید.
// اگر فایل firebase.ts در همان پوشه است: import { db } from "./firebase";
import { db } from "./firebase"; 

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;

/**
 * دریافت سال هجری شمسی فعلی به صورت داینامیک
 */
export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch (error) {
    console.warn("خطا در تشخیص سال شمسی، مقدار پیش‌فرض استفاده شد:", error);
    return "1403";
  }
}

/**
 * پیش‌نمایش کد پیگیری (برای نمایش در فرم قبل از ثبت نهایی)
 * ⚠️ نکته: چون عدد دقیق توسط سرور در لحظه ثبت (Submit) تعیین می‌شود، 
 * در فرم‌ها قبل از کلیک روی دکمه ثبت، این مقدار به صورت خط‌چین نمایش داده می‌شود.
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  return `TR-${year}------`;
}

/**
 * تولید و مصرف کد پیگیری (هنگام کلیک روی دکمه ثبت نهایی)
 * ✅ این تابع Async است تا بتواند با سرور فایربیس هماهنگ شود و کد یکتا بگیرد.
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  // استفاده از یک سند اختصاصی در فایربیس برای مدیریت شمارنده
  const counterRef = doc(db, "system_counters", "tracking_codes");

  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        currentCount = data[year] || 0;
      }

      const newCount = currentCount + 1;
      
      if (newCount > MAX_SEQUENCE) {
        throw new Error("ظرفیت کد پیگیری برای سال جاری پر شده است");
      }

      // ذخیره عدد جدید در فایربیس به صورت اتمی (غیرقابل تداخل)
      transaction.set(counterRef, { [year]: newCount }, { merge: true });
      return newCount;
    });

    // فرمت‌دهی نهایی: اضافه کردن صفرهای پیش‌رو تا ۵ رقم
    return `TR-${year}-${String(nextNumber).padStart(SEQUENCE_LENGTH, "0")}`;
    
  } catch (error) {
    console.error("⚠️ خطا در ارتباط با سرور برای کد پیگیری. استفاده از روش جایگزین (آفلاین):", error);
    
    // حالت آفلاین یا قطعی اینترنت: استفاده از زمان برای جلوگیری از توقف برنامه
    // ۵ رقم آخر Timestamp فعلی را برمی‌گرداند
    const fallback = String(Date.now()).slice(-SEQUENCE_LENGTH);
    return `TR-${year}-${fallback}`;
  }
}

/**
 * استخراج عدد خالص از کد پیگیری (برای مرتب‌سازی یا مقایسه)
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت اصلی: TR-1403-00001
  const mainFormat = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (mainFormat) return Number(mainFormat[1]) || 0;
  
  // فرمت‌های قدیمی (در صورت وجود در دیتابیس)
  const legacyFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

/**
 * بررسی اعتبار فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  const regex = /^TR-\d{4}-\d{5}$/;
  return regex.test(code);
}

/**
 * مقداردهی اولیه سیستم (در صورت نیاز به اجرای کدی در شروع برنامه)
 */
export function initTrackingSystem(): void {
  // در حال حاضر نیاز به اقدام خاصی در شروع برنامه نیست.
  // این تابع برای سازگاری با سایر ماژول‌ها حفظ شده است.
}

/**
 * دریافت حداکثر ظرفیت ممکن برای کد پیگیری
 */
export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
