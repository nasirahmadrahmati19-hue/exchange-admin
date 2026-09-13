  const confirmRegister = useCallback(async () => {
    try {
      const parsedAmountFrom = parseAmount(form.amountFrom);
      
      if (!Number.isFinite(parsedAmountFrom) || parsedAmountFrom <= 0) {
        showToast("❌ مبلغ حواله نامعتبر است. لطفاً یک عدد مثبت وارد کنید.");
        return;
      }

      const nowDate = new Date();
      const senderName = form.senderName.trim(), receiverName = form.receiverName.trim();
      const isSenderCash = form.senderId === String(CASH_BOX_ID) || senderName === CASH_BOX_NAME;
      const isReceiverCash = form.receiverId === String(CASH_BOX_ID) || receiverName === CASH_BOX_NAME;
      const isSenderExchange = form.senderId === String(EXCHANGE_ACCOUNT_ID) || senderName === EXCHANGE_ACCOUNT_NAME;
      const isReceiverExchange = form.receiverId === String(EXCHANGE_ACCOUNT_ID) || receiverName === EXCHANGE_ACCOUNT_NAME;
      
      const sender = isSenderCash ? CASH_BOX_CUSTOMER : isSenderExchange ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => String(c.id) === String(form.senderId)) || customers.find(c => c.name === senderName) || null;
      const receiver = isReceiverCash ? CASH_BOX_CUSTOMER : isReceiverExchange ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => String(c.id) === String(form.receiverId)) || customers.find(c => c.name === receiverName) || null;
      
      let rateLabel = "";
      const txRate = rateMode === "same" ? 1 : rateValue;
      if (rateMode === "same") rateLabel = "بدون تبدیل";
      if (rateMode === "afn" && afnForeign) rateLabel = afnRateLabel(afnForeign, txRate);
      if (rateMode === "direct" && directCounter) rateLabel = directRateLabel(directBaseValue, directCounter, txRate);
      
      if (editingId) {
        const existing = hawalas.find(x => x.id === editingId);
        if (existing) {
          // ✅ اصلاح حیاتی: تمام فیلدهای قابل ویرایش فرم اکنون به درستی در آبجکت به‌روزرسانی قرار می‌گیرند
          const updated: Hawala = { 
            ...existing, 
            type: form.type,
            currencyFrom: form.currencyFrom,
            currencyTo: form.currencyTo,
            amountFrom: parsedAmountFrom,
            rate: txRate,
            rateLabel,
            rateBase: rateMode === "direct" ? directBaseValue : undefined,
            fee: feeValue,
            feeCurrency: form.feeCurrency,
            feePayer: form.feePayer,
            finalAmount,
            profit: feeValue,
            profitCurrency: form.feeCurrency,
            province: form.province, 
            district: form.province === "هرات" ? form.district : form.province, 
            destinationText, 
            senderName, 
            senderPhone: form.senderPhone, 
            senderTelegram: form.senderTelegram, 
            senderId: sender ? String(sender.id) : undefined, 
            receiverName, 
            receiverTazkira: form.receiverTazkira, 
            receiverPhone: form.receiverPhone, 
            receiverAddress: form.receiverAddress, 
            receiverId: receiver ? String(receiver.id) : undefined, 
            note: form.note, 
            balance: form.balance
          };
          
          setHawalas(prev => prev.map(x => x.id === editingId ? updated : x));
          setEditingId(null); 
          setForm(emptyForm); 
          setErrors({}); 
          setPreviewOpen(false); 
          setActiveTab(existing.status === "paid" || existing.status === "cancelled" ? "history" : "current");
          showToast("✅ اطلاعات حواله با موفقیت ویرایش شد.");
          return;
        }
      }
      
      const trackingNumber = await consumeTrackingCode();
      const newHawala: Hawala = { 
        id: generateId(), 
        number: trackingNumber, 
        date: nowDate.toISOString(), 
        time: "", 
        type: form.type, 
        destinationCountry: "افغانستان", 
        province: form.province, 
        district: form.province === "هرات" ? form.district : form.province, 
        destinationText, 
        currencyFrom: form.currencyFrom, 
        currencyTo: form.currencyTo, 
        amountFrom: parsedAmountFrom, 
        rate: txRate, 
        rateLabel, 
        rateBase: rateMode === "direct" ? directBaseValue : undefined, 
        fee: feeValue, 
        feeCurrency: form.feeCurrency, 
        feePayer: form.feePayer, 
        finalAmount, 
        balance: form.balance,
        note: form.note, 
        profit: feeValue, 
        profitCurrency: form.feeCurrency, 
        senderId: sender ? String(sender.id) : undefined, 
        senderName, 
        senderPhone: form.senderPhone, 
        senderTelegram: form.senderTelegram, 
        receiverId: receiver ? String(receiver.id) : undefined, 
        receiverName, 
        receiverTazkira: form.receiverTazkira, 
        receiverPhone: form.receiverPhone, 
        receiverAddress: form.receiverAddress, 
        status: "pending" as HawalaStatus 
      };
      
      setHawalas(prev => [newHawala, ...prev]);
      
      const newEntries = syncCashEntriesForHawala("add", newHawala, undefined, cashEntries);
      setCashEntries(newEntries);
      
      const updatedHawalas = [newHawala, ...hawalas];
      const updatedCustomers = getUpdatedCustomerBalances(customers, newEntries, transactions, updatedHawalas);
      setCustomers(updatedCustomers);
      
      setLastNames({ senderName, receiverName });
      setForm(emptyForm); 
      setErrors({}); 
      setPreviewOpen(false); 
      setActiveTab("current");
      
      await sendHawalaReceipts({ hawala: newHawala, action: "register", customers: updatedCustomers });
      showToast("✅ حواله ثبت شد، حساب‌ها به‌روز و رسید ارسال شد");
    } catch (err) { 
      console.error("Register error:", err); 
      showToast("خطا در ثبت حواله"); 
    }
  }, [form, rateMode, rateValue, afnForeign, directCounter, directBaseValue, feeValue, amountFrom, destinationText, customers, cashEntries, showToast, finalAmount, editingId, hawalas, transactions]);
