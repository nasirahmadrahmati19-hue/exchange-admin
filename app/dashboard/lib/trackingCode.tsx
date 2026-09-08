/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی با رزرو دسته‌ای)
 * ✅ حل مشکل تداخل کد بین موبایل و کامپیوتر
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_KEY_BLOCK = "fx_tracking_block";
const BLOCK_SIZE = 50; // تعداد کدهای رزرو شده برای هر دستگاه در هر بار اتصال

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch {
    return "1403";
  }
}

function isOnline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine !== false;
}

/**
 * دریافت یک بسته جدید از کدهای پیگیری از فایربیس
 */
async function getNewBlockFromFirebase(year: string): Promise<{ start: number; end: number }> {
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);
  
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const currentData = counterDoc.exists() ? counterDoc.data() : {};
    const currentCount = currentData[year] || 0;
    
    const newEndCount = currentCount + BLOCK_SIZE;
    if (newEndCount > MAX_SEQUENCE) {
      throw new Error("ظرفیت کد پیگیری این سال پر شده است");
    }
    
    // ذخیره بالاترین عدد رزرو شده در فایربیس
    transaction.set(counterRef, { ...currentData, [year]: newEndCount }, { merge: true });
    
    return {
      start: currentCount + 1,
      end: newEndCount
    };
  });
}

/**
 * مصرف یک کد پیگیری (اصلی‌ترین تابع)
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  
  // ۱. بررسی اینکه آیا بسته رزرو شده محلی داریم و هنوز کد در آن باقی مانده است؟
  try {
    const blockStr = localStorage.getItem(LS_KEY_BLOCK);
    if (blockStr) {
      const block = JSON.parse(blockStr);
      if (block.year === year && block.current < block.end) {
        // استفاده از کد رزرو شده (سریع و بدون نیاز به اینترنت)
        block.current += 1;
        localStorage.setItem(LS_KEY_BLOCK, JSON.stringify(block));
        try { window.dispatchEvent(new Event('storage')); } catch {}
        
        const code = `TR-${year}-${String(block.current).padStart(SEQUENCE_LENGTH, "0")}`;
        console.log(`✅ کد پیگیری از بسته محلی: ${code}`);
        return code;
      }
    }
  } catch (e) {
    console.warn("خطا در خواندن بسته محلی، درخواست از سرور...", e);
  }

  // ۲. اگر بسته نداشتیم یا تمام شده بود، باید حتماً آنلاین باشیم
  if (!isOnline()) {
    throw new Error("بسته کدهای محلی تمام شده است. برای دریافت بسته جدید لطفاً به اینترنت متصل شوید.");
  }

  // ۳. دریافت بسته جدید از فایربیس
  try {
    const newBlock = await getNewBlockFromFirebase(year);
    
    // ذخیره بسته جدید در حافظه دستگاه
    const blockData = {
      year: year,
      start: newBlock.start,
      end: newBlock.end,
      current: newBlock.start // اولین کد بسته همین الان مصرف می‌شود
    };
    localStorage.setItem(LS_KEY_BLOCK, JSON.stringify(blockData));
    
    const code = `TR-${year}-${String(newBlock.start).padStart(SEQUENCE_LENGTH, "0")}`;
    console.log(`✅ بسته جدید از فایربیس دریافت شد: ${code} (تا ${newBlock.end})`);
    return code;
    
  } catch (error) {
    console.error("❌ خطا در دریافت بسته کد از فایربیس:", error);
    throw new Error("عدم توانایی در تولید کد پیگیری. لطفاً اتصال اینترنت خود را بررسی کنید.");
  }
}

/**
 * پیش‌نمایش کد پیگیری بعدی (برای نمایش در UI قبل از ثبت)
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  try {
    const blockStr = localStorage.getItem(LS_KEY_BLOCK);
    if (blockStr) {
      const block = JSON.parse(blockStr);
      if (block.year === year && block.current < block.end) {
        const nextNum = block.current + 1;
        return `TR-${year}-${String(nextNum).padStart(SEQUENCE_LENGTH, "0")}`;
      }
    }
  } catch {}
  // اگر بسته‌ای وجود نداشت، یک قالب خالی نشان می‌دهد تا کاربر بداند باید آنلاین شود
  return `TR-${year}-----`; 
}

/**
 * استخراج عدد از کد پیگیری (برای مرتب‌سازی)
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
  // سیستم به صورت خودکار و هوشمند کار می‌کند
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
