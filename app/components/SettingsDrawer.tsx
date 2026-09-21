"use client";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import {
  doc, setDoc, getDoc, onSnapshot,
  collection, getDocs, writeBatch, deleteDoc, Timestamp
} from "firebase/firestore";
import { db } from "../dashboard/lib/firebase";

const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "fx-hawalas";
const CASH_KEY = "fx-cash";
const SETTINGS_KEY = "fx-settings";

const FIREBASE_COLLECTIONS = [
  'customers', 'transactions', 'hawalas', 'cash',
  'exchanges', 'rates', 'settings', 'users', 'logs'
];

type Settings = {
  email: string;
  supportEmail: string;
  language: "dari" | "pashto" | "english";
  teamName: string;
  teamAddress: string;
  teamPhone: string;
  telegram: {
    enabled: boolean;
    botToken: string;
    chatIds: string[];
    notifyNewHawala: boolean;
    notifySettlement: boolean;
    notifyVoid: boolean;
    notifyExchange: boolean;
  };
};

const defaultSettings: Settings = {
  email: "",
  supportEmail: "",
  language: "dari",
  teamName: "صرافی برادران نورزاد",
  teamAddress: "هرات، افغانستان",
  teamPhone: "",
  telegram: {
    enabled: false,
    botToken: "",
    chatIds: [],
    notifyNewHawala: true,
    notifySettlement: true,
    notifyVoid: true,
    notifyExchange: true,
  },
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    let migratedChatIds: string[] = [];
    if (parsed.telegram?.chatIds && Array.isArray(parsed.telegram.chatIds)) {
      migratedChatIds = parsed.telegram.chatIds;
    } else if (parsed.telegram?.chatId) {
      migratedChatIds = String(parsed.telegram.chatId)
        .split(/[\n,]+/)
        .map((id: string) => id.trim())
        .filter(Boolean);
    }
    return {
      ...defaultSettings,
      ...parsed,
      telegram: {
        ...defaultSettings.telegram,
        ...parsed.telegram,
        chatIds: migratedChatIds
      }
    };
  } catch {
    return defaultSettings;
  }
}

// ✅ نسخه اصلاح‌شده و ایمن: بازسازی انواع خاص Firebase و حذف مقادیر undefined
function restoreFirestoreTypes(data: any): any {
  if (data === null) return null;
  if (data === undefined) return null; // فایربیس مقدار undefined را در batch قبول نمی‌کند
  
  if (typeof data === "object") {
    // تشخیص و بازسازی Timestamp
    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
      return new Timestamp(data._seconds, data._nanoseconds);
    }
    
    // پردازش آرایه‌ها
    if (Array.isArray(data)) {
      return data.map(restoreFirestoreTypes).filter(item => item !== undefined);
    }
    
    // پردازش آبجکت‌ها
    const restored: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const val = restoreFirestoreTypes(data[key]);
        if (val !== undefined) {
          restored[key] = val;
        }
      }
    }
    return restored;
  }
  return data;
}

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    gear: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    mail: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
    globe: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
    backup: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
    telegram: "M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5",
    x: "M6 18 18 6M6 6l12 12",
    check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5",
    upload: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
    chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
    plus: "M12 4.5v15m7.5-7.5h-15",
    info: "M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[n] || ""} />
    </svg>
  );
};

