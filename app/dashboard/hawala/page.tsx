'use client';

import { useState } from 'react';

export default function FertilizerExchangePage() {
  const [selectedFertilizer, setSelectedFertilizer] = useState('کود کامل NPK ۱۵-۱۰-۱۵ + میکرو');
  const [amount, setAmount] = useState(1000);
  const [price, setPrice] = useState(28500);
  const [warehouse, setWarehouse] = useState('انبار مرکزی استان');

  const recentTrades = [
    { time: '۱۴:۲۵', type: 'خرید', fertilizer: 'کامل ۱۵-۱۰-۱۵', tons: 5, price: 28400, counterparty: 'شرکت کشت سبز', status: 'انجام شده' },
    { time: '۱۳:۵۰', type: 'فروش', fertilizer: 'اوره', tons: 12, price: 18100, counterparty: 'تعاونی روستایی', status: 'در انتظار تأیید' },
    { time: '۱۲:۱۰', type: 'خرید', fertilizer: 'سولفات پتاسیم', tons: 3, price: 32200, counterparty: 'بازرگانی الف', status: 'انجام شده' },
    { time: '۱۱:۰۵', type: 'فروش', fertilizer: 'کامل ۱۵-۱۰-۱۵', tons: 8, price: 28700, counterparty: 'کارخانه کود شمال', status: 'انجام شده' },
  ];

  return (
    <div style={{ background: '#f4f7f9', padding: '20px', minHeight: '100vh', fontFamily: 'Vazirmatn, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;700;900&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />

      <div style={{ maxWidth: '1440px', margin: '0 auto', background: '#ffffff', borderRadius: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', padding: '25px 30px 30px' }}>

        {/* هدر */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: '#1b4d2b', color: '#fff', padding: '10px 20px', borderRadius: '60px', fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fas fa-seedling" style={{ color: '#ffd54f' }}></i> صرافی کود
            </div>
            <span style={{ background: '#e8f5e9', color: '#1b4d2b', padding: '6px 18px', borderRadius: '40px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #a5d6a7' }}>
              <i className="fas fa-circle" style={{ color: '#2b8a3e', fontSize: '0.5rem' }}></i> بازار آزاد (بازار معاملات محلی)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
            <div style={{ background: '#f1f3f5', padding: '8px 18px', borderRadius: '40px', fontSize: '0.9rem', color: '#495057' }}>
              <i className="far fa-calendar-alt"></i> ۱۸ مرداد ۱۴۰۵
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa', padding: '6px 16px 6px 6px', borderRadius: '60px' }}>
              <div style={{ background: '#1b4d2b', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>ک</div>
              <span style={{ fontWeight: 700 }}>کاربر حقیقی</span>
              <i className="fas fa-chevron-down" style={{ color: '#adb5bd', fontSize: '0.7rem' }}></i>
            </div>
          </div>
        </div>

        {/* کارت‌های آماری */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '30px' }}>
          {[
            { icon: 'fa-weight-scale', label: 'حجم کل معاملات امروز', value: '۴,۲۵۰ تن', change: '+۱۲% نسبت به دیروز', up: true },
            { icon: 'fa-chart-line', label: 'میانگین قیمت (کود کامل)', value: '۲۸,۵۰۰ تومان', change: '-۲.۱%', up: false },
            { icon: 'fa-handshake', label: 'تعداد معاملات', value: '۱۴۲', change: 'در ۶ ساعت اخیر', up: true },
            { icon: 'fa-truck', label: 'آماده تحویل فوری', value: '۸۹۰ تن', change: 'در انبارهای استان', up: true },
          ].map((stat, idx) => (
            <div key={idx} style={{ background: '#fafbfc', borderRadius: '20px', padding: '18px 20px', border: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '0.8rem', color: '#868e96', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className={`fas ${stat.icon}`}></i> {stat.label}
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1b1f22', marginTop: '6px' }}>{stat.value}</div>
              <span style={{
                fontSize: '0.75rem',
                color: stat.up ? '#2b8a3e' : '#c62828',
                background: stat.up ? '#d3f0df' : '#ffebee',
                padding: '2px 12px',
                borderRadius: '30px',
                display: 'inline-block',
                marginTop: '5px'
              }}>
                {stat.change.startsWith('+') ? <i className="fas fa-arrow-up"></i> : stat.change.startsWith('-') ? <i className="fas fa-arrow-down"></i> : ''}
                {' '}{stat.change}
              </span>
            </div>
          ))}
        </div>

        {/* پنل اصلی معاملاتی */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1.2fr', gap: '20px', marginBottom: '30px' }}>

          {/* دفتر سفارشات */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '18px 16px', border: '1px solid #eef2f6' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#868e96', letterSpacing: '0.5px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
              <span><i className="fas fa-arrow-up" style={{ color: '#d63939' }}></i> فروشندگان (قیمت درخواستی)</span>
              <span style={{ background: '#f1f3f5', padding: '2px 12px', borderRadius: '40px', fontSize: '0.7rem' }}>تعداد: ۱۸ سفارش</span>
            </div>
            {[
              ['فروشنده الف', '۲۹,۱۰۰', '۱۲ تن'],
              ['فروشنده ب', '۲۹,۰۵۰', '۸ تن'],
              ['فروشنده ج', '۲۸,۹۰۰', '۲۵ تن'],
              ['فروشنده د', '۲۸,۷۵۰', '۵ تن'],
            ].map(([seller, price, volume], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', fontSize: '0.9rem', borderBottom: '1px solid #f1f3f5' }}>
                <span>{seller}</span>
                <span style={{ fontWeight: 700, color: '#d63939' }}>{price}</span>
                <span style={{ color: '#495057' }}>{volume}</span>
              </div>
            ))}
            <div style={{ textAlign: 'center', background: '#f1f3f5', borderRadius: '40px', padding: '4px 0', margin: '10px 0', fontSize: '0.75rem', fontWeight: 700, color: '#495057' }}>
              --- قیمت تعادلی لحظه‌ای: ۲۸,۵۰۰ تومان ---
            </div>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#868e96', marginBottom: '10px' }}>
              <span><i className="fas fa-arrow-down" style={{ color: '#1b7a3d' }}></i> خریداران (قیمت پیشنهادی)</span>
            </div>
            {[
              ['خریدار ۱', '۲۸,۳۰۰', '۲۰ تن'],
              ['خریدار ۲', '۲۸,۱۰۰', '۱۵ تن'],
              ['خریدار ۳', '۲۷,۹۵۰', '۱۰ تن'],
            ].map(([buyer, price, volume], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', fontSize: '0.9rem', borderBottom: '1px solid #f1f3f5' }}>
                <span>{buyer}</span>
                <span style={{ fontWeight: 700, color: '#1b7a3d' }}>{price}</span>
                <span style={{ color: '#495057' }}>{volume}</span>
              </div>
            ))}
          </div>

          {/* فرم ثبت سفارش */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '18px 16px', border: '1px solid #eef2f6' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#868e96', marginBottom: '15px' }}>
              <i className="fas fa-file-signature"></i> ثبت دستور معامله فوری
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#343a40', marginBottom: '5px' }}>
                <i className="far fa-star"></i> نوع کود
              </label>
              <select value={selectedFertilizer} onChange={e => setSelectedFertilizer(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '16px', border: '1.5px solid #dee2e6', fontSize: '1rem', background: '#fafbfc' }}>
                <option>کود کامل NPK ۱۵-۱۰-۱۵ + میکرو</option>
                <option>کود اوره ۴۶%</option>
                <option>سولفات پتاسیم</option>
                <option>نیترات کلسیم</option>
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#343a40', marginBottom: '5px' }}>
                <i className="fas fa-weight-scale"></i> مقدار (به کیلوگرم)
              </label>
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: '100%', padding: '12px 16px', borderRadius: '16px', border: '1.5px solid #dee2e6', fontSize: '1rem', background: '#fafbfc' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#343a40', marginBottom: '5px' }}>
                <i className="fas fa-tag"></i> قیمت پیشنهادی (تومان / کیلو)
              </label>
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '12px 16px', borderRadius: '16px', border: '1.5px solid #dee2e6', fontSize: '1rem', background: '#fafbfc' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#343a40', marginBottom: '5px' }}>
                <i className="fas fa-store"></i> انبار تحویل
              </label>
              <select value={warehouse} onChange={e => setWarehouse(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '16px', border: '1.5px solid #dee2e6', fontSize: '1rem', background: '#fafbfc' }}>
                <option>انبار مرکزی استان</option>
                <option>انبار غرب</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button style={{ flex: 1, padding: '14px 0', border: 'none', borderRadius: '60px', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', background: '#1b7a3d', color: '#fff', boxShadow: '0 6px 14px rgba(27, 122, 61, 0.25)' }}>
                <i className="fas fa-plus-circle"></i> خرید (ثبت سفارش)
              </button>
              <button style={{ flex: 1, padding: '14px 0', border: 'none', borderRadius: '60px', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', background: '#d63939', color: '#fff', boxShadow: '0 6px 14px rgba(214, 57, 57, 0.2)' }}>
                <i className="fas fa-minus-circle"></i> فروش (ثبت سفارش)
              </button>
            </div>
            <div style={{ marginTop: '15px', background: '#f8fafb', borderRadius: '16px', padding: '12px', fontSize: '0.8rem', color: '#495057', textAlign: 'center' }}>
              <i className="fas fa-info-circle"></i> کارمزد معامله: ۰.۵٪ | تسویه: نقدی هنگام تحویل
            </div>
          </div>

          {/* وضعیت بازار و نمادها */}
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '18px 16px', border: '1px solid #eef2f6' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#868e96', marginBottom: '15px' }}>
              <i className="fas fa-chart-pie"></i> خلاصه نمادهای پربازده
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { name: 'کود کامل گرید A', change: '+۳.۲٪', price: '۲۹,۱۰۰ ت', volume: '۴۵ تن', color: '#1b7a3d', bg: '#f6faf7' },
                { name: 'اوره ۴۶%', change: '-۱.۱٪', price: '۱۸,۲۰۰ ت', volume: '۸۰ تن', color: '#d63939', bg: '#fafbfc' },
                { name: 'سولفات پتاسیم', change: '+۰.۸٪', price: '۳۲,۵۰۰ ت', volume: '۱۲ تن', color: '#1b7a3d', bg: '#fafbfc' },
                { name: 'نیترات کلسیم', change: '+۰.۲٪', price: '۲۶,۷۰۰ ت', volume: '۸ تن', color: '#1b7a3d', bg: '#fafbfc' },
              ].map((item, idx) => (
                <div key={idx} style={{ background: item.bg, borderRadius: '16px', padding: '14px', borderRight: `4px solid ${item.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{item.name}</span>
                    <span style={{ color: item.color }}>{item.change}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#495057' }}>
                    <span>{item.price}</span> <span>حجم: {item.volume}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '18px', background: '#1b4d2b', color: 'white', borderRadius: '20px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="fas fa-bolt"></i> تسویه آنی</span>
              <span style={{ fontWeight: 900 }}>۲۸,۵۰۰ تومان <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>/ هر کیلو</span></span>
            </div>
          </div>
        </div>

        {/* جدول تاریخچه معاملات */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #eef2f6', padding: '18px 16px', marginTop: '10px' }}>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#868e96', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span><i className="fas fa-clock-rotate-left"></i> آخرین معاملات انجام شده (تاریخچه امروز)</span>
            <span style={{ background: '#f1f3f5', padding: '2px 16px', borderRadius: '40px', fontSize: '0.7rem' }}>به‌روزرسانی: لحظه‌ای</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>زمان</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>نوع</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>کود</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>مقدار (تن)</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>قیمت (تومان)</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>طرف مقابل</th>
                  <th style={{ textAlign: 'right', padding: '16px 12px', background: '#f1f4f8', color: '#495057', fontWeight: 700 }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>{trade.time}</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{ color: trade.type === 'خرید' ? '#1b7a3d' : '#d63939', fontWeight: 700 }}>{trade.type}</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>{trade.fertilizer}</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>{trade.tons}</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>{trade.price.toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>{trade.counterparty}</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{
                        background: trade.status === 'انجام شده' ? '#e3f0e6' : '#fff3cd',
                        color: trade.status === 'انجام شده' ? '#1b4d2b' : '#856404',
                        padding: '4px 16px',
                        borderRadius: '60px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* فوتر */}
        <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '0.8rem', color: '#adb5bd', borderTop: '1px solid #edf2f7', paddingTop: '20px' }}>
          <i className="fas fa-shield-alt" style={{ color: '#1b4d2b' }}></i> تمامی معاملات این صرافی منطبق بر قوانین بازار محصولات کشاورزی بوده و به صورت شفاف در سامانه ثبت می‌گردد.
        </div>
      </div>
    </div>
  );
}
