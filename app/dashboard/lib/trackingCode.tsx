/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی با دیباگ کامل)
 * ✅ نمایش خطای واقعی فایربیس به جای پیام گمراه‌کننده‌ی اینترنت
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; 

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_LAST_CODE = "fx_last_tracking_code";

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1403";
  } catch {
    return "1403";
  }
}

export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);

  try {
    const trackingCode = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const currentData = counterDoc.exists() ? counterDoc.data() : {};
      
      const currentCount = currentData[year] || 0;

      if (currentCount >= MAX_SEQUENCE) {
        throw new Error("ظرفیت کدهای پیگیری برای این سال به اتمام رسیده است!");
      }

      const nextCount = currentCount + 1;

      transaction.set(
        counterRef, 
        { ...currentData, [year]: nextCount }, 
        { merge: true }
      );

      const formattedSeq = String(nextCount).padStart(SEQUENCE_LENGTH, "0");
      return `TR-${year}-${formattedSeq}`;
    });

    try {
      localStorage.setItem(LS_LAST_CODE, trackingCode);
    } catch {}

    console.log(`✅ کد پیگیری یکتا صادر شد: ${trackingCode}`);
    return trackingCode;

  } catch (error: any) {
    // 🔥 اصلاح حیاتی: چاپ کامل خطای واقعی فایربیس در کنسول
    console.error("🔥 🔥 🔥 خطای واقعی فایربیس در تولید کد پیگیری: 🔥 🔥 🔥");
    console.error("➡️ Error Code:", error?.code);
    console.error("➡️ Error Message:", error?.message);
    console.error("➡️ Full Error Object:", error);
    
    // 🔥 اصلاح حیاتی: پرتاب خطای واقعی به جای پیام "اینترنت"
    const realMessage = error?.message || "خطای ناشناخته در فایربیس";
    throw new Error(`خطا در تولید کد پیگیری: ${realMessage}`);
  }
}

export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  try {
    const lastCode = localStorage.getItem(LS_LAST_CODE);
    if (lastCode && lastCode.startsWith(`TR-${year}-`)) {
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
  // سیستم به صورت خودکار و سرور-بیس کار می‌کند
}

export function getMaxCapacity(): number {
  return MAX_SEQUENCE;
}
