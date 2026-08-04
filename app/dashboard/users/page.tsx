"use client";

import { useState } from "react";

const initialUsers = [
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
  const [users, setUsers] = useState(initialUsers);
  const [selectedUser, setSelectedUser] = useState<typeof initialUsers[0] | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", balance: "" });

  const handleEdit = (user: typeof initialUsers[0]) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleBlock = (user: typeof initialUsers[0]) => {
    setSelectedUser(user);
    setShowBlockModal(true);
  };

  const confirmBlock = () => {
    if (selectedUser) {
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, status: u.status === "فعال" ? "مسدود" : "فعال" }
          : u
      ));
    }
    setShowBlockModal(false);
    setSelectedUser(null);
  };

  const handleAdd = () => {
    if (newUser.name && newUser.email && newUser.balance) {
      setUsers([...users, {
        id: users.length + 1,
        name: newUser.name,
        email: newUser.email,
        status: "فعال",
        balance: newUser.balance,
      }]);
      setNewUser({ name: "", email: "", balance: "" });
      setShowAddModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl"
        >
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
                    <button 
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      ویرایش
                    </button>
                    <button 
                      onClick={() => handleBlock(user)}
                      className={`text-sm font-medium ${user.status === "فعال" ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}`}
                    >
                      {user.status === "فعال" ? "مسدود" : "فعال‌سازی"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal ویرایش */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">ویرایش کاربر</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">نام</label>
                <input
                  type="text"
                  defaultValue={selectedUser.name}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">ایمیل</label>
                <input
                  type="email"
                  defaultValue={selectedUser.email}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">موجودی</label>
                <input
                  type="text"
                  defaultValue={selectedUser.balance}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal مسدود/فعال‌سازی */}
      {showBlockModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">تأیید عملیات</h2>
            <p className="text-gray-600 mb-6">
              آیا مطمئن هستید که می‌خواهید کاربر <strong>{selectedUser.name}</strong> را {selectedUser.status === "فعال" ? "مسدود" : "فعال"} کنید؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBlockModal(false); setSelectedUser(null); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={confirmBlock}
                className={`flex-1 py-2 rounded-xl text-white ${selectedUser.status === "فعال" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                تأیید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal افزودن کاربر */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">افزودن کاربر جدید</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">نام</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">ایمیل</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">موجودی</label>
                <input
                  type="text"
                  value={newUser.balance}
                  onChange={(e) => setNewUser({ ...newUser, balance: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: ۱ بیت‌کوین"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setNewUser({ name: "", email: "", balance: "" }); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl"
              >
                افزودن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
