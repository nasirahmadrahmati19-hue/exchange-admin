// در بالای فایل app/dashboard/page.tsx
import { useAuth } from "../AuthProvider"; // مسیر را طبق ساختار خود تنظیم کنید
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ✅ قانون طلایی: اول صبر کن لودینگ تمام شود، بعد چک کن کاربر هست یا نه
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login"); // اگر کاربر نبود، به صفحه لاگین بفرست
    }
  }, [user, loading, router]);

  // ✅ اگر هنوز در حال بررسی وضعیت لاگین است، همان اسپینر را نشان بده (جلوگیری از پرش)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">در حال بررسی وضعیت ورود...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // اگر به هر دلیلی کاربر لاگین نبود (قبل از اینکه useEffect کار کند)، چیزی نشان نده
  if (!user) {
    return null;
  }

  // ... از اینجا به بعد، کد اصلی و زیبای داشبورد شما شروع می‌شود ...
  // const [theme, setTheme] = useState<"light" | "dark">("light");
  // ...
