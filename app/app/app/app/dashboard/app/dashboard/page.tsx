"use client";

const stats = [
  { title: "کل کاربران", value: "۱۲٬۸۴۷", icon: "👥", color: "bg-blue-50 text-blue-600" },
  { title: "حجم معاملات ۲۴ ساعت", value: "۴۸.۲ میلیارد تومان", icon: "📈", color: "bg-green-50 text-green-600" },
  { title: "برداشت‌های در انتظار", value: "۲۳", icon: "💸", color: "bg-yellow-50 text-yellow-600" },
  { title: "احراز هویت در انتظار", value: "۵۶", icon: "🪪", color: "bg-purple-50 text-purple-600" },
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
  { user: "علی محمدی", amount: "۰.۵ بیت‌کوین", status: "در انتظار" },
  { user: "سارا احمدی", amount: "۲۵۰ میلیون ریال", status: "تأیید شده" },
  { user: "رضا کریمی", amount: "۱۲ اتریوم", status: "در انتظار" },
  { user: "مریم حسینی", amount: "۱٬۲۰۰ تتر", status: "رد شده" },
  { user: "حسین رضایی", amount: "۸۰۰ میلیون ریال", status: "تأیید شده" },
];

const statusStyle: Record<string, string> = {
  "در انتظار": "bg-yellow-100 text-yellow-700",
  "تأیید شده": "bg-green-100 text-green-700",
  "رد شده": "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white rounded-2xl p-6 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-gray-500 text-sm mb-1">{stat.title}</p>
            <p className="text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold mb-6">حجم معاملات هفته اخیر (میلیارد تومان)</h3>
          <div className="flex items-end justify-between gap-3 h-48">
            {weeklyVolume.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-full bg-blue-500 rounded-t-lg hover:bg-blue-600 transition-colors"
                  style={{ height: `${item.value}%` }}
                />
                <span className="text-xs text-gray-500">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold mb-6">آخرین درخواست‌های برداشت</h3>
          <div className="space-y-3">
            {withdrawals.map((w, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm">{w.user}</p>
                  <p className="text-xs text-gray-500">{w.amount}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${statusStyle[w.status]}`}>
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
