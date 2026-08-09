'use client';

export default function HawalaPage() {
  return (
    <>
      {/* لینک فونت و آیکون‌ها (درون خود کامپوننت) */}
      <link
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;700;900&display=swap"
        rel="stylesheet"
      />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
      />

      <div
        style={{
          background: '#f4f7f9',
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontFamily: 'Vazirmatn, sans-serif',
        }}
      >
        <div
          className="dashboard"
          style={{
            maxWidth: '1440px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '32px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
            padding: '25px 30px 30px 30px',
            border: '1px solid rgba(0,0,0,0.02)',
          }}
        >
          {/* ===== هدر ===== */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              flexWrap: 'wrap',
              gap: '15px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div
                style={{
                  background: '#1b4d2b',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '60px',
                  fontWeight: 900,
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <i className="fas fa-seedling" style={{ color: '#ffd54f' }}></i> صرافی کود
              </div>
              <span
                style={{
                  background: '#e8f5e9',
                  color: '#1b4d2b',
                  padding: '6px 18px',
                  borderRadius: '40px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: '1px solid #a5d6a7',
                }}
              >
                <i
                  className="fas fa-circle"
                  style={{ color: '#2b8a3e', fontSize: '0.5rem' }}
                ></i>{' '}
                بازار آزاد (بازار معاملات محلی)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
              <div
                style={{
                  background: '#f1f3f5',
                  padding: '8px 18px',
                  borderRadius: '40px',
                  fontSize: '0.9rem',
                  color: '#495057',
                }}
              >
                <i className="far fa-calendar-alt"></i> ۱۸ مرداد ۱۴۰۵
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#f8f9fa',
                  padding: '6px 16px 6px 6px',
                  borderRadius: '60px',
                }}
              >
                <div
                  style={{
                    background: '#1b4d2b',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                  }}
                >
                  ک
                </div>
                <span style={{ fontWeight: 700 }}>کاربر حقیقی</span>
                <i
                  className="fas fa-chevron-down"
                  style={{ color: '#adb5bd', fontSize: '0.7rem' }}
                ></i>
              </div>
            </div>
          </div>

          {/* ===== کارت‌های آماری ===== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                background: '#fafbfc',
                borderRadius: '20px',
                padding: '18px 20px',
                border: '1px solid #e9ecef',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#868e96',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fas fa-weight-scale"></i> حجم کل معاملات امروز
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1b1f22', marginTop: '6px' }}>
                ۴,۲۵۰ <span style={{ fontSize: '1rem' }}>تن</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#2b8a3e',
                  background: '#d3f0df',
                  padding: '2px 12px',
                  borderRadius: '30px',
                  display: 'inline-block',
                  marginTop: '5px',
                }}
              >
                <i className="fas fa-arrow-up"></i> ۱۲٪ نسبت به دیروز
              </span>
            </div>
            <div
              style={{
                background: '#fafbfc',
                borderRadius: '20px',
                padding: '18px 20px',
                border: '1px solid #e9ecef',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#868e96',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fas fa-chart-line"></i> میانگین قیمت (کود کامل)
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1b1f22', marginTop: '6px' }}>
                ۲۸,۵۰۰ <span style={{ fontSize: '1rem' }}>تومان</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  background: '#ffebee',
                  color: '#c62828',
                  padding: '2px 12px',
                  borderRadius: '30px',
                  display: 'inline-block',
                  marginTop: '5px',
                }}
              >
                <i className="fas fa-arrow-down"></i> ۲.۱٪
              </span>
            </div>
            <div
              style={{
                background: '#fafbfc',
                borderRadius: '20px',
                padding: '18px 20px',
                border: '1px solid #e9ecef',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#868e96',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fas fa-handshake"></i> تعداد معاملات
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1b1f22', marginTop: '6px' }}>
                ۱۴۲
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#2b8a3e',
                  background: '#d3f0df',
                  padding: '2px 12px',
                  borderRadius: '30px',
                  display: 'inline-block',
                  marginTop: '5px',
                }}
              >
                در ۶ ساعت اخیر
              </span>
            </div>
            <div
              style={{
                background: '#fafbfc',
                borderRadius: '20px',
                padding: '18px 20px',
                border: '1px solid #e9ecef',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#868e96',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fas fa-truck"></i> آماده تحویل فوری
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1b1f22', marginTop: '6px' }}>
                ۸۹۰ <span style={{ fontSize: '1rem' }}>تن</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#2b8a3e',
                  background: '#d3f0df',
                  padding: '2px 12px',
                  borderRadius: '30px',
                  display: 'inline-block',
                  marginTop: '5px',
                }}
              >
                در انبارهای استان
              </span>
            </div>
          </div>

          {/* ===== پنل اصلی معاملاتی ===== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 0.8fr 1.2fr',
              gap: '20px',
              marginBottom: '30px',
            }}
          >
            {/* دفتر سفارشات فروشندگان */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '18px 16px',
                border: '1px solid #eef2f6',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  color: '#868e96',
                  letterSpacing: '0.5px',
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <i className="fas fa-arrow-up" style={{ color: '#d63939' }}></i> فروشندگان (قیمت
                  درخواستی)
                </span>
                <span
                  style={{
                    background: '#f1f3f5',
                    padding: '2px 12px',
                    borderRadius: '40px',
                    fontSize: '0.7rem',
                  }}
                >
                  تعداد: ۱۸ سفارش
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>فروشنده الف</span>{' '}
                <span style={{ fontWeight: 700, color: '#d63939' }}>۲۹,۱۰۰</span>{' '}
                <span style={{ color: '#495057' }}>۱۲ تن</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>فروشنده ب</span>{' '}
                <span style={{ fontWeight: 700, color: '#d63939' }}>۲۹,۰۵۰</span>{' '}
                <span style={{ color: '#495057' }}>۸ تن</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>فروشنده ج</span>{' '}
                <span style={{ fontWeight: 700, color: '#d63939' }}>۲۸,۹۰۰</span>{' '}
                <span style={{ color: '#495057' }}>۲۵ تن</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>فروشنده د</span>{' '}
                <span style={{ fontWeight: 700, color: '#d63939' }}>۲۸,۷۵۰</span>{' '}
                <span style={{ color: '#495057' }}>۵ تن</span>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  background: '#f1f3f5',
                  borderRadius: '40px',
                  padding: '4px 0',
                  margin: '10px 0',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#495057',
                }}
              >
                --- قیمت تعادلی لحظه‌ای: ۲۸,۵۰۰ تومان ---
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>خریدار ۱</span>{' '}
                <span style={{ fontWeight: 700, color: '#1b7a3d' }}>۲۸,۳۰۰</span>{' '}
                <span style={{ color: '#495057' }}>۲۰ تن</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>خریدار ۲</span>{' '}
                <span style={{ fontWeight: 700, color: '#1b7a3d' }}>۲۸,۱۰۰</span>{' '}
                <span style={{ color: '#495057' }}>۱۵ تن</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #f1f3f5',
                }}
              >
                <span>خریدار ۳</span>{' '}
                <span style={{ fontWeight: 700, color: '#1b7a3d' }}>۲۷,۹۵۰</span>{' '}
                <span style={{ color: '#495057' }}>۱۰ تن</span>
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  color: '#868e96',
                  letterSpacing: '0.5px',
                  marginTop: '10px',
                  marginBottom: '0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <i className="fas fa-arrow-down" style={{ color: '#1b7a3d' }}></i> خریداران (قیمت
                  پیشنهادی)
                </span>
              </div>
            </div>

            {/* فرم ثبت سفارش */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '18px 16px',
                border: '1px solid #eef2f6',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  color: '#868e96',
                  letterSpacing: '0.5px',
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <i className="fas fa-file-signature"></i> ثبت دستور معامله فوری
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#343a40',
                    marginBottom: '5px',
                  }}
                >
                  <i className="far fa-star"></i> نوع کود
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '1.5px solid #dee2e6',
                    fontSize: '1rem',
                    background: '#fafbfc',
                  }}
                >
                  <option>کود کامل NPK ۱۵-۱۰-۱۵ + میکرو</option>
                  <option>کود اوره ۴۶%</option>
                  <option>سولفات پتاسیم</option>
                  <option>نیترات کلسیم</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#343a40',
                    marginBottom: '5px',
                  }}
                >
                  <i className="fas fa-weight-scale"></i> مقدار (به کیلوگرم)
                </label>
                <input
                  type="number"
                  defaultValue="۱۰۰۰"
                  placeholder="مقدار را وارد کنید..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '1.5px solid #dee2e6',
                    fontSize: '1rem',
                    background: '#fafbfc',
                  }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#343a40',
                    marginBottom: '5px',
                  }}
                >
                  <i className="fas fa-tag"></i> قیمت پیشنهادی (تومان / کیلو)
                </label>
                <input
                  type="number"
                  defaultValue="۲۸,۵۰۰"
                  placeholder="قیمت پیشنهادی..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '1.5px solid #dee2e6',
                    fontSize: '1rem',
                    background: '#fafbfc',
                  }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#343a40',
                    marginBottom: '5px',
                  }}
                >
                  <i className="fas fa-store"></i> انبار تحویل
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '1.5px solid #dee2e6',
                    fontSize: '1rem',
                    background: '#fafbfc',
                  }}
                >
                  <option>انبار مرکزی استان</option>
                  <option>انبار غرب</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    border: 'none',
                    borderRadius: '60px',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    background: '#1b7a3d',
                    color: '#fff',
                    boxShadow: '0 6px 14px rgba(27, 122, 61, 0.25)',
                  }}
                >
                  <i className="fas fa-plus-circle"></i> خرید (ثبت سفارش)
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    border: 'none',
                    borderRadius: '60px',
                    fontWeight: 900,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    background: '#d63939',
                    color: '#fff',
                    boxShadow: '0 6px 14px rgba(214, 57, 57, 0.2)',
                  }}
                >
                  <i className="fas fa-minus-circle"></i> فروش (ثبت سفارش)
                </button>
              </div>
              <div
                style={{
                  marginTop: '15px',
                  background: '#f8fafb',
                  borderRadius: '16px',
                  padding: '12px',
                  fontSize: '0.8rem',
                  color: '#495057',
                  textAlign: 'center',
                }}
              >
                <i className="fas fa-info-circle"></i> کارمزد معامله: ۰.۵٪ | تسویه: نقدی هنگام تحویل
              </div>
            </div>

            {/* وضعیت بازار و نمادها */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '18px 16px',
                border: '1px solid #eef2f6',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  color: '#868e96',
                  letterSpacing: '0.5px',
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <i className="fas fa-chart-pie"></i> خلاصه نمادهای پربازده
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    background: '#f6faf7',
                    borderRadius: '16px',
                    padding: '14px',
                    borderRight: '4px solid #1b7a3d',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>کود کامل گرید A</span>{' '}
                    <span style={{ color: '#1b7a3d' }}>+۳.۲٪</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#495057',
                    }}
                  >
                    <span>۲۹,۱۰۰ ت</span> <span>حجم: ۴۵ تن</span>
                  </div>
                </div>
                <div
                  style={{
                    background: '#fafbfc',
                    borderRadius: '16px',
                    padding: '14px',
                    borderRight: '4px solid #ffb74d',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>اوره ۴۶%</span>{' '}
                    <span style={{ color: '#d63939' }}>-۱.۱٪</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#495057',
                    }}
                  >
                    <span>۱۸,۲۰۰ ت</span> <span>حجم: ۸۰ تن</span>
                  </div>
                </div>
                <div
                  style={{
                    background: '#fafbfc',
                    borderRadius: '16px',
                    padding: '14px',
                    borderRight: '4px solid #4fc3f7',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>سولفات پتاسیم</span>{' '}
                    <span style={{ color: '#1b7a3d' }}>+۰.۸٪</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#495057',
                    }}
                  >
                    <span>۳۲,۵۰۰ ت</span> <span>حجم: ۱۲ تن</span>
                  </div>
                </div>
                <div
                  style={{
                    background: '#fafbfc',
                    borderRadius: '16px',
                    padding: '14px',
                    borderRight: '4px solid #ce93d8',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>نیترات کلسیم</span>{' '}
                    <span style={{ color: '#1b7a3d' }}>+۰.۲٪</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#495057',
                    }}
                  >
                    <span>۲۶,۷۰۰ ت</span> <span>حجم: ۸ تن</span>
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: '18px',
                  background: '#1b4d2b',
                  color: 'white',
                  borderRadius: '20px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <i className="fas fa-bolt"></i> تسویه آنی
                </span>
                <span style={{ fontWeight: 900 }}>
                  ۲۸,۵۰۰ تومان <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>/ هر کیلو</span>
                </span>
              </div>
            </div>
          </div>

          {/* ===== جدول تاریخچه معاملات ===== */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #eef2f6',
              padding: '18px 16px',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                color: '#868e96',
                letterSpacing: '0.5px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                <i className="fas fa-clock-rotate-left"></i> آخرین معاملات انجام شده (تاریخچه امروز)
              </span>
              <span
                style={{
                  background: '#f1f3f5',
                  padding: '2px 16px',
                  borderRadius: '40px',
                  fontSize: '0.7rem',
                }}
              >
                به‌روزرسانی: لحظه‌ای
              </span>
            </div>
            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      زمان
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      نوع
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      کود
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      مقدار (تن)
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      قیمت (تومان)
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      طرف مقابل
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '16px 12px',
                        background: '#f1f4f8',
                        color: '#495057',
                        fontWeight: 700,
                      }}
                    >
                      وضعیت
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۱۴:۲۵</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{ color: '#1b7a3d', fontWeight: 700 }}>خرید</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      کامل ۱۵-۱۰-۱۵
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۵</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      ۲۸,۴۰۰
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      شرکت کشت سبز
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span
                        style={{
                          background: '#e3f0e6',
                          color: '#1b4d2b',
                          padding: '4px 16px',
                          borderRadius: '60px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        انجام شده
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۱۳:۵۰</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{ color: '#d63939', fontWeight: 700 }}>فروش</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>اوره</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۱۲</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      ۱۸,۱۰۰
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      تعاونی روستایی
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span
                        style={{
                          background: '#fff3cd',
                          color: '#856404',
                          padding: '4px 16px',
                          borderRadius: '60px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        در انتظار تأیید
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۱۲:۱۰</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{ color: '#1b7a3d', fontWeight: 700 }}>خرید</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      سولفات پتاسیم
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۳</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      ۳۲,۲۰۰
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      بازرگانی الف
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span
                        style={{
                          background: '#e3f0e6',
                          color: '#1b4d2b',
                          padding: '4px 16px',
                          borderRadius: '60px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        انجام شده
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۱۱:۰۵</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span style={{ color: '#d63939', fontWeight: 700 }}>فروش</span>
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      کامل ۱۵-۱۰-۱۵
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>۸</td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      ۲۸,۷۰۰
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      کارخانه کود شمال
                    </td>
                    <td style={{ padding: '14px 12px', borderBottom: '1px solid #edf2f7' }}>
                      <span
                        style={{
                          background: '#e3f0e6',
                          color: '#1b4d2b',
                          padding: '4px 16px',
                          borderRadius: '60px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        انجام شده
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== فوتر ===== */}
          <div
            style={{
              marginTop: '25px',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: '#adb5bd',
              borderTop: '1px solid #edf2f7',
              paddingTop: '20px',
            }}
          >
            <i className="fas fa-shield-alt" style={{ color: '#1b4d2b' }}></i> تمامی معاملات این صرافی
            منطبق بر قوانین بازار محصولات کشاورزی بوده و به صورت شفاف در سامانه ثبت می‌گردد.
          </div>
        </div>
      </div>
    </>
  );
}
