function getBalanceChangesForTransaction(tx: Transaction, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const sign = action === "register" ? 1 : -1;
  
  if (tx.type === "exchange" && tx.customerId) {
    // ✅ این خط درست است - AFN از حساب مشتری کم می‌شود
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
    
    // ❌ این خط اشتباه است - USD به حساب مشتری اضافه می‌شود!
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
    }
  }
  // ...
}
