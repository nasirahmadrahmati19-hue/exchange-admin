"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type HawalaStatus = "pending" | "sent" | "paid" | "cancelled";
type HawalaType = "send" | "receive";

interface Hawala {
  id: string;
  number: string;
  date: string;
  time: string;
  type: HawalaType;
  province: string;
  district: string;
  currency: string;
  amount: number;
  fee: number;
  finalAmount: number;
  note: string;
  status: HawalaStatus;

  senderName: string;
  senderTazkira: string;
  senderPhone: string;
  senderTelegram: string;
  balance: string;

  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverTelegram: string;
  address: string;

  paidAt?: string;
  paidBy?: string;
  paidAmount?: number;
  cancelReason?: string;
}

interface HawalaForm {
  type: string;
  province: string;
  district: string;
  currency: string;
  amount: string;
  fee: string;
  note: string;

  senderName: string;
  senderTazkira: string;
  senderPhone: string;
  senderTelegram: string;
  balance: string;

  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverTelegram: string;
  address: string;
}

const provinces = [
  "هرات",
  "ارزگان",
  "بادغیس",
  "بدخشان",
  "بامیان",
  "بغلان",
  "بلخ",
  "پکتیا",
  "پکتیکا",
  "پنجشیر",
  "پروان",
  "تخار",
  "جوزجان",
  "خوست",
  "دایکندی",
  "زابل",
  "سرپل",
  "سمنگان",
  "فاریاب",
  "فراه",
  "غزنی",
  "غور",
  "کابل",
  "کندهار",
  "کاپیسا",
  "قندوز",
  "کنر",
  "لغمان",
  "لوگر",
  "میدان وردک",
  "ننگرهار",
  "نیمروز",
  "نورستان",
  "هلمند"
] as const;

const heratDistricts = [
  "گلران",
  "مرکز هرات",
  "ادرسکن",
  "چشت شریف",
  "فارسی",
  "غوریان",
  "گذره",
  "انجیل",
  "کرخ",
  "کوهسان",
  "کشک",
  "کشک کهنه",
  "اوبه",
  "پشتون زرغون",
  "شیندند",
  "زنده جان"
] as const;

const currencies = ["AFN", "USD", "IRR"] as const;

const statusLabels: Record<HawalaStatus, string> = {
  pending: "در انتظار",
  sent: "ارسال‌شده",
  paid: "پرداخت‌شده",
  cancelled: "لغوشده"
};

const emptyForm: HawalaForm = {
  type: "send",
  province: "هرات",
  district: "گلران",
  currency: "AFN",
  amount: "",
  fee: "",
  note: "",

  senderName: "",
  senderTazkira: "",
  senderPhone: "",
  senderTelegram: "",
  balance: "",

  receiverName: "",
  receiverTazkira: "",
  receiverPhone: "",
  receiverTelegram: "",
  address: ""
};

const initialHawalas: Hawala[] = [
  {
    id: "1",
    number: "HW-0001",
    date: "1405-05-18",
    time: "10:30",
    type: "send",
    province: "هرات",
    district: "گلران",
    currency: "AFN",
    amount: 10000,
    fee: 200,
    finalAmount: 9800,
    note: "حواله نقدی",
    status: "sent",

    senderName: "احمد احمدی",
    senderTazkira: "1398-123456",
    senderPhone: "0700000000",
    senderTelegram: "@ahmad",
    balance: "10000",

    receiverName: "محمود محمودی",
    receiverTazkira: "1395-654321",
    receiverPhone: "0788888888",
    receiverTelegram: "@mahmood",
    address: ""
  },
  {
    id: "2",
    number: "HW-0002",
    date: "1405-05-17",
    time: "16:10",
    type: "send",
    province: "هرات",
    district: "غوریان",
    currency: "AFN",
    amount: 5000,
    fee: 100,
    finalAmount: 4900,
    note: "",
    status: "paid",

    senderName: "ولی ولي",
    senderTazkira: "1390-555555",
    senderPhone: "0777777777",
    senderTelegram: "@wali",
    balance: "4900",

    receiverName: "کریم کریمی",
    receiverTazkira: "1392-444444",
    receiverPhone: "0766666666",
    receiverTelegram: "@karim",
    address: "",

    paidAt: "1405-05-17 — 16:45",
    paidBy: "صندوقکار",
    paidAmount: 4900
  },
  {
    id: "3",
    number: "HW-0003",
    date: "1405-05-16",
    time: "09:05",
    type: "receive",
    province: "کابل",
    district: "کابل",
    currency: "AFN",
    amount: 7000,
    fee: 150,
    finalAmount: 6850,
    note: "مشتری منصرف شد",
    status: "cancelled",

    senderName: "نور نور",
    senderTazkira: "1388-222222",
    senderPhone: "0755555555",
    senderTelegram: "@noor",
    balance: "",

    receiverName: "عبدالله عبداللهی",
    receiverTazkira: "1389-333333",
    receiverPhone: "0744444444",
    receiverTelegram: "@abdullah",
    address: "",

    cancelReason: "مشتری منصرف شد"
  }
];

