// =====================================================
// 🔐 API Route: ارسال پیام تلگرام سمت سرور
// ----------------------------------------------------
// توکن ربات فقط در متغیر محیطی (ENV) روی Vercel نگهداری می‌شود
// و هرگز به مرورگر مشتری ارسال نمی‌گردد.
// =====================================================
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TELEGRAM_API = "https://api.telegram.org";

async function verifyCaller(req: Request): Promise<boolean> {
  // بررسی هویت کاربر با Firebase ID Token (idToken) که کلاینت در هدر می‌فرستد.
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) return false;

  try {
    // تأیید امضای توکن با Firebase Admin SDK
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
    await admin.auth().verifyIdToken(idToken);
    return true;
  } catch (err) {
    console.error("❌ [telegram-api] verification failed:", err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    // فقط کاربران لاگین‌شده مجاز به استفاده از این endpoint هستند
    const authorized = await verifyCaller(req);
    if (!authorized) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Telegram bot token is not configured on the server" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const chatId = body?.chatId as string | undefined;
    const text = body?.text as string | undefined;

    if (!chatId || !text) {
      return NextResponse.json({ ok: false, error: "missing chatId or text" }, { status: 400 });
    }

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.error("❌ [telegram-api] send failed:", data);
      return NextResponse.json({ ok: false, error: "telegram_send_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ [telegram-api] unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
