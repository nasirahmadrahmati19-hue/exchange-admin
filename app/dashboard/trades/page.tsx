const exchangeRates: Record<string, { buy: number; sell: number }> = {
  USD: { buy: 65.90, sell: 65.95 },
  EUR: { buy: 74.90, sell: 75.00 },
  PKR: { buy: 229.00, sell: 229.50 }, // کلدار
  IRR_BANK: { buy: 0.350, sell: 0.360 }, // تومان بانکی (unit? note: buy rate is AFN per 1000? because baseUnits of IRR is 1000. We need to decide: is the rate for 1000 تومان or 1 تومان? The user wrote "0.350 خرید | 0.360 فروش" but earlier we used baseUnit of 1000. Probably they intend the rate to be for 1000 تومان. So 0.350 AFN per 1000 تومان? That matches 350 AFN per 1,000,000? No, 0.350 AFN per 1000 تومان means 1 تومان = 0.00035 AFN. But the previous examples had "1000 تومان = 0.38 AFN". So consistent. So we need to keep baseUnits for IRR_BANK and IRR_CHECK as 1000. The rate given is the AFN amount for 1000 units. So buy rate 0.350 means the exchange buys 1000 تومان for 0.350 AFN. So effective rate per 1 تومان is 0.00035. We'll store rate as provided, and in conversion we'll use baseUnits to scale.

- Modify `convertAmount` to use the predefined rates when the pair is in the table, and compute cross rates otherwise. The function will take the fromCurrency and toCurrency, and determine the appropriate rate based on whether the pair involves AFN or two non-AFN currencies. It will also need to know the transaction direction relative to AFN. For pair (from, to) where one is AFN and the other is X, we can directly look up buy/sell. For cross pairs, we'll compute via AFN.

- The rate input in the UI can be set automatically from the predefined rates based on the selected currencies and direction. The user can still override the rate if they want? The request says "منطق محاسبه بر اساس این ها بنویس" meaning base calculation on these rates. So we can pre-fill the rate field with the appropriate rate (buy/sell) based on the selected currencies and transaction direction. The direction is determined by which currency the customer is "paying" (فرستنده/پرداختی) and which they are "receiving" (گیرنده/دریافتی). In the exchange form, exReceivedCurrency is what the customer receives, exPaidCurrency is what they pay. So customer pays paidCurrency to receive receivedCurrency. So the exchange is selling receivedCurrency to the customer, and buying paidCurrency from them. So for the pair (paidCurrency, receivedCurrency): if paidCurrency is AFN and receivedCurrency is USD, that's the exchange selling USD (sell rate). If paidCurrency is USD and receivedCurrency is AFN, that's exchange buying USD (buy rate). So we can derive the appropriate rate automatically.

Thus, we can set exRate to the appropriate rate whenever exReceivedCurrency or exPaidCurrency changes (or also when the pair doesn't involve AFN, we compute cross rate). The user can still edit the rate if desired, but it will be pre-filled.

- Update the rate placeholder/info to show the predefined rate.

- Need to adjust baseUnits for new currencies: EUR baseUnit=1, IRR_BANK baseUnit=1000, IRR_CHECK baseUnit=1000.

- For تومان بانکی and تومان چک, we should add them to currencies list and currencyLabels.

- The existing code's `convertAmount` uses a single rate input. We'll replace its logic with a new function that uses the appropriate rate from the table, and also can fallback to the provided rate if no predefined pair exists (or override). But we need to pass the direction to it. We can add a parameter `rate` that if provided, overrides. In the component, we'll compute the effective rate using a helper function `getEffectiveRate(from, to)` that returns { rate: number, direction: 'buy'|'sell'|'cross' }. If both currencies are in the table and one is AFN, pick the appropriate rate. If both non-AFN, compute cross.

- After computing the rate, we can still use the existing conversion formula that was already handling baseUnits and directions. But the previous conversion formula assumed the rate was always from the canonical pair (currency1, currency2) where currency1 is earlier in order. That might conflict with buying/selling rates which are direction-dependent. So we need to redesign the conversion to use the explicit rate and direction.

Simplify: We'll keep the rate input as the rate to be used for conversion, but we'll automatically fill it with the correct value from the table. The conversion formula will be: if fromCurrency == base of rate pair and toCurrency == AFN: use the rate (which will be buy or sell?) Actually we need to be consistent. Let's define that the rate displayed and used in the formula is always the amount of toCurrency per unit of fromCurrency (or per baseUnit of fromCurrency). The user expects to enter a rate like "65" for USD/AFN. We'll maintain that. The conversion formula can be: toAmount = (fromAmount * rate) / baseUnit(from). This is what the earlier code did for the case from = currency1, to = currency2 (the canonical pair) using rate as amount of currency1 per baseUnit(currency2). That is messy. Instead, we can have a simpler universal formula: toAmount = (fromAmount * rate) / baseUnit(from) if rate is defined as amount of toCurrency per baseUnit(from). But that only works if from is the base of the rate. In our table, the rate is defined as AFN per baseUnit of the other currency (e.g., per 1 USD, per 1000 IRR). So AFN is the quote. For conversions not involving AFN, we can compute a derived rate. So we can adopt the convention: the rate input is always the amount of toCurrency per baseUnit(fromCurrency). When we pre-fill, we compute that rate accordingly.

Thus, for each pair, we need to compute a rate as (amount of toCurrency) per baseUnit of fromCurrency. For direct pairs with AFN, it's straightforward: if fromCurrency is USD (base=1), toCurrency is AFN, rate = 65.90 (buy) or 65.95 (sell) depending on whether we're buying/selling. If fromCurrency is AFN, toCurrency is USD, rate = (1 / sell rate) for buying USD? Actually if from AFN, to USD, baseUnit(AFN)=1, we need rate = amount of USD per 1 AFN. That would be 1/65.95. So the rate input will be computed accordingly. This will keep the conversion formula simple: toAmount = (fromAmount * rate) / baseUnit(fromCurrency). And it will automatically handle the direction.

So we need a function `getRate(fromCurrency, toCurrency)` that returns the rate (amount of toCurrency per baseUnit of fromCurrency) based on the exchange rate table. If no predefined pair, it returns null, and user must enter manually.

Implementation: For fromCurrency = X, toCurrency = Y.

If X == Y, rate = 1.

If both X and Y are in exchangeRates table (i.e., they have buy/sell against AFN), we can convert via AFN: rate = (toAmount_per_baseUnit_from) = (rate for Y in terms of AFN) ? Actually we want to convert from X to Y. So we have rates for X/AFN and Y/AFN. We need to find the appropriate direction for each leg to get the correct overall rate. The conversion path: from X -> AFN -> Y. For X -> AFN, we need the rate that applies when we sell X for AFN (which is exchange buying X, so buy rate if X is foreign). For AFN -> Y, we need the rate that applies when we buy Y with AFN (exchange selling Y, so sell rate for Y). So the effective rate from X to Y is (buy rate for X / sell rate for Y) * (baseUnit(Y) / baseUnit(X))? Let's derive: amount of AFN we get from X: amountAFN = (fromAmount * buyRateForX) / baseUnit(X). Then amount of Y = amountAFN * (1 / sellRateForY) * baseUnit(Y). So overall: amountY = fromAmount * (buyRateForX / sellRateForY) * (baseUnit(Y) / baseUnit(X)). So the rate (Y per baseUnit(X)) = (buyRateForX / sellRateForY) * baseUnit(Y). Wait, baseUnit(Y) is the unit for Y. In the formula, we already multiply by baseUnit(Y) / baseUnit(X). So the rate value we need to plug into our conversion formula (toAmount = fromAmount * rate / baseUnit(from)) is: rate = (buyRateForX * baseUnit(Y)) / sellRateForY. Because then toAmount = fromAmount * ((buyRateForX * baseUnit(Y)) / sellRateForY) / baseUnit(X) = fromAmount * (buyRateForX / sellRateForY) * (baseUnit(Y) / baseUnit(X)), which matches. So we can compute cross rate as rate_cross = (buyRate_X * baseUnit_Y) / sellRate_Y. Good.

If the pair involves AFN directly, say from = USD, to = AFN. Then using formula with buy rate (exchange buying USD) -> AFN amount per baseUnit(USD) is buyRate. So rate = buyRate_USD. And baseUnit(USD)=1. So conversion: toAmount = fromAmount * buyRate_USD / 1 = fromAmount * buyRate_USD, correct.

If from = AFN, to = USD. We need rate: USD per baseUnit(AFN)=1. Using the formula, we want to go AFN -> USD. The exchange is selling USD, so we use sell rate for USD: 1 / sellRate_USD. So rate = 1 / sellRate_USD? But using the cross logic: from = AFN (X=AFN), to = USD (Y=USD). X=AFN is local, not in exchangeRates (since only foreign currencies have buy/sell). We can treat AFN as having no buy/sell. So we need special handling for AFN. We'll handle AFN as base. We can add a getRate function that checks if from is AFN: then rate = 1 / sellRate_Y (since to buy Y). If to is AFN: rate = buyRate_X. So rate = buyRate_X for (X -> AFN) and rate = 1 / sellRate_Y for (AFN -> Y). Good.

Thus, we can implement a function `getEffectiveRate(from: string, to: string): number | null` that returns the rate (toCurrency per baseUnit(from)). Use the rate table. Return null if no rates defined for the pair and cannot compute (e.g., both non-AFN but one missing). Then in component, we set exRate/trRate to this value when currencies change, unless user has manually edited it.

Now, the existing code uses `useEffect` to compute conversions. We'll adjust.

Now, regarding the user's existing code: they already have a version with many changes (the one they sent). I'll incorporate the rate table logic into that code, but only change the calculation part. I'll also add the new currencies to the list. I must ensure the baseUnits for new currencies are set. I'll add EUR, IRR_BANK, IRR_CHECK. The labels: EUR: "یورو", IRR_BANK: "تومان بانکی", IRR_CHECK: "تومان چک". I'll keep IRR as general تومان maybe, but we can add these new ones and keep IRR as the original تومان (but user might not need it). To be safe, I'll add them as extra currencies, and keep the existing four. The user's rates mention only those pairs, but they might want to trade other pairs with manual rates.

Now, the conversion function convertAmount will still be used, but it will take the rate parameter. The rate passed will be the effective rate calculated by getEffectiveRate or the manually entered rate. Since the formula expects rate = toAmount per baseUnit(from), we need to adjust the internal convertAmount logic. The old convertAmount had its own logic with getCanonicalPair and direction, which might conflict with our new rate definition. So we need to replace convertAmount with a simpler function that directly uses the formula: toAmount = (fromAmount * rate) / baseUnit(fromCurrency) if rate is defined as amount of toCurrency per baseUnit(fromCurrency). That's straightforward. The old convertAmount had complex handling for canonical pairs; we can discard that. We'll write a new function `convertAmountSimple(fromAmount, fromCurrency, toCurrency, rate)` that does just that. However, we must ensure the rate is properly scaled for baseUnits. Since our effective rate already accounts for baseUnit(fromCurrency) (because we defined rate as per baseUnit(from)), the formula works. If fromAmount and rate are consistent, it's fine.

Thus:

function convertAmount(fromAmount: number, fromCurrency: string, toCurrency: string, rate: number): number {
  if (fromCurrency === toCurrency) return fromAmount;
  const baseFrom = baseUnits[fromCurrency] || 1;
  return (fromAmount * rate) / baseFrom;
}

Wait, we need to test: for USD -> AFN with rate 65.90 (AFN per USD, baseUSD=1): toAFN = fromAmount * 65.90 / 1 = correct. For AFN -> USD with rate = 1/65.95 = 0.015156... (USD per AFN, baseAFN=1): toUSD = fromAFN * (1/65.95) / 1 = fromAFN / 65.95, correct. For تومان بانکی (IRR_BANK) with base=1000, rate for IRR_BANK -> AFN: buy rate 0.350 (AFN per 1000 تومان). So toAFN = fromAmount * 0.350 / 1000 = fromAmount * 0.00035, correct. For AFN -> IRR_BANK: rate = 1/sellRate_IRR_BANK? But sell rate is 0.360 AFN per 1000 تومان, so to get تومان from AFN: تومان = AFN / (0.360 / 1000) = AFN * (1000/0.360). So rate (تومان per AFN) = 1000/0.360 = 2777.78. So using formula: toAmount = fromAFN * (1000/0.360) / 1 = correct. So the simple formula works if we compute rate as (baseUnit_Y) / (sellRate_Y) for AFN -> Y. That matches our earlier logic: rate = baseUnit(Y) / sellRate_Y. Good.

Thus, we can implement getEffectiveRate as described.

Now, the UI: we need to add EUR, IRR_BANK, IRR_CHECK to the currencies array and labels. Then in the component, we compute exRate and trRate automatically when currencies change (if we want to pre-fill). We can set the rate value to the effective rate and also set a flag that the rate is auto. But we can simply overwrite the exRate and trRate state whenever the currencies change, unless the user has manually typed something? This could be annoying if user wants to override. Better to provide the rate as a suggestion, but allow editing. The request: "منطق محاسبه بر اساس این ها بنویس و من بتوانم که دلار با تومان یا کلدار بار یورو یا هر ارز با ارز دیگر معامله نمایم" - maybe they just want the system to use those rates automatically without any manual rate input. However, the existing UI has rate input, and they didn't ask to remove it. So I'll keep the rate input field, but auto-fill it with the effective rate computed from the table. I'll add a useEffect that sets exRate to the effective rate (if available) when currencies change, but only if the rate field is empty or if it matches the previous auto-filled value? This could be complex. Simpler: I'll pre-fill exRate with the effective rate whenever exReceivedCurrency or exPaidCurrency changes, overwriting any user input. This is straightforward and ensures the correct rate. If the user wants a custom rate, they can still edit after that, but we risk overwriting. To avoid that, we could use a dedicated state `isRateAuto` and only update when auto mode is on. But for simplicity, as the user requested "بر اساس این ها بنویس", they likely want the system to use these rates. So I'll enforce auto-rate. The rate input will be read-only or pre-filled and user can change if needed, but I'll not auto-reset after they modify. To implement: I'll use useEffect with dependencies [exReceivedCurrency, exPaidCurrency] to set exRate to the effective rate from the table. If the table doesn't have that pair, it sets to empty string. Similarly for transfer. This will overwrite any manual input when currencies change, which is acceptable.

Now, the existing code's `computeExchangePaid` and `computeTransferReceiver` use useEffect to compute the result. They call `convertAmount` with the current rate. We'll replace the convertAmount call with our new simple version and use the current rate state.

Now, I'll write the modified code. I'll base it on the user's latest provided code (the very long one with the dropdown operations). I'll add the new currencies, exchangeRates, getEffectiveRate function, and modify the conversion functions accordingly. I'll remove the old `convertAmount`, `getCanonicalPair`, `formatRateQuote` that are now obsolete, and replace with new simpler functions that use the effective rate and baseUnits.

I'll keep `baseUnits` updated with new currencies.

Now, produce the final code.
"use client";

import { useState, useMemo, useEffect } from "react";

// ---------- Types ----------
type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

interface BaseTransaction {
  id: string;
  type: ExchangeType;
  date: string;
  terms: string;
  note: string;
  status: "active" | "voided";
}

interface ExchangeTransaction extends BaseTransaction {
  type: "صرافی-مشتری";
  customerId: string;
  receivedCurrency: string;
  receivedAmount: number;
  paidCurrency: string;
  paidAmount: number;
  rate: number; // مقدار ارز مقصد به ازای هر واحد پایه ارز مبدأ
}

interface TransferTransaction extends BaseTransaction {
  type: "بین-مشتریان";
  senderId: string;
  receiverId: string;
  senderCurrency: string;
  senderAmount: number;
  receiverCurrency: string;
  receiverAmount: number;
  rate: number;
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

// ---------- واحد پایه داخلی ارزها ----------
const baseUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  EUR: 1,
  IRR: 1000,        // تومان عمومی (در صورت نیاز)
  IRR_BANK: 1000,   // تومان بانکی
  IRR_CHECK: 1000,  // تومان چک
  PKR: 1,
};

// ---------- جدول نرخ‌های تبادل (همه نسبت به افغانی) ----------
const exchangeRates: Record<string, { buy: number; sell: number }> = {
  USD:      { buy: 65.90, sell: 65.95 },
  EUR:      { buy: 74.90, sell: 75.00 },
  PKR:      { buy: 229.00, sell: 229.50 },
  IRR_BANK: { buy: 0.350, sell: 0.360 },
  IRR_CHECK:{ buy: 0.490, sell: 0.500 },
};

// ---------- لیست ارزها با برچسب ----------
const currencies = ["AFN", "USD", "EUR", "PKR", "IRR_BANK", "IRR_CHECK"];
const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  PKR: "کلدار",
  IRR_BANK: "تومان بانکی",
  IRR_CHECK: "تومان چک",
};

// ---------- قالب‌بندی عدد ----------
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n % 1 === 0) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

