'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { FaRegCalendarAlt, FaSearch, FaFilter } from 'react-icons/fa'
import { FaArrowTrendUp, FaArrowTrendDown } from 'react-icons/fa6'

interface Transaction {
  id: string
  docNumber: string
  timestamp: { seconds: number }
  description: string
  currency: string
  amount: number
  type: 'deposit' | 'withdrawal' | 'transfer' | 'conversion' | 'fee'
  balanceAfter: number
}

export default function JournalPage() {
  const { data: session } = useSession()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currencySummary, setCurrencySummary] = useState<Record<string, number>>({})

  // لود اولیه داده‌ها
  const loadInitialData = async () => {
    setLoading(true)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', session?.user?.email),
      orderBy('timestamp', 'desc'),
      limit(20)
    )

    const snapshot = await getDocs(q)
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[]

    if (snapshot.empty) setHasMore(false)
    else setLastDoc(snapshot.docs[snapshot.docs.length - 1])

    setTransactions(docs)
    setFilteredTransactions(docs)
    updateCurrencySummary(docs)
    setLoading(false)
  }

  // لود داده‌های بعدی
  const loadMoreData = async () => {
    if (!hasMore || loading) return

    setLoading(true)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', session?.user?.email),
      orderBy('timestamp', 'desc'),
      startAfter(lastDoc),
      limit(20)
    )

    const snapshot = await getDocs(q)
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[]

    if (snapshot.empty) setHasMore(false)
    else setLastDoc(snapshot.docs[snapshot.docs.length - 1])

    const newTransactions = [...transactions, ...docs]
    setTransactions(newTransactions)
    setFilteredTransactions(newTransactions)
    updateCurrencySummary(newTransactions)
    setLoading(false)
  }

  // به‌روزرسانی خلاصه ارزها
  const updateCurrencySummary = (data: Transaction[]) => {
    const summary: Record<string, number> = {}

    data.forEach(t => {
      if (!summary[t.currency]) summary[t.currency] = 0
      summary[t.currency] = t.balanceAfter
    })

    setCurrencySummary(summary)
  }

  // فیلتر داده‌ها
  useEffect(() => {
    let filtered = [...transactions]

    if (selectedCurrency) {
      filtered = filtered.filter(t => t.currency === selectedCurrency)
    }

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.docNumber.includes(searchTerm)
      )
    }

    if (startDate) {
      const start = new Date(startDate).getTime() / 1000
      filtered = filtered.filter(t => t.timestamp.seconds >= start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime() / 1000
      filtered = filtered.filter(t => t.timestamp.seconds <= end)
    }

    setFilteredTransactions(filtered)
    updateCurrencySummary(filtered)
  }, [selectedCurrency, searchTerm, startDate, endDate, transactions])

  // لود داده‌ها وقتی کاربر وارد شد
  useEffect(() => {
    if (session?.user?.email) {
      loadInitialData()
    }
  }, [session])

  return (
    <div className="p-4 space-y-6">
      {/* کارت‌های خلاصه دوره */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(currencySummary).map(([currency, balance]) => (
          <div
            key={currency}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center justify-between"
          >
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">{currency}</h3>
              <p className="text-lg font-bold">{balance.toLocaleString()} <span className="text-sm">IRR</span></p>
            </div>
            {balance >= 0 ? <FaArrowTrendUp className="text-green-500" /> : <FaArrowTrendDown className="text-red-500" />}
          </div>
        ))}
      </div>

      {/* فیلترها */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">جستجو</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو..."
                className="w-full p-2 pl-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <FaSearch className="absolute left-2 top-2.5 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">نوع ارز</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">همه ارزها</option>
              {['AFN', 'USD', 'EUR', 'IRR', 'KWD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">از تاریخ</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <FaRegCalendarAlt className="absolute left-2 top-2.5 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">تا تاریخ</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <FaRegCalendarAlt className="absolute left-2 top-2.5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* جدول تراکنش‌ها */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-3 text-right">شماره سند</th>
              <th className="p-3 text-right">تاریخ</th>
              <th className="p-3 text-right">شرح</th>
              <th className="p-3 text-right">ارز</th>
              <th className="p-3 text-right">مبلغ</th>
              <th className="p-3 text-right">نوع</th>
              <th className="p-3 text-right">تراز بعد</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">هیچ تراکنشی یافت نشد</td>
              </tr>
            )}
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="p-3">{t.docNumber}</td>
                <td className="p-3">{format(new Date(t.timestamp.seconds * 1000), 'yyyy/MM/dd HH:mm')}</td>
                <td className="p-3">{t.description}</td>
                <td className="p-3">{t.currency}</td>
                <td className="p-3 text-left font-mono">{t.amount.toLocaleString()}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-1 rounded text-white text-xs
                    ${t.type === 'deposit' ? 'bg-green-500' :
                      t.type === 'withdrawal' ? 'bg-red-500' :
                      t.type === 'transfer' ? 'bg-blue-500' :
                      t.type === 'conversion' ? 'bg-yellow-500' :
                      'bg-purple-500'
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="p-3 text-left font-mono">{t.balanceAfter.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* لود بیشتر */}
      <div className="flex justify-center">
        {loading ? (
          <button className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg" disabled>در حال بارگذاری...</button>
        ) : hasMore ? (
          <button
            onClick={loadMoreData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            بارگذاری بیشتر
          </button>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">پایان لیست</p>
        )}
      </div>
    </div>
  )
}
