// app/dashboard/page.tsx
'use client';

import Link from 'next/link';

export default function DashboardPage() {
  const menuItems = [
    { title: 'مدیریت نرخ ارزها', href: '/dashboard/rates', color: 'bg-blue-500' },
    { title: 'مدیریت صندوق', href: '/dashboard/cash', color: 'bg-green-500' },
    { title: 'معاملات', href: '/dashboard/trades', color: 'bg-purple-500' },
    { title: 'مشتریان', href: '/dashboard/customers', color: 'bg-pink-500' },
  ];

  return (
    <div style={{ 
      maxWidth: '1280px', 
      margin: '0 auto', 
      padding: '2rem 1rem',
      direction: 'rtl',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 'bold', 
        color: '#1f2937',
        marginBottom: '0.5rem'
      }}>
        📊 داشبورد مدیریت
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        سیستم مدیریت صرافی
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem'
      }}>
        {menuItems.map((item) => (
          <Link key={item.title} href={item.href}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '0.75rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '9999px',
                backgroundColor: item.color,
                margin: '0 auto 0.75rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem'
              }}>
                {item.title.charAt(0)}
              </div>
              <h3 style={{ fontWeight: '600', color: '#1f2937' }}>{item.title}</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                کلیک کنید
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