const styles = `
  .hawala-app * {
    box-sizing: border-box;
  }

  .hawala-app {
    min-height: 100vh;
    background: #f3f4f6;
    padding: 24px;
    color: #111827;
    font-family: Tahoma, Arial, sans-serif;
  }

  .hawala-container {
    max-width: 1250px;
    margin: 0 auto;
  }

  .hawala-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .hawala-header h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 900;
  }

  .muted {
    color: #6b7280;
    font-size: 13px;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .stat-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  }

  .stat-label {
    color: #6b7280;
    font-size: 13px;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 900;
  }

  .tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .tab {
    border: none;
    padding: 10px 16px;
    border-radius: 999px;
    background: #e5e7eb;
    color: #374151;
    font-weight: 800;
    cursor: pointer;
    font-size: 14px;
  }

  .tab.active {
    background: #111827;
    color: #ffffff;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
  }

  .section-title {
    margin: 20px 0 12px;
    font-size: 15px;
    font-weight: 900;
    border-right: 4px solid #2563eb;
    padding-right: 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .full {
    grid-column: 1 / -1;
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
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 14px;
    background: #ffffff;
    color: #111827;
    outline: none;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .field input:disabled {
    background: #f3f4f6;
    color: #6b7280;
  }

  .summary {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 14px;
    border-radius: 14px;
    margin-top: 18px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 6px 0;
    font-size: 14px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    padding: 9px 13px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
  }

  .btn:hover {
    opacity: 0.92;
  }

  .btn-primary {
    background: #2563eb;
    color: #ffffff;
  }

  .btn-success {
    background: #16a34a;
    color: #ffffff;
  }

  .btn-danger {
    background: #dc2626;
    color: #ffffff;
  }

  .btn-secondary {
    background: #e5e7eb;
    color: #111827;
  }

  .btn-warning {
    background: #d97706;
    color: #ffffff;
  }

  .btn-telegram {
    background: #0088cc;
    color: #ffffff;
  }

  .table-wrap {
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    text-align: right;
    padding: 10px;
    color: #6b7280;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    white-space: nowrap;
  }

  td {
    padding: 10px;
    border-bottom: 1px solid #f3f4f6;
    white-space: nowrap;
  }

  .badge {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    display: inline-block;
  }

  .badge-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-sent {
    background: #dbeafe;
    color: #1d4ed8;
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
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .search-bar input,
  .search-bar select {
    flex: 1;
    min-width: 180px;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    font-size: 14px;
  }

  .empty {
    padding: 36px;
    text-align: center;
    color: #6b7280;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 50;
  }

  .modal {
    background: #ffffff;
    width: 100%;
    max-width: 780px;
    border-radius: 18px;
    padding: 20px;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .receipt {
    border: 1px dashed #94a3b8;
    border-radius: 14px;
    padding: 16px;
    background: #ffffff;
  }

  .receipt-title {
    text-align: center;
    font-weight: 900;
    margin-bottom: 12px;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 7px 0;
    font-size: 14px;
  }

  .divider {
    border-top: 1px dashed #cbd5e1;
    margin: 12px 0;
  }

  .toast {
    position: fixed;
    bottom: 24px;
    left: 24px;
    background: #111827;
    color: #ffffff;
    padding: 12px 16px;
    border-radius: 12px;
    z-index: 99;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
  }

  @media (max-width: 900px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }

  @media print {
    .hawala-app * {
      visibility: hidden;
    }

    .modal-overlay {
      position: absolute;
      background: #ffffff;
    }

    .modal,
    .modal * {
      visibility: visible;
    }
  }
`;

