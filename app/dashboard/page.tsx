import StatsCards from "./components/StatsCards";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">داشبورد</h1>
      <StatsCards />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">فعالیت‌های اخیر</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>🔹 کاربر جدید ثبت‌نام کرد: علی محمدی</p>
            <p>🔹 برداشت ۰.۵ بیت‌کوین تأیید شد</p>
            <p>🔹 درخواست احراز هویت از سارا احمدی</p>
            <p>🔹 معامله جدید ETH/USDT به ارزش ۲,۵۰۰ دلار</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">وضعیت سیستم</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>سرور معاملات</span>
              <span className="text-green-600 font-medium">فعال</span>
            </div>
            <div className="flex justify-between">
              <span>کیف پول‌ها</span>
              <span className="text-green-600 font-medium">فعال</span>
            </div>
            <div className="flex justify-between">
              <span>تأییدیه‌های امنیتی</span>
              <span className="text-yellow-600 font-medium">۲ مورد در انتظار</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
