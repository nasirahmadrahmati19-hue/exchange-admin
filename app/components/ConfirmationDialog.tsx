"use client";

// 🔴 دیالوگ تأیید حذف — کامپوننت مشترک برای تمام تب‌ها
// استایل: Bottom Sheet که از پایین صفحه بالا می‌آید (موبایل و دسکتاپ)
// پس‌زمینه شیشه‌ای (backdrop blur)، انیمیشن slide-up، RTL با فونت وزیرمتن
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
    <div dir="rtl" className="confirmation-dialog-root">
      {/* پس‌زمینه تار (backdrop) با افکت شیشه‌ای */}
      <div
        className={`confirmation-dialog-backdrop ${visible ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet — همیشه از پایین صفحه بالا می‌آید (موبایل و دسکتاپ) */}
      <div
        role="alertdialog"
        aria-modal="true"
        className={`confirmation-dialog ${visible ? "open" : ""}`}
      >
        {/* هندل (خط کوچک بالای شیت) */}
        <div className="confirmation-dialog-handle" />

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
          <h2 className="confirmation-dialog-title font-[Vazirmatn]">{title}</h2>
        </div>

        <p className="confirmation-dialog-message confirmation-dialog-message-strong">
          {message}
        </p>
        <p className="confirmation-dialog-message">{description}</p>

        <div className="confirmation-dialog-buttons">
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`confirmation-dialog-button ${
              danger
                ? "confirmation-dialog-button-delete"
                : "confirmation-dialog-button-confirm"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="confirmation-dialog-button confirmation-dialog-button-cancel"
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
