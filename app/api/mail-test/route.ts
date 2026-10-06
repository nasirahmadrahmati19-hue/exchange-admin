import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// 🔧 endpoint تست: با باز کردن /api/mail-test در مرورگر بررسی می‌کنید که
// ۱) متغیرهای محیطی تنظیم هستند ۲) Gmail واقعاً ایمیل را می‌پذیرد یا نه
export async function GET() {
  const adminEmail = process.env.GMAIL_USER || "nasirahmadrahmati19@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    return NextResponse.json({
      ok: false,
      step: "config",
      error: "متغیر محیطی GMAIL_APP_PASSWORD تنظیم نشده است. آن را در .env.local (محلی) یا Vercel Environment Variables (آنلاین) اضافه کنید.",
      adminEmail,
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: adminEmail, pass },
    });

    // verify: فقط اعتبار نام‌کاربری/رمز را چک می‌کند (بدون ارسال ایمیل)
    await transporter.verify();

    const info = await transporter.sendMail({
      from: adminEmail,
      to: adminEmail,
      subject: "🧪 تست ارسال ایمیل — صرافی برادران نورزاد",
      html: `<div dir="rtl"><h3>✅ تنظیمات ایمیل سالم است</h3>
        <p>اگر این ایمیل را می‌بینید، درخواست‌های تایید کاربران هم به همین صندوق می‌رسد.</p>
        <p>Time: ${new Date().toLocaleString("fa-IR")}</p></div>`,
    });

    return NextResponse.json({
      ok: true,
      step: "sent",
      adminEmail,
      gmailMessageId: info.messageId,
      message: "✅ ایمیل تست با موفقیت ارسال شد. صندوق خود را (و پوشه Spam) چک کنید.",
    });
  } catch (error: any) {
    const msg = String(error?.message || error);
    let hint = "";
    if (msg.includes("535") || msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("credentials")) {
      hint = " ⚠️ رمز اپلیکیشن برای این جیمیل معتبر نیست. باید App Password مربوط به همان حساب " + adminEmail + " باشد.";
    } else if (msg.includes("EAI_AGAIN") || msg.includes("ENOTFOUND")) {
      hint = " ⚠️ اتصال شبکه به smtp.gmail.com ممکن نشد (فایروال/پروکسی).";
    } else if (msg.includes("Too many") || msg.includes("quota") || msg.includes("rate")) {
      hint = " ⚠️ گوگل به دلیل تعداد بالای ایمیل موقتاً محدود کرده؛ چند ساعت صبر کنید.";
    }
    return NextResponse.json({
      ok: false,
      step: "send",
      adminEmail,
      error: msg,
      hint,
    }, { status: 500 });
  }
}
