"use client";

const stats = [
  { 
    title: "کل کاربران", 
    value: "۱۲٬۸۴۷", 
    icon: "👥", 
    change: "+۱۲٪", 
    changeType: "up",
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/30"
  },
  { 
    title: "حجم معاملات ۲۴ ساعت", 
    value: "۴۸.۲ میلیارد تومان", 
    icon: "📈", 
    change: "+۸٪", 
    changeType: "up",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/30"
  },
  { 
    title: "برداشت‌های در انتظار", 
    value: "۲۳", 
    icon: "💸", 
    change: "-۵٪", 
    changeType: "down",
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/30"
  },
  { 
    title: "احراز هویت در انتظار", 
    value: "۵۶", 
    icon: "🪪", 
    change: "+۳٪", 
    changeType: "up",
    gradient: "from-rose-500 to-pink-600",
    shadow: "shadow-rose-500/30"
  },
];

const weeklyVolume = [
  { day: "شنبه", value: 65 },
  { day: "یکشنبه", value: 80 },
  { day: "دوشنبه", value: 45 },
  { day: "سه‌شنبه", value: 90 },
  { day: "چهارشنبه", value: 70 },
  { day: "پنجشنبه", value: 100 },
  { day: "جمعه", value: 55 },
];

const withdrawals = [
  { user: "علی محمدی", amount: "۰.۵ بیت‌کوین", status: "در انتظار", avatar: "ع" },
  { user: "سارا احمدی", amount: "۲۵۰ میلیون ریال", status: "تأیید شده", avatar: "س" },
  { user: "رضا کریمی", amount: "۱۲ اتریوم", status: "در انتظار", avatar: "ر" },
  { user: "مریم حسینی", amount: "۱٬۲۰۰ تتر", status: "رد شده", avatar: "م" },
  { user: "حسین رضایی", amount: "۸۰۰ میلیون ریال", status: "تأیید شده", avatar: "ح" },
];

const statusStyle: Record<string, string> = {
  "در انتظار": "bg-amber-100 text-amber-700 border-amber-200",
  "تأیید شده": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "رد شده": "bg-rose-100 text-rose-700 border-rose-200",
};

const avatarColors = [
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-rose-500 to-pink-600",
  "bg-gradient-to-br from-indigo-500 to-blue-600",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* کارت‌های آمار */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.title} 
            className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-2xl shadow-lg ${stat.shadow}`}>
                {stat.icon}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                stat.changeType === "up" 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "bg-rose-50 text-rose-600"
              }`}>
                {stat.change}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-4 mb-1">{stat.title}</p>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* نمودار حجم معاملات */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-800">حجم معاملات هفته اخیر</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">میلیارد تومان</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyVolume.map((item, index) => (
              <div key={item.day} className="flex flex-col items-center gap-2 flex-1 group">
                <div 
                  className={`w-full rounded-xl transition-all duration-300 group-hover:opacity-80 ${
                    index === 5 
                      ? "bg-gradient-to-t from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/30" 
                      : "bg-gradient-to-t from-slate-200 to-slate-100"
                  }`}
                  style={{ height: `${item.value}%` }}
                />
                <span className="text-xs text-slate-500">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* آخرین برداشت‌ها */}
        <div className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-800">آخرین درخواست‌های برداشت</h3>
            <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              مشاهده همه ←
            </button>
          </div>
          <div className="space-y-3">
            {withdrawals.map((w, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${avatarColors[i]} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow`}>
                    {w.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-800">{w.user}</p>
                    <p className="text-xs text-slate-500">{w.amount}</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1.5 rounded-full border ${statusStyle[w.status]}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
