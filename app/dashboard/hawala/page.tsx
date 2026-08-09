<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>صرافی محلی کود - تالار معاملات</title>
    <!-- فونت مدرن و آیکون‌ها -->
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Vazirmatn', sans-serif;
        }

        body {
            background: #f4f7f9;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .dashboard {
            max-width: 1440px;
            width: 100%;
            background: #ffffff;
            border-radius: 32px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
            padding: 25px 30px 30px 30px;
            transition: all 0.2s;
            border: 1px solid rgba(0,0,0,0.02);
        }

        /* هدر */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 15px;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .logo {
            background: #1b4d2b;
            color: #fff;
            padding: 10px 20px;
            border-radius: 60px;
            font-weight: 900;
            font-size: 1.2rem;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .logo i {
            font-size: 1.4rem;
            color: #ffd54f;
        }

        .badge-market {
            background: #e8f5e9;
            color: #1b4d2b;
            padding: 6px 18px;
            border-radius: 40px;
            font-size: 0.8rem;
            font-weight: 700;
            border: 1px solid #a5d6a7;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 25px;
        }

        .date-box {
            background: #f1f3f5;
            padding: 8px 18px;
            border-radius: 40px;
            font-size: 0.9rem;
            color: #495057;
        }

        .user-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f8f9fa;
            padding: 6px 16px 6px 6px;
            border-radius: 60px;
        }
        .user-profile img {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #1b4d2b;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }

        /* کارت های آماری */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: #fafbfc;
            border-radius: 20px;
            padding: 18px 20px;
            border: 1px solid #e9ecef;
            transition: 0.2s;
        }
        .stat-card:hover {
            border-color: #1b4d2b;
            background: #f6faf7;
        }
        .stat-label {
            font-size: 0.8rem;
            color: #868e96;
            font-weight: 400;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .stat-value {
            font-size: 1.7rem;
            font-weight: 900;
            color: #1b1f22;
            margin-top: 6px;
        }
        .stat-change {
            font-size: 0.75rem;
            color: #2b8a3e;
            background: #d3f0df;
            padding: 2px 12px;
            border-radius: 30px;
            display: inline-block;
            margin-top: 5px;
        }

        /* بخش اصلی: دفتر سفارشات + فرم معامله */
        .main-trading-panel {
            display: grid;
            grid-template-columns: 1fr 0.8fr 1.2fr;
            gap: 20px;
            margin-bottom: 30px;
        }

        @media (max-width: 992px) {
            .main-trading-panel {
                grid-template-columns: 1fr;
            }
        }

        .panel-card {
            background: #ffffff;
            border-radius: 24px;
            padding: 18px 16px;
            border: 1px solid #eef2f6;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }

        .panel-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            color: #868e96;
            letter-spacing: 0.5px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* دفتر سفارشات (Order Book) */
        .order-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 4px;
            font-size: 0.9rem;
            border-bottom: 1px solid #f1f3f5;
            transition: 0.1s;
        }
        .order-row:hover {
            background: #f8f9fa;
        }
        .order-sell { color: #d63939; }
        .order-buy { color: #1b7a3d; }
        .order-price { font-weight: 700; }
        .order-volume { color: #495057; }

        .divider-market {
            text-align: center;
            background: #f1f3f5;
            border-radius: 40px;
            padding: 4px 0;
            margin: 10px 0;
            font-size: 0.75rem;
            font-weight: 700;
            color: #495057;
        }

        /* فرم معامله */
        .trade-form .input-group {
            margin-bottom: 16px;
        }
        .trade-form label {
            display: block;
            font-size: 0.8rem;
            font-weight: 700;
            color: #343a40;
            margin-bottom: 5px;
        }
        .trade-form input, .trade-form select {
            width: 100%;
            padding: 12px 16px;
            border-radius: 16px;
            border: 1.5px solid #dee2e6;
            font-size: 1rem;
            background: #fafbfc;
            transition: 0.2s;
        }
        .trade-form input:focus, .trade-form select:focus {
            border-color: #1b4d2b;
            outline: none;
            background: #fff;
            box-shadow: 0 0 0 4px rgba(27, 77, 43, 0.08);
        }

        .btn-group {
            display: flex;
            gap: 12px;
            margin-top: 10px;
        }
        .btn {
            flex: 1;
            padding: 14px 0;
            border: none;
            border-radius: 60px;
            font-weight: 900;
            font-size: 1rem;
            cursor: pointer;
            transition: 0.2s;
        }
        .btn-buy {
            background: #1b7a3d;
            color: #fff;
            box-shadow: 0 6px 14px rgba(27, 122, 61, 0.25);
        }
        .btn-buy:hover { background: #0f5c2b; transform: scale(0.98); }
        .btn-sell {
            background: #d63939;
            color: #fff;
            box-shadow: 0 6px 14px rgba(214, 57, 57, 0.2);
        }
        .btn-sell:hover { background: #b02a2a; transform: scale(0.98); }

        /* جدول معاملات انجام شده */
        .table-responsive {
            overflow-x: auto;
            margin-top: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        th {
            text-align: right;
            padding: 16px 12px;
            background: #f1f4f8;
            color: #495057;
            font-weight: 700;
            border-radius: 16px 16px 0 0;
        }
        td {
            padding: 14px 12px;
            border-bottom: 1px solid #edf2f7;
        }
        .status-badge {
            background: #e3f0e6;
            color: #1b4d2b;
            padding: 4px 16px;
            border-radius: 60px;
            font-size: 0.75rem;
            font-weight: 700;
        }
        .status-badge.pending {
            background: #fff3cd;
            color: #856404;
        }
        .text-muted { color: #868e96; }

        .footer-note {
            margin-top: 25px;
            text-align: center;
            font-size: 0.8rem;
            color: #adb5bd;
            border-top: 1px solid #edf2f7;
            padding-top: 20px;
        }
        .highlight-green { color: #1b7a3d; }
    </style>
</head>
<body>
<div class="dashboard">

    <!-- هدر -->
    <div class="header">
        <div class="header-right">
            <div class="logo">
                <i class="fas fa-seedling"></i> صرافی کود
            </div>
            <span class="badge-market"><i class="fas fa-circle" style="color: #2b8a3e; font-size: 0.5rem;"></i> بازار آزاد (بازار معاملات محلی)</span>
        </div>
        <div class="header-left">
            <div class="date-box"><i class="far fa-calendar-alt"></i> ۱۸ مرداد ۱۴۰۵</div>
            <div class="user-profile">
                <div style="background:#1b4d2b; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">ک</div>
                <span style="font-weight:700;">کاربر حقیقی</span>
                <i class="fas fa-chevron-down" style="color:#adb5bd; font-size:0.7rem;"></i>
            </div>
        </div>
    </div>

    <!-- کارت های آماری لحظه ای -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label"><i class="fas fa-weight-scale"></i> حجم کل معاملات امروز</div>
            <div class="stat-value">۴,۲۵۰ <span style="font-size:1rem;">تن</span></div>
            <span class="stat-change"><i class="fas fa-arrow-up"></i> ۱۲٪ نسبت به دیروز</span>
        </div>
        <div class="stat-card">
            <div class="stat-label"><i class="fas fa-chart-line"></i> میانگین قیمت (کود کامل)</div>
            <div class="stat-value">۲۸,۵۰۰ <span style="font-size:1rem;">تومان</span></div>
            <span class="stat-change" style="background:#ffebee; color:#c62828;"><i class="fas fa-arrow-down"></i> ۲.۱٪</span>
        </div>
        <div class="stat-card">
            <div class="stat-label"><i class="fas fa-handshake"></i> تعداد معاملات</div>
            <div class="stat-value">۱۴۲</div>
            <span class="stat-change">در ۶ ساعت اخیر</span>
        </div>
        <div class="stat-card">
            <div class="stat-label"><i class="fas fa-truck"></i> آماده تحویل فوری</div>
            <div class="stat-value">۸۹۰ <span style="font-size:1rem;">تن</span></div>
            <span class="stat-change">در انبارهای استان</span>
        </div>
    </div>

    <!-- پنل اصلی معاملاتی -->
    <div class="main-trading-panel">
        <!-- سمت چپ: دفتر سفارشات فروشندگان -->
        <div class="panel-card">
            <div class="panel-title">
                <span><i class="fas fa-arrow-up" style="color:#d63939;"></i> فروشندگان (قیمت درخواستی)</span>
                <span style="background:#f1f3f5; padding:2px 12px; border-radius:40px; font-size:0.7rem;">تعداد: ۱۸ سفارش</span>
            </div>
            <div class="order-row"><span>فروشنده الف</span> <span class="order-price">۲۹,۱۰۰</span> <span class="order-volume">۱۲ تن</span></div>
            <div class="order-row"><span>فروشنده ب</span> <span class="order-price">۲۹,۰۵۰</span> <span class="order-volume">۸ تن</span></div>
            <div class="order-row"><span>فروشنده ج</span> <span class="order-price">۲۸,۹۰۰</span> <span class="order-volume">۲۵ تن</span></div>
            <div class="order-row"><span>فروشنده د</span> <span class="order-price">۲۸,۷۵۰</span> <span class="order-volume">۵ تن</span></div>
            <div class="divider-market">--- قیمت تعادلی لحظه‌ای: ۲۸,۵۰۰ تومان ---</div>
            <div class="order-row"><span>خریدار ۱</span> <span class="order-price" style="color:#1b7a3d;">۲۸,۳۰۰</span> <span class="order-volume">۲۰ تن</span></div>
            <div class="order-row"><span>خریدار ۲</span> <span class="order-price" style="color:#1b7a3d;">۲۸,۱۰۰</span> <span class="order-volume">۱۵ تن</span></div>
            <div class="order-row"><span>خریدار ۳</span> <span class="order-price" style="color:#1b7a3d;">۲۷,۹۵۰</span> <span class="order-volume">۱۰ تن</span></div>
            <div class="panel-title" style="margin-top:10px; margin-bottom:0;">
                <span><i class="fas fa-arrow-down" style="color:#1b7a3d;"></i> خریداران (قیمت پیشنهادی)</span>
            </div>
        </div>

        <!-- وسط: فرم ثبت سفارش -->
        <div class="panel-card trade-form">
            <div class="panel-title"><i class="fas fa-file-signature"></i> ثبت دستور معامله فوری</div>
            <div class="input-group">
                <label><i class="far fa-star"></i> نوع کود</label>
                <select>
                    <option>کود کامل NPK ۱۵-۱۰-۱۵ + میکرو</option>
                    <option>کود اوره ۴۶%</option>
                    <option>سولفات پتاسیم</option>
                    <option>نیترات کلسیم</option>
                </select>
            </div>
            <div class="input-group">
                <label><i class="fas fa-weight-scale"></i> مقدار (به کیلوگرم)</label>
                <input type="number" value="۱۰۰۰" placeholder="مقدار را وارد کنید...">
            </div>
            <div class="input-group">
                <label><i class="fas fa-tag"></i> قیمت پیشنهادی (تومان / کیلو)</label>
                <input type="number" value="۲۸,۵۰۰" placeholder="قیمت پیشنهادی...">
            </div>
            <div class="input-group">
                <label><i class="fas fa-store"></i> انبار تحویل</label>
                <select><option>انبار مرکزی استان</option><option>انبار غرب</option></select>
            </div>
            <div class="btn-group">
                <button class="btn btn-buy"><i class="fas fa-plus-circle"></i> خرید (ثبت سفارش)</button>
                <button class="btn btn-sell"><i class="fas fa-minus-circle"></i> فروش (ثبت سفارش)</button>
            </div>
            <div style="margin-top: 15px; background:#f8fafb; border-radius:16px; padding:12px; font-size:0.8rem; color:#495057; text-align:center;">
                <i class="fas fa-info-circle"></i> کارمزد معامله: ۰.۵٪ | تسویه: نقدی هنگام تحویل
            </div>
        </div>

        <!-- راست: وضعیت بازار و نمادها -->
        <div class="panel-card">
            <div class="panel-title"><i class="fas fa-chart-pie"></i> خلاصه نمادهای پربازده</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="background:#f6faf7; border-radius:16px; padding:14px; border-right: 4px solid #1b7a3d;">
                    <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">کود کامل گرید A</span> <span style="color:#1b7a3d;">+۳.۲٪</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#495057;"><span>۲۹,۱۰۰ ت</span> <span>حجم: ۴۵ تن</span></div>
                </div>
                <div style="background:#fafbfc; border-radius:16px; padding:14px; border-right: 4px solid #ffb74d;">
                    <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">اوره ۴۶%</span> <span style="color:#d63939;">-۱.۱٪</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#495057;"><span>۱۸,۲۰۰ ت</span> <span>حجم: ۸۰ تن</span></div>
                </div>
                <div style="background:#fafbfc; border-radius:16px; padding:14px; border-right: 4px solid #4fc3f7;">
                    <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">سولفات پتاسیم</span> <span style="color:#1b7a3d;">+۰.۸٪</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#495057;"><span>۳۲,۵۰۰ ت</span> <span>حجم: ۱۲ تن</span></div>
                </div>
                <div style="background:#fafbfc; border-radius:16px; padding:14px; border-right: 4px solid #ce93d8;">
                    <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">نیترات کلسیم</span> <span style="color:#1b7a3d;">+۰.۲٪</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#495057;"><span>۲۶,۷۰۰ ت</span> <span>حجم: ۸ تن</span></div>
                </div>
            </div>
            <div style="margin-top:18px; background:#1b4d2b; color:white; border-radius:20px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                <span><i class="fas fa-bolt"></i> تسویه آنی</span>
                <span style="font-weight:900;">۲۸,۵۰۰ تومان <span style="font-size:0.7rem; font-weight:400;">/ هر کیلو</span></span>
            </div>
        </div>
    </div>

    <!-- جدول معاملات انجام شده (تاریخچه) -->
    <div style="background: #ffffff; border-radius: 24px; border: 1px solid #eef2f6; padding: 18px 16px; margin-top: 10px;">
        <div class="panel-title" style="margin-bottom: 10px;">
            <span><i class="fas fa-clock-rotate-left"></i> آخرین معاملات انجام شده (تاریخچه امروز)</span>
            <span style="background:#f1f3f5; padding:2px 16px; border-radius:40px; font-size:0.7rem;">به‌روزرسانی: لحظه‌ای</span>
        </div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>زمان</th>
                        <th>نوع</th>
                        <th>کود</th>
                        <th>مقدار (تن)</th>
                        <th>قیمت (تومان)</th>
                        <th>طرف مقابل</th>
                        <th>وضعیت</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>۱۴:۲۵</td>
                        <td><span style="color:#1b7a3d; font-weight:700;">خرید</span></td>
                        <td>کامل ۱۵-۱۰-۱۵</td>
                        <td>۵</td>
                        <td>۲۸,۴۰۰</td>
                        <td>شرکت کشت سبز</td>
                        <td><span class="status-badge">انجام شده</span></td>
                    </tr>
                    <tr>
                        <td>۱۳:۵۰</td>
                        <td><span style="color:#d63939; font-weight:700;">فروش</span></td>
                        <td>اوره</td>
                        <td>۱۲</td>
                        <td>۱۸,۱۰۰</td>
                        <td>تعاونی روستایی</td>
                        <td><span class="status-badge pending">در انتظار تأیید</span></td>
                    </tr>
                    <tr>
                        <td>۱۲:۱۰</td>
                        <td><span style="color:#1b7a3d; font-weight:700;">خرید</span></td>
                        <td>سولفات پتاسیم</td>
                        <td>۳</td>
                        <td>۳۲,۲۰۰</td>
                        <td>بازرگانی الف</td>
                        <td><span class="status-badge">انجام شده</span></td>
                    </tr>
                    <tr>
                        <td>۱۱:۰۵</td>
                        <td><span style="color:#d63939; font-weight:700;">فروش</span></td>
                        <td>کامل ۱۵-۱۰-۱۵</td>
                        <td>۸</td>
                        <td>۲۸,۷۰۰</td>
                        <td>کارخانه کود شمال</td>
                        <td><span class="status-badge">انجام شده</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer-note">
        <i class="fas fa-shield-alt" style="color:#1b4d2b;"></i> تمامی معاملات این صرافی منطبق بر قوانین بازار محصولات کشاورزی بوده و به صورت شفاف در سامانه ثبت می‌گردد.
    </div>
</div>
</body>
</html>