const formatDestination = (item: { province: string; district: string }) => {
  if (item.province === "هرات") {
    return `${item.province} — ${item.district}`;
  }

  return item.province;
};

const badgeClass = (status: HawalaStatus) => {
  if (status === "pending") return "badge badge-pending";
  if (status === "sent") return "badge badge-sent";
  if (status === "paid") return "badge badge-paid";
  return "badge badge-cancelled";
};

export default function HawalaPage() {
  const [activeTab, setActiveTab] = useState<"new" | "current" | "history">("new");
  const [hawalas, setHawalas] = useState<Hawala[]>(initialHawalas);
  const [form, setForm] = useState<HawalaForm>(emptyForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<Hawala | null>(null);
  const [settlement, setSettlement] = useState<Hawala | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Hawala | null>(null);

  const [paidBy, setPaidBy] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [toast, setToast] = useState("");

  const amount = Number(form.amount || 0);
  const fee = Number(form.fee || 0);
  const finalAmount = amount - fee;

  const isHerat = form.province === "هرات";
  const destinationText = formatDestination(form);

  const currentHawalas = hawalas.filter(
    item => item.status === "pending" || item.status === "sent"
  );

  const openCount = currentHawalas.length;
  const paidCount = hawalas.filter(item => item.status === "paid").length;
  const cancelledCount = hawalas.filter(item => item.status === "cancelled").length;
  const openAmount = currentHawalas.reduce((sum, item) => sum + item.finalAmount, 0);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();

    return hawalas.filter(item => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      if (!matchesStatus) return false;
      if (!q) return true;

      const fields = [
        item.number,
        item.senderName,
        item.receiverName,
        item.senderPhone,
        item.receiverPhone,
        item.province,
        item.district,
        item.senderTelegram,
        item.receiverTelegram
      ];

      return fields.some(field => String(field || "").toLowerCase().includes(q));
    });
  }, [hawalas, search, statusFilter]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  const updateForm = (field: keyof HawalaForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProvinceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newProvince = event.target.value;

    setForm(prev => ({
      ...prev,
      province: newProvince,
      district: newProvince === "هرات" ? "گلران" : newProvince
    }));
  };

  const makeHawalaNumber = () => {
    return `HW-${new Date().getFullYear()}-${String(hawalas.length + 1).padStart(4, "0")}`;
  };

  const submitForm = () => {
    if (!form.senderName.trim()) {
      showToast("نام حواله‌دهنده را بنویسید.");
      return;
    }

    if (!form.senderPhone.trim()) {
      showToast("شماره تماس حواله‌دهنده را بنویسید.");
      return;
    }

    if (!form.receiverName.trim()) {
      showToast("نام حواله‌گیرنده را بنویسید.");
      return;
    }

    if (!form.receiverTazkira.trim()) {
      showToast("شماره تذکره حواله‌گیرنده را بنویسید.");
      return;
    }

    if (!form.receiverPhone.trim()) {
      showToast("شماره تماس حواله‌گیرنده را بنویسید.");
      return;
    }

    if (amount <= 0) {
      showToast("مبلغ حواله باید بزرگ‌تر از صفر باشد.");
      return;
    }

    if (fee < 0) {
      showToast("کارمزد نمی‌تواند منفی باشد.");
      return;
    }

    if (finalAmount <= 0) {
      showToast("مبلغ نهایی نمی‌تواند صفر یا منفی باشد.");
      return;
    }

    const newHawala: Hawala = {
      id: String(Date.now()),
      number: makeHawalaNumber(),
      date: new Date().toLocaleDateString("fa-IR"),
      time: new Date().toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      type: form.type as HawalaType,
      province: form.province,
      district: form.province === "هرات" ? form.district : form.province,
      currency: form.currency,
      amount,
      fee,
      finalAmount,
      note: form.note,
      status: "pending",

      senderName: form.senderName,
      senderTazkira: form.senderTazkira,
      senderPhone: form.senderPhone,
      senderTelegram: form.senderTelegram,
      balance: form.balance,

      receiverName: form.receiverName,
      receiverTazkira: form.receiverTazkira,
      receiverPhone: form.receiverPhone,
      receiverTelegram: form.receiverTelegram,
      address: form.address
    };

    setHawalas(prev => [newHawala, ...prev]);
    setForm(emptyForm);
    setActiveTab("current");
    showToast("حواله با موفقیت ثبت شد.");
  };

  const markSent = (id: string) => {
    setHawalas(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: "sent"
            }
          : item
      )
    );

    showToast("حواله به عنوان ارسال‌شده ثبت شد.");
  };

  const openSettlement = (item: Hawala) => {
    setSettlement(item);
    setPaidAmount(String(item.finalAmount));
    setPaidBy("");
  };

  const confirmSettlement = () => {
    if (!settlement) return;

    if (!paidBy.trim()) {
      showToast("نام پرداخت‌کننده را بنویسید.");
      return;
    }

    const amountPaid = Number(paidAmount || settlement.finalAmount);

    if (amountPaid <= 0) {
      showToast("مبلغ پرداخت‌شده معتبر نیست.");
      return;
    }

    const nowDate = new Date().toLocaleDateString("fa-IR");
    const nowTime = new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    setHawalas(prev =>
      prev.map(item =>
        item.id === settlement.id
          ? {
              ...item,
              status: "paid",
              paidAt: `${nowDate} — ${nowTime}`,
              paidBy,
              paidAmount: amountPaid
            }
          : item
      )
    );

    setSettlement(null);
    showToast("حواله با موفقیت تسویه شد.");
  };

  const openCancel = (item: Hawala) => {
    setCancelTarget(item);
    setCancelReason("");
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;

    if (!cancelReason.trim()) {
      showToast("دلیل لغو حواله را بنویسید.");
      return;
    }

    setHawalas(prev =>
      prev.map(item =>
        item.id === cancelTarget.id
          ? {
              ...item,
              status: "cancelled",
              cancelReason
            }
          : item
      )
    );

    setCancelTarget(null);
    showToast("حواله لغو شد.");
  };

  const sendTelegram = (item: Hawala) => {
    const target =
      item.status === "paid"
        ? item.receiverTelegram || item.receiverPhone
        : item.senderTelegram || item.senderPhone;

    if (!target) {
      showToast("چت آی‌دی تلگرام مشتری ثبت نشده است.");
      return;
    }

    showToast(`رسید به تلگرام ${target} ارسال شد.`);
  };

  const tabs = [
    {
      id: "new",
      label: "➕ ثبت حواله جدید"
    },
    {
      id: "current",
      label: "📋 حواله‌های جاری"
    },
    {
      id: "history",
      label: "📜 تاریخچه حواله‌ها"
    }
  ] as const;

  return (
    <div className="hawala-app" dir="rtl">
      <style>{styles}</style>

      <div className="hawala-container">
        <div className="hawala-header">
          <div>
            <h1>🏦 حواله‌جات</h1>
            <div className="muted">ثبت، پیگیری و تسویه حواله‌ها</div>
          </div>

          <button className="btn btn-primary" onClick={() => setActiveTab("new")}>
            ➕ ثبت حواله جدید
          </button>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">حواله‌های باز</div>
            <div className="stat-value">{openCount.toLocaleString("fa-IR")}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">پرداخت‌شده</div>
            <div className="stat-value">{paidCount.toLocaleString("fa-IR")}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">لغوشده</div>
            <div className="stat-value">{cancelledCount.toLocaleString("fa-IR")}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">مجموع مبلغ باز</div>
            <div className="stat-value">{openAmount.toLocaleString("fa-IR")}</div>
          </div>
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "new" && (
          <div className="card">
            <div className="section-title">معلومات حواله</div>

            <div className="grid">
              <div className="field">
                <label>نوع حواله</label>
                <select
                  value={form.type}
                  onChange={e => updateForm("type", e.target.value)}
                >
                  <option value="send">ارسال</option>
                  <option value="receive">دریافت</option>
                </select>
              </div>

              <div className="field">
                <label>واحد پول</label>
                <select
                  value={form.currency}
                  onChange={e => updateForm("currency", e.target.value)}
                >
                  {currencies.map(currency => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>ولایت مقصد</label>
                <select value={form.province} onChange={handleProvinceChange}>
                  {provinces.map(province => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>ولسوالی مقصد</label>

                {isHerat ? (
                  <select
                    value={form.district}
                    onChange={e => updateForm("district", e.target.value)}
                  >
                    {heratDistricts.map(district => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={form.province} disabled />
                )}
              </div>

              <div className="field">
                <label>مبلغ حواله</label>
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={e => updateForm("amount", e.target.value)}
                  placeholder="مثلاً 10000"
                />
              </div>

              <div className="field">
                <label>کارمزد</label>
                <input
                  type="number"
                  min="0"
                  value={form.fee}
                  onChange={e => updateForm("fee", e.target.value)}
                  placeholder="مثلاً 200"
                />
              </div>

              <div className="field">
                <label>مبلغ نهایی دریافتی</label>
                <input
                  value={finalAmount > 0 ? finalAmount.toLocaleString("fa-IR") : "0"}
                  disabled
                />
              </div>

              <div className="field">
                <label>باقی مانده حساب مشتری</label>
                <input
                  value={form.balance}
                  onChange={e => updateForm("balance", e.target.value)}
                  placeholder="اختیاری"
                />
              </div>

              <div className="field full">
                <label>یادداشت</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={e => updateForm("note", e.target.value)}
                  placeholder="توضیح اختیاری..."
                />
              </div>
            </div>

            <div className="section-title">حواله‌دهنده</div>

            <div className="grid">
              <div className="field">
                <label>نام و نام خانوادگی</label>
                <input
                  value={form.senderName}
                  onChange={e => updateForm("senderName", e.target.value)}
                  placeholder="نام کامل حواله‌دهنده"
                />
              </div>

              <div className="field">
                <label>شماره تذکره</label>
                <input
                  value={form.senderTazkira}
                  onChange={e => updateForm("senderTazkira", e.target.value)}
                  placeholder="شماره تذکره"
                />
              </div>

              <div className="field">
                <label>شماره تماس</label>
                <input
                  value={form.senderPhone}
                  onChange={e => updateForm("senderPhone", e.target.value)}
                  placeholder="07xxxxxxxx"
                />
              </div>

              <div className="field">
                <label>چت آی‌دی تلگرام</label>
                <input
                  value={form.senderTelegram}
                  onChange={e => updateForm("senderTelegram", e.target.value)}
                  placeholder="@example یا 123456789"
                />
              </div>
            </div>

            <div className="section-title">حواله‌گیرنده</div>

            <div className="grid">
              <div className="field">
                <label>نام و نام خانوادگی</label>
                <input
                  value={form.receiverName}
                  onChange={e => updateForm("receiverName", e.target.value)}
                  placeholder="نام کامل حواله‌گیرنده"
                />
              </div>

              <div className="field">
                <label>شماره تذکره</label>
                <input
                  value={form.receiverTazkira}
                  onChange={e => updateForm("receiverTazkira", e.target.value)}
                  placeholder="شماره تذکره حواله‌گیرنده"
                />
              </div>

              <div className="field">
                <label>شماره تماس</label>
                <input
                  value={form.receiverPhone}
                  onChange={e => updateForm("receiverPhone", e.target.value)}
                  placeholder="07xxxxxxxx"
                />
              </div>

              <div className="field">
                <label>چت آی‌دی تلگرام</label>
                <input
                  value={form.receiverTelegram}
                  onChange={e => updateForm("receiverTelegram", e.target.value)}
                  placeholder="@example یا 123456789"
                />
              </div>

              <div className="field full">
                <label>آدرس</label>
                <input
                  value={form.address}
                  onChange={e => updateForm("address", e.target.value)}
                  placeholder="اختیاری"
                />
              </div>
            </div>

            <div className="summary">
              <div className="summary-row">
                <span>مقصد نهایی</span>
                <strong>{destinationText}</strong>
              </div>

              <div className="summary-row">
                <span>مبلغ حواله</span>
                <strong>{amount.toLocaleString("fa-IR")}</strong>
              </div>

              <div className="summary-row">
                <span>کارمزد</span>
                <strong>{fee.toLocaleString("fa-IR")}</strong>
              </div>

              <div className="summary-row">
                <span>مبلغ نهایی دریافتی</span>
                <strong>
                  {finalAmount > 0 ? finalAmount.toLocaleString("fa-IR") : "0"}
                </strong>
              </div>
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-primary" onClick={submitForm}>
                ثبت حواله
              </button>

              <button className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
                پاک کردن فرم
              </button>
            </div>
          </div>
        )}

        {activeTab === "current" && (
          <div className="card">
            <div className="section-title">حواله‌های جاری</div>

            {currentHawalas.length === 0 ? (
              <div className="empty">هیچ حواله جاری وجود ندارد.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>شماره</th>
                      <th>تاریخ</th>
                      <th>حواله‌دهنده</th>
                      <th>حواله‌گیرنده</th>
                      <th>مبلغ نهایی</th>
                      <th>ارز</th>
                      <th>مقصد</th>
                      <th>وضعیت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentHawalas.map(item => (
                      <tr key={item.id}>
                        <td>{item.number}</td>
                        <td>{item.date}</td>
                        <td>{item.senderName}</td>
                        <td>{item.receiverName}</td>
                        <td>{item.finalAmount.toLocaleString("fa-IR")}</td>
                        <td>{item.currency}</td>
                        <td>{formatDestination(item)}</td>
                        <td>
                          <span className={badgeClass(item.status)}>
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              className="btn btn-secondary"
                              onClick={() => setSelected(item)}
                            >
                              مشاهده
                            </button>

                            {item.status === "pending" && (
                              <button
                                className="btn btn-warning"
                                onClick={() => markSent(item.id)}
                              >
                                ارسال
                              </button>
                            )}

                            {(item.status === "pending" || item.status === "sent") && (
                              <button
                                className="btn btn-success"
                                onClick={() => openSettlement(item)}
                              >
                                تسویه
                              </button>
                            )}

                            {(item.status === "pending" || item.status === "sent") && (
                              <button
                                className="btn btn-danger"
                                onClick={() => openCancel(item)}
                              >
                                لغو
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="card">
            <div className="section-title">تاریخچه حواله‌ها</div>

            <div className="search-bar">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="جستجو: شماره حواله، نام، شماره تماس، تلگرام..."
              />

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="pending">در انتظار</option>
                <option value="sent">ارسال‌شده</option>
                <option value="paid">پرداخت‌شده</option>
                <option value="cancelled">لغوشده</option>
              </select>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="empty">هیچ حواله‌ای پیدا نشد.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>شماره</th>
                      <th>تاریخ</th>
                      <th>حواله‌دهنده</th>
                      <th>حواله‌گیرنده</th>
                      <th>مبلغ نهایی</th>
                      <th>ارز</th>
                      <th>مقصد</th>
                      <th>وضعیت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredHistory.map(item => (
                      <tr key={item.id}>
                        <td>{item.number}</td>
                        <td>{item.date}</td>
                        <td>{item.senderName}</td>
                        <td>{item.receiverName}</td>
                        <td>{item.finalAmount.toLocaleString("fa-IR")}</td>
                        <td>{item.currency}</td>
                        <td>{formatDestination(item)}</td>
                        <td>
                          <span className={badgeClass(item.status)}>
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setSelected(item)}
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">جزئیات حواله {selected.number}</h3>

              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                بستن
              </button>
            </div>

            <div className="receipt">
              <div className="receipt-title">🏦 رسید حواله</div>

              <div className="receipt-row">
                <span>شماره حواله</span>
                <strong>{selected.number}</strong>
              </div>

              <div className="receipt-row">
                <span>تاریخ</span>
                <strong>{selected.date}</strong>
              </div>

              <div className="receipt-row">
                <span>ساعت</span>
                <strong>{selected.time}</strong>
              </div>

              <div className="receipt-row">
                <span>نوع حواله</span>
                <strong>{selected.type === "send" ? "ارسال" : "دریافت"}</strong>
              </div>

              <div className="receipt-row">
                <span>مقصد</span>
                <strong>{formatDestination(selected)}</strong>
              </div>

              <div className="divider" />

              <div className="receipt-row">
                <span>حواله‌دهنده</span>
                <strong>{selected.senderName}</strong>
              </div>

              <div className="receipt-row">
                <span>تذکره حواله‌دهنده</span>
                <strong>{selected.senderTazkira || "—"}</strong>
              </div>

              <div className="receipt-row">
                <span>تماس حواله‌دهنده</span>
                <strong>{selected.senderPhone}</strong>
              </div>

              <div className="receipt-row">
                <span>تلگرام حواله‌دهنده</span>
                <strong>{selected.senderTelegram || "—"}</strong>
              </div>

              <div className="divider" />

              <div className="receipt-row">
                <span>حواله‌گیرنده</span>
                <strong>{selected.receiverName}</strong>
              </div>

              <div className="receipt-row">
                <span>تذکره حواله‌گیرنده</span>
                <strong>{selected.receiverTazkira}</strong>
              </div>

              <div className="receipt-row">
                <span>تماس حواله‌گیرنده</span>
                <strong>{selected.receiverPhone}</strong>
              </div>

              <div className="receipt-row">
                <span>تلگرام حواله‌گیرنده</span>
                <strong>{selected.receiverTelegram || "—"}</strong>
              </div>

              <div className="divider" />

              <div className="receipt-row">
                <span>مبلغ حواله</span>
                <strong>
                  {selected.amount.toLocaleString("fa-IR")} {selected.currency}
                </strong>
              </div>

              <div className="receipt-row">
                <span>کارمزد</span>
                <strong>{selected.fee.toLocaleString("fa-IR")}</strong>
              </div>

              <div className="receipt-row">
                <span>مبلغ نهایی دریافتی</span>
                <strong>
                  {selected.finalAmount.toLocaleString("fa-IR")} {selected.currency}
                </strong>
              </div>

              <div className="receipt-row">
                <span>باقی مانده حساب مشتری</span>
                <strong>{selected.balance || "—"}</strong>
              </div>

              <div className="receipt-row">
                <span>وضعیت</span>
                <strong>{statusLabels[selected.status]}</strong>
              </div>

              {selected.paidAt && (
                <div className="receipt-row">
                  <span>تاریخ پرداخت</span>
                  <strong>{selected.paidAt}</strong>
                </div>
              )}

              {selected.paidBy && (
                <div className="receipt-row">
                  <span>پرداخت‌کننده</span>
                  <strong>{selected.paidBy}</strong>
                </div>
              )}

              {typeof selected.paidAmount === "number" && (
                <div className="receipt-row">
                  <span>مبلغ پرداخت‌شده</span>
                  <strong>{selected.paidAmount.toLocaleString("fa-IR")}</strong>
                </div>
              )}

              {selected.cancelReason && (
                <div className="receipt-row">
                  <span>دلیل لغو</span>
                  <strong>{selected.cancelReason}</strong>
                </div>
              )}

              {selected.note && (
                <div className="receipt-row">
                  <span>یادداشت</span>
                  <strong>{selected.note}</strong>
                </div>
              )}
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨 چاپ رسید
              </button>

              <button
                className="btn btn-telegram"
                onClick={() => sendTelegram(selected)}
              >
                📨 ارسال رسید به تلگرام
              </button>

              {selected.status !== "paid" && selected.status !== "cancelled" && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      openSettlement(selected);
                      setSelected(null);
                    }}
                  >
                    ✅ تسویه
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      openCancel(selected);
                      setSelected(null);
                    }}
                  >
                    ❌ لغو
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {settlement && (
        <div className="modal-overlay" onClick={() => setSettlement(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تسویه حواله {settlement.number}</h3>

              <button className="btn btn-secondary" onClick={() => setSettlement(null)}>
                بستن
              </button>
            </div>

            <div className="summary">
              <div className="summary-row">
                <span>حواله‌گیرنده</span>
                <strong>{settlement.receiverName}</strong>
              </div>

              <div className="summary-row">
                <span>تذکره حواله‌گیرنده</span>
                <strong>{settlement.receiverTazkira}</strong>
              </div>

              <div className="summary-row">
                <span>تماس حواله‌گیرنده</span>
                <strong>{settlement.receiverPhone}</strong>
              </div>

              <div className="summary-row">
                <span>مبلغ نهایی</span>
                <strong>
                  {settlement.finalAmount.toLocaleString("fa-IR")}{" "}
                  {settlement.currency}
                </strong>
              </div>
            </div>

            <div className="grid" style={{ marginTop: "16px" }}>
              <div className="field">
                <label>نام پرداخت‌کننده</label>
                <input
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                  placeholder="مثلاً صندوقکار"
                />
              </div>

              <div className="field">
                <label>مبلغ پرداخت‌شده</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-success" onClick={confirmSettlement}>
                تأیید پرداخت
              </button>

              <button className="btn btn-secondary" onClick={() => setSettlement(null)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">لغو حواله {cancelTarget.number}</h3>

              <button className="btn btn-secondary" onClick={() => setCancelTarget(null)}>
                بستن
              </button>
            </div>

            <div className="field">
              <label>دلیل لغو حواله</label>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="دلیل لغو را بنویسید..."
              />
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-danger" onClick={confirmCancel}>
                لغو حواله
              </button>

              <button className="btn btn-secondary" onClick={() => setCancelTarget(null)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
