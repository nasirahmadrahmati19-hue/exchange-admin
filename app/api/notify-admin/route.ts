// =====================================================
// 📧 API Route: ارسال ایمیل درخواست تأیید به مدیر صرافی
// ----------------------------------------------------
// متغیرهای محیطی مورد نیاز (در Vercel تنظیم شده‌اند):
//   GMAIL_USER          → آدرس جیمیل فرستنده
//   GMAIL_APP_PASSWORD  → رمز اپلیکیشن جیمیل (App Password)
// این route فقط سمت سرور اجرا می‌شود و هیچ‌گاه رمز را
// به مرورگر client برنمی‌گرداند.
// =====================================================
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ADMIN_EMAIL = "nasirahmadrahmati19@gmail.com";

// ⏱️ ضد هرزگردی: حداکثر یک نوتیفیکیشن برای هر email تا ۲ دقیقه
const lastNotifiedAt = new Map<string, number>();
const COOLDOWN_MS = 2 * 60 * 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  try {
    // 🔴 استفاده دقیق از نام متغیرهای محیطی اعلام‌شده توسط مالک:
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      console.error("❌ [notify-admin] GMAIL_USER یا GMAIL_APP_PASSWORD در محیط تنظیم نشده است");
      return NextResponse.json(
        { ok: false, error: "mail_not_configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const userEmail = String(body?.userEmail || "").trim();
    const userName = String(body?.userName || userEmail || "کاربر جدید").trim();
    const uid = String(body?.uid || "").trim();

    if (!userEmail || !uid) {
      return NextResponse.json(
        { ok: false, error: "missing userEmail or uid" },
        { status: 400 }
      );
    }

    // ضد هرزگردی: اگر همین کاربر کمتر از ۲ دقیقه پیش نوتیفیکیشن فرستاده، تکرار نکن
    const now = Date.now();
    const last = lastNotifiedAt.get(userEmail.toLowerCase()) || 0;
    if (now - last < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: "cooldown" });
    }
    lastNotifiedAt.set(userEmail.toLowerCase(), now);

    const adminUrl = `${req.headers.get("origin") || "https://exchange-admin.vercel.app"}/dashboard/users`;
    const safeName = escapeHtml(userName);
    const safeEmail = escapeHtml(userEmail);

    const html = `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#0f172a; padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;padding:28px;color:#fff;">
          <h2 style="margin:0 0 8px;color:#38bdf8;">🔔 درخواست تأیید جدید</h2>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 16px;">
            یک کاربر جدید وارد برنامه صرافی شده و منتظر تأیید شماست:
          </p>
          <table style="width:100%;background:#0f172a;border-radius:12px;color:#e2e8f0;font-size:14px;">
            <tr><td style="padding:12px 16px;color:#94a3b8;">نام</td><td style="padding:12px 16px;font-weight:bold;">${safeName}</td></tr>
            <tr><td style="padding:12px 16px;color:#94a3b8;">ایمیل</td><td style="padding:12px 16px;" dir="ltr">${safeEmail}</td></tr>
            <tr><td style="padding:12px 16px;color:#94a3b8;">شناسه (UID)</td><td style="padding:12px 16px;font-family:monospace;font-size:12px;" dir="ltr">${escapeHtml(uid)}</td></tr>
          </table>
          <a href="${adminUrl}"
             style="display:block;margin-top:20px;background:#22c55e;color:#fff;text-align:center;
                    padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;">
            ✅ تأیید کاربر در پنل مدیریت
          </a>
          <p style="color:#64748b;font-size:12px;margin-top:16px;text-align:center;">
            صرافی برادران نورزاد — سیستم مدیریت
          </p>
        </div>
      </div>`;

    // nodemailer فقط سمت سرور و به‌صورت lazy import می‌شود
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `"صرافی نورزاد (سیستم)" <${gmailUser}>`,
      to: ADMIN_EMAIL,
      subject: `🔔 درخواست تأیید جدید: ${userName}`,
      html,
    });

    console.log(`✅ [notify-admin] ایمیل تأیید برای ${userEmail} به مدیر ارسال شد`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ [notify-admin] خطا در ارسال ایمیل:", err?.message || err);
    return NextResponse.json({ ok: false, error: "mail_send_failed" }, { status: 500 });
  }
}
