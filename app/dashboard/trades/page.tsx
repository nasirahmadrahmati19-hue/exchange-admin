  const deleteTrade = (tx: Tx) => {
    try {
      // 🔧 اصلاح: استفاده از ?. و || برای جلوگیری از undefined
      const txReceiptNo = tx?.receiptNo || "";
      const receiptBase = txReceiptNo.replace(/-[AB]$/, "");
      
      // 🔧 اصلاح: بررسی وجود receiptNo قبل از replace
      const relatedTxs = trades.filter(t => {
        const tReceiptNo = t?.receiptNo || "";
        if (!tReceiptNo) return false;
        return tReceiptNo.replace(/-[AB]$/, "") === receiptBase;
      });
      
      // برگرداندن مانده حساب مشتریان (فقط اگر balancesBefore وجود داشته باشد)
      const updatedUsers = [...users];
      relatedTxs.forEach(relatedTx => {
        const userIdx = updatedUsers.findIndex(u => u.name === relatedTx.customer);
        if (userIdx === -1) return;
        
        const balancesBefore = (relatedTx as any).balancesBefore;
        if (balancesBefore) {
          updatedUsers[userIdx] = {
            ...updatedUsers[userIdx],
            balances: balancesBefore
          };
        } else {
          // 🔧 اگر تراکنش قدیمی balancesBefore نداشته باشد، فقط یک هشدار اضافه می‌کنیم
          console.warn(`⚠️ تراکنش ${relatedTx.receiptNo} balancesBefore ندارد - مانده برگردانده نشد`);
        }
      });
      
      // 🔧 اصلاح: بررسی وجود receiptNo در فیلتر حذف
      const newTrades = trades.filter(t => {
        const tReceiptNo = t?.receiptNo || "";
        return tReceiptNo.replace(/-[AB]$/, "") !== receiptBase;
      });
      
      setUsers(updatedUsers);
      setTrades(newTrades);
      setDeleteConfirm(null);
    } catch (e) {
      setError("خطا در حذف معامله: " + String(e));
      setDeleteConfirm(null);
    }
  };
