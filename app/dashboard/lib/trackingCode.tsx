/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخهٔ نهایی و ضدگلوله)
 * ✅ تضمین یکتایی مطلق بین تمام دستگاه‌ها (موبایل، کامپیوتر، تبلت)
 * ✅ پشتیبانی از حالت آفلاین (تا زمانی که بستهٔ رزرو شده باقی باشد)
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase"; // مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_KEY_BLOCK = "fx_tracking_block_v2"; // نسخه را تغییر دادیم تا با کش‌های قدیمی تداخل نداشته باشد
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
 * دریافت یک بسته جدید از کدهای پیگیری از فایربیس با مکانیزم Transaction
 * این تابع تضمین می‌کند که حتی اگر ۱۰۰۰ دستگاه هم‌زمان درخواست دهند، 
 * هیچ‌کدام بازهٔ عددی تکراری دریافت نمی‌کنند.
 */
async function getNewBlockFromFirebase(year: string): Promise<{ start: number; end: number }> {
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);
  
  // فایربیس به صورت خودکار در صورت تداخل، تراکنش را چند بار تکرار می‌کند تا موفق شود
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const currentData = counterDoc.exists() ? counterDoc.data() : {};
    const currentCount = currentData[year] || 0;
    
    const newEndCount = currentCount + BLOCK_SIZE;
    if (newEndCount > MAX_SEQUENCE) {
      throw new Error("ظرفیت کد پیگیری این سال پر شده است. لطفاً با پشتیبانی تماس بگیرید.");
    }
    
    // ذخیرهٔ بالاترین عدد رزرو شده در فایربیس (منبع واحد حقیقت)
    transaction.set(counterRef, { ...currentData, [year]: newEndCount }, { merge: true });
    
    return {
      start: currentCount + 1,
      end: newEndCount
    };
  });
}

/**
 * مصرف یک کد پیگیری (اصلی‌ترین تابع)
 * ⚠️ هشدار: این تابع حتماً باید با await صدا زده شود.
 */
export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  
  // ۱. بررسی بستهٔ رزرو شدهٔ محلی
  try {
    const blockStr = localStorage.getItem(LS_KEY_BLOCK);
    if (blockStr) {
      const block = JSON.parse(blockStr);
      // اگر سال تغییر کرده باشد یا بسته تمام شده باشد، به مرحلهٔ بعد می‌رود
      if (block.year === year && block.current < block.end) {
        // افزایش شمارنده و ذخیرهٔ فوری (عملیات همگام و سریع)
        block.current += 1;
        localStorage.setItem(LS_KEY_BLOCK, JSON.stringify(block));
        
        // اطلاع‌رسانی به سایر تب‌های همین مرورگر (اختیاری ولی مفید)
        try { window.dispatchEvent(new Event('storage')); } catch {}
        
        const code = `TR-${year}-${String(block.current).padStart(SEQUENCE_LENGTH, "0")}`;
        return code;
      }
    }
  } catch (e) {
    console.warn("خطا در خواندن بستهٔ محلی. درخواست بستهٔ جدید از سرور...", e);
    // در صورت خرابی دادهٔ لوکال، آن را پاک می‌کنیم تا سیستم ریست شود
    localStorage.removeItem(LS_KEY_BLOCK);
  }

  // ۲. اگر بسته نداشتیم یا تمام شده بود، باید حتماً آنلاین باشیم
  if (!isOnline()) {
    throw new Error("بستهٔ کدهای محلی تمام شده است. برای دریافت بستهٔ جدید لطفاً به اینترنت متصل شوید.");
  }

  // ۳. دریافت بستهٔ جدید از فایربیس (اینجا گلوگاه یکتایی است)
  try {
    const newBlock = await getNewBlockFromFirebase(year);
    
    // ذخیرهٔ بستهٔ جدید در حافظهٔ دستگاه
    const blockData = {
      year: year,
      start: newBlock.start,
      end: newBlock.end,
      current: newBlock.start // اولین کد بسته همین الان مصرف می‌شود
    };
    localStorage.setItem(LS_KEY_BLOCK, JSON.stringify(blockData));
    
    const code = `TR-${year}-${String(newBlock.start).padStart(SEQUENCE_LENGTH, "0")}`;
    console.log(`✅ بستهٔ جدید از فایربیس دریافت شد: ${code} (بازهٔ معتبر تا ${newBlock.end})`);
    return code;
    
  } catch (error) {
    console.error("❌ خطا در دریافت بستهٔ کد از فایربیس:", error);
    throw new Error("عدم توانایی در تولید کد پیگیری. لطفاً اتصال اینترنت خود را بررسی کنید.");
  }
}

/**
 * پیش‌نمایش کد پیگیری بعدی (فقط برای نمایش در UI، این کد ثبت نمی‌شود)
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
  return `TR-${year}-----`; 
}

/**
 * استخراج عدد از کد پیگیری (برای مرتب‌سازی یا مقایسه)
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
  // این تابع فعلاً نیازی به اجرا در شروع برنامه ندارد، 
  // زیرا consumeTrackingCode به صورت هوشمند عمل می‌کند.
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
