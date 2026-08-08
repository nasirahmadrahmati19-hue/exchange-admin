"use client";

import { useMemo, useState } from "react";

// =====================================================
// Types
// =====================================================

type RemittanceType = "ارسال" | "دریافت" | "حساب به حساب";

type RemittanceStatus =
  | "در انتظار"
  | "در حال پردازش"
  | "آماده پرداخت"
  | "پرداخت شد"
  | "لغو شد"
  | "برگشت داده شد";

type Currency = "AFN" | "USD" | "IRR" | "PKR";

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  telegramChatId: string;
  balances: Record<Currency, number>;
}

interface Remittance {
  id: string;
  date: string;

  type: RemittanceType;
  status: RemittanceStatus;

  senderId: string;
  senderPhone: string;

  receiverName: string;
  receiverPhone: string;

  receiverCountry: string;
  receiverCity: string;

  currency: Currency;
  amount: number;

  commission: number;
  commissionCurrency: Currency;

  totalReceived: number;

  paymentMethod: "نقدی" | "حساب مشتری" | "بانکی";

  paidAmount: number;
  paidCurrency: Currency;

  paymentMethodAtDestination:
    | "نقدی"
    | "حساب مشتری"
    | "بانکی"
    | "";

  paymentDate: string;
  paymentNote: string;

  note: string;
}

// =====================================================
// Currency
// =====================================================

const currencies: Currency[] = ["AFN", "USD", "IRR", "PKR"];

const currencyLabels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

// =====================================================
// Initial Customers
// =====================================================

const initialCustomers: Customer[] = [
  {
    id: "c1",
    name: "احمد رحیمی",
    phone: "0700000001",
    whatsapp: "0700000001",
    telegramChatId: "",
    balances: {
      AFN: 500000,
      USD: 10000,
      IRR: 0,
      PKR: 0,
    },
  },
  {
    id: "c2",
    name: "محمد ظاهر",
    phone: "0700000002",
    whatsapp: "0700000002",
    telegramChatId: "",
    balances: {
      AFN: 200000,
      USD: 5000,
      IRR: 0,
      PKR: 0,
    },
  },
  {
    id: "c3",
    name: "فاطمه حسینی",
    phone: "0700000003",
    whatsapp: "0700000003",
    telegramChatId: "",
    balances: {
      AFN: 0,
      USD: 0,
      IRR: 50000000,
      PKR: 0,
    },
  },
  {
    id: "c4",
    name: "علی کریمی",
    phone: "0700000004",
    whatsapp: "0700000004",
    telegramChatId: "",
    balances: {
      AFN: 0,
      USD: 0,
      IRR: 0,
      PKR: 200000,
    },
  },
];

// =====================================================
// Helpers
// =====================================================

