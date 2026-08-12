<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>صندوق - سیستم معاملاتی صرافی</title>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        /* ===== RESET & BASE ===== */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Vazirmatn', sans-serif;
            background: #f0f2f5;
            color: #1a1a2e;
            padding: 20px;
        }

        /* ===== CONTAINER ===== */
        .cash-container {
            max-width: 1400px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
            padding: 25px 30px;
        }

        /* ===== HEADER ===== */
        .cash-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eef2f7;
        }

        .cash-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a2e;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .cash-header h1 i {
            color: #4CAF50;
            font-size: 30px;
        }

        .cash-header .date-time {
            font-size: 14px;
            color: #6b7280;
            background: #f3f4f6;
            padding: 8px 16px;
            border-radius: 10px;
        }

        /* ===== BALANCE CARDS ===== */
        .balances-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .balance-card {
            background: #f8fafc;
            border-radius: 14px;
            padding: 18px 20px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
            text-align: center;
        }

        .balance-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            border-color: #4CAF50;
        }

        .balance-card .currency {
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            margin-bottom: 5px;
        }

        .balance-card .amount {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a2e;
        }

        .balance-card .amount.positive { color: #10b981; }
        .balance-card .amount.negative { color: #ef4444; }

        .balance-card .currency-icon {
            font-size: 28px;
            display: block;
            margin-bottom: 5px;
        }

        /* ===== ACTION BUTTONS ===== */
        .actions-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 25px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 10px;
            font-family: 'Vazirmatn', sans-serif;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: #4CAF50;
            color: white;
        }
        .btn-primary:hover {
            background: #43a047;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .btn-danger {
            background: #ef4444;
            color: white;
        }
        .btn-danger:hover {
            background: #dc2626;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .btn-warning {
            background: #f59e0b;
            color: white;
        }
        .btn-warning:hover {
            background: #d97706;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .btn-info {
            background: #3b82f6;
            color: white;
        }
        .btn-info:hover {
            background: #2563eb;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        .btn-secondary:hover {
            background: #4b5563;
            transform: translateY(-2px);
        }

        .btn-outline {
            background: transparent;
            color: #4CAF50;
            border: 2px solid #4CAF50;
        }
        .btn-outline:hover {
            background: #4CAF50;
            color: white;
        }

        .btn-sm {
            padding: 6px 14px;
            font-size: 12px;
        }

        /* ===== MODAL ===== */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.3s ease;
        }

        .modal-overlay.active {
            display: flex;
        }

        .modal {
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 550px;
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
            animation: slideUp 0.3s ease;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #eef2f7;
        }

        .modal-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: #1a1a2e;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #9ca3af;
            transition: color 0.3s;
        }
        .modal-close:hover {
            color: #ef4444;
        }

        /* ===== FORM ===== */
        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 5px;
        }

        .form-group label .required {
            color: #ef4444;
            margin-right: 4px;
        }

        .form-control {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-family: 'Vazirmatn', sans-serif;
            font-size: 14px;
            transition: all 0.3s ease;
            background: #f9fafb;
        }

        .form-control:focus {
            outline: none;
            border-color: #4CAF50;
            background: white;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.1);
        }

        .form-control.error {
            border-color: #ef4444;
            background: #fef2f2;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #eef2f7;
        }

        .form-actions .btn {
            flex: 1;
            justify-content: center;
        }

        /* ===== SEARCH & FILTER ===== */
        .search-filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 14px;
            border: 1px solid #e5e7eb;
        }

        .search-filter-bar .search-input {
            flex: 1;
            min-width: 200px;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-family: 'Vazirmatn', sans-serif;
            font-size: 14px;
            background: white;
            transition: all 0.3s;
        }

        .search-filter-bar .search-input:focus {
            outline: none;
            border-color: #4CAF50;
            box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.1);
        }

        .search-filter-bar select {
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-family: 'Vazirmatn', sans-serif;
            font-size: 14px;
            background: white;
            cursor: pointer;
        }

        .search-filter-bar select:focus {
            outline: none;
            border-color: #4CAF50;
        }

        /* ===== TABLE ===== */
        .table-responsive {
            overflow-x: auto;
            border-radius: 14px;
            border: 1px solid #e5e7eb;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .table th {
            background: #f8fafc;
            padding: 14px 16px;
            text-align: right;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
            white-space: nowrap;
        }

        .table td {
            padding: 12px 16px;
            border-bottom: 1px solid #eef2f7;
            vertical-align: middle;
        }

        .table tr:hover td {
            background: #fafbfc;
        }

        .table .type-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }

        .type-badge.receive { background: #d1fae5; color: #065f46; }
        .type-badge.payment { background: #fee2e2; color: #991b1b; }
        .type-badge.deposit { background: #dbeafe; color: #1e40af; }
        .type-badge.withdraw { background: #fef3c7; color: #92400e; }

        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-warning { color: #f59e0b; }
        .text-info { color: #3b82f6; }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }

        .mt-20 { margin-top: 20px; }
        .mb-20 { margin-bottom: 20px; }
        .fw-bold { font-weight: 700; }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #9ca3af;
        }

        .empty-state i {
            font-size: 60px;
            margin-bottom: 15px;
            display: block;
        }

        /* ===== CLOSE FUND ===== */
        .close-fund-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .close-fund-item {
            background: #f8fafc;
            padding: 15px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
        }

        .close-fund-item .label {
            font-size: 13px;
            color: #6b7280;
        }

        .close-fund-item .system-bal {
            font-weight: 600;
            color: #1a1a2e;
        }

        .close-fund-item .actual-input {
            width: 100%;
            padding: 6px 10px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-family: 'Vazirmatn', sans-serif;
            font-size: 14px;
            margin-top: 5px;
        }

        .close-fund-item .actual-input:focus {
            outline: none;
            border-color: #4CAF50;
        }

        .close-fund-item .diff {
            margin-top: 5px;
            font-weight: 600;
            font-size: 14px;
        }

        .diff.surplus { color: #10b981; }
        .diff.deficit { color: #ef4444; }
        .diff.equal { color: #6b7280; }

        /* ===== TOAST NOTIFICATIONS ===== */
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .toast {
            padding: 14px 24px;
            border-radius: 12px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            animation: slideInRight 0.4s ease;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            min-width: 280px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .toast.success { background: #10b981; }
        .toast.error { background: #ef4444; }
        .toast.warning { background: #f59e0b; }
        .toast.info { background: #3b82f6; }

        .toast i { font-size: 20px; }

        /* ===== ANIMATIONS ===== */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInRight {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
            .cash-container { padding: 15px; }
            .cash-header { flex-direction: column; gap: 10px; align-items: flex-start; }
            .form-row { grid-template-columns: 1fr; }
            .close-fund-grid { grid-template-columns: 1fr; }
            .balances-grid { grid-template-columns: repeat(2, 1fr); }
            .modal { padding: 20px; max-width: 100%; margin: 10px; }
            .actions-bar .btn { flex: 1; justify-content: center; font-size: 12px; padding: 8px 12px; }
            .search-filter-bar .search-input { min-width: 100%; }
            .table { font-size: 12px; }
            .table th, .table td { padding: 8px 10px; }
        }

        @media (max-width: 480px) {
            .balances-grid { grid-template-columns: 1fr; }
            .balance-card .amount { font-size: 20px; }
        }

        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
            background: #c1c7cd;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #a0a7ae;
        }
    </style>
</head>
<body>

<!-- ============================================================ -->
<!-- MAIN CONTAINER -->
<!-- ============================================================ -->
<div class="cash-container" id="app">

    <!-- HEADER -->
    <div class="cash-header">
        <h1>
            <i class="fas fa-coins"></i>
            صندوق
        </h1>
        <div class="date-time">
            <i class="far fa-calendar-alt"></i>
            <span id="currentDateTime"></span>
        </div>
    </div>

    <!-- BALANCES -->
    <div class="balances-grid" id="balancesGrid">
        <!-- Loaded dynamically -->
    </div>

    <!-- ACTION BUTTONS -->
    <div class="actions-bar">
        <button class="btn btn-primary" onclick="openModal('receive')">
            <i class="fas fa-arrow-down"></i> دریافت
        </button>
        <button class="btn btn-danger" onclick="openModal('payment')">
            <i class="fas fa-arrow-up"></i> پرداخت
        </button>
        <button class="btn btn-warning" onclick="openModal('ownerDeposit')">
            <i class="fas fa-user-plus"></i> واریز مالک
        </button>
        <button class="btn btn-secondary" onclick="openModal('ownerWithdraw')">
            <i class="fas fa-user-minus"></i> برداشت مالک
        </button>
        <button class="btn btn-info" onclick="openModal('closeFund')">
            <i class="fas fa-lock"></i> بستن صندوق
        </button>
        <button class="btn btn-outline" onclick="refreshData()">
            <i class="fas fa-sync"></i> بروزرسانی
        </button>
    </div>

    <!-- SEARCH & FILTER -->
    <div class="search-filter-bar">
        <input type="text" class="search-input" id="searchInput" placeholder="جستجو بر اساس شماره سند یا شرح..." oninput="filterTable()">
        <input type="date" id="filterDateFrom" onchange="filterTable()" style="padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;font-family:'Vazirmatn',sans-serif;">
        <span style="display:flex;align-items:center;color:#6b7280;">تا</span>
        <input type="date" id="filterDateTo" onchange="filterTable()" style="padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;font-family:'Vazirmatn',sans-serif;">
        <select id="filterCurrency" onchange="filterTable()">
            <option value="">همه ارزها</option>
            <option value="AFN">افغانی</option>
            <option value="USD">دالر</option>
            <option value="IRR">تومان</option>
            <option value="EUR">یورو</option>
            <option value="CAD">کلدار</option>
        </select>
        <select id="filterType" onchange="filterTable()">
            <option value="">همه عملیات</option>
            <option value="receive">دریافت</option>
            <option value="payment">پرداخت</option>
            <option value="ownerDeposit">واریز مالک</option>
            <option value="ownerWithdraw">برداشت مالک</option>
        </select>
    </div>

    <!-- TABLE -->
    <div class="table-responsive">
        <table class="table" id="journalTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>تاریخ</th>
                    <th>شماره سند</th>
                    <th>شرح</th>
                    <th>ارز</th>
                    <th>دریافت</th>
                    <th>پرداخت</th>
                    <th>مانده</th>
                    <th>نوع</th>
                </tr>
            </thead>
            <tbody id="journalBody">
                <!-- Loaded dynamically -->
            </tbody>
        </table>
    </div>

    <div class="text-center mt-20" style="color:#9ca3af;font-size:13px;" id="rowCount">
        نمایش ۰ رکورد
    </div>
</div>

<!-- ============================================================ -->
<!-- MODALS -->
<!-- ============================================================ -->

<!-- RECEIVE / PAYMENT / OWNER MODAL -->
<div class="modal-overlay" id="transactionModal">
    <div class="modal">
        <div class="modal-header">
            <h2 id="modalTitle">ثبت دریافت</h2>
            <button class="modal-close" onclick="closeModal('transactionModal')">&times;</button>
        </div>
        <form id="transactionForm" onsubmit="submitTransaction(event)">
            <input type="hidden" id="txType" value="receive">

            <div class="form-group">
                <label>نوع ارز <span class="required">*</span></label>
                <select class="form-control" id="txCurrency" required>
                    <option value="AFN">افغانی</option>
                    <option value="USD">دالر</option>
                    <option value="IRR">تومان</option>
                    <option value="EUR">یورو</option>
                    <option value="CAD">کلدار</option>
                </select>
            </div>

            <div class="form-group">
                <label>مبلغ <span class="required">*</span></label>
                <input type="number" class="form-control" id="txAmount" placeholder="مبلغ را وارد کنید" step="0.01" min="0.01" required>
            </div>

            <div class="form-group">
                <label>تاریخ <span class="required">*</span></label>
                <input type="date" class="form-control" id="txDate" required>
            </div>

            <div class="form-group">
                <label>شماره سند <span class="required">*</span></label>
                <input type="text" class="form-control" id="txDocNumber" placeholder="شماره سند" required>
            </div>

            <div class="form-group">
                <label>شرح / دلیل <span class="required">*</span></label>
                <input type="text" class="form-control" id="txDescription" placeholder="شرح عملیات" required>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">ثبت</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('transactionModal')">انصراف</button>
            </div>
        </form>
    </div>
</div>

<!-- CLOSE FUND MODAL -->
<div class="modal-overlay" id="closeFundModal">
    <div class="modal" style="max-width:700px;">
        <div class="modal-header">
            <h2><i class="fas fa-lock"></i> بستن صندوق و شمارش واقعی</h2>
            <button class="modal-close" onclick="closeModal('closeFundModal')">&times;</button>
        </div>
        <div id="closeFundContent">
            <!-- Loaded dynamically -->
        </div>
        <div class="form-actions">
            <button class="btn btn-primary" onclick="submitCloseFund()">تأیید و بستن</button>
            <button class="btn btn-secondary" onclick="closeModal('closeFundModal')">انصراف</button>
        </div>
    </div>
</div>

<!-- ============================================================ -->
<!-- TOAST CONTAINER -->
<!-- ============================================================ -->
<div class="toast-container" id="toastContainer"></div>

<!-- ============================================================ -->
<!-- JAVASCRIPT -->
<!-- ============================================================ -->
<script>
    // ================================================================
    // DATA STORE (simulating database)
    // ================================================================
    const DATA = {
        balances: {
            AFN: 0,
            USD: 0,
            IRR: 0,
            EUR: 0,
            CAD: 0
        },
        transactions: [],
        nextId: 1
    };

    // Currency symbols
    const CURRENCY_SYMBOLS = {
        AFN: '؋',
        USD: '$',
        IRR: '﷼',
        EUR: '€',
        CAD: 'C$'
    };

    const CURRENCY_NAMES = {
        AFN: 'افغانی',
        USD: 'دالر',
        IRR: 'تومان',
        EUR: 'یورو',
        CAD: 'کلدار'
    };

    // ================================================================
    // INIT - Load sample data
    // ================================================================
    function init() {
        // Set current date/time
        updateDateTime();

        // Load saved data from localStorage
        loadFromStorage();

        // If no data, create sample transactions
        if (DATA.transactions.length === 0) {
            createSampleData();
        }

        renderAll();
    }

    function createSampleData() {
        const today = new Date().toISOString().split('T')[0];
        const sampleTx = [
            { type: 'receive', currency: 'AFN', amount: 50000, date: today, docNumber: 'R-2026001', description: 'دریافت از مشتری احمدی' },
            { type: 'receive', currency: 'USD', amount: 1200, date: today, docNumber: 'R-2026002', description: 'دریافت از حواله خارجی' },
            { type: 'payment', currency: 'AFN', amount: 15000, date: today, docNumber: 'P-2026001', description: 'پرداخت هزینه اجاره' },
            { type: 'ownerDeposit', currency: 'USD', amount: 5000, date: today, docNumber: 'OD-2026001', description: 'واریز سرمایه اولیه' },
            { type: 'receive', currency: 'EUR', amount: 800, date: today, docNumber: 'R-2026003', description: 'دریافت از مشتری کریمی' },
            { type: 'payment', currency: 'IRR', amount: 2000000, date: today, docNumber: 'P-2026002', description: 'پرداخت به تأمین‌کننده' },
            { type: 'ownerWithdraw', currency: 'AFN', amount: 10000, date: today, docNumber: 'OW-2026001', description: 'برداشت شخصی مالک' },
        ];

        sampleTx.forEach(tx => {
            addTransaction(tx.type, tx.currency, tx.amount, tx.date, tx.docNumber, tx.description, false);
        });

        saveToStorage();
    }

    // ================================================================
    // STORAGE
    // ================================================================
    function saveToStorage() {
        try {
            localStorage.setItem('cashFundData', JSON.stringify(DATA));
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            const saved = localStorage.getItem('cashFundData');
            if (saved) {
                const parsed = JSON.parse(saved);
                DATA.balances = parsed.balances || DATA.balances;
                DATA.transactions = parsed.transactions || [];
                DATA.nextId = parsed.nextId || 1;
            }
        } catch (e) {}
    }

    // ================================================================
    // DATE / TIME
    // ================================================================
    function updateDateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        document.getElementById('currentDateTime').textContent = now.toLocaleDateString('fa-IR', options);
    }

    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function generateDocNumber(prefix) {
        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const seq = String(DATA.nextId).padStart(4, '0');
        DATA.nextId++;
        return `${prefix}-${dateStr}-${seq}`;
    }

    // ================================================================
    // TRANSACTION CORE
    // ================================================================
    function addTransaction(type, currency, amount, date, docNumber, description, save = true) {
        const tx = {
            id: DATA.transactions.length + 1,
            type: type,
            currency: currency,
            amount: parseFloat(amount),
            date: date,
            docNumber: docNumber,
            description: description,
            timestamp: new Date().toISOString()
        };

        // Update balance
        if (type === 'receive' || type === 'ownerDeposit') {
            DATA.balances[currency] = (DATA.balances[currency] || 0) + parseFloat(amount);
        } else if (type === 'payment' || type === 'ownerWithdraw') {
            DATA.balances[currency] = (DATA.balances[currency] || 0) - parseFloat(amount);
        }

        DATA.transactions.push(tx);

        if (save) {
            saveToStorage();
        }

        return tx;
    }

    // ================================================================
    // RENDER FUNCTIONS
    // ================================================================
    function renderBalances() {
        const grid = document.getElementById('balancesGrid');
        const currencies = ['AFN', 'USD', 'IRR', 'EUR', 'CAD'];
        const icons = {
            AFN: '🇦🇫',
            USD: '🇺🇸',
            IRR: '🇮🇷',
            EUR: '🇪🇺',
            CAD: '🇨🇦'
        };

        grid.innerHTML = currencies.map(curr => {
            const balance = DATA.balances[curr] || 0;
            const isPositive = balance >= 0;
            return `
                <div class="balance-card">
                    <span class="currency-icon">${icons[curr]}</span>
                    <div class="currency">${CURRENCY_NAMES[curr]} (${curr})</div>
                    <div class="amount ${isPositive ? 'positive' : 'negative'}">
                        ${CURRENCY_SYMBOLS[curr]} ${formatNumber(balance)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderJournal(filtered = null) {
        const tbody = document.getElementById('journalBody');
        const transactions = filtered || DATA.transactions;

        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>هیچ عملیاتی ثبت نشده است</p>
                        </div>
                    </td>
                </tr>
            `;
            document.getElementById('rowCount').textContent = 'نمایش ۰ رکورد';
            return;
        }

        // Sort by date descending (newest first)
        const sorted = [...transactions].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.id - a.id;
        });

        // Calculate running balance for each currency
        const runningBalance = {};
        const rows = [];

        sorted.forEach((tx, index) => {
            const curr = tx.currency;
            if (runningBalance[curr] === undefined) {
                // Calculate initial balance from all transactions before this one
                runningBalance[curr] = DATA.balances[curr] || 0;
                // Recalculate by going through all transactions in order
                let bal = 0;
                const allTx = DATA.transactions.filter(t => t.currency === curr);
                const idx = allTx.findIndex(t => t.id === tx.id);
                if (idx !== -1) {
                    for (let i = 0; i <= idx; i++) {
                        const t = allTx[i];
                        if (t.type === 'receive' || t.type === 'ownerDeposit') bal += t.amount;
                        else if (t.type === 'payment' || t.type === 'ownerWithdraw') bal -= t.amount;
                    }
                }
                runningBalance[curr] = bal;
            }

            let receive = '';
            let payment = '';
            let balance = runningBalance[curr];

            if (tx.type === 'receive' || tx.type === 'ownerDeposit') {
                receive = formatNumber(tx.amount);
            } else {
                payment = formatNumber(tx.amount);
            }

            const typeLabels = {
                receive: 'دریافت',
                payment: 'پرداخت',
                ownerDeposit: 'واریز مالک',
                ownerWithdraw: 'برداشت مالک'
            };

            const typeClass = {
                receive: 'receive',
                payment: 'payment',
                ownerDeposit: 'deposit',
                ownerWithdraw: 'withdraw'
            };

            rows.push(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(tx.date)}</td>
                    <td><strong>${tx.docNumber}</strong></td>
                    <td>${tx.description}</td>
                    <td>${CURRENCY_SYMBOLS[curr]} ${curr}</td>
                    <td class="${receive ? 'text-success fw-bold' : ''}">${receive || '-'}</td>
                    <td class="${payment ? 'text-danger fw-bold' : ''}">${payment || '-'}</td>
                    <td class="fw-bold">${CURRENCY_SYMBOLS[curr]} ${formatNumber(balance)}</td>
                    <td><span class="type-badge ${typeClass[tx.type]}">${typeLabels[tx.type]}</span></td>
