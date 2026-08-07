```tsx
return (
  <div dir="rtl" className="min-h-screen bg-[#f5f7fb] space-y-6 pb-8">

    {/* ================= HEADER ================= */}
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#071a2b] via-[#0b263b] to-[#123a50] p-6 md:p-8 text-white shadow-[0_20px_60px_rgba(7,26,43,0.18)]">

      {/* Decorative circles */}
      <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
      <div className="absolute -bottom-32 right-10 w-72 h-72 rounded-full bg-[#e7b75a]/10 blur-3xl" />

      <div className="relative z-10">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

          <div className="flex items-center gap-4">

            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center text-3xl shadow-lg">
              🏦
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#e7b75a] text-xs md:text-sm font-bold">
                  داشبورد مدیریت
                </span>

                <span className="px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-[10px]">
                  ● فعال
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-black mt-1">
                صرافی و حواله‌جات برادران نورزاد
              </h1>

              <p className="text-white/50 text-xs mt-1">
                📍 هرات، افغانستان
              </p>
            </div>

          </div>

          {d.lastUpdated && (
            <div className="self-start md:self-auto rounded-2xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] text-white/40 mb-1">
                آخرین بروزرسانی
              </p>

              <p className="text-sm font-bold">
                🕐 {d.lastUpdated.toLocaleTimeString("fa-IR")}
              </p>
            </div>
          )}

        </div>


        {/* ================= RATES ================= */}
        <div className="mt-7">

          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💱</span>
            <span className="text-sm font-bold text-white/80">
              نرخ‌های امروز
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

            <RateBox
              icon="🇺🇸"
              title="دالر"
              code="USD"
              value={d.rates.usd}
            />

            <RateBox
              icon="🇪🇺"
              title="یورو"
              code="EUR"
              value={d.rates.eur}
            />

            <RateBox
              icon="🇵🇰"
              title="کلدار"
              code="PKR"
              value={d.rates.pkr}
            />

            <RateBox
              icon="🇮🇷"
              title="تومان"
              code="IRT"
              value={d.rates.toman}
            />

          </div>

        </div>

      </div>
    </section>


    {/* ================= ERRORS ================= */}
    {errors.length > 0 && (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 shadow-sm">

        <div className="flex items-center gap-2 font-bold mb-2">
          <span className="text-xl">⚠️</span>
          <span>هشدار سیستم</span>
        </div>

        <ul className="list-disc pr-6 space-y-1 text-xs">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>

      </div>
    )}


    {/* ================= MAIN KPI ================= */}
    <section>

      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xl">📊</span>

        <div>
          <h2 className="text-base font-black text-slate-800">
            خلاصه وضعیت
          </h2>

          <p className="text-[11px] text-slate-400">
            وضعیت کلی فعالیت‌های مالی سیستم
          </p>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <KpiCard
          icon="💸"
          title="حواله‌ها"
          value={faNum(d.hawalaCount)}
          sub={"حجم کل " + faNum(d.hawalaVolume) + " افغانی"}
          totals={d.hawalaTotals}
          fa={faNum}
          accent="blue"
        />

        <KpiCard
          icon="💱"
          title="تبادل ارز"
          value={faNum(d.tradeCount)}
          sub={"حجم کل " + faNum(d.tradeVolume) + " افغانی"}
          totals={d.tradeTotals}
          fa={faNum}
          accent="gold"
        />

        <KpiCard
          icon="💰"
          title="مانده سیستم"
          value={null}
          sub="مجموع مانده حساب مشتریان"
          totals={{
            AFN: d.accounts.AFN,
            USD: d.accounts.USD,
            IRT: d.accounts.IRR,
            EUR: d.accounts.EUR,
            PKR: d.accounts.PKR
          }}
          fa={faNum}
          accent="green"
        />

      </div>

    </section>


    {/* ================= TODAY ================= */}
    <section>

      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xl">📅</span>

        <div>
          <h2 className="text-base font-black text-slate-800">
            وضعیت امروز
          </h2>

          <p className="text-[11px] text-slate-400">
            خلاصه فعالیت‌های مالی امروز
          </p>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

        <StatChip
          icon="📨"
          label="حواله امروز"
          value={faNum(d.todayHawalaCount)}
          sub={faNum(d.todayHawalaFee) + " کمیشن"}
          accent="blue"
        />

        <StatChip
          icon="📈"
          label="تبادل امروز"
          value={faNum(d.todayTradeCount)}
          sub={faNum(d.todayTradeProfit) + " مفاد"}
          accent="green"
        />

        <StatChip
          icon="⏳"
          label="حواله در انتظار"
          value={faNum(d.pendingHawala)}
          sub="نیازمند پیگیری"
          accent="orange"
        />

        <StatChip
          icon="👤"
          label="طلب مشتری"
          value={faNum(d.totalDebt)}
          sub="مجموع بدهی مشتریان"
          accent="red"
        />

        <StatChip
          icon="🏦"
          label="طلب صرافی"
          value={faNum(d.totalReceivable)}
          sub="مجموع طلب صرافی"
          accent="purple"
        />

      </div>

    </section>


    {/* ================= PROFIT ================= */}
    <section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <FinancialCard
          icon="💵"
          title="کمیشن کل حواله‌ها"
          value={faNum(d.hawalaFee)}
          subtitle="مجموع کمیشن ثبت‌شده"
          accent="blue"
        />

        <FinancialCard
          icon="📈"
          title="مفاد کل معاملات"
          value={faNum(d.tradeProfit)}
          subtitle={`بر اساس کارمزد ${d.commission}٪`}
          accent="green"
        />

      </div>

    </section>

  </div>
);


/* ==========================================================================
   RATE BOX
   ========================================================================== */

function RateBox({
  icon,
  title,
  code,
  value,
}: {
  icon: string;
  title: string;
  code: string;
  value: number;
}) {
  return (
    <div className="group rounded-2xl bg-white/[0.07] hover:bg-white/[0.11] border border-white/10 px-4 py-3 transition-all duration-300">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <span className="text-xl">
            {icon}
          </span>

          <div>
            <p className="text-xs font-bold text-white/80">
              {title}
            </p>

            <p className="text-[9px] text-white/30 uppercase">
              {code}
            </p>
          </div>

        </div>

        <div className="text-left">
          <p className="text-[#e7b75a] text-base font-black">
            {value}
          </p>

          <p className="text-[9px] text-white/30">
            AFN
          </p>
        </div>

      </div>

    </div>
  );
}


/* ==========================================================================
   KPI CARD
   ========================================================================== */

function KpiCard({
  icon,
  title,
  value,
  sub,
  totals,
  fa,
  accent = "blue",
}: {
  icon: string;
  title: string;
  value: string | null;
  sub: string;
  totals: Record<CurCode, number>;
  fa: (n: number) => string;
  accent?: "blue" | "gold" | "green";
}) {

  const rows: { code: CurCode; label: string; emoji: string }[] = [
    { code: "AFN", label: "افغانی", emoji: "🇦🇫" },
    { code: "USD", label: "دالر", emoji: "🇺🇸" },
    { code: "IRT", label: "تومان", emoji: "🇮🇷" },
    { code: "EUR", label: "یورو", emoji: "🇪🇺" },
    { code: "PKR", label: "کلدار", emoji: "🇵🇰" },
  ];

  const accentClasses = {
    blue: "from-blue-500/10 to-transparent",
    gold: "from-[#e7b75a]/15 to-transparent",
    green: "from-emerald-500/10 to-transparent",
  };

  return (
    <div className="group relative overflow-hidden rounded-[24px] bg-white border border-slate-100 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.09)] hover:-translate-y-1 transition-all duration-300">

      <div
        className={`absolute inset-0 bg-gradient-to-br ${accentClasses[accent]} pointer-events-none`}
      />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
              {icon}
            </div>

            <div>
              <p className="text-sm font-black text-slate-800">
                {title}
              </p>

              <p className="text-[10px] text-slate-400 mt-0.5">
                {sub}
              </p>
            </div>

          </div>

          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
            ↗
          </div>

        </div>


        {value && (
          <div className="mt-5">

            <p className="text-3xl font-black tracking-tight text-slate-900">
              {value}
            </p>

            <p className="text-[10px] text-slate-400 mt-1">
              تعداد ثبت‌شده
            </p>

          </div>
        )}


        <div className={`${value ? "mt-5" : "mt-6"} space-y-2.5`}>

          {rows.map((r) => (

            <div
              key={r.code}
              className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 border border-slate-100/70"
            >

              <div className="flex items-center gap-2">

                <span className="text-base">
                  {r.emoji}
                </span>

                <span className="text-xs font-medium text-slate-500">
                  {r.label}
                </span>

              </div>

              <span className="text-xs font-black text-slate-700">
                {fa(totals[r.code] || 0)}
              </span>

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}


/* ==========================================================================
   STAT CHIP
   ========================================================================== */

function StatChip({
  icon,
  label,
  value,
  sub,
  accent = "blue",
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "orange" | "red" | "purple";
}) {

  const accentClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-rose-50 text-rose-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="group rounded-[20px] bg-white border border-slate-100 p-4 shadow-[0_5px_20px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">

      <div className="flex items-start justify-between gap-2">

        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${accentClasses[accent]}`}
        >
          {icon}
        </div>

        <span className="text-[9px] text-slate-300">
          امروز
        </span>

      </div>

      <p className="text-xs text-slate-400 font-medium mt-4">
        {label}
      </p>

      <p className="text-xl font-black text-slate-900 mt-1">
        {value}
      </p>

      {sub && (
        <p className="text-[10px] text-slate-500 mt-1">
          {sub}
        </p>
      )}

    </div>
  );
}


/* ==========================================================================
   FINANCIAL CARD
   ========================================================================== */

function FinancialCard({
  icon,
  title,
  value,
  subtitle,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  subtitle: string;
  accent: "blue" | "green";
}) {

  const isGreen = accent === "green";

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white border border-slate-100 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">

      <div
        className={`absolute -left-10 -top-10 w-32 h-32 rounded-full blur-3xl ${
          isGreen ? "bg-emerald-400/10" : "bg-blue-400/10"
        }`}
      />

      <div className="relative flex items-center justify-between">

        <div className="flex items-center gap-4">

          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
              isGreen
                ? "bg-emerald-50"
                : "bg-blue-50"
            }`}
          >
            {icon}
          </div>

          <div>

            <p className="text-sm font-bold text-slate-500">
              {title}
            </p>

            <p className="text-[10px] text-slate-400 mt-1">
              {subtitle}
            </p>

          </div>

        </div>

        <div className="text-left">

          <p
            className={`text-2xl md:text-3xl font-black ${
              isGreen
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            {value}
          </p>

          <p className="text-[10px] text-slate-400 mt-1">
            افغانی
          </p>

        </div>

      </div>

    </div>
  );
}
```
