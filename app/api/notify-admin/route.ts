import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { userEmail, userName, uid } = await req.json();

    // ساخت لینک تایید مستقیم (اگر در Vercel دیپلوی شده باشد، از آدرس دامنه شما استفاده می‌کند)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const approvalLink = `${baseUrl}/api/approve-user?uid=${uid}&email=${encodeURIComponent(userEmail)}`;

    // تنظیمات ارسال‌کننده ایمیل
    const adminEmail = process.env.GMAIL_USER || 'shababian.mohammad590@gmail.com';

    // بررسی وجود رمز اپلیکیشن — بدون آن ارسال ایمیل ممکن نیست
    if (!process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ متغیر محیطی GMAIL_APP_PASSWORD تنظیم نشده است.');
      return NextResponse.json(
        { success: false, error: 'GMAIL_APP_PASSWORD is not configured' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: adminEmail,
        pass: process.env.GMAIL_APP_PASSWORD, // رمز ۱۶ رقمی اپلیکیشن گوگل
      },
    });

    // ارسال ایمیل
    await transporter.sendMail({
      from: adminEmail,
      to: adminEmail,
      subject: `🔔 درخواست ثبت‌نام/ورود جدید به صرافی`,
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; padding: 20px; background: #f9f9f9;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h2 style="color: #059669; text-align: center; margin-top: 0;">🔔 درخواست ورود کاربر جدید</h2>
            <p style="color: #333;">کاربری با مشخصات زیر درخواست ورود به برنامه را دارد و منتظر تایید شماست:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: #f8fafc; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">نام:</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; font-weight: bold; color: #475569;">ایمیل:</td>
                <td style="padding: 12px 15px; color: #0f172a; direction: ltr; text-align: right;">${userEmail}</td>
              </tr>
            </table>
            
            <div style="text-align: center; margin-top: 35px;">
              <a href="${approvalLink}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.2);">
                ✅ تایید کاربر و اجازه ورود
              </a>
            </div>
            
            <p style="margin-top: 25px; color: #64748b; font-size: 14px; text-align: center;">
              پس از کلیک روی دکمه بالا، حساب این کاربر فعال شده و می‌تواند وارد سیستم شود.
            </p>
            
            <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              صرافی برادران نورزاد — هرات، افغانستان
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ خطا در ارسال ایمیل:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
