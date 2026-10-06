import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, setDoc, updateDoc, getFirestore } from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import nodemailer from "nodemailer";

// ✅ ساخت connection اختصاصی Firebase در سرور (Node.js) — بدون window و بدون long-polling مرورگر
const firebaseConfig = {
  apiKey: "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: "myproject-707c8.firebaseapp.com",
  projectId: "myproject-707c8",
  storageBucket: "myproject-707c8.firebasestorage.app",
  messagingSenderId: "922894348479",
  appId: "1:922894348479:web:82988406466df932e7160a",
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ارسال ایمیل نتیجه تایید به مدیر تا از موفق/ناموفق بودن کلیک لینک باخبر شود
async function sendApprovalResultEmail(userEmail: string, ok: boolean, detail?: string) {
  try {
    if (!process.env.GMAIL_APP_PASSWORD) return; // بدون رمز، ارسال ممکن نیست — بی‌صدا رد می‌شویم
    const adminEmail = process.env.GMAIL_USER || "nasirahmadrahmati19@gmail.com";
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: adminEmail, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: adminEmail,
      to: adminEmail,
      subject: ok ? `✅ تایید انجام شد: ${userEmail}` : `⚠️ خطا در تایید کاربر: ${userEmail}`,
      html: `<div dir="rtl" style="font-family:Tahoma,Arial;padding:20px">
        <h3>${ok ? "✅ کاربر با موفقیت تایید و فعال شد" : "❌ عملیات تایید ناموفق بود"}</h3>
        <p>کاربر: <b dir="ltr">${userEmail}</b></p>
        ${detail ? `<p style="color:#b91c1c">جزئیات خطا: ${detail}</p>` : ""}
        <p>${ok ? "اکنون این کاربر می‌تواند وارد برنامه شود." : "لطفاً دوباره روی لینک کلیک کنید یا قوانین Firestore را بررسی کنید."}</p>
      </div>`,
    });
  } catch (e) {
    console.error("خطا در ارسال ایمیل نتیجه تایید:", e);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  const email = searchParams.get("email");

  if (!uid || !email) {
    return new NextResponse("لینک نامعتبر است. پارامترهای uid یا email یافت نشد.", { status: 400 });
  }

  let ok = false;
  let errorDetail = "";

  try {
    const userRef = doc(db, "users", uid);

    // اگر سند کاربر وجود نداشت، بساز تا updateDoc خطا ندهد
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email,
        name: "کاربر جدید",
        isApproved: false,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    // 🔑 فیلدهای هر دو حالت (isApproved و status) ست می‌شوند تا AuthProvider قطعاً approved ببیند
    await updateDoc(userRef, {
      isApproved: true,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: "admin",
    });

    ok = true;
    console.log(`✅ کاربر تایید شد | uid=${uid} | email=${email}`);
  } catch (error: any) {
    console.error("خطا در تایید کاربر:", error?.code, error?.message || error);
    errorDetail = String(error?.code || "") === "permission-denied"
      ? "permission-denied — قوانین دسترسی Firestore اجازه نوشتن نمی‌دهند. در کنسول فایربیس → Firestore → Rules اجازه نوشتن را باز بگذارید."
      : `${error?.code || ""} ${error?.message || "خطای ناشناخته"}`;
  }

  // اطلاع‌رسانی نتیجه به مدیر (حتی در صورت خطای ایمیل، صفحه نتیجه نمایش داده می‌شود)
  await sendApprovalResultEmail(email, ok, errorDetail || undefined);

  if (!ok) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head><meta charset="UTF-8"><title>خطا در تایید</title>
      <style>body{font-family:Tahoma,Arial;text-align:center;padding:50px;background:#fef2f2;color:#991b1b}p{color:#b91c1c;font-size:14px}</style>
      </head>
      <body>
        <h1>❌ تایید انجام نشد</h1>
        <p>مشکل: ${errorDetail}</p>
        <p>لطفاً چند لحظه دیگر دوباره روی لینک ایمیل کلیک کنید.</p>
      </body></html>
    `, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

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
      <p style="font-size:13px;color:#166534;margin-top:8px">به کاربر بگویید صفحه خود را رفرش کند یا دوباره وارد شود.</p>
      <a href="/login" class="btn">رفتن به صفحه ورود</a>
    </body>
    </html>
  `, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
