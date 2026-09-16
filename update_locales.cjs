const fs = require('fs');

function updateLocale(file, newKeys) {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = { ...data, ...newKeys };
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

updateLocale('src/locales/bn/canteen.json', {
    "record_payment": "পেমেন্ট গ্রহণ",
    "ledger": "খতিয়ান",
    "revenue_trend": "আয়ের প্রবণতা",
    "popular_items": "জনপ্রিয় খাবার",
    "download_invoice": "ইনভয়েস",
    "payment_history": "পেমেন্ট ইতিহাস",
    "employee": "কর্মী",
    "balance": "ব্যালেন্স",
    "credit": "জমা",
    "debit": "খরচ",
    "description": "বিবরণ"
});

updateLocale('src/locales/en/canteen.json', {
    "record_payment": "Record Payment",
    "ledger": "Ledger",
    "revenue_trend": "Revenue Trend",
    "popular_items": "Popular Items",
    "download_invoice": "Invoice",
    "payment_history": "Payment History",
    "employee": "Employee",
    "balance": "Balance",
    "credit": "Credit",
    "debit": "Debit",
    "description": "Description"
});
