"use client";
import { useState } from "react";

const initialUsers = [
  { id: 1, name: "علی محمدی", email: "ali@example.com", status: "active" },
  { id: 2, name: "سارا احمدی", email: "sara@example.com", status: "blocked" },
  { id: 3, name: "محمد رضایی", email: "mohammad@example.com", status: "active" },
  { id: 4, name: "زهرا حسینی", email: "zahra@example.com", status: "active" },
];

export default function UsersPage() {
  const [users, setUsers] = useState(initialUsers);
  const [editUser, setEditUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const toggleBlock = (id: number) => {
    setUsers(
      users.map((u) =>
        u.id === id ? { ...u, status: u.status === "active" ? "blocked" : "active" } : u
      )
    );
  };

  const openEdit = (user: any) => {
    setEditUser({ ...user });
    setShowModal(true);
  };

  const saveEdit = () => {
    if (!editUser) return;
    setUsers(users.map((u) => (u.id === editUser.id ? editUser : u)));
    setShowModal(false);
    setEditUser(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">مدیریت کاربران</h1>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-3 px-4 text-right">ردیف</th>
              <th className="py-3 px-4 text-right">نام</th>
              <th className="py-3 px-4 text-right">ایمیل</th>
              <th className="py-3 px-4 text-right">وضعیت</th>
              <th className="py-3 px-4 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">{user.id}</td>
                <td className="py-3 px-4">{user.name}</td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.status === "active" ? "فعال" : "مسدود"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => toggleBlock(user.id)}
                      className={`px-3 py-1 text-xs rounded-lg transition ${
                        user.status === "active"
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {user.status === "active" ? "مسدود کردن" : "رفع مسدودی"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* مودال ویرایش */}
      {showModal && editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ویرایش کاربر</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">نام</label>
                <input
                  type="text"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ایمیل</label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                انصراف
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
