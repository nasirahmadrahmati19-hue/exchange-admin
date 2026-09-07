/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری جهانی (نسخه نهایی و اصلاح‌شده)
 * ✅ این فایل باید حتماً با نام trackingCode.ts ذخیره شود (نه tsx)
 * ═══════════════════════════════════════════════════════════
 */

import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase"; // مسیر فایل firebase خود را بررسی کنید

const SEQUENCE_LENGTH = 5;
const MAX_SEQUENCE = 99999;
const COUNTER_DOC_ID = "global_tracking_counter";
const LS_KEY_PREFIX = "fx_local_counter_";

export function getCurrentShamsiYear(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).formatToParts(new Date());
    return parts.find((p) => p.type === "year")?.value || "1405";
  } catch {
    return "1405";
  }
}

function isOnline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine !== false;
}

function generateFromLocalStorage(year: string): string {
  const LS_KEY = `${LS_KEY_PREFIX}${year}`;
  try {
    const stored = localStorage.getItem(LS_KEY);
    let count = stored ? parseInt(stored, 10) : 0;
    
    if (!Number.isFinite(count) || count < 0) count = 0;
    count++;
    
    if (count > MAX_SEQUENCE) {
      console.warn(`⚠️ ظرفیت سال ${year} پر شد. ریست به 1`);
      count = 1;
    }
    
    localStorage.setItem(LS_KEY, count.toString());
    try { window.dispatchEvent(new Event('storage')); } catch {}
    
    return `TR-${year}-${String(count).padStart(SEQUENCE_LENGTH, "0")}`;
  } catch (err) {
    console.error("❌ خطا در localStorage:", err);
    return `TR-${year}-00001`;
  }
}

export async function consumeTrackingCode(): Promise<string> {
  const year = getCurrentShamsiYear();
  
  if (!isOnline()) {
    console.log("📡 حالت آفلاین - استفاده از شمارنده محلی");
    return generateFromLocalStorage(year);
  }
  
  try {
    const counterRef = doc(db, "system_counters", COUNTER_DOC_ID);
    
    const newCount = await runTransaction(db, async (transaction) => {
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
    
    const code = `TR-${year}-${String(newCount).padStart(SEQUENCE_LENGTH, "0")}`;
    console.log(`✅ کد پیگیری آنلاین (فایربیس): ${code}`);
    
    try {
      const LS_KEY = `${LS_KEY_PREFIX}${year}`;
      localStorage.setItem(LS_KEY, newCount.toString());
    } catch {}
    
    return code;
  } catch (cloudError) {
    console.warn("⚠️ فایربیس کار نکرد. استفاده از حالت آفلاین:", (cloudError as Error).message);
    return generateFromLocalStorage(year);
  }
}

export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
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
