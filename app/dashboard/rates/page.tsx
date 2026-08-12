// app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FaExchangeAlt, 
  FaWallet, 
  FaUserFriends, 
  FaChartLine, 
  FaMoneyBillWave, 
  FaHistory, 
  FaCog,
  FaArrowUp,
  FaArrowDown,
  FaClock,
  FaBell,
  FaUsers,
  FaShoppingCart,
  FaHandshake,
  FaPercentage
} from 'react-icons/fa';

interface StatItem {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}

interface Activity {
  id: number;
  type: string;
  description: string;
  amount: string;
  time: string;
  status: 'success' | 'pending' | 'failed';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatItem[]>([
    { title: 'کل موجودی', value: '۱۵,۲۵۰,۰۰۰', change: 12.5, icon: FaWallet, color: 'blue' },
    { title: 'معاملات امروز', value: '۴۲', change: 8.3, icon: FaExchangeAlt, color: 'green' },
    { title: 'مشتریان فعال', value: '۱۲۸', change: 5.2, icon: FaUserFriends, color: 'purple' },
    { title: 'نرخ دلار', value: '۷۵,۵۰۰', change: -2.1, icon: FaMoneyBillWave, color: 'yellow' },
  ]);

  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, type: 'خرید', description: 'خرید ۵۰۰ دلار از احمد رحیمی', amount: '+۵۰۰ USD', time: '۱۰:۳۰', status: 'success' },
    { id: 2, type: 'فروش', description: 'فروش ۳۰۰ یورو به علی کریمی', amount: '-۳۰۰ EUR', time: '۱۱:۱۵', status: 'success' },
    { id: 3, type: 'حواله', description: 'حواله ۵۰,۰۰۰ افغانی به محمد حسینی', amount: '-۵۰,۰۰۰ AFN', time: '۱۳:۲۰', status: 'pending' },
    { id: 4, type: 'تبدیل', description: 'تبدیل ۲۰۰ کلدار به دلار', amount: '+۲۰۰ CAD', time: '۱۴:۴۵', status: 'success' },
    { id: 5, type: 'دریافت', description: 'دریافت از مشتری زهرا احمدی', amount: '+۱,۲۰۰ USD', time: '۱۶:۰۰', status: 'success' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update stats randomly for demo
      setStats(prev => prev.map(stat => ({
        ...stat,
        change: stat.change + (Math.random() - 0.5) * 0.5
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'success': return 'تکمیل شده';
      case 'pending': return 'در انتظار';
      case 'failed': return 'ناموفق';
      default: return 'نامشخص';
    }
  };

  const quickActions = [
    { title: 'ثبت معامله', icon: FaShoppingCart, href: '/dashboard/trades', color: 'bg-gradient-to-r from-blue-500 to-blue-600' },
    { title: 'مدیریت صندوق', icon: FaWallet, href: '/dashboard/cash', color: 'bg-gradient-to-r from-green-500 to-green-600' },
    { title: 'حواله‌جات', icon: FaHistory, href: '/dashboard/transfers', color: 'bg-gradient-to-r from-purple-500 to-purple-600' },
    { title: 'نرخ ارزها', icon: FaChartLine, href: '/dashboard/rates', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
    { title: 'مشتریان', icon: FaUsers, href: '/dashboard/customers', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
    { title: 'تنظیمات', icon: FaCog, href: '/dashboard/settings', color: 'bg-gradient-to-r from-gray-500 to-gray-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FaHandshake className="text-blue-600" />
              داشبورد مدیریت صرافی
            </h1>
            <p className="