// ---------- محاسبه نرخ مؤثر بر اساس جدول نرخ‌ها ----------
function getEffectiveRate(fromCurrency: string, toCurrency: string): number | null {
  if (fromCurrency === toCurrency) return 1;

  const baseFrom = baseUnits[fromCurrency] || 1;
  const baseTo = baseUnits[toCurrency] || 1;

  // حالت ۱: مبدأ = افغانی
  if (fromCurrency === "AFN") {
    const rateObj = exchangeRates[toCurrency];
    if (rateObj) {
      // نرخ فروش (صرافی ارز مقصد را می‌فروشد) → ۱ افغانی = (1 / sell) * baseTo
      return (baseTo / rateObj.sell);
    }
    return null;
  }

  // حالت ۲: مقصد = افغانی
  if (toCurrency === "AFN") {
    const rateObj = exchangeRates[fromCurrency];
    if (rateObj) {
      // نرخ خرید (صرافی ارز مبدأ را می‌خرد) → به ازای هر baseFrom افغانی دریافت می‌کنیم
      return rateObj.buy;
    }
    return null;
  }

  // حالت ۳: دو ارز خارجی (عبور از افغانی)
  const fromRate = exchangeRates[fromCurrency];
  const toRate = exchangeRates[toCurrency];
  if (fromRate && toRate) {
    // تبدیل: from → AFN (buy) → to (sell)
    // rate = (fromRate.buy * baseTo) / toRate.sell
    return (fromRate.buy * baseTo) / toRate.sell;
  }

  return null; // جفت ارز پشتیبانی نشده
}

