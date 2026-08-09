"use client";

import { useMemo, useState } from "react";

type HawalaStatus = "sent" | "paid" | "cancelled";

type Currency = "AFN" | "IRR" | "USD" | "EUR" | "PKR";

interface Customer {
  id: string;
  name: string;
  phone: string;
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
  symbol: string;
}[] = [
  { value: "AFN", label: "افغانی", symbol: "؋" },
  { value: "IRR", label: "تومان", symbol: "تومان" },
  { value: "USD", label: "دالر", symbol: "$" },
  { value: "EUR", label: "یورو", symbol: "€" },
  { value: "PKR", label: "کلدار", symbol: "₨" },
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
  "بامیان",
];

const statusLabels: Record<HawalaStatus, string> = {
  sent: "ارسال‌شده",
  paid: "پرداخت‌شده",
  cancelled: "لغوشده",
};

const emptyForm: HawalaForm = {
  customerId: "",
  currency: "AFN",
  amount: "",
  fee: "",
  destination: "هرات",
  receiverName: "",
  receiverPhone: "",
  note: "",
};

const initialCustomers: Customer[] = [
  {
    id: "C-001",
    name: "احمد احمدی",
    phone: "0700000000",
  },
  {
    id: "C-002",
    name: "ولی ولی",
    phone: "0777777777",
  },
  {
    id: "C-003",
    name: "محمد محمدی",
    phone: "0788888888",
  },
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
    status: "sent",
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
    paidAt: "1405/05/17 — 16:45",
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
    note: "درخواست مشتری",
    status: "cancelled",
    cancelReason: "درخواست مشتری",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-AF").format(value);
}

function getCurrencyLabel(currency: Currency) {
  return currencies.find((item) => item.value === currency)?.label ?? currency;
}

function getCurrencySymbol(currency: Currency) {
  return currencies.find((item) => item.value === currency)?.symbol ?? "";
}

