// در buildLedger تب مشتری‌ها، بعد از entries.push برای cashEntries:
if (ce.fee && ce.fee > 0 && ce.feePayer === "customer" && isCurrency(ce.feeCurrency)) {
  entries.push({
    id: `${ce.id}-fee`,
    date: ce.date || new Date().toISOString(),
    customerId: ce.customerId,
    type: "fee",
    description: "کارمزد صندوق",
    currency: ce.feeCurrency as Currency,
    amount: ce.fee,
    direction: "out",
    balanceAfter: 0,
    referenceId: ce.id,
    referenceNumber: ce.trackingCode || ""
  });
}
