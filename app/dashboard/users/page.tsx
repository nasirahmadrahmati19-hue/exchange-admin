"use client";

const users = [
  { id: 1, name: "علی محمدی", email: "ali@example.com", status: "فعال", balance: "۱۲.۵ بیت‌کوین" },
  { id: 2, name: "سارا احمدی", email: "sara@example.com", status: "فعال", balance: "۲۵۰ میلیون ریال" },
  { id: 3, name: "رضا کریمی", email: "reza@example.com", status: "مسدود", balance: "۱۲ اتریوم" },
  { id: 4, name: "مریم حسینی", email: "maryam@example.com", status: "فعال", balance: "۱٬۲۰۰ تتر" },
  { id: 5, name: "حسین رضایی", email: "hossein@example.com", status: "فعال", balance: "۸۰۰ میلیون ریال" },
];

const statusStyle: Record<string, string> = {
  "فعال": "bg-green-100 text-green-700",
  "مسدود": "bg-red-100 text-red-700",
};

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl">
          + افزودن کاربر
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">شناسه</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">نام</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">ایمیل</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">موجودی</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">وضعیت</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{user.id}</td>
                <td className="px-6 py-4 text-sm font-medium">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 text-sm">{user.balance}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-3 py-1 rounded-full ${statusStyle[user.status]}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">ویرایش</button>
                    <button className="text-red-600 hover:text-red-800 text-sm">مسدود</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