function getToday() {
  const date = new Date();

  return new Intl.DateTimeFormat("fa-AF", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTime() {
  return new Intl.DateTimeFormat("fa-AF", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function HawalaPage() {
  const [hawalas, setHawalas] = useState<Hawala[]>(initialHawalas);
  const [customers, setCustomers] =
    useState<Customer[]>(initialCustomers);

  const [form, setForm] = useState<HawalaForm>(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | HawalaStatus>(
    "all"
  );

  const [selectedHawala, setSelectedHawala] =
    useState<Hawala | null>(null);

  const [cancelReason, setCancelReason] = useState("");

  const totalSent = useMemo(
    () => hawalas.filter((item) => item.status === "sent").length,
    [hawalas]
  );

  const totalPaid = useMemo(
    () => hawalas.filter((item) => item.status === "paid").length,
    [hawalas]
  );

  const totalCancelled = useMemo(
    () => hawalas.filter((item) => item.status === "cancelled").length,
    [hawalas]
  );

  const currencyTotals = useMemo(() => {
    const result: Record<Currency, number> = {
      AFN: 0,
      IRR: 0,
      USD: 0,
      EUR: 0,
      PKR: 0,
    };

    hawalas.forEach((hawala) => {
      if (hawala.status !== "cancelled") {
        result[hawala.currency] += hawala.amount;
      }
    });

    return result;
  }, [hawalas]);

  const filteredHawalas = useMemo(() => {
    return hawalas.filter((hawala) => {
      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        searchText === "" ||
        hawala.number.toLowerCase().includes(searchText) ||
        hawala.customerName.toLowerCase().includes(searchText) ||
        hawala.receiverName.toLowerCase().includes(searchText) ||
        hawala.receiverPhone.includes(searchText);

      const matchesStatus =
        statusFilter === "all" || hawala.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [hawalas, search, statusFilter]);

  function updateForm<K extends keyof HawalaForm>(
    key: K,
    value: HawalaForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function generateHawalaNumber() {
    const maxNumber = hawalas.reduce((max, item) => {
      const number = Number(item.number.replace("HW-", ""));
      return Number.isNaN(number) ? max : Math.max(max, number);
    }, 0);

    return `HW-${String(maxNumber + 1).padStart(4, "0")}`;
  }

  function handleAddCustomer() {
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();

    if (!name) {
      alert("نام مشتری را وارد کنید.");
      return;
    }

    const newCustomer: Customer = {
      id: `C-${String(customers.length + 1).padStart(3, "0")}`,
      name,
      phone,
    };

    setCustomers((previous) => [...previous, newCustomer]);

    updateForm("customerId", newCustomer.id);

    setNewCustomerName("");
    setNewCustomerPhone("");
    setShowCustomerForm(false);
  }

  function handleCreateHawala() {
    if (!form.customerId) {
      alert("لطفاً مشتری را انتخاب کنید.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("مبلغ حواله را وارد کنید.");
      return;
    }

    if (!form.receiverName.trim()) {
      alert("نام حواله‌گیرنده را وارد کنید.");
      return;
    }

    if (!form.receiverPhone.trim()) {
      alert("شماره تماس حواله‌گیرنده را وارد کنید.");
      return;
    }

    const customer = customers.find(
      (item) => item.id === form.customerId
    );

    if (!customer) {
      alert("مشتری انتخاب‌شده پیدا نشد.");
      return;
    }

    const amount = Number(form.amount);
    const fee = Number(form.fee || 0);

    const newHawala: Hawala = {
      id: crypto.randomUUID(),
      number: generateHawalaNumber(),
      date: getToday(),
      time: getTime(),

      customerId: customer.id,
      customerName: customer.name,

      currency: form.currency,
      amount,
      fee,
      totalAmount: amount + fee,

      destination: form.destination,

      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),

      note: form.note.trim(),
      status: "sent",
    };

    setHawalas((previous) => [newHawala, ...previous]);

    setForm(emptyForm);
    setShowForm(false);
  }

  function markAsPaid(id: string) {
    setHawalas((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "paid",
              paidAt: `${getToday()} — ${getTime()}`,
            }
          : item
      )
    );

    setSelectedHawala(null);
  }

  function cancelHawala(id: string) {
    const reason = cancelReason.trim();

    if (!reason) {
      alert("دلیل لغو حواله را وارد کنید.");
      return;
    }

    setHawalas((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "cancelled",
              cancelReason: reason,
            }
          : item
      )
    );

    setCancelReason("");
    setSelectedHawala(null);
  }

  return (
    <main className="hawala-app" dir="rtl">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Tahoma,
            Arial,
            sans-serif;
          background: #f5f6f8;
          color: #172033;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .hawala-app {
          min-height: 100vh;
          padding: 24px;
          background: #f5f6f8;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }

        .title-area h1 {
          margin: 0 0 7px;
          font-size: 27px;
          font-weight: 800;
        }

        .title-area p {
          margin: 0;
          color: #687386;
          font-size: 14px;
        }

        .primary-button {
          border: 0;
          border-radius: 10px;
          padding: 12px 18px;
          background: #1769e0;
          color: white;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(23, 105, 224, 0.18);
        }

        .primary-button:hover {
          background: #1259c1;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 16px;
        }

        .summary-card {
          background: white;
          border: 1px solid #e6e9ef;
          border-radius: 14px;
          padding: 18px;
          min-height: 112px;
        }

        .summary-card .label {
          color: #6c7789;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .summary-card .value {
          font-size: 28px;
          font-weight: 800;
        }

        .summary-card.sent .value {
          color: #1769e0;
        }

        .summary-card.paid .value {
          color: #16834a;
        }

        .summary-card.cancelled .value {
          color: #d43b3b;
        }

        .summary-card.total .value {
          color: #202938;
        }

        .currency-card {
          background: white;
          border: 1px solid #e6e9ef;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 20px;
        }

        .currency-card-title {
          font-weight: 800;
          margin-bottom: 16px;
        }

        .currency-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .currency-item {
          border: 1px solid #e7eaf0;
          background: #fafbfc;
          border-radius: 10px;
          padding: 13px;
        }

        .currency-name {
          color: #707b8c;
          font-size: 12px;
          margin-bottom: 7px;
        }

        .currency-value {
          font-size: 18px;
          font-weight: 800;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #e6e9ef;
          padding: 14px;
          border-radius: 14px;
          margin-bottom: 14px;
        }

        .search-input {
          flex: 1;
          min-width: 220px;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #d9dee7;
          border-radius: 9px;
          background: white;
          padding: 11px 12px;
          outline: none;
          color: #202938;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #1769e0;
          box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.08);
        }

        .filter-button {
          border: 1px solid #d9dee7;
          background: white;
          border-radius: 9px;
          padding: 10px 14px;
          color: #4c5668;
        }

        .filter-button.active {
          border-color: #1769e0;
          background: #edf4ff;
          color: #1769e0;
          font-weight: 700;
        }

        .table-card {
          background: white;
          border: 1px solid #e6e9ef;
          border-radius: 14px;
          overflow: hidden;
        }

        .table-header {
          padding: 16px 18px;
          border-bottom: 1px solid #e8ebf0;
          font-weight: 800;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 950px;
        }

        th {
          background: #fafbfc;
          color: #687386;
          font-size: 12px;
          font-weight: 700;
          text-align: right;
          padding: 13px 15px;
          border-bottom: 1px solid #e8ebf0;
          white-space: nowrap;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #edf0f4;
          font-size: 13px;
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .hawala-number {
          font-weight: 800;
          color: #1769e0;
        }

        .customer-name {
          font-weight: 700;
        }

        .sub-text {
          color: #7a8493;
          font-size: 11px;
          margin-top: 4px;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 20px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .status.sent {
          background: #eaf2ff;
          color: #1769e0;
        }

        .status.paid {
          background: #e8f7ef;
          color: #16834a;
        }

        .status.cancelled {
          background: #fdecec;
          color: #d43b3b;
        }

        .action-button {
          border: 1px solid #dce1e8;
          background: white;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
        }

        .action-button:hover {
          background: #f5f7fa;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #7a8493;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(720px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        }

        .modal.small {
          width: min(480px, 100%);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #e8ebf0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .close-button {
          border: 0;
          background: transparent;
          font-size: 23px;
          color: #6c7789;
        }

        .modal-body {
          padding: 20px;
        }

        .form-section {
          margin-bottom: 20px;
        }

        .form-section-title {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 13px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 12px;
          color: #5d6879;
          font-weight: 700;
        }

        .customer-select-row {
          display: flex;
          gap: 8px;
        }

        .customer-select-row .select {
          flex: 1;
        }

        .add-customer-button {
          width: 43px;
          border: 1px solid #1769e0;
          background: #edf4ff;
          color: #1769e0;
          border-radius: 9px;
          font-size: 20px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 20px;
          border-top: 1px solid #e8ebf0;
        }

        .secondary-button {
          border: 1px solid #d8dee7;
          background: white;
          color: #4d5869;
          border-radius: 9px;
          padding: 10px 16px;
        }

        .danger-button {
          border: 0;
          background: #d43b3b;
          color: white;
          border-radius: 9px;
          padding: 10px 16px;
          font-weight: 700;
        }

        .success-button {
          border: 0;
          background: #16834a;
          color: white;
          border-radius: 9px;
          padding: 10px 16px;
          font-weight: 700;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .detail-item {
          background: #f8f9fb;
          border-radius: 9px;
          padding: 12px;
        }

        .detail-label {
          color: #737e8e;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .detail-value {
          font-weight: 700;
          font-size: 13px;
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 18px;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .currency-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 650px) {
          .hawala-app {
            padding: 12px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .currency-grid {
            grid-template-columns: 1fr 1fr;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            min-width: 0;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="container">
        <div className="page-header">
          <div className="title-area">
            <h1>حواله‌جات</h1>
            <p>
              ثبت، پیگیری و مدیریت حواله‌های صرافی
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            + ثبت حواله جدید
          </button>
        </div>

        <section className="summary-grid">
          <div className="summary-card sent">
            <div className="label">حواله‌های ارسال‌شده</div>
            <div className="value">{formatNumber(totalSent)}</div>
          </div>

          <div className="summary-card paid">
            <div className="label">حواله‌های پرداخت‌شده</div>
            <div className="value">{formatNumber(totalPaid)}</div>
          </div>

          <div className="summary-card cancelled">
            <div className="label">حواله‌های لغوشده</div>
            <div className="value">
              {formatNumber(totalCancelled)}
            </div>
          </div>

          <div className="summary-card total">
            <div className="label">مجموع حواله‌ها</div>
            <div className="value">
              {formatNumber(hawalas.length)}
            </div>
          </div>
        </section>

        <section className="currency-card">
          <div className="currency-card-title">
            مجموع مبالغ حواله‌ها
          </div>

          <div className="currency-grid">
            {currencies.map((currency) => (
              <div className="currency-item" key={currency.value}>
                <div className="currency-name">
                  {currency.label}
                </div>

                <div className="currency-value">
                  {formatNumber(currencyTotals[currency.value])}{" "}
                  <span style={{ fontSize: 12 }}>
                    {currency.symbol}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="toolbar">
          <div className="search-input">
            <input
              className="input"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="جستجو بر اساس شماره، مشتری یا گیرنده..."
            />
          </div>

          <button
            className={`filter-button ${
              statusFilter === "all" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("all")}
          >
            همه
          </button>

          <button
            className={`filter-button ${
              statusFilter === "sent" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("sent")}
          >
            ارسال‌شده
          </button>

          <button
            className={`filter-button ${
              statusFilter === "paid" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("paid")}
          >
            پرداخت‌شده
          </button>

          <button
            className={`filter-button ${
              statusFilter === "cancelled" ? "active" : ""
            }`}
            onClick={() => setStatusFilter("cancelled")}
          >
            لغوشده
          </button>
        </section>

        <section className="table-card">
          <div className="table-header">
            فهرست حواله‌ها
          </div>

          <div className="table-wrapper">
            {filteredHawalas.length === 0 ? (
              <div className="empty-state">
                هیچ حواله‌ای پیدا نشد.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>شماره حواله</th>
                    <th>تاریخ</th>
                    <th>حواله‌دهنده</th>
                    <th>مبلغ</th>
                    <th>گیرنده</th>
                    <th>مقصد</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHawalas.map((hawala) => (
                    <tr key={hawala.id}>
                      <td>
                        <div className="hawala-number">
                          {hawala.number}
                        </div>
                        <div className="sub-text">
                          {hawala.time}
                        </div>
                      </td>

                      <td>{hawala.date}</td>

                      <td>
                        <div className="customer-name">
                          {hawala.customerName}
                        </div>
                      </td>

                      <td>
                        <div className="amount">
                          {formatNumber(hawala.amount)}{" "}
                          {getCurrencySymbol(
                            hawala.currency
                          )}
                        </div>

                        {hawala.fee > 0 && (
                          <div className="sub-text">
                            کارمزد:{" "}
                            {formatNumber(hawala.fee)}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="customer-name">
                          {hawala.receiverName}
                        </div>

                        <div className="sub-text">
                          {hawala.receiverPhone}
                        </div>
                      </td>

                      <td>{hawala.destination}</td>

                      <td>
                        <span
                          className={`status ${hawala.status}`}
                        >
                          {statusLabels[hawala.status]}
                        </span>
                      </td>

                      <td>
                        <button
                          className="action-button"
                          onClick={() =>
                            setSelectedHawala(hawala)
                          }
                        >
                          مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {showForm && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2>ثبت حواله جدید</h2>

              <button
                className="close-button"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <div className="form-section-title">
                  معلومات حواله‌دهنده
                </div>

                <div className="form-grid">
                  <div className="form-group full">
                    <label>مشتری</label>

                    <div className="customer-select-row">
                      <select
                        className="select"
                        value={form.customerId}
                        onChange={(event) =>
                          updateForm(
                            "customerId",
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          انتخاب مشتری
                        </option>

                        {customers.map((customer) => (
                          <option
                            key={customer.id}
                            value={customer.id}
                          >
                            {customer.name} —{" "}
                            {customer.phone}
                          </option>
                        ))}
                      </select>

                      <button
                        className="add-customer-button"
                        title="افزودن مشتری"
                        onClick={() =>
                          setShowCustomerForm(true)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>ارز حواله</label>

                    <select
                      className="select"
                      value={form.currency}
                      onChange={(event) =>
                        updateForm(
                          "currency",
                          event.target.value as Currency
                        )
                      }
                    >
                      {currencies.map((currency) => (
                        <option
                          key={currency.value}
                          value={currency.value}
                        >
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>مبلغ حواله</label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(event) =>
                        updateForm(
                          "amount",
                          event.target.value
                        )
                      }
                      placeholder="مثلاً 10000"
                    />
                  </div>

                  <div className="form-group">
                    <label>کارمزد</label>

                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={form.fee}
                      onChange={(event) =>
                        updateForm(
                          "fee",
                          event.target.value
                        )
                      }
                      placeholder="مثلاً 200"
                    />
                  </div>

                  <div className="form-group">
                    <label>مقصد حواله</label>

                    <select
                      className="select"
                      value={form.destination}
                      onChange={(event) =>
                        updateForm(
                          "destination",
                          event.target.value
                        )
                      }
                    >
                      {destinations.map((destination) => (
                        <option
                          key={destination}
                          value={destination}
                        >
                          {destination}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  معلومات حواله‌گیرنده
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>نام حواله‌گیرنده</label>

                    <input
                      className="input"
                      value={form.receiverName}
                      onChange={(event) =>
                        updateForm(
                          "receiverName",
                          event.target.value
                        )
                      }
                      placeholder="نام کامل"
                    />
                  </div>

                  <div className="form-group">
                    <label>شماره تماس حواله‌گیرنده</label>

                    <input
                      className="input"
                      type="tel"
                      value={form.receiverPhone}
                      onChange={(event) =>
                        updateForm(
                          "receiverPhone",
                          event.target.value
                        )
                      }
                      placeholder="07XXXXXXXX"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  یادداشت
                </div>

                <textarea
                  className="textarea"
                  rows={3}
                  value={form.note}
                  onChange={(event) =>
                    updateForm("note", event.target.value)
                  }
                  placeholder="یادداشت اختیاری..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowForm(false)}
              >
                انصراف
              </button>

              <button
                className="primary-button"
                onClick={handleCreateHawala}
              >
                ثبت حواله
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomerForm && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCustomerForm(false);
            }
          }}
        >
          <div className="modal small">
            <div className="modal-header">
              <h2>افزودن مشتری</h2>

              <button
                className="close-button"
                onClick={() =>
                  setShowCustomerForm(false)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>نام مشتری</label>

                  <input
                    className="input"
                    value={newCustomerName}
                    onChange={(event) =>
                      setNewCustomerName(
                        event.target.value
                      )
                    }
                    placeholder="نام کامل مشتری"
                  />
                </div>

                <div className="form-group full">
                  <label>شماره تماس</label>

                  <input
                    className="input"
                    value={newCustomerPhone}
                    onChange={(event) =>
                      setNewCustomerPhone(
                        event.target.value
                      )
                    }
                    placeholder="07XXXXXXXX"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() =>
                  setShowCustomerForm(false)
                }
              >
                انصراف
              </button>

              <button
                className="primary-button"
                onClick={handleAddCustomer}
              >
                افزودن مشتری
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedHawala && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedHawala(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
                  حواله {selectedHawala.number}
                </h2>

                <div className="sub-text">
                  {selectedHawala.date} —{" "}
                  {selectedHawala.time}
                </div>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedHawala(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    وضعیت
                  </div>

                  <div className="detail-value">
                    <span
                      className={`status ${selectedHawala.status}`}
                    >
                      {
                        statusLabels[
                          selectedHawala.status
                        ]
                      }
                    </span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    مبلغ حواله
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedHawala.amount
                    )}{" "}
                    {getCurrencyLabel(
                      selectedHawala.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    حواله‌دهنده
                  </div>

                  <div className="detail-value">
                    {selectedHawala.customerName}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    مقصد
                  </div>

                  <div className="detail-value">
                    {selectedHawala.destination}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    حواله‌گیرنده
                  </div>

                  <div className="detail-value">
                    {selectedHawala.receiverName}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    شماره تماس گیرنده
                  </div>

                  <div className="detail-value">
                    {selectedHawala.receiverPhone}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    کارمزد
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedHawala.fee
                    )}{" "}
                    {getCurrencySymbol(
                      selectedHawala.currency
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    مجموع پرداخت
                  </div>

                  <div className="detail-value">
                    {formatNumber(
                      selectedHawala.totalAmount
                    )}{" "}
                    {getCurrencySymbol(
                      selectedHawala.currency
                    )}
                  </div>
                </div>

                {selectedHawala.paidAt && (
                  <div className="detail-item">
                    <div className="detail-label">
                      زمان پرداخت
                    </div>

                    <div className="detail-value">
                      {selectedHawala.paidAt}
                    </div>
                  </div>
                )}

                {selectedHawala.cancelReason && (
                  <div className="detail-item">
                    <div className="detail-label">
                      دلیل لغو
                    </div>

                    <div className="detail-value">
                      {selectedHawala.cancelReason}
                    </div>
                  </div>
                )}

                {selectedHawala.note && (
                  <div className="detail-item">
                    <div className="detail-label">
                      یادداشت
                    </div>

                    <div className="detail-value">
                      {selectedHawala.note}
                    </div>
                  </div>
                )}
              </div>

              {selectedHawala.status === "sent" && (
                <div className="modal-actions">
                  <button
                    className="success-button"
                    onClick={() =>
                      markAsPaid(selectedHawala.id)
                    }
                  >
                    ✓ ثبت پرداخت حواله
                  </button>

                  <button
                    className="danger-button"
                    onClick={() => {
                      const reason = window.prompt(
                        "دلیل لغو حواله را وارد کنید:"
                      );

                      if (reason?.trim()) {
                        setCancelReason(reason);
                        cancelHawala(
                          selectedHawala.id
                        );
                      }
                    }}
                  >
                    لغو حواله
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() =>
                  setSelectedHawala(null)
                }
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