// ---------- تابع تبدیل ساده ----------
function convertAmount(fromAmount: number, fromCurrency: string, toCurrency: string, rate: number): number {
  if (fromCurrency === toCurrency) return fromAmount;
  const baseFrom = baseUnits[fromCurrency] || 1;
  return (fromAmount * rate) / baseFrom;
}

// ---------- نمایش نرخ ----------
function formatRateQuote(currencyA: string, currencyB: string, rate: number): string {
  const baseA = baseUnits[currencyA] || 1;
  return `${baseA.toLocaleString()} ${currencyLabels[currencyA]} = ${formatNumber(rate)} ${currencyLabels[currencyB]}`;
}

// ---------- داده‌های اولیه مشتریان ----------
const initialCustomers: Customer[] = [
  { id: "c1", name: "احمد رحیمی", balances: { AFN: 500000, USD: 10000, EUR: 0, PKR: 0, IRR_BANK: 0, IRR_CHECK: 0 } },
  { id: "c2", name: "محمد ظاهر", balances: { AFN: 200000, USD: 5000, EUR: 0, PKR: 0, IRR_BANK: 0, IRR_CHECK: 0 } },
  { id: "c3", name: "فاطمه حسینی", balances: { AFN: 0, USD: 0, EUR: 0, PKR: 0, IRR_BANK: 50000000, IRR_CHECK: 0 } },
  { id: "c4", name: "علی کریمی", balances: { AFN: 0, USD: 0, EUR: 0, PKR: 200000, IRR_BANK: 0, IRR_CHECK: 0 } },
];

