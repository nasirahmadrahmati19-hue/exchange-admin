/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی - ضدگلوله آفلاین)
 * ✅ هرگز خطا به UI پرتاب نمی‌کند
 * ✅ در حالت آفلاین فوراً کد محلی تولید می‌کند
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_LAST_CODE = "fx_last_tracking_code";
const LS_OFFLINE_COUNTER = "fx_offline_tracking_counter";

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch {
    return "1403";
  }
}

function isOnline(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function generateOfflineTrackingCode(): string {
  const year = getCurrentShamsiYear();
  
  let offlineCounter = 1;
  try {
    const stored = localStorage.getItem(LS_OFFLINE_COUNTER);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.year === year) {
        offlineCounter = (parsed.count || 0) + 1;
      }
    }
    localStorage.setItem(LS_OFFLINE_COUNTER, JSON.stringify({ year, count: offlineCounter }));
  } catch (e) {
    console.warn("⚠️ خطا در ذخیره شمارنده آفلاین:", e);
  }

  const timePart = Date.now().toString().slice(-6);
  const counterPart = String(offlineCounter).padStart(3, "0");
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  
  const offlineCode = `TR-${year}-OFF${timePart}${counterPart}${randomPart}`;

  try {
    localStorage.setItem(LS_LAST_CODE, offlineCode);
  } catch {}

  console.log(`📡 کد پیگیری آفلاین تولید شد: ${offlineCode}`);
  return offlineCode;
}

export async function consumeTrackingCode(): Promise<string> {
  // ✅ خط دفاعی اول: اگر اینترنت قطع است، فوراً کد محلی برگردان
  if (!isOnline()) {
    console.warn("⚠️ اینترنت قطع است. تولید کد محلی...");
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

      return `TR-${year}-${String(nextCount).padStart(SEQUENCE_LENGTH, "0")}`;
    });

    const trackingCode = await Promise.race([transactionPromise, timeoutPromise]);
    
    try {
      localStorage.setItem(LS_LAST_CODE, trackingCode);
    } catch {}
    
    console.log(`✅ کد پیگیری آنلاین صادر شد: ${trackingCode}`);
    return trackingCode;

  } catch (error: any) {
    // ✅ خط دفاعی سوم: هر خطایی را بگیر و کد محلی برگردان
    const errorMessage = error?.message || "";
    const errorCode = error?.code || "";
    
    console.warn(`⚠️ خطا در دریافت کد از سرور (${errorCode || errorMessage}). سوئیچ به حالت آفلاین...`);
    
    // ⭐⭐⭐ مهم‌ترین خط: هرگز خطا را throw نکن ⭐⭐⭐
    return generateOfflineTrackingCode();
  }
}

export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  try {
    const lastCode = localStorage.getItem(LS_LAST_CODE);
    if (lastCode && lastCode.startsWith(`TR-${year}-`)) {
      if (lastCode.includes("-OFF")) {
        return generateOfflineTrackingCode();
      }
      const match = lastCode.match(/(\d+)$/);
      if (match) {
        const nextNum = Number(match[1]) + 1;
        return `TR-${year}-${String(nextNum).padStart(SEQUENCE_LENGTH, "0")}`;
      }
    }
  } catch {}
  return `TR-${year}-00001`;
}

export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  const offlineMatch = String(code).match(/^TR-\d{4}-OFF(\d+)$/);
  if (offlineMatch) return Number(offlineMatch[1]) || 0;

  const match = String(code).match(/^TR-\d{4}-(\d{5})$/);
  if (match) return Number(match[1]) || 0;
  
  const legacyFormat = String(code).match(/^(?:HW|FX|TR)-(\d+)$/);
  if (legacyFormat) return Number(legacyFormat[1]) || 0;
  
  return 0;
}

export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  return /^TR-\d{4}-\d{5}$|^(?:HW|FX|TR)-\d+$|^TR-\d{4}-OFF\d+$/.test(code);
}

export function initTrackingSystem(): void {}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
