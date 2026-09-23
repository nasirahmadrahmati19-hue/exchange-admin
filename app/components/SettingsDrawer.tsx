"use client";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../dashboard/lib/firebase";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, type User } from "firebase/auth";

const SETTINGS_KEY = "fx-settings";

// 🚨 ایمیل مالک اصلی (شما)
const OWNER_EMAIL = "nasirahmadrahmati19@gmail.com";

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
    chatIds?: string[];
    chatId?: string;
    notifyNewHawala: boolean;
    notifySettlement: boolean;
    notifyVoid: boolean;
    notifyExchange: boolean;
  };
};

type AuthorizedUser = {
  email: string;
  role: "admin" | "user";
  addedAt: number;
};

const defaultSettings: Settings = {
  email: "", supportEmail: "", language: "dari", teamName: "صرافی برادران نورزاد",
  teamAddress: "هرات، افغانستان", teamPhone: "",
  telegram: { enabled: false, botToken: "", notifyNewHawala: true, notifySettlement: true, notifyVoid: true, notifyExchange: true },
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
      migratedChatIds = String(parsed.telegram.chatId).split(/[\n,]+/).map((id: string) => id.trim()).filter(Boolean);
    }
    return { ...defaultSettings, ...parsed, telegram: { ...defaultSettings.telegram, ...parsed.telegram, chatIds: migratedChatIds } };
  } catch { return defaultSettings; }
}

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    gear: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    mail: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
    globe: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
    google: "M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z",
    x: "M6 18 18 6M6 6l12 12",
    check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5",
    chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
    lock: "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z",
    plus: "M12 4.5v15m7.5-7.5h-15",
    trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  };
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>);
};

