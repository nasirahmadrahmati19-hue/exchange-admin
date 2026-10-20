// ============================================================
// 🧪 روت تست ارسال ایمیل
// ------------------------------------------------------------
// با متد GET اجرا می‌شود: /api/notify-admin/test
// یک ایمیل تست به آدرس GMAIL_USER می‌فرستد و نتیجه را JSON برمی‌گرداند.
// ⚠️ هیچ رمز عبوری در پاسخ لاگ یا برگردانده نمی‌شود.
// ============================================================
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  // اگر متغیرهای محیطی تعریف نشده باشند، همان را گزارش می‌دهیم
  if (!gmailUser || !gmailAppPassword) {
    return NextResponse.json(
      {
        success: false,
        message:
          "متغیرهای محیطی GMAIL_USER و/یا GMAIL_APP_PASSWORD تنظیم نشده‌اند. آن‌ها را در Vercel (بخش Settings → Environment Variables) اضافه کنید.",
        gmailUserLoaded: !!gmailUser,
        gmailPasswordLoaded: !!gmailAppPassword,
      },
      { status: 500 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `"صرافی نورزاد (تست)" <${gmailUser}>`,
      to: gmailUser,
      subject: "✅ تست ارسال ایمیل - exchange-admin",
      text: "اگر این ایمیل را دریافت کردید، تنظیمات SMTP جیمیل شما صحیح است.",
      html: `
        <div dir="rtl" style="font-family: Tahoma, sans-serif; padding: 24px; background:#f4f6fa;">
          <h2 style="color:#16a34a;">✅ تست ارسال ایمیل موفق بود</h2>
          <p>تنظیمات nodemailer و متغیرهای محیطی پروژه <b>exchange-admin</b> به درستی کار می‌کنند.</p>
          <p style="color:#64748b;font-size:12px;">این یک پیام خودکار تست است.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `ایمیل تست با موفقیت ارسال شد (messageId: ${info.messageId})`,
      gmailUserLoaded: !!process.env.GMAIL_USER,
      gmailPasswordLoaded: !!process.env.GMAIL_APP_PASSWORD,
    });
  } catch (err: unknown) {
    // متن کامل خطا بدون لو دادن رمز عبور
    let msg = "خطای ناشناخته";
    if (err instanceof Error) {
      msg = err.message;
      // حذف هرگونه ارجاع احتمالی به پسورد از متن خطا
      if (gmailAppPassword) {
        msg = msg.split(gmailAppPassword).join("[REDACTED]");
      }
    }
    console.error("❌ [notify-admin/test] خطا:", msg);
    return NextResponse.json(
      {
        success: false,
        message: msg,
        gmailUserLoaded: !!process.env.GMAIL_USER,
        gmailPasswordLoaded: !!process.env.GMAIL_APP_PASSWORD,
      },
      { status: 500 }
    );
  }
}
