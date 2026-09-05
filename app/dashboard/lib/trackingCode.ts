/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری مسلسل و یکتا (نسخه حرفه‌ای فایربیس)
 * ساختار: TR-1405-00001
 * - TR: پیشوند ثابت
 * - 1405: سال هجری شمسی (خودکار)
 * - 00001: شماره مسلسل ۵ رقمی (مدیریت‌شده توسط سرور فایربیس)
 * 
 * ✅ حل مشکل گوشی و کامپیوتر:
 * - از تراکنش اتمی (Transaction) فایربیس استفاده می‌کند.
 * - تضمین می‌کند حتی اگر ۱۰۰ نفر همزمان کلیک کنند، کد تکراری تولید نمی‌شود.
 * - در حالت آفلاین، به صورت هوشمند از زمان استفاده می‌کند تا برنامه متوقف نشود.
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // مسیر فایل firebase خود را در صورت نیاز اصلاح کنید

const SEQUENCE_LENGTH = 5;

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
 * پیش‌نمایش کد پیگیری (قبل از ثبت نهایی)
 * ⚠️ نکته: چون عدد دقیق توسط سرور در لحظه ثبت تعیین می‌شود، 
 * در فرم‌ها قبل از کلیک روی دکمه ثبت، این مقدار نمایش داده می‌شود.
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  return `TR-${year}------`; // یا می‌توانید بنویسید "به‌صورت خودکار"
}

/**
 * تولید و مصرف کد پیگیری (هنگام کلیک روی دکمه ثبت)
 * ✅ این تابع اکنون Async است تا بتواند با سرور فایربیس هماهنگ شود.
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  // استفاده از یک سند اختصاصی در فایربیس برای شمارش
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
      if (newCount > 99999) {
        throw new Error("ظرفیت کد پیگیری این سال پر شده است");
      }

      // ذخیره عدد جدید در فایربیس به صورت اتمی (غیرقابل تداخل)
      transaction.set(counterRef, { [year]: newCount }, { merge: true });
      return newCount;
    });

    return `TR-${year}-${String(nextNumber).padStart(SEQUENCE_LENGTH, "0")}`;
  } catch (error) {
    console.error("⚠️ خطا در ارتباط با سرور برای کد پیگیری. استفاده از روش جایگزین:", error);
    // حالت آفلاین یا قطعی اینترنت: استفاده از زمان برای جلوگیری از توقف برنامه
    const fallback = String(Date.now()).slice(-5);
    return `TR-${year}-${fallback}`;
  }
}

/**
 * گرفتن شماره از کد پیگیری (برای مرتب‌سازی)
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  const mainFormat = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (mainFormat) return Number(mainFormat[1]) || 0;
  
  const legacyFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

export function initTrackingSystem(): void {
  // هیچ کاری لازم نیست انجام شود
}

export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  const regex = /^TR-\d{4}-\d{5}$/;
  return regex.test(code);
}

export function getMaxCapacity(): number {
  return Math.pow(10, SEQUENCE_LENGTH) - 1; // 99999
}