export default function SettingsDrawer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [activeAccordion, setActiveAccordion] = useState<string | null>("email");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisData, setDiagnosisData] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const latestSettingsRef = useRef(settings);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestSettingsRef.current = settings;

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("fx-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("fx-theme", theme); } catch {}
  }, [theme]);

  const dk = theme === "dark";

  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const docRef = doc(db, "app_settings", "global_settings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fbSettings = docSnap.data().value as Settings;
          let migratedChatIds: string[] = [];
          if (fbSettings?.telegram?.chatIds && Array.isArray(fbSettings.telegram.chatIds)) {
            migratedChatIds = fbSettings.telegram.chatIds;
          }
          const finalSettings: Settings = {
            ...defaultSettings,
            ...fbSettings,
            telegram: { ...defaultSettings.telegram, ...fbSettings?.telegram, chatIds: migratedChatIds }
          };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          setSettings(finalSettings);
        } else {
          setSettings(loadSettings());
        }
        setMounted(true);
      } catch (error) {
        console.warn("⚠️ عدم دسترسی به فایربیس، استفاده از حافظه محلی:", error);
        setSettings(loadSettings());
        setMounted(true);
      }
    };
    loadInitialSettings();
  }, [db]);

  useEffect(() => {
    const docRef = doc(db, "app_settings", "global_settings");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const fbSettings = snapshot.data().value as Settings;
        if (JSON.stringify(fbSettings) !== JSON.stringify(latestSettingsRef.current)) {
          let migratedChatIds: string[] = [];
          if (fbSettings?.telegram?.chatIds && Array.isArray(fbSettings.telegram.chatIds)) {
            migratedChatIds = fbSettings.telegram.chatIds;
          }
          const finalSettings: Settings = {
            ...defaultSettings,
            ...fbSettings,
            telegram: { ...defaultSettings.telegram, ...fbSettings?.telegram, chatIds: migratedChatIds }
          };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          setSettings(finalSettings);
        }
      }
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "app_settings", "global_settings"), {
          value: settings,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        console.error("❌ خطا در ذخیره فایربیس:", error);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [settings, mounted, db]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-settings-toggle]")) setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => setToast(""), 4000);
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateTelegram = useCallback((updates: Partial<Settings["telegram"]>) => {
    setSettings(prev => ({ ...prev, telegram: { ...prev.telegram, ...updates } }));
  }, []);

  const scanLocalStorage = () => {
    const result: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          result[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          result[key] = localStorage.getItem(key);
        }
      }
    }
    return result;
  };

  const scanSessionStorage = () => {
    const result: Record<string, any> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          result[key] = JSON.parse(sessionStorage.getItem(key) || 'null');
        } catch {
          result[key] = sessionStorage.getItem(key);
        }
      }
    }
    return result;
  };

  const scanFirebase = async () => {
    const result: Record<string, any[]> = {};
    for (const col of FIREBASE_COLLECTIONS) {
      try {
        const snapshot = await getDocs(collection(db, col));
        result[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`⚠️ خطا در خواندن collection ${col}:`, err);
        result[col] = [];
      }
    }
    return result;
  };

  // ===================== بک‌آپ =====================
  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    try {
      showToast("⏳ در حال جمع‌آوری داده‌ها از Firebase...");

      const firebaseData = await scanFirebase();
      const localStorageData = scanLocalStorage();
      const sessionStorageData = scanSessionStorage();

      const data = {
        version: "3.1", // ارتقا نسخه برای ردیابی اصلاحات
        exportDate: new Date().toISOString(),
        settings: settings,
        localStorage: localStorageData,
        sessionStorage: sessionStorageData,
        firebase: firebaseData,
      };

      console.log("📦 گزارش بک‌آپ جامع:", {
        localStorageKeys: Object.keys(localStorageData),
        sessionStorageKeys: Object.keys(sessionStorageData),
        firebaseCollections: Object.fromEntries(
          Object.entries(firebaseData).map(([k, v]) => [k, v.length])
        ),
      });

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exchange-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("✅ پشتیبان کامل (Firebase + LocalStorage) دانلود شد");
    } catch (err) {
      console.error("❌ خطای بک‌آپ:", err);
      showToast("❌ خطا در ایجاد پشتیبان", "error");
    } finally {
      setIsBackingUp(false);
    }
  }, [settings, showToast]);

  // ===================== بازیابی (نسخه نهایی و مقاوم در برابر خطا) =====================
  const handleRestore = useCallback(async (file: File) => {
    setIsRestoring(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const result = e.target?.result;
        if (!result) {
          showToast("❌ فایل خالی یا نامعتبر است", "error");
          setIsRestoring(false);
          return;
        }

        const data = JSON.parse(result as string);
        if (!data.version) {
          showToast("❌ فرمت فایل پشتیبان نامعتبر است", "error");
          setIsRestoring(false);
          return;
        }

        console.log("🚀 [شروع بازیابی] نسخه:", data.version);

        // ۱. بازیابی localStorage
        if (data.localStorage) {
          console.log("💾 بازیابی LocalStorage...", Object.keys(data.localStorage).length, "کلید");
          Object.entries(data.localStorage).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              localStorage.setItem(key, JSON.stringify(value));
            }
          });
        }

        // ۲. بازیابی sessionStorage
        if (data.sessionStorage) {
          console.log("💾 بازیابی SessionStorage...", Object.keys(data.sessionStorage).length, "کلید");
          Object.entries(data.sessionStorage).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              sessionStorage.setItem(key, JSON.stringify(value));
            }
          });
        }

        // ۳. بازیابی Firebase (بخش اصلاح‌شده و ایمن)
        if (data.firebase) {
          showToast("⏳ در حال بازیابی داده‌های Firebase (لطفاً صبر کنید)...");
          console.log("🔥 شروع بازیابی Firebase...");

          for (const [colName, docs] of Object.entries(data.firebase)) {
            if (!Array.isArray(docs) || docs.length === 0) {
              console.log(`⏭️ پرش از ${colName} (خالی است یا داده‌ای ندارد)`);
              continue;
            }

            console.log(`📂 پردازش collection: ${colName} (${(docs as any[]).length} سند)`);

            try {
              // الف) حذف اسناد قدیمی به صورت تکه‌تکه
              const oldSnapshot = await getDocs(collection(db, colName));
              if (oldSnapshot.size > 0) {
                console.log(`🗑️ در حال حذف ${oldSnapshot.size} سند قدیمی از ${colName}...`);
                const deleteChunkSize = 400;
                for (let i = 0; i < oldSnapshot.size; i += deleteChunkSize) {
                  const deleteBatch = writeBatch(db);
                  oldSnapshot.docs.slice(i, i + deleteChunkSize).forEach(d => deleteBatch.delete(d.ref));
                  await deleteBatch.commit();
                }
                console.log(`✅ حذف اسناد قدیمی ${colName} تکمیل شد.`);
              }

              // ب) نوشتن اسناد جدید به صورت تکه‌تکه با پاکسازی داده‌ها
              const writeChunkSize = 400;
              const totalDocs = (docs as any[]).length;
              let successCount = 0;

              for (let i = 0; i < totalDocs; i += writeChunkSize) {
                const chunk = (docs as any[]).slice(i, i + writeChunkSize);
                const batch = writeBatch(db);

                chunk.forEach((docData: any) => {
                  // بررسی اعتبار ID
                  if (!docData || !docData.id) {
                    console.warn("⚠️ یک سند بدون ID معتبر نادیده گرفته شد:", docData);
                    return;
                  }

                  const docId = String(docData.id);
                  const { id, ...rest } = docData; // جداسازی ID از داده‌ها
                  
                  // بازسازی انواع داده (مثل Timestamp)
                  const cleanData = restoreFirestoreTypes(rest);
                  
                  // پاکسازی نهایی: حذف هرگونه مقدار undefined که باعث کرش فایربیس می‌شود
                  const sanitizedData = Object.fromEntries(
                    Object.entries(cleanData).filter(([_, value]) => value !== undefined)
                  );

                  const docRef = doc(db, colName, docId);
                  batch.set(docRef, sanitizedData);
                  successCount++;
                });

                await batch.commit();
                console.log(`✅ نوشته شد: ${successCount} از ${totalDocs} در ${colName}`);
              }

            } catch (err: any) {
              console.error(`❌ خطای فاجعه‌بار در collection ${colName}:`, err);
              throw new Error(`شکست در بازیابی ${colName}: ${err.message}`);
            }
          }
        }

        // ۴. بازیابی تنظیمات
        if (data.settings) {
          let migratedChatIds: string[] = [];
          if (data.settings.telegram?.chatIds && Array.isArray(data.settings.telegram.chatIds)) {
            migratedChatIds = data.settings.telegram.chatIds;
          } else if (data.settings.telegram?.chatId) {
            migratedChatIds = String(data.settings.telegram.chatId)
              .split(/[\n,]+/)
              .map((id: string) => id.trim())
              .filter(Boolean);
          }

          const finalSettings: Settings = {
            ...defaultSettings,
            ...data.settings,
            telegram: {
              ...defaultSettings.telegram,
              ...data.settings.telegram,
              chatIds: migratedChatIds
            }
          };

          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          try {
            await setDoc(doc(db, "app_settings", "global_settings"), {
              value: finalSettings,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (fbErr) {
            console.warn("⚠️ خطا در همگام‌سازی تنظیمات:", fbErr);
          }
        }

        console.log("🎉 [پایان موفقیت‌آمیز] تمام داده‌ها بازیابی شدند.");
        showToast("✅ بازیابی با موفقیت انجام شد. صفحه در حال رفرش...", "success");

        // ارسال رویداد سفارشی برای اطلاع‌رسانی به سایر کامپوننت‌ها
        window.dispatchEvent(new CustomEvent('fx-data-restored', { 
          detail: { timestamp: Date.now() } 
        }));

        // رفرش واقعی صفحه پس از ۲ ثانیه
        setTimeout(() => {
          window.location.reload();
        }, 2000);

      } catch (err: any) {
        console.error("💥 [خطای مرگبار بازیابی]:", err);
        showToast(`❌ خطا: ${err.message || "فایل نامعتبر است"}`, "error");
        setIsRestoring(false);
      }
    };

    reader.onerror = () => {
      showToast("❌ خطا در خواندن فایل", "error");
      setIsRestoring(false);
    };
    reader.readAsText(file);
  }, [showToast, db]);

  // ===================== تشخیص =====================
  const runDiagnosis = useCallback(async () => {
    const summary: any = {
      localStorage: scanLocalStorage(),
      sessionStorage: scanSessionStorage(),
      firebase: {},
    };

    for (const col of FIREBASE_COLLECTIONS) {
      try {
        const snapshot = await getDocs(collection(db, col));
        summary.firebase[col] = {
          count: snapshot.size,
          sample: snapshot.docs.slice(0, 2).map(d => ({ id: d.id, ...d.data() }))
        };
      } catch (err) {
        summary.firebase[col] = { error: String(err) };
      }
    }

    setDiagnosisData(summary);
    setShowDiagnosis(true);
    console.log("🔍 گزارش تشخیص جامع:", summary);
  }, []);

  if (!mounted) return null;

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const panelBg = dk ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200";
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-11 w-full px-3.5 ${inputShell}`;
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;

  const fld = (label: string, node: ReactNode) => (
    <div><label className={uiLabel}>{label}</label>{node}</div>
  );

  const AccordionItem = ({ id, icon, title, children }: { id: string; icon: string; title: string; children: ReactNode }) => {
    const isOpen = activeAccordion === id;
    return (
      <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
        <button onClick={() => setActiveAccordion(isOpen ? null : id)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 transition-colors ${dk ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
              <Ic n={icon} className="h-4 w-4" />
            </span>
            <span className={`text-sm font-black ${heading}`}>{title}</span>
          </div>
          <Ic n="chevron" className={`h-4 w-4 transition-transform duration-300 ${subText} ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className={`px-4 pb-4 pt-2 ${dk ? "border-t border-slate-700" : "border-t border-slate-100"}`}>
            {children}
          </div>
        </div>
      </div>
    );
  };

  const Toggle = ({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) => (
    <button type="button" onClick={() => onChange(!enabled)} className="flex items-center gap-3 cursor-pointer group">
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${enabled ? "bg-emerald-500" : dk ? "bg-slate-600" : "bg-slate-300"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${enabled ? "-translate-x-1" : "-translate-x-6"}`} />
      </span>
      {label && <span className={`text-sm font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{label}</span>}
    </button>
  );

  return (
    <>
      <button
        data-settings-toggle
        onClick={() => setOpen(!open)}
        className={`fixed top-4 left-4 z-50 grid h-12 w-12 place-items-center rounded-xl border shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${open ? dk ? "bg-emerald-400 text-slate-900 border-emerald-400" : "bg-emerald-500 text-white border-emerald-500" : dk ? "bg-slate-800 text-emerald-300 border-slate-600 hover:border-emerald-400" : "bg-white text-emerald-600 border-slate-200 hover:border-emerald-400"}`}
        title="تنظیمات"
      >
        <Ic n="gear" className={`h-6 w-6 transition-transform duration-500 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />}

      <div ref={panelRef} className={`fixed top-0 left-0 z-50 h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"} ${panelBg} border-r shadow-2xl overflow-y-auto`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur ${dk ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
              <Ic n="gear" className="h-5 w-5" />
            </span>
            <div>
              <h2 className={`text-lg font-black ${heading}`}>تنظیمات</h2>
              <p className={`text-[10px] font-bold ${subText}`}>پیکربندی سیستم صرافی</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${dk ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
            <Ic n="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">

          {/* ===== ایمیل ===== */}
          <AccordionItem id="email" icon="mail" title="ایمیل (جیمیل)">
            <div className="space-y-3">
              {fld("ایمیل صرافی", <input type="email" dir="ltr" value={settings.email} onChange={e => updateSettings({ email: e.target.value })} placeholder="example@gmail.com" className={`${uiInput} text-left`} />)}
              {fld("ایمیل پشتیبانی", <input type="email" dir="ltr" value={settings.supportEmail} onChange={e => updateSettings({ supportEmail: e.target.value })} placeholder="support@gmail.com" className={`${uiInput} text-left`} />)}
              <button onClick={() => showToast("تغییرات به صورت خودکار ذخیره می‌شوند")} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" /> ذخیره ایمیل
              </button>
            </div>
          </AccordionItem>

          {/* ===== زبان ===== */}
          <AccordionItem id="language" icon="globe" title="زبان سیستم">
            <div className="space-y-2">
              {([
                { value: "dari", label: "دری (فارسی)", flag: "🇦🇫" },
                { value: "pashto", label: "پشتو", flag: "🇦🇫" },
                { value: "english", label: "English", flag: "🇬🇧" },
              ] as const).map(lang => (
                <button key={lang.value} onClick={() => { updateSettings({ language: lang.value }); showToast(`زبان به ${lang.label} تغییر کرد`); }} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all ${settings.language === lang.value ? dk ? "border-emerald-400 bg-emerald-400/10" : "border-emerald-500 bg-emerald-50" : dk ? "border-slate-600 hover:border-slate-500" : "border-slate-200 hover:border-slate-300"}`}>
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`flex-1 text-right text-sm font-bold ${heading}`}>{lang.label}</span>
                  {settings.language === lang.value && <Ic n="check" className={`h-5 w-5 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />}
                </button>
              ))}
            </div>
          </AccordionItem>

          {/* ===== اطلاعات تیم ===== */}
          <AccordionItem id="team" icon="users" title="اطلاعات تیم">
            <div className="space-y-3">
              {fld("نام تیم / صرافی", <input value={settings.teamName} onChange={e => updateSettings({ teamName: e.target.value })} placeholder="صرافی برادران نورزاد" className={uiInput} />)}
              {fld("آدرس", <input value={settings.teamAddress} onChange={e => updateSettings({ teamAddress: e.target.value })} placeholder="هرات، افغانستان" className={uiInput} />)}
              {fld("شماره تماس", <input dir="ltr" value={settings.teamPhone} onChange={e => updateSettings({ teamPhone: e.target.value })} placeholder="+93 700 000 000" className={`${uiInput} text-left`} />)}
              <button onClick={() => showToast("تغییرات به صورت خودکار ذخیره می‌شوند")} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" /> ذخیره اطلاعات تیم
              </button>
            </div>
          </AccordionItem>

          {/* ===== پشتیبان‌گیری ===== */}
          <AccordionItem id="backup" icon="backup" title="پشتیبان‌گیری جامع">
            <div className="space-y-3">
              <div className={`rounded-xl p-3 text-xs ${dk ? "bg-amber-500/10 border border-amber-500/30 text-amber-200" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                💡 این بک‌آپ شامل <b>تمام داده‌ها</b> از Firebase و حافظه محلی است (حواله‌ها، معاملات، مشتریان و...).<br />
                <span className="text-[10px] opacity-80">نسخه ۳.۱: رفع مشکل مقادیر undefined و بهبود پایدارنویسی Batch.</span>
              </div>

              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ic n="download" className="h-4 w-4" />
                {isBackingUp ? "در حال جمع‌آوری..." : "دانلود پشتیبان کامل"}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${dk ? "border-slate-600 text-slate-200 hover:bg-slate-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
              >
                <Ic n="upload" className="h-4 w-4" />
                {isRestoring ? "در حال بازیابی..." : "بازیابی از فایل"}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleRestore(file); e.target.value = ""; }} />

              <button onClick={runDiagnosis} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-black transition-all active:scale-95 ${dk ? "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" : "border-amber-500 text-amber-600 hover:bg-amber-50"}`}>
                <Ic n="info" className="h-4 w-4" /> تشخیص ذخیره‌سازی
              </button>
            </div>
          </AccordionItem>

          {/* ===== تلگرام ===== */}
          <AccordionItem id="telegram" icon="telegram" title="تنظیمات تلگرام">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${heading}`}>فعال‌سازی تلگرام</span>
                <Toggle enabled={settings.telegram.enabled} onChange={v => updateTelegram({ enabled: v })} />
              </div>
              {settings.telegram.enabled && (
                <>
                  {fld("توکن بات (Bot Token)", <input dir="ltr" value={settings.telegram.botToken} onChange={e => updateTelegram({ botToken: e.target.value })} placeholder="123456789:ABCdefGHI..." className={`${uiInput} text-left font-mono text-xs`} />)}

                  <div className="space-y-2">
                    <label className={uiLabel}>لیست چت آی‌دی‌ها (Chat IDs)</label>
                    <div className="space-y-2">
                      {settings.telegram.chatIds.map((id, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input dir="ltr" value={id} onChange={e => {
                            const newIds = [...settings.telegram.chatIds];
                            newIds[idx] = e.target.value;
                            updateTelegram({ chatIds: newIds });
                          }} placeholder="-1001234567890" className={`${uiInput} text-left font-mono text-xs flex-1`} />
                          <button onClick={() => {
                            const newIds = settings.telegram.chatIds.filter((_, i) => i !== idx);
                            updateTelegram({ chatIds: newIds });
                          }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors" title="حذف">
                            <Ic n="x" className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => updateTelegram({ chatIds: [...settings.telegram.chatIds, ""] })} className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs font-bold transition-colors ${dk ? "border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-300" : "border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"}`}>
                        <Ic n="plus" className="h-4 w-4" /> افزودن چت آی‌دی جدید
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3 space-y-3 ${dk ? "border-slate-600" : "border-slate-200"}`}>
                    <p className={`text-xs font-black ${heading}`}>اعلان‌ها:</p>
                    <Toggle enabled={settings.telegram.notifyNewHawala} onChange={v => updateTelegram({ notifyNewHawala: v })} label="حواله جدید" />
                    <Toggle enabled={settings.telegram.notifySettlement} onChange={v => updateTelegram({ notifySettlement: v })} label="تسویه حواله" />
                    <Toggle enabled={settings.telegram.notifyVoid} onChange={v => updateTelegram({ notifyVoid: v })} label="لغو حواله" />
                    <Toggle enabled={settings.telegram.notifyExchange} onChange={v => updateTelegram({ notifyExchange: v })} label="تبادل ارز" />
                  </div>

                  <button onClick={() => showToast("✅ تنظیمات با موفقیت همگام‌سازی شد")} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95">
                    <Ic n="check" className="h-4 w-4" /> تأیید و همگام‌سازی تنظیمات
                  </button>
                </>
              )}
            </div>
          </AccordionItem>

          <div className={`mt-4 rounded-xl p-4 text-center ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
            <p className={`text-[10px] font-bold ${subText}`}>نسخه ۳.۱.۰ — صرافی برادران نورزاد</p>
          </div>
        </div>
      </div>

      {/* ===== مودال تشخیص ===== */}
      {showDiagnosis && diagnosisData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDiagnosis(false)}>
          <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${dk ? "bg-slate-900 border border-slate-700" : "bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`sticky top-0 flex items-center justify-between border-b px-5 py-4 ${dk ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
              <h3 className={`text-lg font-black ${heading}`}>🔍 گزارش تشخیص جامع</h3>
              <button onClick={() => setShowDiagnosis(false)} className={`grid h-9 w-9 place-items-center rounded-lg ${dk ? "hover:bg-slate-700" : "hover:bg-slate-100"}`}>
                <Ic n="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`rounded-xl p-4 ${dk ? "bg-slate-800" : "bg-slate-50"}`}>
                <h4 className={`text-sm font-black mb-3 ${heading}`}>💾 LocalStorage ({Object.keys(diagnosisData.localStorage).length} کلید):</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(diagnosisData.localStorage).map(([key, value]) => (
                    <div key={key} className={`flex items-center justify-between p-2 rounded text-xs ${dk ? "bg-slate-700/50" : "bg-white"}`}>
                      <span className={`font-mono ${heading}`}>{key}</span>
                      <span className={subText}>
                        {Array.isArray(value) ? `${value.length} آیتم` : typeof value === 'object' ? 'Object' : 'string'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl p-4 ${dk ? "bg-slate-800" : "bg-slate-50"}`}>
                <h4 className={`text-sm font-black mb-3 ${heading}`}>🔥 Firebase Collections:</h4>
                <div className="space-y-2">
                  {Object.entries(diagnosisData.firebase).map(([col, info]: [string, any]) => (
                    <div key={col} className={`flex items-center justify-between p-2 rounded-lg ${dk ? "bg-slate-700/50" : "bg-white"}`}>
                      <span className={`text-xs font-mono ${heading}`}>{col}</span>
                      <span className={`text-xs font-black ${info.count > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {info.error ? "خطا" : `${info.count} سند`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl p-4 border-2 ${dk ? "border-emerald-500/50 bg-emerald-500/10" : "border-emerald-500 bg-emerald-50"}`}>
                <p className={`text-xs font-black mb-2 ${heading}`}>💡 نتیجه:</p>
                <ul className={`text-xs space-y-1 ${subText}`}>
                  <li>• اگر collection های Firebase (مثل hawalas, transactions) تعداد زیادی سند دارند، <b>داده‌های شما در Firebase ذخیره می‌شوند</b>.</li>
                  <li>• بک‌آپ نسخه ۳.۱ <b>هم Firebase و هم localStorage</b> را ذخیره می‌کند و مشکل مقادیر undefined را حل کرده است.</li>
                  <li>• این گزارش را در کنسول (F12) هم می‌توانید ببینید.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition-all duration-300 ${toastType === "success" ? dk ? "bg-emerald-400 text-slate-900" : "bg-emerald-500 text-white" : dk ? "bg-rose-400 text-slate-900" : "bg-rose-500 text-white"}`}>
          {toast}
        </div>
      )}
    </>
  );
}