export default function SettingsDrawer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [activeAccordion, setActiveAccordion] = useState<string | null>("email");
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");

  const panelRef = useRef<HTMLDivElement>(null);
  const latestSettingsRef = useRef(settings);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestSettingsRef.current = settings;

  const auth = getAuth();
  const provider = new GoogleAuthProvider();

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const loadAuthorizedUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "authorized_users"));
        const users: AuthorizedUser[] = [];
        querySnapshot.forEach((doc) => {
          users.push(doc.data() as AuthorizedUser);
        });
        setAuthorizedUsers(users);
      } catch (error) {
        console.error("خطا در بارگذاری کاربران مجاز:", error);
      }
    };
    loadAuthorizedUsers();
  }, []);

  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "app_settings", "global_settings"));
        if (docSnap.exists()) {
          const fbSettings = docSnap.data().value as Settings;
          let migratedChatIds: string[] = fbSettings?.telegram?.chatIds && Array.isArray(fbSettings.telegram.chatIds) ? fbSettings.telegram.chatIds : [];
          const finalSettings: Settings = { ...defaultSettings, ...fbSettings, telegram: { ...defaultSettings.telegram, ...fbSettings?.telegram, chatIds: migratedChatIds } };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
          setSettings(finalSettings);
        } else { setSettings(loadSettings()); }
        setMounted(true);
      } catch { setSettings(loadSettings()); setMounted(true); }
    };
    loadInitialSettings();
  }, [db]);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => setToast(""), 4000);
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => { setSettings(prev => ({ ...prev, ...updates })); }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      showToast("✅ ورود با موفقیت انجام شد");
    } catch (error: any) {
      console.error(error);
      showToast("❌ خطا در ورود: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("خروج از حساب کاربری");
    } catch (error) {
      showToast("❌ خطا در خروج");
    }
  };

  const isOwner = user && user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isAuthorized = user && authorizedUsers.some(u => u.email.toLowerCase() === user.email?.toLowerCase());
  const canAccess = isOwner || isAuthorized;

  const handleAddUser = async () => {
    if (!isOwner) return;
    if (!newUserEmail) {
      showToast("❌ لطفاً ایمیل را وارد کنید");
      return;
    }
    try {
      const userDoc = doc(db, "authorized_users", newUserEmail);
      await setDoc(userDoc, {
        email: newUserEmail,
        role: newUserRole,
        addedAt: Date.now()
      });
      setAuthorizedUsers([...authorizedUsers, { email: newUserEmail, role: newUserRole, addedAt: Date.now() }]);
      setNewUserEmail("");
      showToast("✅ کاربر اضافه شد");
    } catch (error) {
      console.error(error);
      showToast("❌ خطا در افزودن کاربر");
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!isOwner) return;
    try {
      await deleteDoc(doc(db, "authorized_users", email));
      setAuthorizedUsers(authorizedUsers.filter(u => u.email !== email));
      showToast("✅ کاربر حذف شد");
    } catch (error) {
      console.error(error);
      showToast("❌ خطا در حذف کاربر");
    }
  };

  const handleBackup = useCallback(async () => {
    if (!canAccess) return;
    setIsBackingUp(true);
    try {
      showToast("⏳ در حال جمع‌آوری داده‌ها...");
      const backupData: Record<string, any> = { 
        version: "7.0", 
        exportDate: new Date().toISOString(), 
        userEmail: user?.email,
        data: {} 
      };

      if (isOwner) {
        const allKeys = ["fx-customers", "fx-transactions", "fx-hawalas", "fx-cash"];
        for (const key of allKeys) {
          const docSnap = await getDoc(doc(db, "appData", key));
          backupData.data[key] = docSnap.exists() ? docSnap.data() : { value: [], lastUpdated: 0 };
        }
      } else {
        const userKeys = [
          `fx-customers-${user?.email}`,
          `fx-transactions-${user?.email}`,
          `fx-hawalas-${user?.email}`,
          `fx-cash-${user?.email}`
        ];
        for (const key of userKeys) {
          const docSnap = await getDoc(doc(db, "appData", key));
          backupData.data[key] = docSnap.exists() ? docSnap.data() : { value: [], lastUpdated: 0 };
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${user?.email}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("✅ پشتیبان دانلود شد");
    } catch (err) {
      console.error(err);
      showToast("❌ خطا در ایجاد پشتیبان");
    } finally {
      setIsBackingUp(false);
    }
  }, [canAccess, isOwner, user, showToast]);

  if (!mounted) return null;
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const panelBg = dk ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200";
  const uiInput = `h-11 w-full px-3.5 rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800"}`;
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const fld = (label: string, node: ReactNode) => (<div><label className={uiLabel}>{label}</label>{node}</div>);

  const AccordionItem = ({ id, icon, title, children, locked = false }: { id: string; icon: string; title: string; children: ReactNode; locked?: boolean }) => {
    const isOpen = activeAccordion === id;
    return (
      <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
        <button onClick={() => !locked && setActiveAccordion(isOpen ? null : id)} className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 ${locked ? "opacity-60 cursor-not-allowed" : dk ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${locked ? (dk ? "bg-slate-700 text-slate-500" : "bg-slate-200 text-slate-400") : (dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600")}`}>
              <Ic n={locked ? "lock" : icon} className="h-4 w-4" />
            </span>
            <span className={`text-sm font-black ${heading}`}>{title}</span>
          </div>
          {!locked && <Ic n="chevron" className={`h-4 w-4 transition-transform duration-300 ${subText} ${isOpen ? "rotate-180" : ""}`} />}
        </button>
        <div className={`transition-all duration-300 overflow-hidden ${isOpen && !locked ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className={`px-4 pb-4 pt-2 ${dk ? "border-t border-slate-700" : "border-t border-slate-100"}`}>{children}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <button data-settings-toggle onClick={() => setOpen(!open)} className={`fixed top-4 left-4 z-50 grid h-12 w-12 place-items-center rounded-xl border shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${open ? dk ? "bg-emerald-400 text-slate-900" : "bg-emerald-500 text-white" : dk ? "bg-slate-800 text-emerald-300" : "bg-white text-emerald-600"}`} title="تنظیمات">
        <Ic n="gear" className={`h-6 w-6 transition-transform duration-500 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />}
      <div ref={panelRef} className={`fixed top-0 left-0 z-50 h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"} ${panelBg} border-r shadow-2xl overflow-y-auto`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur ${dk ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="gear" className="h-5 w-5" /></span>
            <div><h2 className={`text-lg font-black ${heading}`}>تنظیمات</h2><p className={`text-[10px] font-bold ${subText}`}>پیکربندی سیستم صرافی</p></div>
          </div>
          <button onClick={() => setOpen(false)} className={`grid h-9 w-9 place-items-center rounded-lg ${dk ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}><Ic n="x" className="h-5 w-5" /></button>
        </div>
        
        <div className="space-y-3 p-4">
          <AccordionItem id="email" icon="mail" title="ایمیل">
            <div className="space-y-3">
              {fld("ایمیل صرافی", <input type="email" dir="ltr" value={settings.email} onChange={e => updateSettings({ email: e.target.value })} className={`${uiInput} text-left`} />)}
              {fld("ایمیل پشتیبانی", <input type="email" dir="ltr" value={settings.supportEmail} onChange={e => updateSettings({ supportEmail: e.target.value })} className={`${uiInput} text-left`} />)}
            </div>
          </AccordionItem>

          <AccordionItem id="language" icon="globe" title="زبان سیستم">
            <div className="space-y-2">
              {([ { value: "dari", label: "دری", flag: "🇦🇫" }, { value: "pashto", label: "پشتو", flag: "🇦🇫" }, { value: "english", label: "English", flag: "🇬🇧" } ] as const).map(lang => (
                <button key={lang.value} onClick={() => { updateSettings({ language: lang.value }); showToast(`زبان به ${lang.label} تغییر کرد`); }} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 ${settings.language === lang.value ? dk ? "border-emerald-400 bg-emerald-400/10" : "border-emerald-500 bg-emerald-50" : dk ? "border-slate-600" : "border-slate-200"}`}>
                  <span className="text-xl">{lang.flag}</span><span className={`flex-1 text-right text-sm font-bold ${heading}`}>{lang.label}</span>
                  {settings.language === lang.value && <Ic n="check" className={`h-5 w-5 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />}
                </button>
              ))}
            </div>
          </AccordionItem>

          {isOwner && (
            <AccordionItem id="users" icon="users" title="مدیریت کاربران">
              <div className="space-y-3">
                <div className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-700 border border-blue-200">
                  👑 شما مالک سیستم هستید و می‌توانید کاربران را مدیریت کنید
                </div>

                <div className="space-y-2">
                  {fld("ایمیل کاربر جدید", 
                    <input 
                      type="email" 
                      dir="ltr" 
                      value={newUserEmail} 
                      onChange={e => setNewUserEmail(e.target.value)} 
                      placeholder="user@example.com"
                      className={`${uiInput} text-left`} 
                    />
                  )}
                  <div className="flex gap-2">
                    <select 
                      value={newUserRole} 
                      onChange={e => setNewUserRole(e.target.value as "admin" | "user")}
                      className={uiInput}
                    >
                      <option value="user">کاربر عادی</option>
                      <option value="admin">مدیر</option>
                    </select>
                    <button 
                      onClick={handleAddUser}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <Ic n="plus" className="h-4 w-4" /> افزودن
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={`text-xs font-bold ${heading}`}>کاربران مجاز:</p>
                  {authorizedUsers.length === 0 ? (
                    <p className={`text-xs ${subText} text-center py-2`}>هنوز کاربری اضافه نشده</p>
                  ) : (
                    authorizedUsers.map(u => (
                      <div key={u.email} className={`flex items-center justify-between rounded-lg p-2 ${dk ? "bg-slate-700" : "bg-slate-100"}`}>
                        <div>
                          <div className={`text-xs font-bold ${heading}`}>{u.email}</div>
                          <div className={`text-[10px] ${subText}`}>{u.role === "admin" ? "مدیر" : "کاربر عادی"}</div>
                        </div>
                        <button 
                          onClick={() => handleRemoveUser(u.email)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200"
                        >
                          <Ic n="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </AccordionItem>
          )}

          <AccordionItem id="access" icon="users" title="دسترسی به اطلاعات" locked={!canAccess}>
            {isAuthLoading ? (
              <div className="py-4 text-center text-sm text-slate-500">در حال بررسی...</div>
            ) : !user ? (
              <div className="space-y-3 text-center py-2">
                <p className={`text-xs ${subText}`}>برای مشاهده اطلاعات، وارد شوید</p>
                <button onClick={handleGoogleLogin} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Ic n="google" className="h-5 w-5" /> ورود با گوگل
                </button>
              </div>
            ) : !canAccess ? (
              <div className="space-y-3 text-center py-2">
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-600 border border-rose-200">
                  ⛔ شما اجازه دسترسی ندارید. لطفاً با مالک تماس بگیرید.
                </div>
                <button onClick={handleLogout} className="w-full rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-300">خروج</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 border border-emerald-200">
                  ✅ خوش آمدید ({user.email})
                  {isOwner && <span className="block mt-1">👑 مالک سیستم</span>}
                </div>
                
                <button onClick={handleBackup} disabled={isBackingUp} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Ic n="download" className="h-4 w-4" /> {isBackingUp ? "در حال آماده‌سازی..." : "دانلود پشتیبان"}
                </button>

                <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100">
                  خروج
                </button>
              </div>
            )}
          </AccordionItem>

          <div className={`mt-4 rounded-xl p-4 text-center ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
            <p className={`text-[10px] font-bold ${subText}`}>نسخه ۷.۰.۰ — صرافی برادران نورزاد</p>
          </div>
        </div>
      </div>
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition-all duration-300 ${toast.includes("❌") ? (dk ? "bg-rose-400 text-slate-900" : "bg-rose-500 text-white") : (dk ? "bg-emerald-400 text-slate-900" : "bg-emerald-500 text-white")}`}>
          {toast}
        </div>
      )}
    </>
  );
}
