// app/components/InstallPWAButton.tsx
"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // ۱. بررسی نصب بودن اپ
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // ۲. تشخیص iOS و Safari
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const safari =
      /Safari/.test(ua) &&
      !/Chrome/.test(ua) &&
      !/Chromium/.test(ua) &&
      !/Android/.test(ua);

    setIsIOS(ios);
    setIsSafari(safari);

    // ۳. اگر iOS Safari است، راهنما را نشان بده
    if (ios && safari) {
      setShowIOSGuide(true);
      return;
    }

    // ۴. گوش دادن به رویداد beforeinstallprompt (اندروید/کروم)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // اگر اپ نصب است، هیچ چیزی نمایش نده
  if (isStandalone) return null;

  // دکمه نصب برای اندروید/کروم
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("کاربر نصب را پذیرفت");
    } else {
      console.log("کاربر نصب را رد کرد");
    }
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  // حالت iOS Safari: راهنمای متنی
  if (showIOSGuide) {
    return (
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white text-gray-800 px-5 py-4 rounded-xl shadow-lg z-[1000] max-w-[90vw] text-center"
        dir="rtl"
      >
        <p className="text-sm mb-2 leading-6">
          برای نصب اپ روی گوشی:
          <br />
          روی <strong>اشتراک‌گذاری (Share)</strong> بزنید
          <br />
          سپس <strong>«Add to Home Screen»</strong> را انتخاب کنید.
        </p>
        <button
          onClick={() => setShowIOSGuide(false)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-md text-xs transition-colors"
        >
          بستن
        </button>
      </div>
    );
  }

  // حالت اندروید/کروم: دکمه نصب
  if (canInstall && deferredPrompt) {
    return (
      <button
        onClick={handleInstallClick}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-lg z-[1000] transition-colors"
        dir="rtl"
      >
        📲 نصب اپلیکیشن
      </button>
    );
  }

  return null;
}
