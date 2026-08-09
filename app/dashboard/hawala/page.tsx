"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type HawalaStatus = "pending" | "sent" | "paid" | "cancelled";
type HawalaType = "send" | "receive";
type TelegramStatus = "not_sent" | "sent" | "error";

interface Hawala {
  id: string;
  hawalaNumber: string;
  createdDate: string;
  createdTime: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;

  hawalaType: HawalaType;
  status: HawalaStatus;

  destinationCountry: string;
  destinationProvince: string;
  destinationDistrict: string;
  destinationText: string;

  currency: string;
  amount: number;
  fee: number;
  finalAmount: number;
  customerBalance: string;

  note: string;
  internalNote?: string;

  senderName: string;
  senderTazkira: string;
  senderPhone: string;
  senderTelegram: string;
  senderAddress?: string;

  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverTelegram: string;
  receiverAddress?: string;

  paidDate?: string;
  paidTime?: string;
  paidAmount?: number;
  paidBy?: string;
  receivedBy?: string;
  paymentMethod?: string;
  paymentAccount?: string;

  cancelReason?: string;
  cancelledDate?: string;
  cancelledTime?: string;
  cancelledBy?: string;

  telegramStatus: TelegramStatus;
  telegramSentAt?: string;
}

interface HawalaForm {
  hawalaType: string;
  destinationProvince: string;
  destinationDistrict: string;
  currency: string;
  amount: string;
  fee: string;
  customerBalance: string;
  note: string;
  internalNote: string;

  senderName: string;
  senderTazkira: string;
  senderPhone: string;
  senderTelegram: string;
  senderAddress: string;

  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverTelegram: string;
  receiverAddress: string;
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

const paymentMethods = ["نقدی", "بانکی", "صندوق"] as const;

const statusLabels: Record<HawalaStatus, string> = {
  pending: "در انتظار",
  sent: "ارسال‌شده",
  paid: "پرداخت‌شده",
  cancelled: "لغوشده"
};

const telegramLabels: Record<TelegramStatus, string> = {
  not_sent: "ارسال نشده",
  sent: "ارسال شده",
  error: "ناموفق"
};

const initialHawalas: Hawala[] = [
  {
    id: "1",
    hawalaNumber: "HW-20260809-0001",
    createdDate: "1405-05-18",
    createdTime: "10:30",
    createdBy: "کاربر سیستم",
    hawalaType: "send",
    status: "sent",
    destinationCountry: "افغانستان",
    destinationProvince: "هرات",
    destinationDistrict: "گلران",
    destinationText: "هرات — گلران",
    currency: "AFN",
    amount: 10000,
    fee: 200,
    finalAmount: 9800,
    customerBalance: "10,000",
    note: "حواله نقدی",
    internalNote: "",
    senderName: "احمد احمدی",
    senderTazkira: "1398-123456",
    senderPhone: "0700000000",
    senderTelegram: "@ahmad",
    senderAddress: "",
    receiverName: "محمود محمودی",
    receiverTazkira: "1395-654321",
    receiverPhone: "0788888888",
    receiverTelegram: "@mahmood",
    receiverAddress: "",
    telegramStatus: "not_sent"
  },
  {
    id: "2",
    hawalaNumber: "HW-20260808-0002",
    createdDate: "1405-05-17",
    createdTime: "16:10",
    createdBy: "کاربر سیستم",
    hawalaType: "send",
    status: "paid",
    destinationCountry: "افغانستان",
    destinationProvince: "هرات",
    destinationDistrict: "غوریان",
    destinationText: "هرات — غوریان",
    currency: "AFN",
    amount: 5000,
    fee: 100,
    finalAmount: 4900,
    customerBalance: "4,900",
    note: "",
    internalNote: "",
    senderName: "ولی ولی",
    senderTazkira: "1390-555555",
    senderPhone: "0777777777",
    senderTelegram: "@wali",
    senderAddress: "",
    receiverName: "کریم کریمی",
    receiverTazkira: "1392-444444",
    receiverPhone: "0766666666",
    receiverTelegram: "@karim",
    receiverAddress: "",
    paidDate: "1405-05-17",
    paidTime: "16:45",
    paidAmount: 4900,
    paidBy: "صندوقکار",
    receivedBy: "کریم کریمی",
    paymentMethod: "نقدی",
    paymentAccount: "",
    telegramStatus: "sent",
    telegramSentAt: "1405-05-17 — 16:46"
  },
  {
    id: "3",
    hawalaNumber: "HW-20260807-0003",
    createdDate: "1405-05-16",
    createdTime: "09:05",
    createdBy: "کاربر سیستم",
    hawalaType: "receive",
    status: "cancelled",
    destinationCountry: "افغانستان",
    destinationProvince: "کابل",
    destinationDistrict: "کابل",
    destinationText: "کابل",
    currency: "AFN",
    amount: 7000,
    fee: 150,
    finalAmount: 6850,
    customerBalance: "",
    note: "",
    internalNote: "",
    senderName: "نور نور",
    senderTazkira: "1388-222222",
    senderPhone: "0755555555",
    senderTelegram: "@noor",
    senderAddress: "",
    receiverName: "عبدالله عبداللهی",
    receiverTazkira: "1389-333333",
    receiverPhone: "0744444444",
    receiverTelegram: "@abdullah",
    receiverAddress: "",
    cancelReason: "مشتری منصرف شد",
    cancelledDate: "1405-05-16",
    cancelledTime: "09:30",
    cancelledBy: "کاربر سیستم",
    telegramStatus: "not_sent"
  }
];

const emptyForm: HawalaForm = {
  hawalaType: "send",
  destinationProvince: "هرات",
  destinationDistrict: "گلران",
  currency: "AFN",
  amount: "",
  fee: "",
  customerBalance: "",
  note: "",
  internalNote: "",

  senderName: "",
  senderTazkira: "",
  senderPhone: "",
  senderTelegram: "",
  senderAddress: "",

  receiverName: "",
  receiverTazkira: "",
  receiverPhone: "",
  receiverTelegram: "",
  receiverAddress: ""
};

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
    max-width: 1300px;
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
    max-width: 820px;
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

const getNow = () => {
  return {
    date: new Date().toLocaleDateString("fa-IR"),
    time: new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };
};

const formatNumber = (value: number) => {
  return Number(value || 0).toLocaleString("fa-IR");
};

const formatDestination = (province: string, district: string) => {
  if (province === "هرات") {
    return `${province} — ${district}`;
  }

  return province;
};

const badgeClass = (status: HawalaStatus) => {
  if (status === "pending") return "badge badge-pending";
  if (status === "sent") return "badge badge-sent";
  if (status === "paid") return "badge badge-paid";
  return "badge badge-cancelled";
};

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";

