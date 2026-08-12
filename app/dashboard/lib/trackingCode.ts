// lib/trackingCode.ts

/**
 * ═══════════════════════════════════════════════════════════
 * سیستم تولید کد پیگیری یکتا
 * ساختار: TR-1405-00001
 * - TR: پیشوند ثابت (Transaction)
 * - 1405: سال هجری شمسی (خودکار)
 * - 00001: شماره مسلسل ۵ رقمی (ریست در سال جدید)
 * ظرفیت: 99,999 تراکنش در سال
 * ═══════════════════════════════════════════════════════════
 */

const COUNTERS_KEY = "tracking-counters";
const SEQUENCE_LENGTH = 5; // ✅ 5 رقم برای ظرفیت بیشتر

interface YearlyCounters {
  [year: string]: number;
}

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
 * خواندن شمارنده‌ها از localStorage
 */
function getCounters(): YearlyCounters {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const safe: YearlyCounters = {};
      for (const [year, count] of Object.entries(parsed)) {
        safe[year] = Number(count) || 0;
      }
      return safe;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * ذخیره شمارنده‌ها در localStorage
 */
function setCounters(counters: YearlyCounters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
  } catch (err) {
    console.error("Failed to save tracking counters:", err);
  }
}

/**
 * پیش‌نمایش کد پیگیری بعدی (بدون افزایش شمارنده)
 * برای نمایش در فرم‌ها قبل از ثبت
 */
export function getNextTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const counters = getCounters();
  const currentCount = counters[year] || 0;
  const nextCount = currentCount + 1;
  return `TR-${year}-${String(nextCount).padStart(SEQUENCE_LENGTH, "0")}`;
}

/**
 * تولید و مصرف کد پیگیری (با افزایش شمارنده)
 * برای ثبت نهایی تراکنش
 */
export function consumeTrackingCode(): string {
  const year = getCurrentShamsiYear();
  const counters = getCounters();
  const currentCount = counters[year] || 0;
  const nextCount = currentCount + 1;
  
  counters[year] = nextCount;
  setCounters(counters);
  
  return `TR-${year}-${String(nextCount).padStart(SEQUENCE_LENGTH, "0")}`;
}

/**
 * مقداردهی اولیه سیستم
 */
export function initTrackingSystem(): void {
  const year = getCurrentShamsiYear();
  const counters = getCounters();
  if (!counters[year]) {
    counters[year] = 0;
    setCounters(counters);
  }
}

/**
 * گرفتن شماره از کد پیگیری (برای مرتب‌سازی)
 * ✅ هم فرمت جدید TR-1405-00001 و هم فرمت‌های قدیمی HW-0001, FX-0001 را شناسایی می‌کند
 */
export function getTrackingNumberValue(code: string): number {
  if (!code) return 0;
  
  // فرمت جدید: TR-1405-00001 یا TR-1405-99999
  const newFormat = String(code).match(/^TR-\d{4}-(\d{4,5})$/);
  if (newFormat) return Number(newFormat[1]) || 0;
  
  // فرمت‌های قدیمی: HW-0001 یا FX-0001
  const oldFormat = String(code).match(/^(?:HW|FX)-(\d+)$/);
  if (oldFormat) return Number(oldFormat[1]) || 0;
  
  return 0;
}

/**
 * اعتبارسنجی فرمت کد پیگیری
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  const regex = /^TR-\d{4}-\d{5}$/;
  return regex.test(code);
}

/**
 * حداکثر ظرفیت سالانه
 */
export function getMaxCapacity(): number {
  return Math.pow(10, SEQUENCE_LENGTH) - 1; // 99999
}
