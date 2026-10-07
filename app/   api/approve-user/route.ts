import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

// مقداردهی اولیه Firebase Admin SDK فقط یک‌بار (جلوگیری از reinitialize در HMR یا چند درخواست همزمان)
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  const email = searchParams.get("email");

  if (!uid || !email) {
    return new NextResponse("لینک نامعتبر است. پارامترهای uid یا email یافت نشد.", { status: 400 });
  }

  try {
    // ✅ استفاده از Admin SDK برای عبور از Firestore Security Rules
    // ✅ استفاده از set با merge: true برای:
    //    1. جلوگیری از خطای missing document
    //    2. حفظ تمام فیلدهای موجود کاربر (نام، ایمیل و غیره)
    //    3. تنظیم همزمان status و isApproved برای سازگاری با Rules و login
    await admin.firestore().collection("users").doc(uid).set(
      {
        status: "approved",        // ✅ برای سازگاری با Firestore Rules
        isApproved: true,          // ✅ برای سازگاری با login/page.tsx
        approvedAt: new Date().toISOString(),
        approvedBy: "admin",
      },
      { merge: true }
    );

    // نمایش صفحه موفقیت به مدیر
    return new NextResponse(
      `
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
    `,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error) {
    console.error("خطا در تایید کاربر:", error);
    return new NextResponse("خطا در برقراری ارتباط با دیتابیس برای تایید کاربر.", { status: 500 });
  }
}
