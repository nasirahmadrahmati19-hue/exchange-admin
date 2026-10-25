# صرافی برادران نورزاد — Exchange Admin (Next.js + PWA)

اپلیکیشن صرافی (صرفی) ساخته‌شده با **Next.js 14**، **Firebase/Firestore** و **PWA** (قابل نصب روی موبایل).

## 🚀 استقرار روی Vercel (راهنمای کامل)

### روش ۱ — اتصال مستقیم GitHub (توصیه می‌شود)

1. به آدرس https://vercel.com/new بروید و با همان اکانت GitHub خود (`nasirahmadrahmati19-hue`) وارد شوید.
2. در لیست مخازن، **`exchange-admin`** را پیدا کرده و روی **Import** کلیک کنید.
   - ⚠️ اگر این مخزن در لیست نیست: از منوی بالا «Add more Repositories» یا افزونهٔ GitHub App Vercel را نصب/مجوز دهید تا این مخزن نمایش داده شود.
3. در صفحهٔ تنظیمات پروژه:
   - **Framework Preset**: `Next.js` (به‌صورت خودکار تشخیص داده می‌شود؛ فایل `vercel.json` هم اضافه شده است).
   - **Build Command**: `npm run build`
   - **Output Directory**: خالی بگذارید (Next.js خودش `.next` را مدیریت می‌کند).
4. در بخش **Environment Variables** مقادیر زیر را اضافه کنید (حداقل موارد ستاره‌دار):

| Variable | توضیح |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` * | کلید Web Config فايربیس |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` * | مثلاً `myproject-707c8.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` * | مثلاً `myproject-707c8` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | باکت Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID وب |
| `TELEGRAM_BOT_TOKEN` | توکن ربات تلگرام (برای اعلان‌ها) |
| `FIREBASE_PROJECT_ID` | برای firebase-admin (سمت سرور) |
| `FIREBASE_CLIENT_EMAIL` | ایمیل سرویس‌اکانت admin |
| `FIREBASE_PRIVATE_KEY` | کلید خصوصی سرویس‌اکانت (با `\n`) |
| `ADMIN_EMAIL` / `GMAIL_USER` / `GMAIL_APP_PASSWORD` | برای ارسال ایمیل ادمین |

5. روی **Deploy** کلیک کنید. هر push بعدی به برنچ `main` به‌صورت خودکار بازاستقرار می‌کند.

### روش ۲ — با Vercel CLI (از کامپیوتر خودتان)

```bash
npm i -g vercel
cd پوشهٔ_پروژه
vercel        # لاگین + ساخت پروژه (Production نباشد Preview می‌دهد)
vercel --prod # استقرار نهایی روی دامنهٔ Production
```

> 🔑 توجه: توکن Vercel با توکن GitHub فرق دارد! توکن Vercel از اینجا ساخته می‌شود:
> https://vercel.com/account/tokens (شکل آن `vcu_...` یا قدیمی `...` بدون پیشوند `ghp_` است).
> چیزی که با `ghp_` شروع شود فقط برای GitHub است و Vercel آن را قبول نمی‌کند.

## ✅ وضعیت فعلی مخزن

- آخرین commit روی `main`: `ui: compact statement view …` ✔
- بیلد محلی بدون خطا انجام می‌شود (`npm run build` موفق) ✔
- فایل `vercel.json` برای شناسایی دقیق Framework اضافه شد ✔

## ❓ رفع مشکلات رایج «در Vercل deploy نمی‌شود»

1. **مخزن به Vercel وصل نیست / Import نمی‌شود** → مراحل روش ۱ بند ۲ را انجام دهید (مجوز GitHub App).
2. **Deploy Error: Missing environment variables** → متغیرهای جدول بالا را در Settings → Environment Variables پر کنید و سپس «Redeploy» بزنید.
3. **صفحهٔ قدیمی نشان داده می‌شود** → احتمالاً دامنه‌ای که باز می‌کنید به این پروژه وصل نیست. آدرس واقعی Deployment را از تب **Deployments** در داشبورد Vercel بردارید.
4. **PWA کهنه** → کش Service Worker را پاک کنید (یا یک بار Offline mode و دوباره Online).
5. **Build Timeouts** → در Vercel نسخه Hobby محدودیت دارد؛ لاگ Build را در Deploy Log بررسی کنید.

## 🛠 توسعه محلی

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # بیلد پروداکشن
```
