/* ---------- ساخت رسید رسمی ---------- */
export function buildReceipt(o: {
  receiptNo: string;
  customer: string;
  typeLabel: string;
  amountLabel: string;
  receiver: string;
  balances: Balances;
  balancesBefore?: Balances;
  deductedAmount?: number;
  deductedCurrency?: string;
  exchangeRate?: string;
  description?: string;
  date: string;
  time: string;
  siteName: string;
}): string {
  const M = CURRENCY_META;
  const LINE = "━━━━━━━━━━━━━━━━━━━━";
  const settings = loadJSON<any>("db_settings", {});
  const siteName = o.siteName || settings.siteName || "صرافی برادران نورزاد";
  const receiptNoClean = o.receiptNo.replace("#", "");

  const exchangeRate = o.exchangeRate || "—";
  const description = o.description || `انتقال ${o.amountLabel} به گیرنده`;

  // استخراج ارز و مبلغ از amountLabel
  const currencyMatch = o.amountLabel.match(/(AFN|USD|IRR|افغانی|دالر|تومان)/);
  const mainCurrency = currencyMatch ? currencyMatch[1] : "افغانی";
  
  // ✅ اصلاح شده - ternary درست
  const mainCurrencyLabel = mainCurrency === "AFN" || mainCurrency === "افغانی"
    ? "افغانی"
    : mainCurrency === "USD" || mainCurrency === "دالر"
      ? "دالر"
      : "تومان";

  // ✅ اصلاح شده - ternary درست (بدون : اضافی)
  const mainCurrencyFlag = mainCurrency === "AFN" || mainCurrency === "افغانی"
    ? M.AFN.flag
    : mainCurrency === "USD" || mainCurrency === "دالر"
      ? M.USD.flag
      : M.IRR.flag;

  const amountNum = Number(o.amountLabel.replace(/[^\d]/g, "")) || 0;

  return [
    `🧾 رسید معامله صرافی`,
    ``,
    `🏦 ${siteName}`,
    ``,
    LINE,
    ``,
    `📋 اطلاعات معامله`,
    ``,
    `شماره رسید: ${receiptNoClean}`,
    `تاریخ: ${o.date}`,
    `ساعت: ${o.time}`,
    `نام مشتری: ${o.customer}`,
    `نوع معامله: ${o.typeLabel}`,
    `گیرنده: ${o.receiver}`,
    ``,
    LINE,
    ``,
    `💰 جزئیات مالی`,
    ``,
    `مبلغ اصلی: ${fa(amountNum)} ${mainCurrencyLabel}`,
    `نرخ معامله: ${exchangeRate}`,
    `مبلغ نهایی: ${fa(amountNum)} ${mainCurrencyLabel}`,
    `وضعیت: ✅ موفق`,
    ``,
    LINE,
    ``,
    `📊 مانده حساب`,
    ``,
    ...(o.balancesBefore ? [
      `مانده قبل از معامله:`,
      `${M.AFN.flag} افغانی: ${fa(o.balancesBefore.AFN)} AFN`,
      ``,
    ] : []),
    ...(o.deductedAmount ? [
      `مبلغ کسرشده:`,
      `${mainCurrencyFlag} ${mainCurrencyLabel}: ${fa(o.deductedAmount)} ${o.deductedCurrency || mainCurrencyLabel}`,
      ``,
    ] : []),
    `مانده پس از معامله:`,
    `${M.AFN.flag} افغانی: ${fa(o.balances.AFN)} AFN`,
    `${M.USD.flag} دالر: ${fa(o.balances.USD)} USD`,
    `${M.IRR.flag} تومان: ${fa(o.balances.IRR)} IRR`,
    ``,
    LINE,
    ``,
    `📝 شرح معامله`,
    ``,
    `شرح: ${description}`,
    `گیرنده: ${o.receiver}`,
    `توضیحات اضافی: —`,
    ``,
    LINE,
    ``,
    `🔐 تأیید معامله`,
    ``,
    `کد پیگیری: ${receiptNoClean}`,
    `وضعیت ثبت: ✅ ثبت‌شده و تأییدشده`,
    ``,
    `این رسید نشان‌دهنده ثبت موفق معامله در`,
    `سیستم ${siteName} می‌باشد.`,
    ``,
    `🙏 تشکر از اعتماد شما`,
    ``,
    `${siteName}`,
  ].join("\n");
}