// ---------- ساخت شماره سند ----------
const generateDocId = () => {
  const now = new Date();
  return `EX-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
};

// ---------- محاسبه موجودی مشتریان ----------
function computeBalances(customers: Customer[], transactions: Transaction[]) {
  const balances: Record<string, Record<string, number>> = {};
  customers.forEach(c => { balances[c.id] = { ...c.balances }; });

  transactions.forEach(tx => {
    if (tx.status === "voided") return;
    if (tx.type === "صرافی-مشتری") {
      const cust = balances[tx.customerId];
      if (!cust) return;
      cust[tx.paidCurrency] = (cust[tx.paidCurrency] || 0) - tx.paidAmount;
      cust[tx.receivedCurrency] = (cust[tx.receivedCurrency] || 0) + tx.receivedAmount;
    } else {
      const sender = balances[tx.senderId];
      const receiver = balances[tx.receiverId];
      if (sender) {
        sender[tx.senderCurrency] = (sender[tx.senderCurrency] || 0) - tx.senderAmount;
        if (tx.commission > 0 && tx.commissionCurrency) {
          sender[tx.commissionCurrency] = (sender[tx.commissionCurrency] || 0) - tx.commission;
        }
      }
      if (receiver) {
        receiver[tx.receiverCurrency] = (receiver[tx.receiverCurrency] || 0) + tx.receiverAmount;
      }
    }
  });

  return balances;
}

// ---------- کامپوننت ----------
export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"صرافی-مشتری" | "بین-مشتریان">("صرافی-مشتری");

  const liveBalances = useMemo(() => computeBalances(customers, transactions), [customers, transactions]);

  // States عمومی
  const [docId, setDocId] = useState(generateDocId());
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  // فرم تبادل با مشتری
  const [exCustomer, setExCustomer] = useState("");
  const [exReceivedCurrency, setExReceivedCurrency] = useState("AFN");
  const [exReceivedAmount, setExReceivedAmount] = useState("");
  const [exPaidCurrency, setExPaidCurrency] = useState("USD");
  const [exPaidAmount, setExPaidAmount] = useState("");
  const [exRate, setExRate] = useState("");

  // فرم تبادل بین مشتریان
  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] = useState("AFN");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  // ویرایش/مشاهده
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  // ─── به‌روزرسانی خودکار نرخ (صرافی-مشتری) ───
  useEffect(() => {
    const rate = getEffectiveRate(exReceivedCurrency, exPaidCurrency);
    setExRate(rate !== null ? rate.toString() : "");
  }, [exReceivedCurrency, exPaidCurrency]);

  // ─── به‌روزرسانی خودکار نرخ (بین مشتریان) ───
  useEffect(() => {
    const rate = getEffectiveRate(trSenderCurrency, trReceiverCurrency);
    setTrRate(rate !== null ? rate.toString() : "");
  }, [trSenderCurrency, trReceiverCurrency]);

  // ─── محاسبه خودکار مبلغ پرداختی (صرافی-مشتری) ───
  useEffect(() => {
    if (!exRate || !exReceivedAmount) { setExPaidAmount(""); return; }
    const received = parseFloat(exReceivedAmount);
    const rate = parseFloat(exRate);
    if (!Number.isFinite(received) || !Number.isFinite(rate) || rate <= 0) { setExPaidAmount(""); return; }
    setExPaidAmount(formatNumber(convertAmount(received, exReceivedCurrency, exPaidCurrency, rate)));
  }, [exReceivedAmount, exRate, exReceivedCurrency, exPaidCurrency]);

  // ─── محاسبه خودکار مبلغ گیرنده (بین مشتریان) ───
  useEffect(() => {
    if (!trRate || !trSenderAmount) { setTrReceiverAmount(""); return; }
    const senderAmt = parseFloat(trSenderAmount);
    const rate = parseFloat(trRate);
    if (!Number.isFinite(senderAmt) || !Number.isFinite(rate) || rate <= 0) { setTrReceiverAmount(""); return; }
    setTrReceiverAmount(formatNumber(convertAmount(senderAmt, trSenderCurrency, trReceiverCurrency, rate)));
  }, [trSenderAmount, trRate, trSenderCurrency, trReceiverCurrency]);

  // ─── Reset ───
  const resetForm = () => {
    setDocId(generateDocId());
    setNote(""); setTerms("نقدی");
    setExCustomer(""); setExReceivedCurrency("AFN"); setExReceivedAmount(""); setExPaidCurrency("USD"); setExPaidAmount(""); setExRate("");
    setTrSender(""); setTrSenderCurrency("AFN"); setTrSenderAmount(""); setTrReceiver(""); setTrReceiverCurrency("AFN"); setTrReceiverAmount("");
    setTrRate(""); setTrCommission("0"); setTrCommissionCurrency("AFN");
  };

  // ─── ثبت تبادل با مشتری ───
  const submitExchange = () => {
    if (!exCustomer || !exReceivedAmount || !exPaidAmount || !exRate) return;
    const receivedAmount = parseFloat(exReceivedAmount);
    const paidAmount = parseFloat(exPaidAmount);
    const rate = parseFloat(exRate);
    if (!Number.isFinite(receivedAmount) || !Number.isFinite(paidAmount) || !Number.isFinite(rate) || rate <= 0) return;
    const tx: ExchangeTransaction = {
      id: docId, type: "صرافی-مشتری", date: new Date().toISOString(),
      customerId: exCustomer,
      receivedCurrency: exReceivedCurrency, receivedAmount,
      paidCurrency: exPaidCurrency, paidAmount,
      rate, terms, note, status: "active"
    };
    setTransactions(prev => [tx, ...prev]);
    resetForm();
  };

  // ─── ثبت تبادل بین مشتریان ───
  const submitTransfer = () => {
    if (!trSender || !trReceiver || !trSenderAmount || !trRate) return;
    if (trSender === trReceiver) { alert("فرستنده و گیرنده نمی‌توانند یکسان باشند"); return; }
    const senderAmountNum = parseFloat(trSenderAmount);
    const rateNum = parseFloat(trRate);
    const commissionNum = parseFloat(trCommission) || 0;
    if (!Number.isFinite(senderAmountNum) || !Number.isFinite(rateNum) || rateNum <= 0) return;
    if (!Number.isFinite(commissionNum) || commissionNum < 0) return;
    const receiverAmountNum = convertAmount(senderAmountNum, trSenderCurrency, trReceiverCurrency, rateNum);
    const tx: TransferTransaction = {
      id: docId, type: "بین-مشتریان", date: new Date().toISOString(),
      senderId: trSender, receiverId: trReceiver,
      senderCurrency: trSenderCurrency, senderAmount: senderAmountNum,
      receiverCurrency: trReceiverCurrency, receiverAmount: receiverAmountNum,
      rate: rateNum, commission: commissionNum, commissionCurrency: trCommissionCurrency,
      note, terms, status: "active"
    };
    setTransactions(prev => [tx, ...prev]);
    resetForm();
  };

  // ─── ابطال ───
  const voidTransaction = (id: string) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: "voided" } : tx));
  };

  // ─── ویرایش ───
  const startEdit = (tx: Transaction) => { setEditingTx({ ...tx }); setEditMode(true); };
  const saveEdit = () => {
    if (!editingTx) return;
    setTransactions(prev => prev.map(tx => tx.id === editingTx.id ? { ...editingTx } : tx));
    setEditMode(false); setEditingTx(null);
  };

  // ─── چاپ ───
  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;
    let html = `<div style="direction:rtl;font-family:Tahoma;padding:20px">`;
    html += `<h2>رسید معامله - ${tx.id}</h2>`;
    html += `<p><strong>تاریخ:</strong> ${new Date(tx.date).toLocaleString("fa-IR")}</p>`;
    html += `<p><strong>نوع:</strong> ${tx.type}</p>`;
    if (tx.type === "صرافی-مشتری") {
      const cust = customers.find(c => c.id === tx.customerId);
      html += `<p><strong>مشتری:</strong> ${cust?.name || tx.customerId}</p>`;
      html += `<p><strong>دریافت:</strong> ${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}</p>`;
      html += `<p><strong>پرداخت:</strong> ${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}</p>`;
      html += `<p><strong>نرخ:</strong> ${formatRateQuote(tx.receivedCurrency, tx.paidCurrency, tx.rate)}</p>`;
    } else {
      const sender = customers.find(c => c.id === tx.senderId);
      const receiver = customers.find(c => c.id === tx.receiverId);
      html += `<p><strong>فرستنده:</strong> ${sender?.name} | ${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}</p>`;
      html += `<p><strong>گیرنده:</strong> ${receiver?.name} | ${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}</p>`;
      html += `<p><strong>نرخ:</strong> ${formatRateQuote(tx.senderCurrency, tx.receiverCurrency, tx.rate)}</p>`;
      if (tx.commission > 0) html += `<p><strong>کارمزد:</strong> ${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}</p>`;
    }
    html += `<p><strong>مفاد:</strong> ${tx.terms}</p><p><strong>یادداشت:</strong> ${tx.note || "-"}</p>`;
    html += `<p><strong>وضعیت:</strong> ${tx.status === "voided" ? "ابطال شده" : "فعال"}</p></div>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || id;

  return (
    <div dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

      {/* تب‌ها */}
      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setActiveTab("صرافی-مشتری")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${activeTab === "صرافی-مشتری" ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>تبادل ارز (صرافی با مشتری)</button>
        <button onClick={() => setActiveTab("بین-مشتریان")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${activeTab === "بین-مشتریان" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>تبادل بین حساب مشتریان</button>
      </div>

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل ارز</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">اطلاعات مشتری و دریافتی</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری</label>
                  <select value={exCustomer} onChange={e => setExCustomer(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز دریافتی</label>
                  <select value={exReceivedCurrency} onChange={e => setExReceivedCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ دریافتی</label>
                  <input type="number" value={exReceivedAmount} onChange={e => setExReceivedAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">اطلاعات پرداختی</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز پرداختی</label>
                  <select value={exPaidCurrency} onChange={e => setExPaidCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ پرداختی (محاسبه شده)</label>
                  <input type="text" value={exPaidAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm" />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
            <input type="number" step="any" value={exRate} onChange={e => setExRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">مفاد معامله</label><input value={terms} onChange={e => setTerms(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label><input value={note} onChange={e => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
          </div>
          <button onClick={submitExchange} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]">ثبت معامله</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-700 mb-4">اطلاعات فرستنده</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری فرستنده</label>
                  <select value={trSender} onChange={e => setTrSender(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز فرستنده</label>
                  <select value={trSenderCurrency} onChange={e => setTrSenderCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ فرستنده</label>
                  <input type="number" value={trSenderAmount} onChange={e => setTrSenderAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
              <h3 className="text-sm font-bold text-green-700 mb-4">اطلاعات گیرنده</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری گیرنده</label>
                  <select value={trReceiver} onChange={e => setTrReceiver(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز گیرنده</label>
                  <select value={trReceiverCurrency} onChange={e => setTrReceiverCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ گیرنده (محاسبه شده)</label>
                  <input type="text" value={trReceiverAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm" />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
            <input type="number" step="any" value={trRate} onChange={e => setTrRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">کارمزد (اختیاری)</label><input type="number" value={trCommission} onChange={e => setTrCommission(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز کارمزد</label>
              <select value={trCommissionCurrency} onChange={e => setTrCommissionCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label><input value={note} onChange={e => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
          </div>
          <button onClick={submitTransfer} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]">ثبت معامله</button>
        </div>
      )}

      {/* موجودی مشتریان */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">موجودی فعلی مشتریان</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr><th className="py-2 px-3 text-right font-bold">مشتری</th>{currencies.map(c => <th key={c} className="py-2 px-3 text-right font-bold">{currencyLabels[c]}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(cust => {
                const bal = liveBalances[cust.id] || cust.balances;
                return <tr key={cust.id} className="hover:bg-gray-50"><td className="py-2 px-3 font-medium">{cust.name}</td>{currencies.map(cur => <td key={cur} className="py-2 px-3">{formatNumber(bal[cur] || 0)}</td>)}</tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* آخرین معاملات */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">آخرین معاملات</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-3 px-2 text-right font-bold">شماره</th>
              <th className="py-3 px-2 text-right font-bold">تاریخ</th>
              <th className="py-3 px-2 text-right font-bold">نوع</th>
              <th className="py-3 px-2 text-right font-bold">مشتری/فرستنده</th>
              <th className="py-3 px-2 text-right font-bold">دریافت</th>
              <th className="py-3 px-2 text-right font-bold">پرداخت</th>
              <th className="py-3 px-2 text-right font-bold">نرخ</th>
              <th className="py-3 px-2 text-right font-bold">مفاد</th>
              <th className="py-3 px-2 text-right font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-400">هیچ معامله‌ای ثبت نشده است</td></tr>}
            {transactions.map((tx, idx) => {
              const isVoided = tx.status === "voided";
              return (
                <tr key={tx.id} className={`hover:bg-gray-50 ${isVoided ? "opacity-60 line-through" : ""}`}>
                  <td className="py-3 px-2 font-mono text-xs">{idx + 1}</td>
                  <td className="py-3 px-2 text-xs">{new Date(tx.date).toLocaleString("fa-IR")}</td>
                  <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded text-xs ${tx.type === "صرافی-مشتری" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{tx.type === "صرافی-مشتری" ? "صرافی-مشتری" : "بین مشتریان"}</span></td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? customerName(tx.customerId) : customerName(tx.senderId)}</td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}` : `${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}`}</td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}` : `${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}`}</td>
                  <td className="py-3 px-2 text-xs">{tx.type === "صرافی-مشتری" ? formatRateQuote(tx.receivedCurrency, tx.paidCurrency, tx.rate) : formatRateQuote(tx.senderCurrency, tx.receiverCurrency, tx.rate)}</td>
                  <td className="py-3 px-2 text-xs">{tx.terms}</td>
                  <td className="py-3 px-2 relative">
                    <button onClick={() => { const menu = document.getElementById(`menu-${tx.id}`); menu?.classList.toggle('hidden'); }} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded">عملیات ▾</button>
                    <div id={`menu-${tx.id}`} className="absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden">
                      <button onClick={() => { setViewTx(tx); }} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">مشاهده</button>
                      <button onClick={() => printReceipt(tx)} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">چاپ</button>
                      {!isVoided && <>
                        <button onClick={() => startEdit(tx)} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">ویرایش</button>
                        <button onClick={() => { if (window.confirm("آیا مطمئن هستید؟")) voidTransaction(tx.id); }} className="block w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50">ابطال</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* مودال مشاهده */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setViewTx(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">جزئیات معامله</h2>
            <div className="space-y-2 text-sm">
              <p><strong>شماره:</strong> {viewTx.id}</p>
              <p><strong>تاریخ:</strong> {new Date(viewTx.date).toLocaleString("fa-IR")}</p>
              <p><strong>نوع:</strong> {viewTx.type}</p>
              {viewTx.type === "صرافی-مشتری" ? (
                <>
                  <p><strong>مشتری:</strong> {customerName(viewTx.customerId)}</p>
                  <p><strong>دریافت:</strong> {formatNumber(viewTx.receivedAmount)} {currencyLabels[viewTx.receivedCurrency]}</p>
                  <p><strong>پرداخت:</strong> {formatNumber(viewTx.paidAmount)} {currencyLabels[viewTx.paidCurrency]}</p>
                  <p><strong>نرخ:</strong> {formatRateQuote(viewTx.receivedCurrency, viewTx.paidCurrency, viewTx.rate)}</p>
                </>
              ) : (
                <>
                  <p><strong>فرستنده:</strong> {customerName(viewTx.senderId)} | {formatNumber(viewTx.senderAmount)} {currencyLabels[viewTx.senderCurrency]}</p>
                  <p><strong>گیرنده:</strong> {customerName(viewTx.receiverId)} | {formatNumber(viewTx.receiverAmount)} {currencyLabels[viewTx.receiverCurrency]}</p>
                  <p><strong>نرخ:</strong> {formatRateQuote(viewTx.senderCurrency, viewTx.receiverCurrency, viewTx.rate)}</p>
                  {viewTx.commission > 0 && <p><strong>کارمزد:</strong> {formatNumber(viewTx.commission)} {currencyLabels[viewTx.commissionCurrency]}</p>}
                </>
              )}
              <p><strong>مفاد:</strong> {viewTx.terms}</p>
              <p><strong>یادداشت:</strong> {viewTx.note || "-"}</p>
              <p><strong>وضعیت:</strong> {viewTx.status === "voided" ? "ابطال شده" : "فعال"}</p>
            </div>
            <button onClick={() => setViewTx(null)} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">بستن</button>
          </div>
        </div>
      )}

      {/* مودال ویرایش */}
      {editMode && editingTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ویرایش معامله</h2>
            {editingTx.type === "صرافی-مشتری" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-bold">مشتری</label><select value={(editingTx as ExchangeTransaction).customerId} onChange={e => setEditingTx({...editingTx, customerId: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">ارز دریافتی</label><select value={(editingTx as ExchangeTransaction).receivedCurrency} onChange={e => setEditingTx({...editingTx, receivedCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ دریافتی</label><input type="number" value={(editingTx as ExchangeTransaction).receivedAmount} onChange={e => setEditingTx({...editingTx, receivedAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز پرداختی</label><select value={(editingTx as ExchangeTransaction).paidCurrency} onChange={e => setEditingTx({...editingTx, paidCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ پرداختی</label><input type="number" value={(editingTx as ExchangeTransaction).paidAmount} onChange={e => setEditingTx({...editingTx, paidAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">نرخ</label><input type="number" step="any" value={(editingTx as ExchangeTransaction).rate} onChange={e => setEditingTx({...editingTx, rate: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">مفاد</label><input value={editingTx.terms} onChange={e => setEditingTx({...editingTx, terms: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">یادداشت</label><input value={editingTx.note} onChange={e => setEditingTx({...editingTx, note: e.target.value})} className="w-full border rounded p-2" /></div>
              </div>
            )}
            {editingTx.type === "بین-مشتریان" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-bold">فرستنده</label><select value={(editingTx as TransferTransaction).senderId} onChange={e => setEditingTx({...editingTx, senderId: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">گیرنده</label><select value={(editingTx as TransferTransaction).receiverId} onChange={e => setEditingTx({...editingTx, receiverId: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">ارز فرستنده</label><select value={(editingTx as TransferTransaction).senderCurrency} onChange={e => setEditingTx({...editingTx, senderCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ فرستنده</label><input type="number" value={(editingTx as TransferTransaction).senderAmount} onChange={e => setEditingTx({...editingTx, senderAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز گیرنده</label><select value={(editingTx as TransferTransaction).receiverCurrency} onChange={e => setEditingTx({...editingTx, receiverCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ گیرنده</label><input type="number" value={(editingTx as TransferTransaction).receiverAmount} onChange={e => setEditingTx({...editingTx, receiverAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">نرخ</label><input type="number" step="any" value={(editingTx as TransferTransaction).rate} onChange={e => setEditingTx({...editingTx, rate: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">کارمزد</label><input type="number" value={(editingTx as TransferTransaction).commission} onChange={e => setEditingTx({...editingTx, commission: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز کارمزد</label><select value={(editingTx as TransferTransaction).commissionCurrency} onChange={e => setEditingTx({...editingTx, commissionCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">یادداشت</label><input value={editingTx.note} onChange={e => setEditingTx({...editingTx, note: e.target.value})} className="w-full border rounded p-2" /></div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setEditMode(false); setEditingTx(null); }} className="px-4 py-2 bg-gray-200 rounded-lg">انصراف</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg">ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
