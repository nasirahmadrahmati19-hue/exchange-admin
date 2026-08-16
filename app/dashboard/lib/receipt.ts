// ===== سیستم رسید تلگرامی =====

const SETTINGS_KEY = "fx-settings";
const CUSTOMERS_KEY = "fx-customers";

// ===== تبدیل عدد به حروف فارسی =====
export function numberToPersianWords(num: number): string {
  if (!Number.isFinite(num) || num === 0) return "صفر";
  
  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const hundreds = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
  
  function threeDigits(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    
    let result = hundreds[h];
    
    if (remainder >= 10 && remainder <= 19) {
      if (result) result += " و ";
      result += teens[remainder - 10];
    } else {
      if (t > 0) {
        if (result) result += " و ";
        result += tens[t];
      }
      if (o > 0) {
        if (result) result += " و ";
        result += ones[o];
      }
    }
    
    return result;
  }
  
  const parts: string[] = [];
  let scaleIndex = 0;
  let n = Math.floor(Math.abs(num));
  
  while (n > 0 && scaleIndex < scales.length) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const chunkWords = threeDigits(chunk);
      if (scaleIndex > 0) {
        parts.unshift(`${chunkWords} ${scales[scaleIndex]}`);
      } else {
        parts.unshift(chunkWords);
      }
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }
  
  return parts.join(" و ");
}

// ===== فرمت تاریخ شمسی =====
export function formatShamsiDateTime(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    
    const get = (t: string) => parts.find(p => p.type === t)?.value || "0";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const min = String(minutes).padStart(2, "0");
    
    return `${year}/${month}/${day} ${h12}:${min} ${ampm}`;
  } catch {
    return "-";
  }
}

// ===== خواندن تنظیمات تلگرام =====
function getTelegramSettings(): { enabled: boolean; botToken: string; chatId: string } {
  if (typeof window === "undefined") return { enabled: false, botToken: "", chatId: "" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { enabled: false, botToken: "", chatId: "" };
    const settings = JSON.parse(raw);
    return {
      enabled: settings.telegram?.enabled || false,
      botToken: settings.telegram?.botToken || "",
      chatId: settings.telegram?.chatId || "",
    };
  } catch {
    return { enabled: false, botToken: "", chatId: "" };
  }
}

// ===== خواندن chat_id مشتری =====
function getCustomerChatId(customerName: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) return "";
    const customers = JSON.parse(raw);
    const customer = customers.find((c: any) => c.name === customerName);
    return customer?.telegramChatId || "";
  } catch {
    return "";
  }
}

// ===== ساخت متن رسید =====
export type ReceiptData = {
  type: "deposit" | "withdraw" | "exchange" | "hawala" | "transfer" | "convert";
  date: Date;
  trackingCode: string;
  description: string;
  rate?: number;
  amount: number;
  currency: string;
  customerName?: string;
  balances: Record<string, number>;
};

export function buildReceiptText(data: ReceiptData): string {
  const isWithdraw = data.type === "withdraw" || data.type === "exchange";
  const title = isWithdraw ? "🔴 سند برد" : "🟢 سند رسید";
  
  const dateStr = formatShamsiDateTime(data.date);
  const amountWords = numberToPersianWords(data.amount);
  const formattedAmount = data.amount.toLocaleString("en-US");
  
  let text = `${title}\n\n`;
  text += `🗓 تاریخ: ${dateStr}\n\n`;
  text += `🛅 پیگیری: ${data.trackingCode}\n\n`;
  
  if (data.customerName) {
    text += `👤 مشتری: ${data.customerName}\n\n`;
  }
  
  text += `📑 شرح: ${data.description}, مبلغ ${amountWords}\n\n`;
  
  if (data.rate && data.rate > 0) {
    text += `📊 نرخ: ${data.rate}\n\n`;
  }
  
  text += `💰 مبلغ: ${formattedAmount} ${data.currency}\n\n`;
  text += `-------------بیلانس فعلی--------------\n`;
  
  const currencyLabels: Record<string, string> = {
    AFN: "افغانی",
    USD: "دالر",
    EUR: "یورو",
    IRR: "تومان",
    PKR: "کلدار",
  };
  
  for (const [currency, balance] of Object.entries(data.balances)) {
    const label = currencyLabels[currency] || currency;
    const status = balance > 0 ? "طلب" : balance < 0 ? "قرض" : "";
    const formattedBalance = Math.abs(balance).toLocaleString("en-US");
    text += `${label}: ${formattedBalance} ${status}\n`;
  }
  
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  
  return text;
}

// ===== ارسال پیام به تلگرام =====
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// ===== تابع اصلی: ارسال رسید بعد از معامله =====
export async function sendReceiptAfterTransaction(data: ReceiptData): Promise<{ sent: boolean; message: string }> {
  const settings = getTelegramSettings();
  
  if (!settings.enabled) {
    return { sent: false, message: "تلگرام غیرفعال است" };
  }
  
  if (!settings.botToken) {
    return { sent: false, message: "توکن ربات تنظیم نشده" };
  }
  
  const receiptText = buildReceiptText(data);
  
  let sentToCustomer = false;
  let sentToExchange = false;
  
  // ارسال به مشتری (اگر chat_id داشته باشد)
  if (data.customerName) {
    const customerChatId = getCustomerChatId(data.customerName);
    if (customerChatId) {
      sentToCustomer = await sendTelegramMessage(settings.botToken, customerChatId, receiptText);
    }
  }
  
  // ارسال به صرافی (همیشه)
  if (settings.chatId) {
    sentToExchange = await sendTelegramMessage(settings.botToken, settings.chatId, receiptText);
  }
  
  if (sentToCustomer || sentToExchange) {
    const targets = [];
    if (sentToCustomer) targets.push("مشتری");
    if (sentToExchange) targets.push("صرافی");
    return { sent: true, message: `رسید به ${targets.join(" و ")} ارسال شد` };
  }
  
  return { sent: false, message: "خطا در ارسال رسید" };
}
