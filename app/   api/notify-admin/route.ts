import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { userEmail, userName, uid } = await req.json();

    // ساخت لینک تایید مستقیم
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const approvalLink = `${baseUrl}/api/approve-user?uid=${uid}&email=${encodeURIComponent(userEmail)}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'nasirahmadrahmati19@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: 'nasirahmadrahmati19@gmail.com',
      to: 'nasirahmadrahmati19@gmail.com',
      subject: `🔔 درخواست ثبت‌نام/ورود جدید به صرافی`,
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial; padding: 20px; background: #f9f9f9;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #059669; text-align: center;">🔔 درخواست ورود کاربر جدید</h2>
            <p>کاربری با مشخصات زیر درخواست ورود به برنامه را دارد و منتظر تایید شماست:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">نام:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">ایمیل:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userEmail}</td>
              </tr>
            </table>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${approvalLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                ✅ تایید کاربر و اجازه ورود
              </a>
            </div>
            
            <p style="margin-top: 20px; color: #555; font-size: 14px;">پس از کلیک روی دکمه بالا، کاربر می‌تواند وارد سیستم شود.</p>
            <p style="text-align: center; margin-top: 30px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">صرافی برادران نورزاد — هرات</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('خطا در ارسال ایمیل:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
