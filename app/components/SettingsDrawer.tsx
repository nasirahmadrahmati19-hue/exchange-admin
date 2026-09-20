"use client";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import {
  doc, setDoc, getDoc, onSnapshot,
  collection, collectionGroup, getDocs, writeBatch,
  query, orderBy, startAfter, limit, documentId,
  Timestamp, GeoPoint,
} from "firebase/firestore";
import { db } from "../dashboard/lib/firebase";
const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "fx-hawalas";
const CASH_KEY = "fx-cash";
const SETTINGS_KEY = "fx-settings";
const LOCAL_KEYS = [CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, SETTINGS_KEY];
const FIREBASE_COLLECTIONS = [
  "customers", "transactions", "hawalas", "cash",
  "exchanges", "rates", "settings", "users", "logs",
  "app_settings",
];
const WRITE_CHUNK = 400;
const READ_CHUNK = 400;
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
function isTimestampLike(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const seconds = data._seconds ?? data.seconds;
  const nanoseconds = data._nanoseconds ?? data.nanoseconds;
  if (typeof seconds !== "number" || typeof nanoseconds !== "number") return false;
  const keys = Object.keys(data);
  return keys.every((k) =>
    ["_seconds", "_nanoseconds", "seconds", "nanoseconds", "type"].includes(k)
  );
}
function isGeoPointLike(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const lat = data._lat ?? data.latitude;
  const lng = data._long ?? data.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  const keys = Object.keys(data);
  return keys.every((k) =>
    ["_lat", "_long", "latitude", "longitude"].includes(k)
  );
}
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
        chatIds: migratedChatIds,
      },
    };
  } catch {
    return defaultSettings;
  }
}
function restoreFirestoreTypes(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === "object") {
    if (isTimestampLike(data)) {
      return new Timestamp(
        data._seconds ?? data.seconds,
        data._nanoseconds ?? data.nanoseconds
      );
    }
    if (isGeoPointLike(data)) {
      return new GeoPoint(
        data._lat ?? data.latitude,
        data._long ?? data.longitude
      );
    }
    if (Array.isArray(data)) {
      return data.map(restoreFirestoreTypes);
    }
    const restored: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = restoreFirestoreTypes(data[key]);
        if (value !== undefined) restored[key] = value;
      }
    }
    return restored;
  }
  return data;
}
function safeSerialize(data: any): any {
  if (data === null || data === undefined) return data;
  if (
    data instanceof Timestamp ||
    (data && typeof data.toDate === "function" && typeof data.seconds === "number")
  ) {
    return { _seconds: data.seconds, _nanoseconds: data.nanoseconds ?? 0 };
  }
  if (
    data instanceof GeoPoint ||
    (data && typeof data.latitude === "number" && typeof data.longitude === "number" && typeof data.isEqual === "function")
  ) {
    return { _lat: data.latitude, _long: data.longitude };
  }
  if (data instanceof Date) {
    return { _seconds: Math.floor(data.getTime() / 1000), _nanoseconds: 0 };
  }
  if (Array.isArray(data)) {
    return data.map(safeSerialize);
  }
  if (typeof data === "object") {
    const result: any = {};
    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (typeof data[key] === "function") continue;
      result[key] = safeSerialize(data[key]);
    }
    return result;
  }
  return data;
}
function serializeDoc(d: { id: string; ref: { path: string }; data: () => any }) {
  return safeSerialize({
    ...d.data(),
    __docId: d.id,
    __path: d.ref.path,
  });
}
async function fetchAllFromQuery(baseQuery: any) {
  const docs: any[] = [];
  let last: any = null;
  for (;;) {
    const pageQuery = last
      ? query(baseQuery, orderBy(documentId()), startAfter(last), limit(READ_CHUNK))
      : query(baseQuery, orderBy(documentId()), limit(READ_CHUNK));
    const snapshot = await getDocs(pageQuery);
    if (snapshot.empty) break;
    docs.push(...snapshot.docs);
    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < READ_CHUNK) break;
  }
  return docs;
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
  const [restoreLog, setRestoreLog] = useState<string[]>([]);
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
    try {
      window.localStorage.setItem("fx-theme", theme);
    } catch {}
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
            telegram: { ...defaultSettings.telegram, ...fbSettings?.telegram, chatIds: migratedChatIds },
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
  }, []);
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
            telegram: { ...defaultSettings.telegram, ...fbSettings?.telegram, chatIds: migratedChatIds },
          };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          setSettings(finalSettings);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "app_settings", "global_settings"), {
          value: settings,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error("❌ خطا در ذخیره فایربیس:", error);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [settings, mounted]);
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
    toastTimeoutRef.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);
  const updateTelegram = useCallback((updates: Partial<Settings["telegram"]>) => {
    setSettings((prev) => ({ ...prev, telegram: { ...prev.telegram, ...updates } }));
  }, []);
  const scanLocalStorage = () => {
    const result: Record<string, any> = {};
    for (const key of LOCAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || result[key] !== undefined) continue;
      try {
        result[key] = JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        result[key] = localStorage.getItem(key);
      }
    }
    return result;
  };
  const scanSessionStorage = () => {
    const result: Record<string, any> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      try {
        result[key] = JSON.parse(sessionStorage.getItem(key) || "null");
      } catch {
        result[key] = sessionStorage.getItem(key);
      }
    }
    return result;
  };
  const scanFirebase = async () => {
    const result: Record<string, any[]> = {};
    const errors: Record<string, string> = {};
    for (const col of FIREBASE_COLLECTIONS) {
      const byPath = new Map<string, any>();
      try {
        const topDocs = await fetchAllFromQuery(collection(db, col));
        for (const d of topDocs) byPath.set(d.ref.path, serializeDoc(d));
      } catch (err: any) {
        errors[col] = err?.message || String(err);
      }
      try {
        const groupDocs = await fetchAllFromQuery(collectionGroup(db, col));
        for (const d of groupDocs) {
          if (!byPath.has(d.ref.path)) byPath.set(d.ref.path, serializeDoc(d));
        }
      } catch (err: any) {
        if (!errors[col]) errors[`${col}__group`] = err?.message || String(err);
      }
      result[col] = Array.from(byPath.values());
    }
    return { result, errors };
  };
  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    try {
      showToast("⏳ در حال جمع‌آوری داده‌ها از Firebase...");
      const { result: firebaseData, errors } = await scanFirebase();
      const localStorageData = scanLocalStorage();
      const sessionStorageData = scanSessionStorage();
      const stats: Record<string, number> = {};
      let totalDocs = 0;
      for (const [col, docs] of Object.entries(firebaseData)) {
        stats[col] = docs.length;
        totalDocs += docs.length;
      }
      if (totalDocs === 0) {
        showToast("⚠️ هیچ سندی از Firebase خوانده نشد. فایل را بررسی کنید", "error");
      }
      const data = {
        version: "3.1",
        exportDate: new Date().toISOString(),
        settings,
        localStorage: localStorageData,
        sessionStorage: sessionStorageData,
        firebase: firebaseData,
        _errors: errors,
        _stats: stats,
        _totalDocs: totalDocs,
      };
      console.log("📦 گزارش بک‌آپ:", { stats, totalDocs, errors });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exchange-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const errorCount = Object.keys(errors).length;
      showToast(
        errorCount
          ? `⚠️ پشتیبان دانلود شد (${totalDocs} سند، ${errorCount} خطا)`
          : `✅ پشتیبان دانلود شد (${totalDocs} سند از Firebase)`
      );
    } catch (err: any) {
      console.error("❌ خطای بک‌آپ:", err);
      showToast(`❌ خطا: ${err.message}`, "error");
    } finally {
      setIsBackingUp(false);
    }
  }, [settings, showToast]);
  const handleRestore = useCallback(async (file: File) => {
    setIsRestoring(true);
    setRestoreLog([]);
    const addLog = (msg: string) => {
      console.log(msg);
      setRestoreLog((prev) => [...prev, msg]);
    };
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
          showToast("❌ فایل نامعتبر است (نسخه ندارد)", "error");
          setIsRestoring(false);
          return;
        }
        addLog(`🚀 شروع بازیابی نسخه ${data.version}`);
        if (data._totalDocs === 0) {
          addLog("⚠️ این فایل ۰ سند Firebase دارد. معاملات از Firebase برنمی‌گردند");
        }
        if (data.localStorage) {
          const keys = Object.keys(data.localStorage);
          addLog(`💾 بازیابی localStorage: ${keys.length} کلید`);
          for (const [key, value] of Object.entries(data.localStorage)) {
            if (value !== null && value !== undefined) {
              try {
                localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
              } catch (err: any) {
                addLog(`⚠️ خطا در نوشتن کلید ${key}: ${err.message}`);
              }
            }
          }
          addLog("✅ localStorage بازیابی شد");
        }
        if (data.sessionStorage) {
          const keys = Object.keys(data.sessionStorage);
          addLog(`💾 بازیابی sessionStorage: ${keys.length} کلید`);
          for (const [key, value] of Object.entries(data.sessionStorage)) {
            if (value !== null && value !== undefined) {
              try {
                sessionStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
              } catch (err: any) {
                addLog(`⚠️ خطا در نوشتن کلید ${key}: ${err.message}`);
              }
            }
          }
          addLog("✅ sessionStorage بازیابی شد");
        }
        if (data.firebase) {
          addLog("🔥 شروع بازیابی Firebase (بدون پاک‌کردن کل داده‌های فعلی)...");
          const collections = Object.entries(data.firebase);
          let totalRestored = 0;
          for (const [colName, docs] of collections) {
            if (!Array.isArray(docs) || docs.length === 0) {
              addLog(`⏭️ ${colName}: خالی (پرش — چیزی حذف نشد)`);
              continue;
            }
            addLog(`📂 ${colName}: ${docs.length} سند در حال نوشتن...`);
            try {
              for (let i = 0; i < docs.length; i += WRITE_CHUNK) {
                const chunk = docs.slice(i, i + WRITE_CHUNK);
                const batch = writeBatch(db);
                for (const docData of chunk) {
                  const raw = docData as any;
                  const docId = String(raw.__docId || raw.id || "");
                  const path = typeof raw.__path === "string" ? raw.__path : "";
                  let docRef;
                  if (path && path.split("/").filter(Boolean).length >= 2) {
                    docRef = doc(db, ...path.split("/").filter(Boolean));
                  } else if (docId && docId !== "undefined" && docId !== "null") {
                    docRef = doc(db, colName, docId);
                  } else {
                    addLog(`⚠️ سند بدون ID در ${colName} رد شد`);
                    continue;
                  }
                  const { __docId, __path, ...rest } = raw;
                  const cleanData = restoreFirestoreTypes(rest);
                  batch.set(docRef, cleanData);
                }
                await batch.commit();
                const written = Math.min(i + WRITE_CHUNK, docs.length);
                addLog(`✅ ${colName}: ${written} از ${docs.length} نوشته شد`);
              }
              totalRestored += docs.length;
            } catch (err: any) {
              addLog(`❌ خطا در ${colName}: ${err.message}`);
              throw new Error(`شکست در ${colName}: ${err.message}`);
            }
          }
          addLog(`🎉 بازیابی Firebase تکمیل شد: ${totalRestored} سند`);
        }
        if (data.settings) {
          addLog("⚙️ بازیابی تنظیمات...");
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
              chatIds: migratedChatIds,
            },
          };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          try {
            await setDoc(doc(db, "app_settings", "global_settings"), {
              value: finalSettings,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (fbErr: any) {
            addLog(`⚠️ خطا در همگام‌سازی تنظیمات: ${fbErr.message}`);
          }
          addLog("✅ تنظیمات بازیابی شد");
        }
        addLog("🏁 پایان موفقیت‌آمیز بازیابی!");
        showToast("✅ تمام داده‌ها بازیابی شدند. صفحه در حال بروزرسانی...", "success");
        setTimeout(() => {
          window.location.replace(window.location.origin + window.location.pathname + "?r=" + Date.now());
        }, 2500);
      } catch (err: any) {
        addLog(`💥 خطای نهایی: ${err.message}`);
        console.error("💥 خطای بازیابی:", err);
        showToast(`❌ خطا: ${err.message}`, "error");
        setIsRestoring(false);
      }
    };
    reader.onerror = () => {
      showToast("❌ خطا در خواندن فایل", "error");
      setIsRestoring(false);
    };
    reader.readAsText(file);
  }, [showToast]);
  const runDiagnosis = useCallback(async () => {
    const summary: any = {
      localStorage: scanLocalStorage(),
      sessionStorage: scanSessionStorage(),
      firebase: {},
    };
    for (const col of FIREBASE_COLLECTIONS) {
      try {
        const topDocs = await fetchAllFromQuery(collection(db, col));
        let groupCount = 0;
        try {
          const groupDocs = await fetchAllFromQuery(collectionGroup(db, col));
          groupCount = groupDocs.length;
        } catch (err: any) {
          summary.firebase[col] = {
            count: topDocs.length,
            groupCount: 0,
            groupError: err.message,
            sample: topDocs.slice(0, 2).map((d: any) => ({ id: d.id, path: d.ref.path })),
          };
          continue;
        }
        summary.firebase[col] = {
          count: topDocs.length,
          groupCount,
          sample: topDocs.slice(0, 2).map((d: any) => ({ id: d.id, path: d.ref.path })),
        };
      } catch (err: any) {
        summary.firebase[col] = { error: err.message, count: 0 };
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
    <div>
      <label className={uiLabel}>{label}</label>
      {node}
    </div>
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
          <AccordionItem id="email" icon="mail" title="ایمیل (جیمیل)">
            <div className="space-y-3">
              {fld("ایمیل صرافی", <input type="email" dir="ltr" value={settings.email} onChange={(e) => updateSettings({ email: e.target.value })} placeholder="example@gmail.com" className={`${uiInput} text-left`} />)}
              {fld("ایمیل پشتیبانی", <input type="email" dir="ltr" value={settings.supportEmail} onChange={(e) => updateSettings({ supportEmail: e.target.value })} placeholder="support@gmail.com" className={`${uiInput} text-left`} />)}
              <button onClick={() => showToast("تغییرات به صورت خودکار ذخیره می‌شوند")} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" /> ذخیره ایمیل
              </button>
            </div>
          </AccordionItem>
          <AccordionItem id="language" icon="globe" title="زبان سیستم">
            <div className="space-y-2">
              {([
                { value: "dari", label: "دری (فارسی)", flag: "🇦🇫" },
                { value: "pashto", label: "پشتو", flag: "🇦🇫" },
                { value: "english", label: "English", flag: "🇬🇧" },
              ] as const).map((lang) => (
                <button key={lang.value} onClick={() => { updateSettings({ language: lang.value }); showToast(`زبان به ${lang.label} تغییر کرد`); }} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all ${settings.language === lang.value ? dk ? "border-emerald-400 bg-emerald-400/10" : "border-emerald-500 bg-emerald-50" : dk ? "border-slate-600 hover:border-slate-500" : "border-slate-200 hover:border-slate-300"}`}>
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`flex-1 text-right text-sm font-bold ${heading}`}>{lang.label}</span>
                  {settings.language === lang.value && <Ic n="check" className={`h-5 w-5 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />}
                </button>
              ))}
            </div>
          </AccordionItem>
          <AccordionItem id="team" icon="users" title="اطلاعات تیم">
            <div className="space-y-3">
              {fld("نام تیم / صرافی", <input value={settings.teamName} onChange={(e) => updateSettings({ teamName: e.target.value })} placeholder="صرافی برادران نورزاد" className={uiInput} />)}
              {fld("آدرس", <input value={settings.teamAddress} onChange={(e) => updateSettings({ teamAddress: e.target.value })} placeholder="هرات، افغانستان" className={uiInput} />)}
              {fld("شماره تماس", <input dir="ltr" value={settings.teamPhone} onChange={(e) => updateSettings({ teamPhone: e.target.value })} placeholder="+93 700 000 000" className={`${uiInput} text-left`} />)}
              <button onClick={() => showToast("تغییرات به صورت خودکار ذخیره می‌شوند")} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white transition-all hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" /> ذخیره اطلاعات تیم
              </button>
            </div>
          </AccordionItem>
          <AccordionItem id="backup" icon="backup" title="پشتیبان‌گیری جامع">
            <div className="space-y-3">
              <div className={`rounded-xl p-3 text-xs ${dk ? "bg-amber-500/10 border border-amber-500/30 text-amber-200" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                💡 این بک‌آپ شامل <b>تمام داده‌ها</b> از Firebase و حافظه محلی است.
                <br />
                <span className="text-[10px] opacity-80">نسخه ۳.۱: مسیر سند + Timestamp + بدون حذف کل دیتابیس هنگام بازیابی</span>
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
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleRestore(file); e.target.value = ""; }} />
              <button onClick={runDiagnosis} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-black transition-all active:scale-95 ${dk ? "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" : "border-amber-500 text-amber-600 hover:bg-amber-50"}`}>
                <Ic n="info" className="h-4 w-4" /> تشخیص ذخیره‌سازی
              </button>
              {restoreLog.length > 0 && (
                <div className={`rounded-xl border p-3 max-h-48 overflow-y-auto text-[11px] font-mono space-y-1 ${dk ? "border-slate-600 bg-slate-800 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  <p className={`text-xs font-black mb-2 ${heading}`}>📋 گزارش بازیابی:</p>
                  {restoreLog.map((log, i) => (
                    <p key={i} className={log.includes("❌") || log.includes("💥") ? "text-rose-500" : log.includes("✅") || log.includes("🎉") ? "text-emerald-500" : ""}>
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </AccordionItem>
          <AccordionItem id="telegram" icon="telegram" title="تنظیمات تلگرام">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${heading}`}>فعال‌سازی تلگرام</span>
                <Toggle enabled={settings.telegram.enabled} onChange={(v) => updateTelegram({ enabled: v })} />
              </div>
              {settings.telegram.enabled && (
                <>
                  {fld("توکن بات (Bot Token)", <input dir="ltr" value={settings.telegram.botToken} onChange={(e) => updateTelegram({ botToken: e.target.value })} placeholder="123456789:ABCdefGHI..." className={`${uiInput} text-left font-mono text-xs`} />)}
                  <div className="space-y-2">
                    <label className={uiLabel}>لیست چت آی‌دی‌ها (Chat IDs)</label>
                    <div className="space-y-2">
                      {settings.telegram.chatIds.map((id, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input dir="ltr" value={id} onChange={(e) => {
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
                    <Toggle enabled={settings.telegram.notifyNewHawala} onChange={(v) => updateTelegram({ notifyNewHawala: v })} label="حواله جدید" />
                    <Toggle enabled={settings.telegram.notifySettlement} onChange={(v) => updateTelegram({ notifySettlement: v })} label="تسویه حواله" />
                    <Toggle enabled={settings.telegram.notifyVoid} onChange={(v) => updateTelegram({ notifyVoid: v })} label="لغو حواله" />
                    <Toggle enabled={settings.telegram.notifyExchange} onChange={(v) => updateTelegram({ notifyExchange: v })} label="تبادل ارز" />
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
      {showDiagnosis && diagnosisData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDiagnosis(false)}>
          <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${dk ? "bg-slate-900 border border-slate-700" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>
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
                        {Array.isArray(value) ? `${(value as any[]).length} آیتم` : typeof value === "object" && value ? "Object" : "string"}
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
                      <span className={`text-xs font-black ${info.count > 0 || info.groupCount > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {info.error ? `خطا: ${info.error}` : `${info.count} سند${info.groupCount ? ` / group ${info.groupCount}` : ""}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition-all duration-300 ${toastType === "success" ? dk ? "bg-emerald-400 text-slate-900" : "bg-emerald-500 text-white" : dk ? "bg-rose-400 text-slate-900" : "bg-rose-500 text-white"}`}>
          {toast}
        </div>
      )}
    </>
  );
}
