"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type HawalaStatus = "pending" | "sent" | "paid" | "cancelled";

interface Hawala {
  id: string;
  number: string;
  date: string;
  time: string;
  type: string;

  destinationCountry: string;
  province: string;
  district: string;
  destinationText: string;

  amount: number;
  fee: number;
  finalAmount: number;
  balance: string;
  note: string;

  senderName: string;
  senderPhone: string;
  senderTelegram: string;

  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverAddress: string;

  status: HawalaStatus;
  paidAt?: string;
  paidBy?: string;
  cancelReason?: string;
}

interface FormState {
  type: string;
  senderName: string;
  senderPhone: string;
  senderTelegram: string;
  amount: string;
  fee: string;
  balance: string;
  province: string;
  district: string;
  receiverName: string;
  receiverTazkira: string;
  receiverPhone: string;
  receiverAddress: string;
  note: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

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

const emptyForm: FormState = {
  type: "send",
  senderName: "",
  senderPhone: "",
  senderTelegram: "",
  amount: "",
  fee: "",
  balance: "",
  province: "هرات",
  district: "گلران",
  receiverName: "",
  receiverTazkira: "",
  receiverPhone: "",
  receiverAddress: "",
  note: ""
};

const initialHawalas: Hawala[] = [
  {
    id: "1",
    number: "HW-0001",
    date: "1405-05-18",
    time: "10:30",
    type: "send",
    destinationCountry: "افغانستان",
    province: "هرات",
    district: "گلران",
    destinationText: "هرات — گلران",
    amount: 10000,
    fee: 200,
    finalAmount: 9800,
    balance: "10000",
    note: "",
    senderName: "احمد احمدی",
    senderPhone: "0700000000",
    senderTelegram: "@ahmad",
    receiverName: "محمود محمودی",
    receiverTazkira: "1395-654321",
    receiverPhone: "0788888888",
    receiverAddress: "",
    status: "sent"
  },
  {
    id: "2",
    number: "HW-0002",
    date: "1405-05-17",
    time: "16:10",
    type: "send",
    destinationCountry: "افغانستان",
    province: "هرات",
    district: "غوریان",
    destinationText: "هرات — غوریان",
    amount: 5000,
    fee: 100,
    finalAmount: 4900,
    balance: "",
    note: "",
    senderName: "ولی ولی",
    senderPhone: "0777777777",
    senderTelegram: "@wali",
    receiverName: "کریم کریمی",
    receiverTazkira: "1392-444444",
    receiverPhone: "0766666666",
    receiverAddress: "",
    status: "paid",
    paidAt: "1405-05-17 — 16:45",
    paidBy: "صندوقکار"
  }
];

const statusLabels: Record<HawalaStatus, string> = {
  pending: "در انتظار",
  sent: "ارسال‌شده",
  paid: "پرداخت‌شده",
  cancelled: "لغوشده"
};

const styles = `
  .hawala-app * {
    box-sizing: border-box;
  }

  .hawala-app {
    min-height: 100vh;
    background: #f3f4f6;
    padding: 24px;
    font-family: Tahoma, Arial, sans-serif;
    color: #111827;
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

  .req {
    color: #dc2626;
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

  .field input.error,
  .field select.error,
  .field textarea.error {
    border-color: #dc2626;
    background: #fff5f5;
  }

  .error-text {
    color: #dc2626;
    font-size: 12px;
    margin-top: 4px;
    font-weight: 700;
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

  .search-bar input {
    flex: 1;
    min-width: 220px;
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
    .grid {
      grid-template-columns: 1fr;
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
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState("");

  const [settleTarget, setSettleTarget] = useState<Hawala | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Hawala | null>(null);

  const [paidBy, setPaidBy] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const [toast, setToast] = useState("");

  const todayDate = useMemo(() => getNow().date, []);

  const amount = Number(form.amount || 0);
  const fee = Number(form.fee || 0);
  const finalAmount = amount - fee;
  const safeFinalAmount = finalAmount > 0 ? finalAmount : 0;

  const isHerat = form.province === "هرات";
  const destinationText = formatDestination(form.province, form.district);

  const currentHawalas = hawalas.filter(
    item => item.status === "pending" || item.status === "sent"
  );

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();

    return hawalas.filter(item => {
      if (!q) return true;

      const fields = [
        item.number,
        item.senderName,
        item.receiverName,
        item.senderPhone,
        item.receiverPhone,
        item.receiverTazkira,
        item.province,
        item.district,
        item.destinationText
      ];

      return fields.some(field => String(field || "").toLowerCase().includes(q));
    });
  }, [hawalas, historySearch]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));

    setErrors(prev => ({
      ...prev,
      [field]: undefined
    }));
  };

  const handleProvinceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newProvince = event.target.value;

    setForm(prev => ({
      ...prev,
      province: newProvince,
      district: newProvince === "هرات" ? "گلران" : newProvince
    }));

    setErrors(prev => ({
      ...prev,
      province: undefined
    }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!form.senderName.trim()) {
      newErrors.senderName = "نام و نام خانوادگی حواله‌دهنده ضروری است.";
    }

    if (!form.senderPhone.trim()) {
      newErrors.senderPhone = "شماره تماس حواله‌دهنده ضروری است.";
    }

    if (!form.receiverName.trim()) {
      newErrors.receiverName = "نام و نام خانوادگی حواله‌گیرنده ضروری است.";
    }

    if (!form.receiverTazkira.trim()) {
      newErrors.receiverTazkira = "شماره تذکره حواله‌گیرنده ضروری است.";
    }

    if (!form.receiverPhone.trim()) {
      newErrors.receiverPhone = "شماره تماس حواله‌گیرنده ضروری است.";
    }

    if (!form.amount.trim() || amount <= 0) {
      newErrors.amount = "مبلغ حواله ضروری است.";
    }

    if (fee < 0) {
      newErrors.fee = "کمیشن نمی‌تواند منفی باشد.";
    }

    if (amount > 0 && fee >= amount) {
      newErrors.fee = "کمیشن نمی‌تواند بیشتر یا برابر مبلغ حواله باشد.";
    }

    if (!form.province.trim()) {
      newErrors.province = "ولایت مقصد ضروری است.";
    }

    return newErrors;
  };

  const handleRegisterClick = () => {
    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      showToast("لطفاً فیلدهای ضروری را خانه‌پری کنید.");
      return;
    }

    setPreviewOpen(true);
  };

  const makeHawalaNumber = () => {
    return `HW-${String(hawalas.length + 1).padStart(4, "0")}`;
  };

  const confirmRegister = () => {
    const now = getNow();

    const newHawala: Hawala = {
      id: String(Date.now()),
      number: makeHawalaNumber(),
      date: now.date,
      time: now.time,
      type: form.type,

      destinationCountry: "افغانستان",
      province: form.province,
      district: form.province === "هرات" ? form.district : form.province,
      destinationText,

      amount,
      fee,
      finalAmount,
      balance: form.balance,
      note: form.note,

      senderName: form.senderName,
      senderPhone: form.senderPhone,
      senderTelegram: form.senderTelegram,

      receiverName: form.receiverName,
      receiverTazkira: form.receiverTazkira,
      receiverPhone: form.receiverPhone,
      receiverAddress: form.receiverAddress,

      status: "pending"
    };

    setHawalas(prev => [newHawala, ...prev]);
    setPreviewOpen(false);
    setForm(emptyForm);
    setErrors({});
    setActiveTab("current");
    showToast("معامله با موفقیت ثبت شد.");
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    showToast("فورم پاک شد.");
  };

  const openSettlement = (item: Hawala) => {
    setSettleTarget(item);
    setPaidAmount(String(item.finalAmount));
    setPaidBy("");
  };

  const confirmSettlement = () => {
    if (!settleTarget) return;

    if (!paidBy.trim()) {
      showToast("نام پرداخت‌کننده را بنویسید.");
      return;
    }

    const amountPaid = Number(paidAmount || settleTarget.finalAmount);

    if (amountPaid <= 0) {
      showToast("مبلغ پرداخت‌شده معتبر نیست.");
      return;
    }

    const now = getNow();

    setHawalas(prev =>
      prev.map(item =>
        item.id === settleTarget.id
          ? {
              ...item,
              status: "paid",
              paidAt: `${now.date} — ${now.time}`,
              paidBy
            }
          : item
      )
    );

    setSettleTarget(null);
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
            <div className="section-title">معلومات حواله‌دهنده</div>

            <div className="grid">
              <div className="field">
                <label>
                  نوع حواله <span className="req">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={e => setField("type", e.target.value)}
                >
                  <option value="send">ارسال</option>
                  <option value="receive">دریافت</option>
                </select>
              </div>

              <div className="field">
                <label>تاریخ</label>
                <input value={todayDate} disabled />
              </div>

              <div className="field">
                <label>
                  نام و نام خانوادگی حواله‌دهنده <span className="req">*</span>
                </label>
                <input
                  className={errors.senderName ? "error" : ""}
                  value={form.senderName}
                  onChange={e => setField("senderName", e.target.value)}
                  placeholder="نام کامل حواله‌دهنده"
                />
                {errors.senderName && (
                  <div className="error-text">{errors.senderName}</div>
                )}
              </div>

              <div className="field">
                <label>
                  شماره تماس حواله‌دهنده <span className="req">*</span>
                </label>
                <input
                  className={errors.senderPhone ? "error" : ""}
                  value={form.senderPhone}
                  onChange={e => setField("senderPhone", e.target.value)}
                  placeholder="07xxxxxxxx"
                />
                {errors.senderPhone && (
                  <div className="error-text">{errors.senderPhone}</div>
                )}
              </div>

              <div className="field">
                <label>چت آی‌دی تلگرام</label>
                <input
                  value={form.senderTelegram}
                  onChange={e => setField("senderTelegram", e.target.value)}
                  placeholder="@example یا 123456789"
                />
              </div>

              <div className="field">
                <label>کشور مقصد</label>
                <input value="افغانستان" disabled />
              </div>

              <div className="field">
                <label>
                  مبلغ حواله <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className={errors.amount ? "error" : ""}
                  value={form.amount}
                  onChange={e => setField("amount", e.target.value)}
                  placeholder="مثلاً 10000"
                />
                {errors.amount && <div className="error-text">{errors.amount}</div>}
              </div>

              <div className="field">
                <label>کمیشن حواله</label>
                <input
                  type="number"
                  min="0"
                  className={errors.fee ? "error" : ""}
                  value={form.fee}
                  onChange={e => setField("fee", e.target.value)}
                  placeholder="مثلاً 200"
                />
                {errors.fee && <div className="error-text">{errors.fee}</div>}
              </div>

              <div className="field">
                <label>مبلغ نهایی</label>
                <input value={formatNumber(safeFinalAmount)} disabled />
              </div>

              <div className="field">
                <label>باقی مانده حساب مشتری</label>
                <input
                  value={form.balance}
                  onChange={e => setField("balance", e.target.value)}
                  placeholder="اختیاری"
                />
              </div>
            </div>

            <div className="section-title">معلومات مقصد</div>

            <div className="grid">
              <div className="field">
                <label>
                  ولایت مقصد <span className="req">*</span>
                </label>
                <select
                  className={errors.province ? "error" : ""}
                  value={form.province}
                  onChange={handleProvinceChange}
                >
                  {provinces.map(province => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
                {errors.province && (
                  <div className="error-text">{errors.province}</div>
                )}
              </div>

              <div className="field">
                <label>ولسوالی مقصد</label>

                {isHerat ? (
                  <select
                    value={form.district}
                    onChange={e => setField("district", e.target.value)}
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
                <label>مقصد نهایی</label>
                <input value={destinationText} disabled />
              </div>
            </div>

            <div className="section-title">معلومات حواله‌گیرنده</div>

            <div className="grid">
              <div className="field">
                <label>
                  نام و نام خانوادگی حواله‌گیرنده <span className="req">*</span>
                </label>
                <input
                  className={errors.receiverName ? "error" : ""}
                  value={form.receiverName}
                  onChange={e => setField("receiverName", e.target.value)}
                  placeholder="نام کامل حواله‌گیرنده"
                />
                {errors.receiverName && (
                  <div className="error-text">{errors.receiverName}</div>
                )}
              </div>

              <div className="field">
                <label>
                  شماره تذکره حواله‌گیرنده <span className="req">*</span>
                </label>
                <input
                  className={errors.receiverTazkira ? "error" : ""}
                  value={form.receiverTazkira}
                  onChange={e => setField("receiverTazkira", e.target.value)}
                  placeholder="شماره تذکره حواله‌گیرنده"
                />
                {errors.receiverTazkira && (
                  <div className="error-text">{errors.receiverTazkira}</div>
                )}
              </div>

              <div className="field">
                <label>
                  شماره تماس حواله‌گیرنده <span className="req">*</span>
                </label>
                <input
                  className={errors.receiverPhone ? "error" : ""}
                  value={form.receiverPhone}
                  onChange={e => setField("receiverPhone", e.target.value)}
                  placeholder="07xxxxxxxx"
                />
                {errors.receiverPhone && (
                  <div className="error-text">{errors.receiverPhone}</div>
                )}
              </div>

              <div className="field full">
                <label>آدرس حواله‌گیرنده</label>
                <input
                  value={form.receiverAddress}
                  onChange={e => setField("receiverAddress", e.target.value)}
                  placeholder="اختیاری"
                />
              </div>
            </div>

            <div className="section-title">یادداشت</div>

            <div className="field full">
              <textarea
                rows={4}
                value={form.note}
                onChange={e => setField("note", e.target.value)}
                placeholder="یادداشت اختیاری..."
              />
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-primary" onClick={handleRegisterClick}>
                ثبت حواله
              </button>

              <button className="btn btn-secondary" onClick={resetForm}>
                پاک کردن فورم
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
                        <td>{formatNumber(item.finalAmount)}</td>
                        <td>{item.destinationText}</td>
                        <td>
                          <span className={badgeClass(item.status)}>
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
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
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="جستجو: شماره حواله، نام، شماره تماس، تذکره، مقصد..."
              />
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
                      <th>مقصد</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredHistory.map(item => (
                      <tr key={item.id}>
                        <td>{item.number}</td>
                        <td>{item.date}</td>
                        <td>{item.senderName}</td>
                        <td>{item.receiverName}</td>
                        <td>{formatNumber(item.finalAmount)}</td>
                        <td>{item.destinationText}</td>
                        <td>
                          <span className={badgeClass(item.status)}>
                            {statusLabels[item.status]}
                          </span>
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

      {previewOpen && (
        <div className="modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">جزئیات حواله قبل از ثبت</h3>

              <button className="btn btn-secondary" onClick={() => setPreviewOpen(false)}>
                بستن
              </button>
            </div>

            <div className="receipt">
              <div className="receipt-title">🏦 پیش‌نمایش حواله</div>

              <DetailRow label="تاریخ" value={todayDate} />
              <DetailRow
                label="نوع حواله"
                value={form.type === "send" ? "ارسال" : "دریافت"}
              />
              <DetailRow label="کشور مقصد" value="افغانستان" />
              <DetailRow label="مقصد" value={destinationText} />

              <div className="divider" />

              <DetailRow label="نام حواله‌دهنده" value={form.senderName} />
              <DetailRow label="شماره تماس حواله‌دهنده" value={form.senderPhone} />
              <DetailRow label="چت آی‌دی تلگرام" value={form.senderTelegram} />

              <div className="divider" />

              <DetailRow label="مبلغ حواله" value={formatNumber(amount)} />
              <DetailRow label="کمیشن حواله" value={formatNumber(fee)} />
              <DetailRow
                label="مبلغ نهایی"
                value={formatNumber(safeFinalAmount)}
              />
              <DetailRow label="باقی مانده حساب مشتری" value={form.balance} />

              <div className="divider" />

              <DetailRow label="نام حواله‌گیرنده" value={form.receiverName} />
              <DetailRow label="شماره تذکره حواله‌گیرنده" value={form.receiverTazkira} />
              <DetailRow label="شماره تماس حواله‌گیرنده" value={form.receiverPhone} />
              <DetailRow label="آدرس حواله‌گیرنده" value={form.receiverAddress} />

              {form.note && <DetailRow label="یادداشت" value={form.note} />}
            </div>

            <div className="actions" style={{ marginTop: "18px" }}>
              <button className="btn btn-success" onClick={confirmRegister}>
                ثبت نهایی حواله
              </button>

              <button className="btn btn-secondary" onClick={() => setPreviewOpen(false)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {settleTarget && (
        <div className="modal-overlay" onClick={() => setSettleTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تسویه حواله {settleTarget.number}</h3>

              <button className="btn btn-secondary" onClick={() => setSettleTarget(null)}>
                بستن
              </button>
            </div>

            <div className="summary">
              <div className="summary-row">
                <span>حواله‌گیرنده</span>
                <strong>{settleTarget.receiverName}</strong>
              </div>

              <div className="summary-row">
                <span>شماره تذکره</span>
                <strong>{settleTarget.receiverTazkira}</strong>
              </div>

              <div className="summary-row">
                <span>شماره تماس</span>
                <strong>{settleTarget.receiverPhone}</strong>
              </div>

              <div className="summary-row">
                <span>مبلغ نهایی</span>
                <strong>{formatNumber(settleTarget.finalAmount)}</strong>
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

              <button className="btn btn-secondary" onClick={() => setSettleTarget(null)}>
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
