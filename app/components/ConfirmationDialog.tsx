"use client";

// 🔴 دیالوگ تأیید حذف — کامپوننت مشترک برای تمام تب‌ها
// استایل: پس‌زمینه شیشه‌ای (backdrop blur)، انیمیشن fade-in، RTL با فونت وزیرمتن
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface ConfirmationState {
  title?: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // قرمز برای عملیات حذف/باطل‌سازی
  onConfirm: () => void;
}

export function useConfirmation() {
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  return { confirmation, ask: setConfirmation, close: () => setConfirmation(null) };
}

export default function ConfirmationDialog({
  state,
  onClose,
}: {
  state: ConfirmationState | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) {
      setVisible(false);
      return;
    }
    // انیمیشن fade-in بعد از mount شدن modal
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const {
    title = "تأیید حذف",
    message = "آیا مطمئن هستید که می‌خواهید این مورد را حذف کنید؟",
    description = "این عمل قابل بازگشت نیست و تمام اطلاعات مرتبط حذف خواهد شد.",
    confirmLabel = "حذف",
    cancelLabel = "انصراف",
    danger = true,
  } = state;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* پس‌زمینه شیشه‌ای */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* کارت دیالوگ — در موبایل تمام عرض نمی‌گیرد (p-4 margin دارد) */}
      <div
        role="alertdialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl text-right transition-transform duration-200 ${
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-2"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${
                danger ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"
              }`}
            >
              <svg
                className={`w-6 h-6 ${danger ? "text-red-600" : "text-amber-600"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white font-[Vazirmatn]">
              {title}
            </h2>
          </div>

          <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{message}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">{description}</p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98] ${
              danger
                ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-all duration-150 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** بسته‌بندی محتوا + دیالوگ؛ هر صفحه‌ای که از useConfirmation استفاده می‌کند این را render کند */
export function WithConfirmation({
  children,
  confirmation,
  close,
}: {
  children: ReactNode;
  confirmation: ConfirmationState | null;
  close: () => void;
}) {
  return (
    <>
      {children}
      <ConfirmationDialog state={confirmation} onClose={close} />
    </>
  );
}
