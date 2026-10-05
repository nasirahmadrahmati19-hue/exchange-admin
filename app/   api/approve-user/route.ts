import { NextRequest, NextResponse } from "next/server";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // مطمئن شوید مسیر فایل firebase شما درست است

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  const email = searchParams.get("email");

  if (!uid || !email) {
    return new NextResponse("لینک نامعتبر است. پارامترهای uid یا email یافت نشد.", { status: 400 });
  }

  try {
    // به‌روزرسانی وضعیت کاربر در Firestore
    await updateDoc(doc(db, "users", uid), {
      isApproved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: "admin"
    });

    // نمایش صفحه موفقیت زیبا به مدیر
    return new NextResponse(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>کاربر تایید شد</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; text-align: center; padding: 50px; background: #f0fdf4; color: #166534; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          p { font-size: 16px; color: #15803d; }
          .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .btn:hover { background: #047857; }
        </style>
      </head>
      <body>
        <h1>✅ کاربر با موفقیت تایید شد!</h1>
        <p>صراف با ایمیل <strong>${email}</strong> اکنون مجوز ورود به سیستم را دارد.</p>
        <a href="/dashboard" class="btn">ورود به داشبورد مدیریت</a>
      </body>
      </html>
    `, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("خطا در تایید کاربر:", error);
    return new NextResponse("خطا در برقراری ارتباط با دیتابیس برای تایید کاربر.", { status: 500 });
  }
}