function generateRemittanceId() {
  const now = new Date();

  return `RM-${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(
    2,
    "0"
  )}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function getCustomerName(
  customers: Customer[],
  id: string
) {
  return customers.find((c) => c.id === id)?.name || id;
}

// =====================================================
// Main Component
// =====================================================

export default function RemittancePage() {
  const [customers] = useState<Customer[]>(initialCustomers);

  const [remittances, setRemittances] = useState<Remittance[]>(
    []
  );

  const [activeStatus, setActiveStatus] = useState<
    "همه" | RemittanceStatus
  >("همه");

  const [search, setSearch] = useState("");

  const [viewRemittance, setViewRemittance] =
    useState<Remittance | null>(null);

  // ===================================================
  // Form
  // ===================================================

  const [remittanceType, setRemittanceType] =
    useState<RemittanceType>("ارسال");

  const [senderId, setSenderId] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");

  const [receiverCountry, setReceiverCountry] =
    useState("");

  const [receiverCity, setReceiverCity] =
    useState("");

  const [currency, setCurrency] =
    useState<Currency>("AFN");

  const [amount, setAmount] = useState("");

  const [commission, setCommission] =
    useState("0");

  const [commissionCurrency, setCommissionCurrency] =
    useState<Currency>("AFN");

  const [paymentMethod, setPaymentMethod] =
    useState<
      "نقدی" | "حساب مشتری" | "بانکی"
    >("نقدی");

  const [paidAmount, setPaidAmount] = useState("");

  const [paidCurrency, setPaidCurrency] =
    useState<Currency>("AFN");

  const [paymentMethodAtDestination, setPaymentMethodAtDestination] =
    useState<
      "نقدی" | "حساب مشتری" | "بانکی" | ""
    >("");

  const [paymentNote, setPaymentNote] =
    useState("");

  const [note, setNote] = useState("");

  // ===================================================
  // Calculations
  // ===================================================

  const amountNumber = Number(amount) || 0;
  const commissionNumber = Number(commission) || 0;

  const totalReceived =
    amountNumber + commissionNumber;

  // ===================================================
  // Customer balances
  // ===================================================

  const liveBalances = useMemo(() => {
    const balances: Record<
      string,
      Record<Currency, number>
    > = {};

    customers.forEach((customer) => {
      balances[customer.id] = {
        ...customer.balances,
      };
    });

    remittances.forEach((tx) => {
      if (
        tx.status === "لغو شد" ||
        tx.status === "برگشت داده شد"
      ) {
        return;
      }

      // فقط زمانی که مبلغ حواله از حساب مشتری برداشت شود
      if (
        tx.paymentMethod === "حساب مشتری" &&
        tx.senderId
      ) {
        const customer =
          balances[tx.senderId];

        if (customer) {
          customer[tx.currency] =
            (customer[tx.currency] || 0) -
            tx.totalReceived;
        }
      }
    });

    return balances;
  }, [customers, remittances]);

  // ===================================================
  // Reset
  // ===================================================

  function resetForm() {
    setRemittanceType("ارسال");

    setSenderId("");

    setReceiverName("");
    setReceiverPhone("");

    setReceiverCountry("");
    setReceiverCity("");

    setCurrency("AFN");

    setAmount("");
    setCommission("0");

    setCommissionCurrency("AFN");

    setPaymentMethod("نقدی");

    setPaidAmount("");
    setPaidCurrency("AFN");

    setPaymentMethodAtDestination("");

    setPaymentNote("");
    setNote("");
  }

  // ===================================================
  // Submit
  // ===================================================

  function submitRemittance() {
    if (!senderId) {
      alert("لطفاً مشتری فرستنده را انتخاب کنید.");
      return;
    }

    if (!receiverName.trim()) {
      alert("لطفاً نام گیرنده را وارد کنید.");
      return;
    }

    if (!amount || amountNumber <= 0) {
      alert("لطفاً مبلغ حواله را وارد کنید.");
      return;
    }

    if (remittanceType === "حساب به حساب") {
      if (!receiverPhone.trim()) {
        alert("لطفاً شماره تماس گیرنده را وارد کنید.");
        return;
      }
    }

    const sender =
      customers.find((c) => c.id === senderId);

    if (!sender) {
      alert("مشتری فرستنده پیدا نشد.");
      return;
    }

    // بررسی موجودی فقط زمانی که از حساب مشتری برداشت می‌شود
    if (paymentMethod === "حساب مشتری") {
      const balance =
        sender.balances[currency] || 0;

      if (balance < totalReceived) {
        alert(
          `موجودی ${currencyLabels[currency]} مشتری کافی نیست.`
        );
        return;
      }
    }

    const newRemittance: Remittance = {
      id: generateRemittanceId(),

      date: new Date().toISOString(),

      type: remittanceType,

      status: "در انتظار",

      senderId,

      senderPhone:
        sender.phone || "",

      receiverName:
        receiverName.trim(),

      receiverPhone:
        receiverPhone.trim(),

      receiverCountry:
        receiverCountry.trim(),

      receiverCity:
        receiverCity.trim(),

      currency,

      amount: amountNumber,

      commission: commissionNumber,

      commissionCurrency,

      totalReceived,

      paymentMethod,

      paidAmount:
        Number(paidAmount) || 0,

      paidCurrency,

      paymentMethodAtDestination,

      paymentDate: "",

      paymentNote,

      note,
    };

    setRemittances((prev) => [
      newRemittance,
      ...prev,
    ]);

    alert(
      `حواله با شماره ${newRemittance.id} ثبت شد.`
    );

    resetForm();
  }

  // ===================================================
  // Change Status
  // ===================================================

  function changeStatus(
    id: string,
    status: RemittanceStatus
  ) {
    setRemittances((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          status,

          paymentDate:
            status === "پرداخت شد"
              ? new Date().toISOString()
              : item.paymentDate,
        };
      })
    );
  }

  // ===================================================
  // Print Receipt
  // ===================================================

  function printReceipt(tx: Remittance) {
    const senderName =
      getCustomerName(
        customers,
        tx.senderId
      );

    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>رسید حواله ${tx.id}</title>

        <style>
          body {
            direction: rtl;
            font-family: Tahoma, Arial;
            padding: 30px;
            line-height: 2;
          }

          .receipt {
            max-width: 600px;
            margin: auto;
            border: 1px solid #ddd;
            padding: 25px;
            border-radius: 12px;
          }

          h1 {
            text-align: center;
            font-size: 22px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #eee;
            padding: 7px 0;
          }

          strong {
            font-weight: bold;
          }
        </style>
      </head>

      <body>
        <div class="receipt">

          <h1>رسید حواله</h1>

          <div class="row">
            <strong>شماره سند</strong>
            <span>${tx.id}</span>
          </div>

          <div class="row">
            <strong>تاریخ</strong>
            <span>
              ${new Date(tx.date).toLocaleString(
                "fa-IR"
              )}
            </span>
          </div>

          <div class="row">
            <strong>نوع حواله</strong>
            <span>${tx.type}</span>
          </div>

          <div class="row">
            <strong>فرستنده</strong>
            <span>${senderName}</span>
          </div>

          <div class="row">
            <strong>گیرنده</strong>
            <span>${tx.receiverName}</span>
          </div>

          <div class="row">
            <strong>مبلغ حواله</strong>
            <span>
              ${formatNumber(tx.amount)}
              ${currencyLabels[tx.currency]}
            </span>
          </div>

          <div class="row">
            <strong>کارمزد</strong>
            <span>
              ${formatNumber(tx.commission)}
              ${currencyLabels[tx.commissionCurrency]}
            </span>
          </div>

          <div class="row">
            <strong>مبلغ کل</strong>
            <span>
              ${formatNumber(tx.totalReceived)}
              ${currencyLabels[tx.currency]}
            </span>
          </div>

          <div class="row">
            <strong>وضعیت</strong>
            <span>${tx.status}</span>
          </div>

          ${
            tx.note
              ? `
              <div class="row">
                <strong>یادداشت</strong>
                <span>${tx.note}</span>
              </div>
              `
              : ""
          }

        </div>
      </body>
      </html>
    `;

    const win = window.open(
      "",
      "_blank"
    );

    if (!win) {
      alert("پنجره چاپ باز نشد.");
      return;
    }

    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.print();
    }, 300);
  }

  // ===================================================
  // WhatsApp Receipt
  // ===================================================

  function sendWhatsAppReceipt(
    tx: Remittance
  ) {
    const sender =
      customers.find(
        (c) => c.id === tx.senderId
      );

    const phone =
      sender?.whatsapp ||
      tx.senderPhone;

    if (!phone) {
      alert(
        "شماره WhatsApp مشتری ثبت نشده است."
      );
      return;
    }

    const senderName =
      sender?.name || tx.senderId;

    const message = `
رسید حواله

صرافی برادران نورزاد

شماره سند: ${tx.id}

نوع حواله: ${tx.type}

فرستنده:
${senderName}

گیرنده:
${tx.receiverName}

مبلغ حواله:
${formatNumber(tx.amount)} ${currencyLabels[tx.currency]}

کارمزد:
${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}

مبلغ کل:
${formatNumber(tx.totalReceived)} ${currencyLabels[tx.currency]}

وضعیت:
${tx.status}

تاریخ:
${new Date(tx.date).toLocaleString(
      "fa-IR"
    )}
    `.trim();

    const cleanPhone =
      phone.replace(/\D/g, "");

    const url =
      `https://wa.me/${cleanPhone}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(
      url,
      "_blank"
    );
  }

  // ===================================================
  // Copy Receipt
  // ===================================================

  async function copyReceipt(
    tx: Remittance
  ) {
    const senderName =
      getCustomerName(
        customers,
        tx.senderId
      );

    const text = `
رسید حواله

شماره سند: ${tx.id}
نوع حواله: ${tx.type}

فرستنده: ${senderName}
گیرنده: ${tx.receiverName}

مبلغ حواله:
${formatNumber(tx.amount)} ${currencyLabels[tx.currency]}

کارمزد:
${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}

مبلغ کل:
${formatNumber(tx.totalReceived)} ${currencyLabels[tx.currency]}

وضعیت: ${tx.status}

تاریخ:
${new Date(tx.date).toLocaleString(
      "fa-IR"
    )}
    `.trim();

    await navigator.clipboard.writeText(text);

    alert("رسید کپی شد.");
  }

  // ===================================================
  // Filter
  // ===================================================

  const filteredRemittances =
    remittances.filter((tx) => {
      const matchesStatus =
        activeStatus === "همه" ||
        tx.status === activeStatus;

      const senderName =
        getCustomerName(
          customers,
          tx.senderId
        );

      const matchesSearch =
        !search ||
        tx.id
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        senderName.includes(search) ||
        tx.receiverName.includes(search);

      return (
        matchesStatus &&
        matchesSearch
      );
    });

  // ===================================================
  // Statistics
  // ===================================================

  const totalCount =
    remittances.length;

  const pendingCount =
    remittances.filter(
      (x) =>
        x.status === "در انتظار" ||
        x.status === "در حال پردازش" ||
        x.status === "آماده پرداخت"
    ).length;

  const completedCount =
    remittances.filter(
      (x) =>
        x.status === "پرداخت شد"
    ).length;

  const totalCommission =
    remittances.reduce(
      (sum, x) =>
        sum + x.commission,
      0
    );

  // ===================================================
  // UI
  // ===================================================

  return (
    <div
      dir="rtl"
      className="space-y-6 p-6 bg-gray-50 min-h-screen"
    >

      {/* Header */}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          حواله‌جات
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          مدیریت ارسال، دریافت و انتقال حساب به حساب
        </p>
      </div>

      {/* Statistics */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            کل حواله‌ها
          </p>

          <p className="text-2xl font-bold mt-2">
            {totalCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            در انتظار
          </p>

          <p className="text-2xl font-bold mt-2">
            {pendingCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            پرداخت‌شده
          </p>

          <p className="text-2xl font-bold mt-2">
            {completedCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            درآمد کارمزد
          </p>

          <p className="text-2xl font-bold mt-2">
            {formatNumber(totalCommission)}
          </p>
        </div>

      </div>

      {/* Register New Remittance */}

      <div className="bg-white border rounded-2xl shadow-sm p-6">

        <h2 className="text-xl font-bold text-gray-800 mb-6">
          ثبت حواله جدید
        </h2>

        {/* Basic Info */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

          <div>
            <label className="block font-bold text-sm mb-2">
              شماره سند
            </label>

            <input
              value="خودکار هنگام ثبت"
              readOnly
              className="w-full h-12 border rounded-xl px-4 bg-gray-100"
            />
          </div>

          <div>
            <label className="block font-bold text-sm mb-2">
              تاریخ و ساعت
            </label>

            <input
              value={new Date().toLocaleString(
                "fa-IR"
              )}
              readOnly
              className="w-full h-12 border rounded-xl px-4 bg-gray-100"
            />
          </div>

          <div>
            <label className="block font-bold text-sm mb-2">
              نوع حواله
            </label>

            <select
              value={remittanceType}
              onChange={(e) =>
                setRemittanceType(
                  e.target.value as RemittanceType
                )
              }
              className="w-full h-12 border rounded-xl px-4 bg-white"
            >
              <option value="ارسال">
                ارسال حواله
              </option>

              <option value="دریافت">
                دریافت حواله
              </option>

              <option value="حساب به حساب">
                حساب به حساب
              </option>
            </select>
          </div>

        </div>

        {/* Sender / Receiver */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Sender */}

          <div className="border rounded-xl p-5">

            <h3 className="font-bold text-lg mb-5">
              اطلاعات فرستنده
            </h3>

            <div className="space-y-4">

              <div>
                <label className="block font-bold text-sm mb-2">
                  مشتری فرستنده
                </label>

                <select
                  value={senderId}
                  onChange={(e) =>
                    setSenderId(
                      e.target.value
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                >
                  <option value="">
                    انتخاب مشتری
                  </option>

                  {customers.map(
                    (customer, index) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {index + 1}.{" "}
                        {customer.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-sm mb-2">
                  ارز حواله
                </label>

                <select
                  value={currency}
                  onChange={(e) =>
                    setCurrency(
                      e.target.value as Currency
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                >
                  {currencies.map(
                    (cur) => (
                      <option
                        key={cur}
                        value={cur}
                      >
                        {currencyLabels[cur]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-sm mb-2">
                  مبلغ حواله
                </label>

                <input
                  type="number"
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                  placeholder="مبلغ را وارد کنید"
                />
              </div>

              <div>
                <label className="block font-bold text-sm mb-2">
                  روش پرداخت
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as
                        | "نقدی"
                        | "حساب مشتری"
                        | "بانکی"
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                >
                  <option value="نقدی">
                    نقدی
                  </option>

                  <option value="حساب مشتری">
                    حساب مشتری
                  </option>

                  <option value="بانکی">
                    بانکی
                  </option>
                </select>
              </div>

            </div>

          </div>

          {/* Receiver */}

          <div className="border rounded-xl p-5">

            <h3 className="font-bold text-lg mb-5">
              اطلاعات گیرنده
            </h3>

            <div className="space-y-4">

              <div>
                <label className="block font-bold text-sm mb-2">
                  نام گیرنده
                </label>

                <input
                  value={receiverName}
                  onChange={(e) =>
                    setReceiverName(
                      e.target.value
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                />
              </div>

              <div>
                <label className="block font-bold text-sm mb-2">
                  شماره تماس گیرنده
                </label>

                <input
                  value={receiverPhone}
                  onChange={(e) =>
                    setReceiverPhone(
                      e.target.value
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block font-bold text-sm mb-2">
                    کشور
                  </label>

                  <input
                    value={receiverCountry}
                    onChange={(e) =>
                      setReceiverCountry(
                        e.target.value
                      )
                    }
                    className="w-full h-12 border rounded-xl px-4"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sm mb-2">
                    شهر
                  </label>

                  <input
                    value={receiverCity}
                    onChange={(e) =>
                      setReceiverCity(
                        e.target.value
                      )
                    }
                    className="w-full h-12 border rounded-xl px-4"
                  />
                </div>

              </div>

              <div>
                <label className="block font-bold text-sm mb-2">
                  روش دریافت
                </label>

                <select
                  value={
                    paymentMethodAtDestination
                  }
                  onChange={(e) =>
                    setPaymentMethodAtDestination(
                      e.target.value as
                        | "نقدی"
                        | "حساب مشتری"
                        | "بانکی"
                        | ""
                    )
                  }
                  className="w-full h-12 border rounded-xl px-4"
                >
                  <option value="">
                    انتخاب روش دریافت
                  </option>

                  <option value="نقدی">
                    نقدی
                  </option>

                  <option value="حساب مشتری">
                    حساب مشتری
                  </option>

                  <option value="بانکی">
                    بانکی
                  </option>
                </select>
              </div>

            </div>

          </div>

        </div>

        {/* Financial */}

        <div className="border rounded-xl p-5 mt-6">

          <h3 className="font-bold text-lg mb-5">
            اطلاعات مالی حواله
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

            <div>
              <label className="block font-bold text-sm mb-2">
                مبلغ اصلی حواله
              </label>

              <input
                value={
                  amountNumber
                    ? formatNumber(
                        amountNumber
                      )
                    : "0"
                }
                readOnly
                className="w-full h-12 border rounded-xl px-4 bg-gray-100"
              />
            </div>

            <div>
              <label className="block font-bold text-sm mb-2">
                کارمزد
              </label>

              <input
                type="number"
                value={commission}
                onChange={(e) =>
                  setCommission(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-4"
              />
            </div>

            <div>
              <label className="block font-bold text-sm mb-2">
                ارز کارمزد
              </label>

              <select
                value={commissionCurrency}
                onChange={(e) =>
                  setCommissionCurrency(
                    e.target.value as Currency
                  )
                }
                className="w-full h-12 border rounded-xl px-4"
              >
                {currencies.map(
                  (cur) => (
                    <option
                      key={cur}
                      value={cur}
                    >
                      {currencyLabels[cur]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-sm mb-2">
                مبلغ کل دریافتی
              </label>

              <input
                value={`${formatNumber(
                  totalReceived
                )} ${currencyLabels[currency]}`}
                readOnly
                className="w-full h-12 border rounded-xl px-4 bg-gray-100 font-bold"
              />
            </div>

          </div>

        </div>

        {/* Payment */}

        <div className="border rounded-xl p-5 mt-6">

          <h3 className="font-bold text-lg mb-5">
            اطلاعات پرداخت
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <div>
              <label className="block font-bold text-sm mb-2">
                مبلغ پرداخت
              </label>

              <input
                type="number"
                value={paidAmount}
                onChange={(e) =>
                  setPaidAmount(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-4"
              />
            </div>

            <div>
              <label className="block font-bold text-sm mb-2">
                ارز پرداخت
              </label>

              <select
                value={paidCurrency}
                onChange={(e) =>
                  setPaidCurrency(
                    e.target.value as Currency
                  )
                }
                className="w-full h-12 border rounded-xl px-4"
              >
                {currencies.map(
                  (cur) => (
                    <option
                      key={cur}
                      value={cur}
                    >
                      {currencyLabels[cur]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-sm mb-2">
                توضیحات پرداخت
              </label>

              <input
                value={paymentNote}
                onChange={(e) =>
                  setPaymentNote(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-4"
              />
            </div>

          </div>

        </div>

        {/* Note */}

        <div className="mt-6">

          <label className="block font-bold text-sm mb-2">
            یادداشت
          </label>

          <textarea
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
            rows={3}
            className="w-full border rounded-xl px-4 py-3"
            placeholder="یادداشت اختیاری"
          />

        </div>

        {/* Submit */}

        <button
          onClick={submitRemittance}
          className="w-full h-14 mt-6 rounded-xl bg-[#092F3A] text-white font-bold hover:bg-[#0a4652] transition"
        >
          ثبت حواله
        </button>

      </div>

      {/* Search / Filter */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex flex-col md:flex-row gap-4">

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="جستجو بر اساس سند، فرستنده یا گیرنده"
            className="flex-1 h-12 border rounded-xl px-4"
          />

          <select
            value={activeStatus}
            onChange={(e) =>
              setActiveStatus(
                e.target.value as
                  | "همه"
                  | RemittanceStatus
              )
            }
            className="h-12 border rounded-xl px-4"
          >
            <option value="همه">
              همه وضعیت‌ها
            </option>

            <option value="در انتظار">
              در انتظار
            </option>

            <option value="در حال پردازش">
              در حال پردازش
            </option>

            <option value="آماده پرداخت">
              آماده پرداخت
            </option>

            <option value="پرداخت شد">
              پرداخت شد
            </option>

            <option value="لغو شد">
              لغو شد
            </option>

            <option value="برگشت داده شد">
              برگشت داده شد
            </option>
          </select>

        </div>

      </div>

      {/* Remittance Table */}

      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">

        <div className="p-5">

          <h2 className="text-lg font-bold">
            آخرین حواله‌ها
          </h2>

        </div>

        <table className="min-w-full text-sm">

          <thead className="bg-gray-50">

            <tr>

              <th className="px-4 py-3 text-right font-bold">
                سند
              </th>

              <th className="px-4 py-3 text-right font-bold">
                تاریخ
              </th>

              <th className="px-4 py-3 text-right font-bold">
                نوع
              </th>

              <th className="px-4 py-3 text-right font-bold">
                فرستنده
              </th>

              <th className="px-4 py-3 text-right font-bold">
                گیرنده
              </th>

              <th className="px-4 py-3 text-right font-bold">
                مبلغ
              </th>

              <th className="px-4 py-3 text-right font-bold">
                کارمزد
              </th>

              <th className="px-4 py-3 text-right font-bold">
                وضعیت
              </th>

              <th className="px-4 py-3 text-right font-bold">
                عملیات
              </th>

            </tr>

          </thead>

          <tbody>

            {filteredRemittances.length === 0 ? (

              <tr>

                <td
                  colSpan={9}
                  className="text-center py-10 text-gray-400"
                >
                  هنوز حواله‌ای ثبت نشده است.
                </td>

              </tr>

            ) : (

              filteredRemittances.map(
                (tx) => (

                  <tr
                    key={tx.id}
                    className="border-t hover:bg-gray-50"
                  >

                    <td className="px-4 py-3 font-mono text-xs">
                      {tx.id}
                    </td>

                    <td className="px-4 py-3">
                      {new Date(
                        tx.date
                      ).toLocaleString(
                        "fa-IR"
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {tx.type}
                    </td>

                    <td className="px-4 py-3">
                      {getCustomerName(
                        customers,
                        tx.senderId
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {tx.receiverName}
                    </td>

                    <td className="px-4 py-3 font-bold">
                      {formatNumber(
                        tx.amount
                      )}{" "}
                      {
                        currencyLabels[
                          tx.currency
                        ]
                      }
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(
                        tx.commission
                      )}{" "}
                      {
                        currencyLabels[
                          tx.commissionCurrency
                        ]
                      }
                    </td>

                    <td className="px-4 py-3">
                      {tx.status}
                    </td>

                    <td className="px-4 py-3">

                      <div className="flex flex-wrap gap-2">

                        <button
                          onClick={() =>
                            setViewRemittance(
                              tx
                            )
                          }
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg"
                        >
                          مشاهده
                        </button>

                        <button
                          onClick={() =>
                            printReceipt(
                              tx
                            )
                          }
                          className="px-3 py-1.5 bg-gray-100 rounded-lg"
                        >
                          چاپ
                        </button>

                        <button
                          onClick={() =>
                            sendWhatsAppReceipt(
                              tx
                            )
                          }
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg"
                        >
                          WhatsApp
                        </button>

                        <button
                          onClick={() =>
                            copyReceipt(
                              tx
                            )
                          }
                          className="px-3 py-1.5 bg-gray-100 rounded-lg"
                        >
                          کپی رسید
                        </button>

                        <select
                          value={tx.status}
                          onChange={(e) =>
                            changeStatus(
                              tx.id,
                              e.target
                                .value as RemittanceStatus
                            )
                          }
                          className="border rounded-lg px-2 py-1.5"
                        >
                          <option value="در انتظار">
                            در انتظار
                          </option>

                          <option value="در حال پردازش">
                            در حال پردازش
                          </option>

                          <option value="آماده پرداخت">
                            آماده پرداخت
                          </option>

                          <option value="پرداخت شد">
                            پرداخت شد
                          </option>

                          <option value="لغو شد">
                            لغو شد
                          </option>

                          <option value="برگشت داده شد">
                            برگشت داده شد
                          </option>
                        </select>

                      </div>

                    </td>

                  </tr>

                )
              )

            )}

          </tbody>

        </table>

      </div>

      {/* Customer Balances */}

      <div className="bg-white border rounded-xl shadow-sm p-5">

        <h2 className="text-lg font-bold mb-4">
          موجودی فعلی مشتریان
        </h2>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-gray-50">

              <tr>

                <th className="px-4 py-3 text-right font-bold">
                  مشتری
                </th>

                {currencies.map(
                  (cur) => (
                    <th
                      key={cur}
                      className="px-4 py-3 text-right font-bold"
                    >
                      {
                        currencyLabels[
                          cur
                        ]
                      }
                    </th>
                  )
                )}

              </tr>

            </thead>

            <tbody>

              {customers.map(
                (customer) => {

                  const balance =
                    liveBalances[
                      customer.id
                    ];

                  return (
                    <tr
                      key={customer.id}
                      className="border-t"
                    >

                      <td className="px-4 py-3 font-bold">
                        {customer.name}
                      </td>

                      {currencies.map(
                        (cur) => (
                          <td
                            key={cur}
                            className="px-4 py-3"
                          >
                            {formatNumber(
                              balance[
                                cur
                              ] || 0
                            )}
                          </td>
                        )
                      )}

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* View Modal */}

      {viewRemittance && (

        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() =>
            setViewRemittance(null)
          }
        >

          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2 className="text-xl font-bold mb-5">
              جزئیات حواله
            </h2>

            <div className="space-y-3 text-sm">

              <p>
                <strong>شماره سند:</strong>{" "}
                {viewRemittance.id}
              </p>

              <p>
                <strong>نوع حواله:</strong>{" "}
                {viewRemittance.type}
              </p>

              <p>
                <strong>تاریخ:</strong>{" "}
                {new Date(
                  viewRemittance.date
                ).toLocaleString(
                  "fa-IR"
                )}
              </p>

              <p>
                <strong>فرستنده:</strong>{" "}
                {getCustomerName(
                  customers,
                  viewRemittance.senderId
                )}
              </p>

              <p>
                <strong>گیرنده:</strong>{" "}
                {viewRemittance.receiverName}
              </p>

              <p>
                <strong>شماره گیرنده:</strong>{" "}
                {viewRemittance.receiverPhone ||
                  "-"}
              </p>

              <p>
                <strong>کشور:</strong>{" "}
                {viewRemittance.receiverCountry ||
                  "-"}
              </p>

              <p>
                <strong>شهر:</strong>{" "}
                {viewRemittance.receiverCity ||
                  "-"}
              </p>

              <p>
                <strong>مبلغ حواله:</strong>{" "}
                {formatNumber(
                  viewRemittance.amount
                )}{" "}
                {
                  currencyLabels[
                    viewRemittance.currency
                  ]
                }
              </p>

              <p>
                <strong>کارمزد:</strong>{" "}
                {formatNumber(
                  viewRemittance.commission
                )}{" "}
                {
                  currencyLabels[
                    viewRemittance.commissionCurrency
                  ]
                }
              </p>

              <p>
                <strong>مبلغ کل:</strong>{" "}
                {formatNumber(
                  viewRemittance.totalReceived
                )}{" "}
                {
                  currencyLabels[
                    viewRemittance.currency
                  ]
                }
              </p>

              <p>
                <strong>روش پرداخت:</strong>{" "}
                {viewRemittance.paymentMethod}
              </p>

              <p>
                <strong>وضعیت:</strong>{" "}
                {viewRemittance.status}
              </p>

              <p>
                <strong>یادداشت:</strong>{" "}
                {viewRemittance.note || "-"}
              </p>

            </div>

            <div className="flex flex-wrap gap-2 mt-6">

              <button
                onClick={() =>
                  printReceipt(
                    viewRemittance
                  )
                }
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                چاپ رسید
              </button>

              <button
                onClick={() =>
                  sendWhatsAppReceipt(
                    viewRemittance
                  )
                }
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg"
              >
                ارسال به WhatsApp
              </button>

              <button
                onClick={() =>
                  copyReceipt(
                    viewRemittance
                  )
                }
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg"
              >
                کپی رسید
              </button>

              <button
                onClick={() =>
                  setViewRemittance(null)
                }
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                بستن
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