  return (
    <div className="receipt-row">
      <span>{label}</span>
      <strong>{hasValue ? value : "—"}</strong>
    </div>
  );
}

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
  const [receivedBy, setReceivedBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدی");
  const [paymentAccount, setPaymentAccount] = useState("");

  const [cancelReason, setCancelReason] = useState("");
  const [toast, setToast] = useState("");

  const amount = Number(form.amount || 0);
  const fee = Number(form.fee || 0);
  const finalAmount = amount - fee;
  const safeFinalAmount = finalAmount > 0 ? finalAmount : 0;

  const isHerat = form.destinationProvince === "هرات";
  const destinationText = formatDestination(
    form.destinationProvince,
    form.destinationDistrict
  );

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
        item.hawalaNumber,
        item.senderName,
        item.receiverName,
        item.senderPhone,
        item.receiverPhone,
        item.senderTelegram,
        item.receiverTelegram,
        item.destinationProvince,
        item.destinationDistrict,
        item.destinationText
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
      destinationProvince: newProvince,
      destinationDistrict: newProvince === "هرات" ? "گلران" : newProvince
    }));
  };

  const makeHawalaNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `HW-${year}${month}${day}-${String(hawalas.length + 1).padStart(4, "0")}`;
  };

  const submitForm = () => {
    if (!form.senderName.trim()) {
      showToast("نام حواله‌دهنده را بنویسید.");
      return;
    }

    if (!form.senderTazkira.trim()) {
      showToast("شماره تذکره حواله‌دهنده را بنویسید.");
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

    const now = getNow();

    const newHawala: Hawala = {
      id: String(Date.now()),
      hawalaNumber: makeHawalaNumber(),
      createdDate: now.date,
      createdTime: now.time,
      createdBy: "کاربر سیستم",
      hawalaType: form.hawalaType as HawalaType,
      status: "pending",

      destinationCountry: "افغانستان",
      destinationProvince: form.destinationProvince,
      destinationDistrict:
        form.destinationProvince === "هرات"
          ? form.destinationDistrict
          : form.destinationProvince,
      destinationText,

      currency: form.currency,
      amount,
      fee,
      finalAmount,
      customerBalance: form.customerBalance,

      note: form.note,
      internalNote: form.internalNote,

      senderName: form.senderName,
      senderTazkira: form.senderTazkira,
      senderPhone: form.senderPhone,
      senderTelegram: form.senderTelegram,
      senderAddress: form.senderAddress,

      receiverName: form.receiverName,
      receiverTazkira: form.receiverTazkira,
      receiverPhone: form.receiverPhone,
      receiverTelegram: form.receiverTelegram,
      receiverAddress: form.receiverAddress,

      telegramStatus: "not_sent"
    };

    setHawalas(prev => [newHawala, ...prev]);
    setForm(emptyForm);
    setActiveTab("current");
    showToast("حواله با موفقیت ثبت شد.");
  };

  const markSent = (id: string) => {
    const now = getNow();

    setHawalas(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: "sent",
              updatedAt: `${now.date} — ${now.time}`,
              updatedBy: "کاربر سیستم"
            }
          : item
      )
    );

    showToast("حواله به عنوان ارسال‌شده ثبت شد.");
  };

  const openSettlement = (item: Hawala) => {
    setSettlement(item);
    setPaidAmount(String(item.finalAmount));
    setReceivedBy(item.receiverName);
    setPaymentMethod("نقدی");
    setPaymentAccount("");
    setPaidBy("");
  };

  const confirmSettlement = () => {
    if (!settlement) return;

    if (!paidBy.trim()) {
      showToast("نام پرداخت‌کننده را بنویسید.");
      return;
    }

    if (!receivedBy.trim()) {
      showToast("نام دریافت‌کننده را بنویسید.");
      return;
    }

    const amountPaid = Number(paidAmount || settlement.finalAmount);

    if (amountPaid <= 0) {
      showToast("مبلغ پرداخت‌شده معتبر نیست.");
      return;
    }

    const now = getNow();

    setHawalas(prev =>
      prev.map(item =>
        item.id === settlement.id
          ? {
              ...item,
              status: "paid",
              paidDate: now.date,
              paidTime: now.time,
              paidAmount: amountPaid,
              paidBy,
              receivedBy,
              paymentMethod,
              paymentAccount,
              updatedAt: `${now.date} — ${now.time}`,
              updatedBy: paidBy
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

    const now = getNow();

    setHawalas(prev =>
      prev.map(item =>
        item.id === cancelTarget.id
          ? {
              ...item,
              status: "cancelled",
              cancelReason,
              cancelledDate: now.date,
              cancelledTime: now.time,
              cancelledBy: "کاربر سیستم",
              updatedAt: `${now.date} — ${now.time}`,
              updatedBy: "کاربر سیستم"
            }
          : item
      )
    );

    setCancelTarget(null);
    showToast("حواله لغو شد.");
  };

  const sendTelegram = (item: Hawala) => {
    const now = getNow();

    const target =
      item.status === "paid" ? item.receiverTelegram : item.senderTelegram;

    if (!target.trim()) {
      setHawalas(prev =>
        prev.map(h =>
          h.id === item.id
            ? {
                ...h,
                telegramStatus: "error"
              }
            : h
        )
      );

      setSelected(prev =>
        prev && prev.id === item.id
          ? {
              ...prev,
              telegramStatus: "error"
            }
          : prev
      );

      showToast("چت آی‌دی تلگرام مشتری ثبت نشده است.");
      return;
    }

    const sentAt = `${now.date} — ${now.time}`;

    setHawalas(prev =>
      prev.map(h =>
        h.id === item.id
          ? {
              ...h,
              telegramStatus: "sent",
              telegramSentAt: sentAt
            }
          : h
      )
    );

    setSelected(prev =>
      prev && prev.id === item.id
        ? {
            ...prev,
            telegramStatus: "sent",
            telegramSentAt: sentAt
          }
        : prev
    );

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
            <div className="stat-value">{formatNumber(openCount)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">پرداخت‌شده</div>
            <div className="stat-value">{formatNumber(paidCount)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">لغوشده</div>
            <div className="stat-value">{formatNumber(cancelledCount)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">مجموع مبلغ باز</div>
            <div className="stat-value">{formatNumber(openAmount)}</div>
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
            <div className="section-title">معلومات مقصد</div>

            <div className="grid">
              <div className="field">
                <label>کشور</label>
                <input value="افغانستان" disabled />
              </div>

              <div className="field">
                <label>ولایت مقصد</label>
                <select
                  value={form.destinationProvince}
                  onChange={handleProvinceChange}
                >
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
                    value={form.destinationDistrict}
                    onChange={e => updateForm("destinationDistrict", e.target.value)}
                  >
                    {heratDistricts.map(district => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={form.destinationProvince} disabled />
                )}
              </div>

              <div className="field">
                <label>مقصد نهایی</label>
                <input value={destinationText} disabled />
              </div>
            </div>

            <div className="section-title">نوع و معلومات مالی</div>

            <div className="grid">
              <div className="field">
                <label>نوع حواله</label>
                <select
                  value={form.hawalaType}
                  onChange={e => updateForm("hawalaType", e.target.value)}
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
                <input value={formatNumber(safeFinalAmount)} disabled />
              </div>

              <div className="field">
                <label>باقی مانده حساب مشتری</label>
                <input
                  value={form.customerBalance}
                  onChange={e => updateForm("customerBalance", e.target.value)}
                  placeholder="اختیاری"
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
                  placeholder="شماره تذکره حواله‌دهنده"
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

              <div className="field full">
                <label>آدرس حواله‌دهنده</label>
                <input
                  value={form.senderAddress}
                  onChange={e => updateForm("senderAddress", e.target.value)}
                  placeholder="اختیاری"
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
                <label>آدرس حواله‌گیرنده</label>
                <input
                  value={form.receiverAddress}
                  onChange={e => updateForm("receiverAddress", e.target.value)}
                  placeholder="اختیاری"
                />
              </div>
            </div>

            <div className="section-title">یادداشت‌ها</div>

            <div className="grid">
              <div className="field full">
                <label>یادداشت عمومی</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={e => updateForm("note", e.target.value)}
                  placeholder="توضیح قابل نمایش در رسید..."
                />
              </div>

              <div className="field full">
                <label>یادداشت داخلی</label>
                <textarea
                  rows={3}
                  value={form.internalNote}
                  onChange={e => updateForm("internalNote", e.target.value)}
                  placeholder="فقط برای کارمندان صرافی..."
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
                <strong>{formatNumber(amount)}</strong>
              </div>

              <div className="summary-row">
                <span>کارمزد</span>
                <strong>{formatNumber(fee)}</strong>
              </div>

              <div className="summary-row">
                <span>مبلغ نهایی دریافتی</span>
                <strong>{formatNumber(safeFinalAmount)}</strong>
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
                        <td>{item.hawalaNumber}</td>
                        <td>{item.createdDate}</td>
                        <td>{item.senderName}</td>
                        <td>{item.receiverName}</td>
                        <td>{formatNumber(item.finalAmount)}</td>
                        <td>{item.currency}</td>
                        <td>
                          {formatDestination(
                            item.destinationProvince,
                            item.destinationDistrict
                          )}
                        </td>
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
                placeholder="جستجو: شماره حواله، نام، شماره تماس، تلگرام، مقصد..."
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
                        <td>{item.hawalaNumber}</td>
                        <td>{item.createdDate}</td>
                        <td>{item.senderName}</td>
                        <td>{item.receiverName}</td>
                        <td>{formatNumber(item.finalAmount)}</td>
                        <td>{item.currency}</td>
                        <td>
                          {formatDestination(
                            item.destinationProvince,
                            item.destinationDistrict
                          )}
                        </td>
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
              <h3 className="modal-title">جزئیات حواله {selected.hawalaNumber}</h3>

              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                بستن
              </button>
            </div>

            <div className="receipt">
              <div className="receipt-title">🏦 رسید حواله</div>

              <DetailRow label="شماره حواله" value={selected.hawalaNumber} />
              <DetailRow label="تاریخ ثبت" value={selected.createdDate} />
              <DetailRow label="ساعت ثبت" value={selected.createdTime} />
              <DetailRow
                label="نوع حواله"
                value={selected.hawalaType === "send" ? "ارسال" : "دریافت"}
              />
              <DetailRow label="مقصد" value={selected.destinationText} />
              <DetailRow label="واحد پول" value={selected.currency} />

              <div className="divider" />

              <DetailRow label="حواله‌دهنده" value={selected.senderName} />
              <DetailRow label="تذکره حواله‌دهنده" value={selected.senderTazkira} />
              <DetailRow label="تماس حواله‌دهنده" value={selected.senderPhone} />
              <DetailRow label="تلگرام حواله‌دهنده" value={selected.senderTelegram} />
              <DetailRow label="آدرس حواله‌دهنده" value={selected.senderAddress} />

              <div className="divider" />

              <DetailRow label="حواله‌گیرنده" value={selected.receiverName} />
              <DetailRow label="تذکره حواله‌گیرنده" value={selected.receiverTazkira} />
              <DetailRow label="تماس حواله‌گیرنده" value={selected.receiverPhone} />
              <DetailRow label="تلگرام حواله‌گیرنده" value={selected.receiverTelegram} />
              <DetailRow label="آدرس حواله‌گیرنده" value={selected.receiverAddress} />

              <div className="divider" />

              <DetailRow label="مبلغ حواله" value={formatNumber(selected.amount)} />
              <DetailRow label="کارمزد" value={formatNumber(selected.fee)} />
              <DetailRow
                label="مبلغ نهایی دریافتی"
                value={formatNumber(selected.finalAmount)}
              />
              <DetailRow label="باقی مانده حساب مشتری" value={selected.customerBalance} />
              <DetailRow label="وضعیت" value={statusLabels[selected.status]} />
              <DetailRow
                label="وضعیت تلگرام"
                value={telegramLabels[selected.telegramStatus]}
              />

              {selected.telegramSentAt && (
                <DetailRow label="زمان ارسال تلگرام" value={selected.telegramSentAt} />
              )}

              {selected.paidDate && (
                <DetailRow label="تاریخ پرداخت" value={selected.paidDate} />
              )}

              {selected.paidTime && (
                <DetailRow label="ساعت پرداخت" value={selected.paidTime} />
              )}

              {typeof selected.paidAmount === "number" && (
                <DetailRow
                  label="مبلغ پرداخت‌شده"
                  value={formatNumber(selected.paidAmount)}
                />
              )}

              {selected.paidBy && <DetailRow label="پرداخت‌کننده" value={selected.paidBy} />}

              {selected.receivedBy && (
                <DetailRow label="دریافت‌کننده" value={selected.receivedBy} />
              )}

              {selected.paymentMethod && (
                <DetailRow label="روش پرداخت" value={selected.paymentMethod} />
              )}

              {selected.paymentAccount && (
                <DetailRow label="صندوق / حساب" value={selected.paymentAccount} />
              )}

              {selected.cancelReason && (
                <DetailRow label="دلیل لغو" value={selected.cancelReason} />
              )}

              {selected.note && <DetailRow label="یادداشت" value={selected.note} />}
            </div>

            {selected.internalNote && (
              <div className="summary" style={{ marginTop: "14px" }}>
                <div className="summary-row">
                  <span>یادداشت داخلی</span>
                  <strong>{selected.internalNote}</strong>
                </div>
              </div>
            )}

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

              {selected.status === "pending" && (
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    markSent(selected.id);
                    setSelected(null);
                  }}
                >
                  ارسال
                </button>
              )}

              {selected.status !== "paid" && selected.status !== "cancelled" && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      openSettlement(selected);
                      setSelected(null);
                    }}
                  >
                    تسویه
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      openCancel(selected);
                      setSelected(null);
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

      {settlement && (
        <div className="modal-overlay" onClick={() => setSettlement(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تسویه حواله {settlement.hawalaNumber}</h3>

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
                  {formatNumber(settlement.finalAmount)} {settlement.currency}
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
                <label>نام دریافت‌کننده</label>
                <input
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  placeholder="نام حواله‌گیرنده"
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

              <div className="field">
                <label>روش پرداخت</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field full">
                <label>صندوق / حساب</label>
                <input
                  value={paymentAccount}
                  onChange={e => setPaymentAccount(e.target.value)}
                  placeholder="اختیاری"
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
              <h3 className="modal-title">لغو حواله {cancelTarget.hawalaNumber}</h3>

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
