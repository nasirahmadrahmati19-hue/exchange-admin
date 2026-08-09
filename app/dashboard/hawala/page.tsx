```tsx
"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type HawalaStatus = "pending" | "paid" | "cancelled";

type Currency =
  | "AFN"
  | "IRR"
  | "USD"
  | "EUR"
  | "PKR";

interface Customer {
  id: string;
  name: string;
  phone: string;
  tazkira: string;
}

interface Hawala {
  id: string;
  number: string;
  date: string;
  time: string;

  customerId: string;
  customerName: string;

  currency: Currency;
  amount: number;
  fee: number;
  totalAmount: number;

  destination: string;

  receiverName: string;
  receiverPhone: string;

  note: string;
  status: HawalaStatus;

  paidAt?: string;
  cancelReason?: string;
}

interface HawalaForm {
  customerId: string;

  currency: Currency;
  amount: string;
  fee: string;

  destination: string;

  receiverName: string;
  receiverPhone: string;

  note: string;
}

const currencies: {
  value: Currency;
  label: string;
}[] = [
  { value: "AFN", label: "افغانی" },
  { value: "IRR", label: "تومان" },
  { value: "USD", label: "دالر" },
  { value: "EUR", label: "یورو" },
  { value: "PKR", label: "کلدار" }
];

const destinations = [
  "هرات",
  "کابل",
  "مزار شریف",
  "کندهار",
  "ننگرهار",
  "قندوز",
  "بدخشان",
  "تخار",
  "بغلان",
  "فاریاب",
  "غور",
  "بادغیس",
  "فراه",
  "نیمروز",
  "هلمند",
  "غزنی",
  "پکتیا",
  "خوست",
  "لغمان",
  "کنر",
  "بلخ",
  "سمنگان",
  "سرپل",
  "جوزجان",
  "دایکندی",
  "ارزگان",
  "زابل",
  "کاپیسا",
  "پروان",
  "پنجشیر",
  "لوگر",
  "میدان وردک",
  "بامیان"
];

const statusLabels: Record<HawalaStatus, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  cancelled: "لغوشده"
};

const emptyForm: HawalaForm = {
  customerId: "",
  currency: "AFN",
  amount: "",
  fee: "",
  destination: "هرات",
  receiverName: "",
  receiverPhone: "",
  note: ""
};

const initialCustomers: Customer[] = [
  {
    id: "C-001",
    name: "احمد احمدی",
    phone: "0700000000",
    tazkira: "1398-123456"
  },
  {
    id: "C-002",
    name: "ولی ولی",
    phone: "0777777777",
    tazkira: "1390-555555"
  },
  {
    id: "C-003",
    name: "محمد محمدی",
    phone: "0788888888",
    tazkira: "1395-222222"
  }
];

const initialHawalas: Hawala[] = [
  {
    id: "1",
    number: "HW-0001",
    date: "1405/05/18",
    time: "10:30",

    customerId: "C-001",
    customerName: "احمد احمدی",

    currency: "AFN",
    amount: 10000,
    fee: 200,
    totalAmount: 10200,

    destination: "کابل",

    receiverName: "محمود محمودی",
    receiverPhone: "0788888888",

    note: "",
    status: "pending"
  },
  {
    id: "2",
    number: "HW-0002",
    date: "1405/05/17",
    time: "16:10",

    customerId: "C-002",
    customerName: "ولی ولی",

    currency: "USD",
    amount: 500,
    fee: 5,
    totalAmount: 505,

    destination: "هرات",

    receiverName: "کریم کریمی",
    receiverPhone: "0766666666",

    note: "",
    status: "paid",

    paidAt: "1405/05/17 — 16:45"
  },
  {
    id: "3",
    number: "HW-0003",
    date: "1405/05/16",
    time: "11:20",

    customerId: "C-003",
    customerName: "محمد محمدی",

    currency: "IRR",
    amount: 2000000,
    fee: 50000,
    totalAmount: 2050000,

    destination: "مزار شریف",

    receiverName: "حسن حسینی",
    receiverPhone: "0701111111",

    note: "حواله لغو شده",
    status: "cancelled",

    cancelReason: "درخواست مشتری"
  }
];

const styles = `
  .hawala-app {
    min-height: 100vh;
    background: #f5f6f8;
    padding: 24px;
    color: #111827;
    font-family: Tahoma, Arial, sans-serif;
  }

  .hawala-app *,
  .hawala-app *::before,
  .hawala-app *::after {
    box-sizing: border-box;
  }

  .hawala-container {
    max-width: 1250px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .header h1 {
    margin: 0 0 5px;
    font-size: 26px;
    font-weight: 900;
  }

  .muted {
    color: #6b7280;
    font-size: 13px;
  }

  /* پیگیری حواله */

  .tracking-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }

  .tracking-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 15px;
    padding: 17px;
  }

  .tracking-title {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .tracking-number {
    font-size: 24px;
    font-weight: 900;
  }

  .currency-box {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
    margin-top: 9px;
  }

  .currency-item {
    background: #f8fafc;
    border-radius: 8px;
    padding: 7px 5px;
    text-align: center;
  }

  .currency-code {
    display: block;
    color: #6b7280;
    font-size: 10px;
    margin-bottom: 3px;
  }

  .currency-value {
    display: block;
    font-size: 12px;
    font-weight: 900;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .tab {
    border: none;
    background: #e5e7eb;
    color: #374151;
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
  }

  .tab.active {
    background: #111827;
    color: white;
  }

  .card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px;
  }

  .section-title {
    margin: 8px 0 14px;
    font-size: 15px;
    font-weight: 900;
    border-right: 4px solid #2563eb;
    padding-right: 9px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .field label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 800;
    color: #374151;
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    background: white;
    color: #111827;
    outline: none;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: #2563eb;
  }

  .customer-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .summary {
    margin-top: 18px;
    padding: 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin: 7px 0;
    font-size: 14px;
  }

  .summary-row.total {
    border-top: 1px dashed #cbd5e1;
    margin-top: 12px;
    padding-top: 12px;
    font-size: 15px;
  }

  .actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    padding: 9px 13px;
    border-radius: 9px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-success {
    background: #16a34a;
    color: white;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-secondary {
    background: #e5e7eb;
    color: #111827;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    text-align: right;
    padding: 11px 9px;
    color: #6b7280;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
  }

  td {
    padding: 11px 9px;
    border-bottom: 1px solid #f1f5f9;
    white-space: nowrap;
  }

  .badge {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 900;
  }

  .badge-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-paid {
    background: #dcfce7;
    color: #166534;
  }

  .badge-cancelled {
    background: #fee2e2;
    color: #991b1b;
  }

  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    flex-wrap: wrap;
  }

  .search-bar input,
  .search-bar select {
    flex: 1;
    min-width: 180px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
  }

  .empty {
    padding: 35px;
    text-align: center;
    color: #6b7280;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, .65);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px;
    z-index: 50;
  }

  .modal {
    background: white;
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 16px;
    padding: 20px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .receipt {
    border: 1px dashed #94a3b8;
    border-radius: 12px;
    padding: 16px;
  }

  .receipt-title {
    text-align: center;
    font-weight: 900;
    margin-bottom: 15px;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin: 8px 0;
    font-size: 13px;
  }

  .divider {
    border-top: 1px dashed #cbd5e1;
    margin: 12px 0;
  }

  .toast {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #111827;
    color: white;
    padding: 11px 15px;
    border-radius: 10px;
    z-index: 100;
  }

  @media (max-width: 1000px) {
    .tracking-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 700px) {
    .tracking-grid {
      grid-template-columns: 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }

    .currency-box {
      grid-template-columns: repeat(5, 1fr);
      overflow-x: auto;
    }
  }

  @media print {
    body * {
      visibility: hidden;
    }

    .modal-overlay,
    .modal-overlay * {
      visibility: visible;
    }

    .modal-overlay {
      position: absolute;
      background: white;
    }
  }
`;

const badgeClass = (status: HawalaStatus) => {
  if (status === "paid") {
    return "badge badge-paid";
  }

  if (status === "cancelled") {
    return "badge badge-cancelled";
  }

  return "badge badge-pending";
};

const currencyLabel = (currency: Currency) => {
  return (
    currencies.find(
      item => item.value === currency
    )?.label || currency
  );
};

export default function HawalaPage() {
  const [activeTab, setActiveTab] =
    useState<"new" | "current" | "history">("new");

  const [hawalas, setHawalas] =
    useState<Hawala[]>(initialHawalas);

  const [customers, setCustomers] =
    useState<Customer[]>(initialCustomers);

  const [form, setForm] =
    useState<HawalaForm>(emptyForm);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selected, setSelected] =
    useState<Hawala | null>(null);

  const [settlement, setSettlement] =
    useState<Hawala | null>(null);

  const [cancelTarget, setCancelTarget] =
    useState<Hawala | null>(null);

  const [paidAmount, setPaidAmount] =
    useState("");

  const [cancelReason, setCancelReason] =
    useState("");

  const [toast, setToast] =
    useState("");

  const [showCustomerModal, setShowCustomerModal] =
    useState(false);

  const [newCustomer, setNewCustomer] =
    useState({
      name: "",
      phone: "",
      tazkira: ""
    });

  const amount =
    Number(form.amount || 0);

  const fee =
    Number(form.fee || 0);

  const totalAmount =
    amount + fee;

  /* ---------------------------
     پیگیری حواله
  ---------------------------- */

  const paidCount =
    hawalas.filter(
      item => item.status === "paid"
    ).length;

  const cancelledCount =
    hawalas.filter(
      item => item.status === "cancelled"
    ).length;

  const sentCount =
    hawalas.length;

  const currencyTotals = useMemo(() => {
    const result: Record<Currency, number> = {
      AFN: 0,
      IRR: 0,
      USD: 0,
      EUR: 0,
      PKR: 0
    };

    hawalas.forEach(item => {
      if (item.status !== "cancelled") {
        result[item.currency] += item.amount;
      }
    });

    return result;
  }, [hawalas]);

  const currentHawalas =
    hawalas.filter(
      item => item.status === "pending"
    );

  const filteredHistory =
    useMemo(() => {
      const q =
        search.trim().toLowerCase();

      return hawalas.filter(item => {
        const matchesStatus =
          statusFilter === "all" ||
          item.status === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!q) {
          return true;
        }

        const fields = [
          item.number,
          item.customerName,
          item.receiverName,
          item.receiverPhone,
          item.destination,
          item.currency
        ];

        return fields.some(field =>
          String(field || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }, [
      hawalas,
      search,
      statusFilter
    ]);

  const showToast = (
    message: string
  ) => {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 3000);
  };

  const updateForm = (
    field: keyof HawalaForm,
    value: string
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /* ---------------------------
     افزودن مشتری
  ---------------------------- */

  const addCustomer = () => {
    if (!newCustomer.name.trim()) {
      showToast(
        "نام مشتری را وارد کنید."
      );

      return;
    }

    if (!newCustomer.phone.trim()) {
      showToast(
        "شماره تماس مشتری را وارد کنید."
      );

      return;
    }

    const customer: Customer = {
      id: `C-${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      tazkira: newCustomer.tazkira
    };

    setCustomers(prev => [
      ...prev,
      customer
    ]);

    setForm(prev => ({
      ...prev,
      customerId: customer.id
    }));

    setNewCustomer({
      name: "",
      phone: "",
      tazkira: ""
    });

    setShowCustomerModal(false);

    showToast(
      "مشتری با موفقیت اضافه شد."
    );
  };

  /* ---------------------------
     ثبت حواله
  ---------------------------- */

  const makeHawalaNumber = () => {
    const nextNumber =
      hawalas.length + 1;

    return `HW-${String(
      nextNumber
    ).padStart(4, "0")}`;
  };

  const submitForm = () => {
    if (!form.customerId) {
      showToast(
        "مشتری را انتخاب کنید."
      );

      return;
    }

    if (amount <= 0) {
      showToast(
        "مبلغ حواله باید بیشتر از صفر باشد."
      );

      return;
    }

    if (fee < 0) {
      showToast(
        "کارمزد نمی‌تواند منفی باشد."
      );

      return;
    }

    if (!form.receiverName.trim()) {
      showToast(
        "نام حواله‌گیرنده را وارد کنید."
      );

      return;
    }

    if (!form.receiverPhone.trim()) {
      showToast(
        "شماره تماس حواله‌گیرنده را وارد کنید."
      );

      return;
    }

    const customer =
      customers.find(
        item =>
          item.id ===
          form.customerId
      );

    if (!customer) {
      showToast(
        "مشتری انتخاب‌شده پیدا نشد."
      );

      return;
    }

    const now = new Date();

    const newHawala: Hawala = {
      id: String(Date.now()),

      number: makeHawalaNumber(),

      date: now.toLocaleDateString(
        "fa-IR"
      ),

      time: now.toLocaleTimeString(
        "fa-IR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      ),

      customerId:
        customer.id,

      customerName:
        customer.name,

      currency:
        form.currency,

      amount,

      fee,

      totalAmount,

      destination:
        form.destination,

      receiverName:
        form.receiverName,

      receiverPhone:
        form.receiverPhone,

      note:
        form.note,

      status: "pending"
    };

    setHawalas(prev => [
      newHawala,
      ...prev
    ]);

    setForm(emptyForm);

    setActiveTab("current");

    showToast(
      "حواله با موفقیت ثبت شد."
    );
  };

  /* ---------------------------
     پرداخت حواله
  ---------------------------- */

  const openSettlement = (
    item: Hawala
  ) => {
    setSettlement(item);

    setPaidAmount(
      String(item.amount)
    );
  };

  const confirmSettlement = () => {
    if (!settlement) {
      return;
    }

    const amountPaid =
      Number(
        paidAmount ||
          settlement.amount
      );

    if (amountPaid <= 0) {
      showToast(
        "مبلغ پرداخت‌شده معتبر نیست."
      );

      return;
    }

    const now = new Date();

    const date =
      now.toLocaleDateString(
        "fa-IR"
      );

    const time =
      now.toLocaleTimeString(
        "fa-IR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    setHawalas(prev =>
      prev.map(item =>
        item.id ===
        settlement.id
          ? {
              ...item,
              status: "paid",
              paidAt:
                `${date} — ${time}`
            }
          : item
      )
    );

    setSettlement(null);

    showToast(
      "حواله با موفقیت پرداخت شد."
    );
  };

  /* ---------------------------
     لغو حواله
  ---------------------------- */

  const openCancel = (
    item: Hawala
  ) => {
    setCancelTarget(item);

    setCancelReason("");
  };

  const confirmCancel = () => {
    if (!cancelTarget) {
      return;
    }

    if (!cancelReason.trim()) {
      showToast(
        "دلیل لغو حواله را وارد کنید."
      );

      return;
    }

    setHawalas(prev =>
      prev.map(item =>
        item.id ===
        cancelTarget.id
          ? {
              ...item,
              status:
                "cancelled",
              cancelReason
            }
          : item
      )
    );

    setCancelTarget(null);

    showToast(
      "حواله لغو شد."
    );
  };

  return (
    <div
      className="hawala-app"
      dir="rtl"
    >
      <style>
        {styles}
      </style>

      <div className="hawala-container">

        {/* Header */}

        <div className="header">

          <div>
            <h1>
              🏦 حواله‌جات
            </h1>

            <div className="muted">
              ثبت، پیگیری و مدیریت حواله‌ها
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() =>
              setActiveTab("new")
            }
          >
            ➕ حواله جدید
          </button>

        </div>

        {/* -----------------------
            پیگیری حواله
        ----------------------- */}

        <div className="tracking-grid">

          <div className="tracking-card">
            <div className="tracking-title">
              حواله پرداخت‌شده
            </div>

            <div className="tracking-number">
              {paidCount.toLocaleString(
                "fa-IR"
              )}
            </div>
          </div>

          <div className="tracking-card">
            <div className="tracking-title">
              حواله لغوشده
            </div>

            <div className="tracking-number">
              {cancelledCount.toLocaleString(
                "fa-IR"
              )}
            </div>
          </div>

          <div className="tracking-card">
            <div className="tracking-title">
              حواله ارسال‌شده
            </div>

            <div className="tracking-number">
              {sentCount.toLocaleString(
                "fa-IR"
              )}
            </div>
          </div>

          {/* مجموع حواله‌ها */}

          <div className="tracking-card">

            <div className="tracking-title">
              مجموع حواله‌ها
            </div>

            <div className="currency-box">

              {currencies.map(
                currency => (
                  <div
                    className="currency-item"
                    key={
                      currency.value
                    }
                  >
                    <span className="currency-code">
                      {
                        currency.label
                      }
                    </span>

                    <span className="currency-value">
                      {currencyTotals[
                        currency.value
                      ].toLocaleString(
                        "fa-IR"
                      )}
                    </span>
                  </div>
                )
              )}

            </div>

          </div>

        </div>

        {/* Tabs */}

        <div className="tabs">

          <button
            className={
              activeTab === "new"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("new")
            }
          >
            ➕ حواله جدید
          </button>

          <button
            className={
              activeTab === "current"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("current")
            }
          >
            📋 پیگیری حواله
          </button>

          <button
            className={
              activeTab === "history"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("history")
            }
          >
            📜 تاریخچه
          </button>

        </div>

        {/* -----------------------
            ثبت حواله جدید
        ----------------------- */}

        {activeTab === "new" && (
          <div className="card">

            <div className="section-title">
              معلومات حواله
            </div>

            <div className="grid">

              {/* مشتری */}

              <div className="field">

                <label>
                  مشتری
                </label>

                <div className="customer-row">

                  <select
                    value={
                      form.customerId
                    }
                    onChange={e =>
                      updateForm(
                        "customerId",
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      انتخاب مشتری
                    </option>

                    {customers.map(
                      customer => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {
                            customer.name
                          } —{" "}
                          {
                            customer.phone
                          }
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setShowCustomerModal(
                        true
                      )
                    }
                  >
                    ➕ مشتری
                  </button>

                </div>

              </div>

              {/* ارز */}

              <div className="field">

                <label>
                  ارز حواله‌شده
                </label>

                <select
                  value={
                    form.currency
                  }
                  onChange={e =>
                    updateForm(
                      "currency",
                      e.target.value
                    )
                  }
                >
                  {currencies.map(
                    currency => (
                      <option
                        key={
                          currency.value
                        }
                        value={
                          currency.value
                        }
                      >
                        {
                          currency.label
                        }{" "}
                        (
                        {
                          currency.value
                        }
                        )
                      </option>
                    )
                  )}
                </select>

              </div>

              {/* مبلغ */}

              <div className="field">

                <label>
                  مبلغ حواله
                </label>

                <input
                  type="number"
                  min="0"
                  value={
                    form.amount
                  }
                  onChange={e =>
                    updateForm(
                      "amount",
                      e.target.value
                    )
                  }
                  placeholder="مثلاً 10000"
                />

              </div>

              {/* کارمزد */}

              <div className="field">

                <label>
                  کارمزد
                </label>

                <input
                  type="number"
                  min="0"
                  value={
                    form.fee
                  }
                  onChange={e =>
                    updateForm(
                      "fee",
                      e.target.value
                    )
                  }
                  placeholder="مثلاً 200"
                />

              </div>

              {/* مقصد */}

              <div className="field">

                <label>
                  مقصد حواله
                </label>

                <select
                  value={
                    form.destination
                  }
                  onChange={e =>
                    updateForm(
                      "destination",
                      e.target.value
                    )
                  }
                >
                  {destinations.map(
                    destination => (
                      <option
                        key={
                          destination
                        }
                        value={
                          destination
                        }
                      >
                        {
                          destination
                        }
                      </option>
                    )
                  )}
                </select>

              </div>

            </div>

            {/* حواله گیرنده */}

            <div className="section-title">
              معلومات حواله‌گیرنده
            </div>

            <div className="grid">

              <div className="field">

                <label>
                  نام حواله‌گیرنده
                </label>

                <input
                  value={
                    form.receiverName
                  }
                  onChange={e =>
                    updateForm(
                      "receiverName",
                      e.target.value
                    )
                  }
                  placeholder="نام و نام خانوادگی"
                />

              </div>

              <div className="field">

                <label>
                  شماره تماس حواله‌گیرنده
                </label>

                <input
                  value={
                    form.receiverPhone
                  }
                  onChange={e =>
                    updateForm(
                      "receiverPhone",
                      e.target.value
                    )
                  }
                  placeholder="07xxxxxxxx"
                />

              </div>

            </div>

            {/* یادداشت */}

            <div
              className="field"
              style={{
                marginTop: "14px"
              }}
            >

              <label>
                یادداشت
              </label>

              <textarea
                rows={3}
                value={
                  form.note
                }
                onChange={e =>
                  updateForm(
                    "note",
                    e.target.value
                  )
                }
                placeholder="اختیاری"
              />

            </div>

            {/* خلاصه */}

            <div className="summary">

              <div className="summary-row">

                <span>
                  مبلغ حواله
                </span>

                <strong>
                  {amount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    form.currency
                  }
                </strong>

              </div>

              <div className="summary-row">

                <span>
                  کارمزد
                </span>

                <strong>
                  {fee.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    form.currency
                  }
                </strong>

              </div>

              <div className="summary-row total">

                <span>
                  مجموع دریافتی
                </span>

                <strong>
                  {totalAmount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    form.currency
                  }
                </strong>

              </div>

            </div>

            <div
              className="actions"
              style={{
                marginTop: "18px"
              }}
            >

              <button
                className="btn btn-primary"
                onClick={
                  submitForm
                }
              >
                ثبت حواله
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setForm(
                    emptyForm
                  )
                }
              >
                پاک کردن
              </button>

            </div>

          </div>
        )}

        {/* -----------------------
            پیگیری حواله
        ----------------------- */}

        {activeTab === "current" && (
          <div className="card">

            <div className="section-title">
              حواله‌های در انتظار پرداخت
            </div>

            {currentHawalas.length ===
            0 ? (
              <div className="empty">
                هیچ حواله‌ای در انتظار پرداخت نیست.
              </div>
            ) : (
              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>
                      <th>
                        شماره حواله
                      </th>

                      <th>
                        مشتری
                      </th>

                      <th>
                        ارز
                      </th>

                      <th>
                        مبلغ
                      </th>

                      <th>
                        مقصد
                      </th>

                      <th>
                        حواله‌گیرنده
                      </th>

                      <th>
                        وضعیت
                      </th>

                      <th>
                        عملیات
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {currentHawalas.map(
                      item => (
                        <tr
                          key={
                            item.id
                          }
                        >

                          <td>
                            {
                              item.number
                            }
                          </td>

                          <td>
                            {
                              item.customerName
                            }
                          </td>

                          <td>
                            {
                              currencyLabel(
                                item.currency
                              )
                            }
                          </td>

                          <td>
                            {item.amount.toLocaleString(
                              "fa-IR"
                            )}
                          </td>

                          <td>
                            {
                              item.destination
                            }
                          </td>

                          <td>
                            {
                              item.receiverName
                            }
                          </td>

                          <td>
                            <span
                              className={
                                badgeClass(
                                  item.status
                                )
                              }
                            >
                              {
                                statusLabels[
                                  item.status
                                ]
                              }
                            </span>
                          </td>

                          <td>

                            <div className="actions">

                              <button
                                className="btn btn-secondary"
                                onClick={() =>
                                  setSelected(
                                    item
                                  )
                                }
                              >
                                مشاهده
                              </button>

                              <button
                                className="btn btn-success"
                                onClick={() =>
                                  openSettlement(
                                    item
                                  )
                                }
                              >
                                پرداخت
                              </button>

                              <button
                                className="btn btn-danger"
                                onClick={() =>
                                  openCancel(
                                    item
                                  )
                                }
                              >
                                لغو
                              </button>

                            </div>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        )}

        {/* -----------------------
            تاریخچه
        ----------------------- */}

        {activeTab === "history" && (
          <div className="card">

            <div className="section-title">
              تاریخچه حواله‌ها
            </div>

            <div className="search-bar">

              <input
                value={search}
                onChange={e =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="جستجو بر اساس شماره، مشتری، گیرنده، تماس یا مقصد..."
              />

              <select
                value={
                  statusFilter
                }
                onChange={e =>
                  setStatusFilter(
                    e.target.value
                  )
                }
              >

                <option value="all">
                  همه وضعیت‌ها
                </option>

                <option value="pending">
                  در انتظار پرداخت
                </option>

                <option value="paid">
                  پرداخت‌شده
                </option>

                <option value="cancelled">
                  لغوشده
                </option>

              </select>

            </div>

            {filteredHistory.length ===
            0 ? (
              <div className="empty">
                هیچ حواله‌ای پیدا نشد.
              </div>
            ) : (
              <div className="table-wrap">

                <table>

                  <thead>

                    <tr>

                      <th>
                        شماره
                      </th>

                      <th>
                        تاریخ
                      </th>

                      <th>
                        مشتری
                      </th>

                      <th>
                        ارز
                      </th>

                      <th>
                        مبلغ
                      </th>

                      <th>
                        مقصد
                      </th>

                      <th>
                        حواله‌گیرنده
                      </th>

                      <th>
                        وضعیت
                      </th>

                      <th>
                        عملیات
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredHistory.map(
                      item => (
                        <tr
                          key={
                            item.id
                          }
                        >

                          <td>
                            {
                              item.number
                            }
                          </td>

                          <td>
                            {
                              item.date
                            }
                          </td>

                          <td>
                            {
                              item.customerName
                            }
                          </td>

                          <td>
                            {
                              currencyLabel(
                                item.currency
                              )
                            }
                          </td>

                          <td>
                            {item.amount.toLocaleString(
                              "fa-IR"
                            )}
                          </td>

                          <td>
                            {
                              item.destination
                            }
                          </td>

                          <td>
                            {
                              item.receiverName
                            }
                          </td>

                          <td>
                            <span
                              className={
                                badgeClass(
                                  item.status
                                )
                              }
                            >
                              {
                                statusLabels[
                                  item.status
                                ]
                              }
                            </span>
                          </td>

                          <td>

                            <button
                              className="btn btn-secondary"
                              onClick={() =>
                                setSelected(
                                  item
                                )
                              }
                            >
                              مشاهده
                            </button>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        )}

      </div>

      {/* -----------------------
          افزودن مشتری
      ----------------------- */}

      {showCustomerModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowCustomerModal(
              false
            )
          }
        >

          <div
            className="modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h3 className="modal-title">
                افزودن مشتری
              </h3>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowCustomerModal(
                    false
                  )
                }
              >
                بستن
              </button>

            </div>

            <div className="grid">

              <div className="field">

                <label>
                  نام مشتری
                </label>

                <input
                  value={
                    newCustomer.name
                  }
                  onChange={e =>
                    setNewCustomer(
                      prev => ({
                        ...prev,
                        name:
                          e.target.value
                      })
                    )
                  }
                  placeholder="نام و نام خانوادگی"
                />

              </div>

              <div className="field">

                <label>
                  شماره تماس
                </label>

                <input
                  value={
                    newCustomer.phone
                  }
                  onChange={e =>
                    setNewCustomer(
                      prev => ({
                        ...prev,
                        phone:
                          e.target.value
                      })
                    )
                  }
                  placeholder="07xxxxxxxx"
                />

              </div>

              <div className="field">

                <label>
                  شماره تذکره
                </label>

                <input
                  value={
                    newCustomer.tazkira
                  }
                  onChange={e =>
                    setNewCustomer(
                      prev => ({
                        ...prev,
                        tazkira:
                          e.target.value
                      })
                    )
                  }
                  placeholder="اختیاری"
                />

              </div>

            </div>

            <div
              className="actions"
              style={{
                marginTop: "18px"
              }}
            >

              <button
                className="btn btn-primary"
                onClick={
                  addCustomer
                }
              >
                ذخیره مشتری
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowCustomerModal(
                    false
                  )
                }
              >
                انصراف
              </button>

            </div>

          </div>

        </div>
      )}

      {/* -----------------------
          مشاهده حواله
      ----------------------- */}

      {selected && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelected(null)
          }
        >

          <div
            className="modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h3 className="modal-title">
                جزئیات حواله{" "}
                {selected.number}
              </h3>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setSelected(null)
                }
              >
                بستن
              </button>

            </div>

            <div className="receipt">

              <div className="receipt-title">
                🧾 رسید حواله
              </div>

              <div className="receipt-row">
                <span>
                  شماره حواله
                </span>

                <strong>
                  {
                    selected.number
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  تاریخ
                </span>

                <strong>
                  {
                    selected.date
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  ساعت
                </span>

                <strong>
                  {
                    selected.time
                  }
                </strong>
              </div>

              <div className="divider" />

              <div className="receipt-row">
                <span>
                  مشتری
                </span>

                <strong>
                  {
                    selected.customerName
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  ارز حواله‌شده
                </span>

                <strong>
                  {
                    currencyLabel(
                      selected.currency
                    )
                  }{" "}
                  (
                  {
                    selected.currency
                  }
                  )
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  مبلغ حواله
                </span>

                <strong>
                  {selected.amount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    selected.currency
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  کارمزد
                </span>

                <strong>
                  {selected.fee.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    selected.currency
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  مجموع دریافتی
                </span>

                <strong>
                  {selected.totalAmount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    selected.currency
                  }
                </strong>
              </div>

              <div className="divider" />

              <div className="receipt-row">
                <span>
                  مقصد حواله
                </span>

                <strong>
                  {
                    selected.destination
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  حواله‌گیرنده
                </span>

                <strong>
                  {
                    selected.receiverName
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  شماره تماس
                </span>

                <strong>
                  {
                    selected.receiverPhone
                  }
                </strong>
              </div>

              <div className="receipt-row">
                <span>
                  وضعیت
                </span>

                <strong>
                  {
                    statusLabels[
                      selected.status
                    ]
                  }
                </strong>
              </div>

              {selected.paidAt && (
                <div className="receipt-row">
                  <span>
                    زمان پرداخت
                  </span>

                  <strong>
                    {
                      selected.paidAt
                    }
                  </strong>
                </div>
              )}

              {selected.cancelReason && (
                <div className="receipt-row">
                  <span>
                    دلیل لغو
                  </span>

                  <strong>
                    {
                      selected.cancelReason
                    }
                  </strong>
                </div>
              )}

              {selected.note && (
                <div className="receipt-row">
                  <span>
                    یادداشت
                  </span>

                  <strong>
                    {
                      selected.note
                    }
                  </strong>
                </div>
              )}

            </div>

            <div
              className="actions"
              style={{
                marginTop: "18px"
              }}
            >

              <button
                className="btn btn-primary"
                onClick={() =>
                  window.print()
                }
              >
                🖨 چاپ رسید
              </button>

              {selected.status ===
                "pending" && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      openSettlement(
                        selected
                      );

                      setSelected(
                        null
                      );
                    }}
                  >
                    پرداخت
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      openCancel(
                        selected
                      );

                      setSelected(
                        null
                      );
                    }}
                  >
                    لغو
                  </button>
                </>
              )}

            </div>

          </div>

        </div>
      )}

      {/* -----------------------
          پرداخت حواله
      ----------------------- */}

      {settlement && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSettlement(null)
          }
        >

          <div
            className="modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h3 className="modal-title">
                پرداخت حواله{" "}
                {
                  settlement.number
                }
              </h3>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setSettlement(
                    null
                  )
                }
              >
                بستن
              </button>

            </div>

            <div className="summary">

              <div className="summary-row">
                <span>
                  مشتری
                </span>

                <strong>
                  {
                    settlement.customerName
                  }
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  حواله‌گیرنده
                </span>

                <strong>
                  {
                    settlement.receiverName
                  }
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  مبلغ قابل پرداخت
                </span>

                <strong>
                  {settlement.amount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  {
                    settlement.currency
                  }
                </strong>
              </div>

            </div>

            <div
              className="field"
              style={{
                marginTop: "15px"
              }}
            >

              <label>
                مبلغ پرداخت‌شده
              </label>

              <input
                type="number"
                min="0"
                value={
                  paidAmount
                }
                onChange={e =>
                  setPaidAmount(
                    e.target.value
                  )
                }
              />

            </div>

            <div
              className="actions"
              style={{
                marginTop: "18px"
              }}
            >

              <button
                className="btn btn-success"
                onClick={
                  confirmSettlement
                }
              >
                تأیید پرداخت
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setSettlement(
                    null
                  )
                }
              >
                انصراف
              </button>

            </div>

          </div>

        </div>
      )}

      {/* -----------------------
          لغو حواله
      ----------------------- */}

      {cancelTarget && (
        <div
          className="modal-overlay"
          onClick={() =>
            setCancelTarget(
              null
            )
          }
        >

          <div
            className="modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h3 className="modal-title">
                لغو حواله{" "}
                {
                  cancelTarget.number
                }
              </h3>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setCancelTarget(
                    null
                  )
                }
              >
                بستن
              </button>

            </div>

            <div className="field">

              <label>
                دلیل لغو
              </label>

              <textarea
                rows={4}
                value={
                  cancelReason
                }
                onChange={e =>
                  setCancelReason(
                    e.target.value
                  )
                }
                placeholder="دلیل لغو حواله را وارد کنید..."
              />

            </div>

            <div
              className="actions"
              style={{
                marginTop: "18px"
              }}
            >

              <button
                className="btn btn-danger"
                onClick={
                  confirmCancel
                }
              >
                لغو حواله
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setCancelTarget(
                    null
                  )
                }
              >
                انصراف
              </button>

            </div>

          </div>

        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}

    </div>
  );
}
```
