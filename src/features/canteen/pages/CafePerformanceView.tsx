import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Search, Calendar, RefreshCw, Printer, 
  ShoppingBag, Users, DollarSign, ArrowUpRight, CheckCircle2,
  Clock, Filter, ChevronRight, X, Utensils, Receipt, FileText,
  PieChart, Award, Eye, Download, Layers, ShieldCheck
} from 'lucide-react';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate, toYMDDate } from '../utils/dateUtils';

interface CafePerformanceViewProps {
  members: any[];
  catalog: any[];
}

export const CafePerformanceView: React.FC<CafePerformanceViewProps> = ({ members, catalog }) => {
  // Date filtering state
  const todayYMD = useMemo(() => toYMDDate(new Date()), []);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState<string>(todayYMD);
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'buyers'>('items');

  // Search & Filter state
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('ALL');
  const [itemSortBy, setItemSortBy] = useState<'qty' | 'amount' | 'name'>('qty');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerPaymentFilter, setBuyerPaymentFilter] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [buyerGroupMode, setBuyerGroupMode] = useState<'individual' | 'grouped'>('individual');

  // Modal states
  const [selectedItemForBuyers, setSelectedItemForBuyers] = useState<any | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<any | null>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  // Raw transactions state
  const [allTxs, setAllTxs] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    } catch {
      return [];
    }
  });

  const loadTransactions = () => {
    try {
      const data = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      setAllTxs(Array.isArray(data) ? data : []);
    } catch {
      setAllTxs([]);
    }
  };

  useEffect(() => {
    loadTransactions();
    const handleTxUpdate = () => loadTransactions();
    window.addEventListener('canteen_txs_updated', handleTxUpdate);
    window.addEventListener('canteen_state_updated', handleTxUpdate);
    window.addEventListener('storage', handleTxUpdate);
    return () => {
      window.removeEventListener('canteen_txs_updated', handleTxUpdate);
      window.removeEventListener('canteen_state_updated', handleTxUpdate);
      window.removeEventListener('storage', handleTxUpdate);
    };
  }, []);

  // Filter raw transactions to only real SALE transactions
  const rawSales = useMemo(() => {
    return allTxs.filter((tx: any) => {
      if (!tx) return false;
      const type = String(tx.type || '').toUpperCase();
      if (type === 'INITIAL_BILL' || type === 'BILL PAYMENT' || type === 'ADVANCE_RETURN') {
        return false;
      }
      if (type === 'SALE' || tx.isPreOrder) {
        return true;
      }
      // If has items or soldItems and amount > 0
      return Boolean(tx.items || (tx.soldItems && tx.soldItems.length > 0)) && Number(tx.amount || 0) > 0;
    });
  }, [allTxs]);

  // Determine active date range based on dateFilterMode
  const activeDateLabel = useMemo(() => {
    if (dateFilterMode === 'today') return `Today (${formatCanteenDate(new Date())})`;
    if (dateFilterMode === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `Yesterday (${formatCanteenDate(y)})`;
    }
    if (dateFilterMode === 'week') return 'Last 7 Days';
    if (dateFilterMode === 'month') return 'This Month';
    if (dateFilterMode === 'all') return 'All Historical Sales';
    if (dateFilterMode === 'custom') return `Date: ${formatCanteenDate(customDate)}`;
    return 'Selected Date';
  }, [dateFilterMode, customDate]);

  // Filter sales by date
  const filteredSales = useMemo(() => {
    const today = new Date();
    const ymdToday = toYMDDate(today);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymdYesterday = toYMDDate(yesterday);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const ymdSevenDaysAgo = toYMDDate(sevenDaysAgo);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const ymdStartOfMonth = toYMDDate(startOfMonth);

    return rawSales.filter((tx: any) => {
      const txYMD = toYMDDate(tx.date || tx.created_at || tx.timestamp || (typeof tx.id === 'number' ? tx.id : undefined));
      if (!txYMD) return false;

      if (dateFilterMode === 'today') return txYMD === ymdToday;
      if (dateFilterMode === 'yesterday') return txYMD === ymdYesterday;
      if (dateFilterMode === 'week') return txYMD >= ymdSevenDaysAgo && txYMD <= ymdToday;
      if (dateFilterMode === 'month') return txYMD >= ymdStartOfMonth && txYMD <= ymdToday;
      if (dateFilterMode === 'custom') return txYMD === customDate;
      if (dateFilterMode === 'all') return true;
      return true;
    });
  }, [rawSales, dateFilterMode, customDate]);

  // Helper to clean member full display name
  const getMemberDisplayName = (tx: any) => {
    const m = members.find((mem: any) => mem.airman_id === tx.airman_id || String(mem['BD No']) === String(tx.bdNo));
    const rank = (tx.rank || (m ? m['Rank'] : '') || '').trim();
    let name = (tx.memberName || (m ? m['Surname'] || m.name : '') || tx.airman_id || 'Unknown Member').trim();
    if (rank && name.startsWith(rank)) {
      name = name.slice(rank.length).trim();
    }
    return {
      fullName: rank ? `${rank} ${name}` : name,
      rank: rank || 'Airman',
      surname: name,
      bdNo: tx.bdNo || (m ? m['BD No'] : '') || '—',
      airman_id: tx.airman_id || (m ? m.airman_id : '')
    };
  };

  // Resolve sold item details from each sale transaction
  interface ParsedSaleRow {
    txId: string;
    saleDate: string;
    saleTime: string;
    member: {
      fullName: string;
      rank: string;
      surname: string;
      bdNo: string;
      airman_id: string;
    };
    itemName: string;
    category: string;
    qty: number;
    unitPrice: number;
    totalAmount: number;
    isPaid: boolean;
    paymentMode: 'CASH' | 'DUE';
    originalTx: any;
  }

  const parsedSalesRows: ParsedSaleRow[] = useMemo(() => {
    const rows: ParsedSaleRow[] = [];

    filteredSales.forEach((tx: any) => {
      const memberInfo = getMemberDisplayName(tx);
      const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';
      const paymentMode: 'CASH' | 'DUE' = isPaid ? 'CASH' : 'DUE';
      const saleDate = formatCanteenDate(tx.date || tx.created_at || tx.timestamp);
      
      let saleTime = '—';
      if (typeof tx.id === 'number' && tx.id > 1000000000000) {
        saleTime = new Date(tx.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (tx.timestamp || tx.created_at) {
        try {
          saleTime = new Date(tx.timestamp || tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {}
      }

      // Check if structured soldItems array exists
      if (tx.soldItems && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
        tx.soldItems.forEach((si: any) => {
          const catItem = catalog.find((c: any) => c.id === si.menuItemId || c.name?.toLowerCase() === si.menuItemName?.toLowerCase());
          const name = si.menuItemName || si.name || (catItem ? catItem.name : 'Unknown Item');
          const qty = Number(si.qty || 1);
          const unitPrice = Number(si.price ?? catItem?.price ?? 0);
          const totalAmount = unitPrice * qty;

          rows.push({
            txId: String(tx.id),
            saleDate,
            saleTime,
            member: memberInfo,
            itemName: name,
            category: catItem?.category || 'SNACKS',
            qty,
            unitPrice,
            totalAmount: totalAmount > 0 ? totalAmount : Number(tx.amount || 0),
            isPaid,
            paymentMode,
            originalTx: tx
          });
        });
      } else if (tx.items) {
        // Parse string items: e.g. "চিকেন বিরিয়ানি (2), কোল্ড কফি (1)" or "Chicken Patties (1)"
        const parts = String(tx.items).split(/[,+;|\n]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          parts.forEach((part: string) => {
            let q = 1;
            let rawName = part;
            const parenMatch = part.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
            if (parenMatch) {
              rawName = parenMatch[1].trim();
              q = parseInt(parenMatch[2], 10) || 1;
            } else {
              const xMatch = part.match(/^(.+?)\s*[xX]\s*(\d+)$/);
              if (xMatch) {
                rawName = xMatch[1].trim();
                q = parseInt(xMatch[2], 10) || 1;
              }
            }

            const catItem = catalog.find((c: any) => c.name?.toLowerCase() === rawName.toLowerCase());
            let unitPrice = Number(catItem?.price || 0);
            let totalAmount = unitPrice * q;
            if (totalAmount === 0 && tx.amount) {
              totalAmount = Math.round(Number(tx.amount) / Math.max(1, parts.length));
              unitPrice = Math.round(totalAmount / q);
            }

            rows.push({
              txId: String(tx.id),
              saleDate,
              saleTime,
              member: memberInfo,
              itemName: catItem?.name || rawName,
              category: catItem?.category || 'SNACKS',
              qty: q,
              unitPrice,
              totalAmount,
              isPaid,
              paymentMode,
              originalTx: tx
            });
          });
        }
      } else {
        // Fallback single line sale
        const amt = Number(tx.amount || 0);
        rows.push({
          txId: String(tx.id),
          saleDate,
          saleTime,
          member: memberInfo,
          itemName: 'ক্যাফে মেনু আইটেম',
          category: 'MEALS',
          qty: 1,
          unitPrice: amt,
          totalAmount: amt,
          isPaid,
          paymentMode,
          originalTx: tx
        });
      }
    });

    return rows;
  }, [filteredSales, catalog, members]);

  // Aggregate KPI Metrics
  const kpiMetrics = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let dueRevenue = 0;
    let totalUnits = 0;
    const distinctMembers = new Set<string>();

    filteredSales.forEach((tx: any) => {
      const amt = Number(tx.amount || 0);
      totalRevenue += amt;
      const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';
      if (isPaid) cashRevenue += amt;
      else dueRevenue += amt;

      const memberId = tx.airman_id || tx.bdNo || tx.memberName;
      if (memberId) distinctMembers.add(String(memberId));
    });

    parsedSalesRows.forEach(row => {
      totalUnits += row.qty;
    });

    return {
      totalRevenue,
      cashRevenue,
      dueRevenue,
      totalUnits,
      totalOrders: filteredSales.length,
      uniqueCustomers: distinctMembers.size
    };
  }, [filteredSales, parsedSalesRows]);

  // Group by item for: "daily kon Item koto Item Sell holo"
  interface ItemPerformance {
    name: string;
    category: string;
    unitPrice: number;
    totalQty: number;
    totalRevenue: number;
    image?: string;
    buyers: {
      member: ParsedSaleRow['member'];
      qty: number;
      amount: number;
      date: string;
      time: string;
      paymentMode: 'CASH' | 'DUE';
      txId: string;
    }[];
  }

  const itemPerformanceList: ItemPerformance[] = useMemo(() => {
    const map = new Map<string, ItemPerformance>();

    parsedSalesRows.forEach(row => {
      const key = row.itemName.trim().toLowerCase();
      const existing = map.get(key);

      const catItem = catalog.find(c => c.name?.toLowerCase() === key);
      const img = catItem?.DP || catItem?.img || catItem?.image || catItem?.photo;

      if (!existing) {
        map.set(key, {
          name: row.itemName,
          category: row.category || catItem?.category || 'SNACKS',
          unitPrice: row.unitPrice || catItem?.price || 0,
          totalQty: row.qty,
          totalRevenue: row.totalAmount,
          image: img,
          buyers: [{
            member: row.member,
            qty: row.qty,
            amount: row.totalAmount,
            date: row.saleDate,
            time: row.saleTime,
            paymentMode: row.paymentMode,
            txId: row.txId
          }]
        });
      } else {
        existing.totalQty += row.qty;
        existing.totalRevenue += row.totalAmount;
        if (!existing.image && img) existing.image = img;
        if (existing.unitPrice === 0 && row.unitPrice > 0) existing.unitPrice = row.unitPrice;
        existing.buyers.push({
          member: row.member,
          qty: row.qty,
          amount: row.totalAmount,
          date: row.saleDate,
          time: row.saleTime,
          paymentMode: row.paymentMode,
          txId: row.txId
        });
      }
    });

    const list = Array.from(map.values());

    // Sort items
    list.sort((a, b) => {
      if (itemSortBy === 'qty') return b.totalQty - a.totalQty;
      if (itemSortBy === 'amount') return b.totalRevenue - a.totalRevenue;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [parsedSalesRows, catalog, itemSortBy]);

  // Categories list for item filter
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    itemPerformanceList.forEach(i => set.add(i.category.toUpperCase()));
    return ['ALL', ...Array.from(set)];
  }, [itemPerformanceList]);

  // Filtered item list
  const filteredItemList = useMemo(() => {
    return itemPerformanceList.filter(item => {
      const matchSearch = !itemSearch.trim() || item.name.toLowerCase().includes(itemSearch.toLowerCase());
      const matchCat = itemCategoryFilter === 'ALL' || item.category.toUpperCase() === itemCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [itemPerformanceList, itemSearch, itemCategoryFilter]);

  // Max sold quantity for visual progress bar
  const maxSoldQty = useMemo(() => {
    return Math.max(1, ...itemPerformanceList.map(i => i.totalQty));
  }, [itemPerformanceList]);

  // Group by customer for: "kar kar kase sell deya holo aisob"
  interface CustomerSummary {
    member: ParsedSaleRow['member'];
    totalOrdersCount: number;
    totalItemsCount: number;
    totalSpent: number;
    cashSpent: number;
    dueSpent: number;
    orders: {
      txId: string;
      date: string;
      time: string;
      itemsList: string;
      amount: number;
      paymentMode: 'CASH' | 'DUE';
      tx: any;
    }[];
  }

  const customerPerformanceList: CustomerSummary[] = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    filteredSales.forEach((tx: any) => {
      const memberInfo = getMemberDisplayName(tx);
      const key = memberInfo.airman_id || memberInfo.bdNo || memberInfo.fullName;
      const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';
      const paymentMode: 'CASH' | 'DUE' = isPaid ? 'CASH' : 'DUE';
      const amt = Number(tx.amount || 0);
      const saleDate = formatCanteenDate(tx.date || tx.created_at || tx.timestamp);

      let saleTime = '—';
      if (typeof tx.id === 'number' && tx.id > 1000000000000) {
        saleTime = new Date(tx.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // Count items in tx
      let itemsCount = 1;
      let itemsSummary = tx.items || '—';
      if (tx.soldItems && Array.isArray(tx.soldItems)) {
        itemsCount = tx.soldItems.reduce((s: number, i: any) => s + Number(i.qty || 1), 0);
        itemsSummary = tx.soldItems.map((i: any) => `${i.menuItemName || i.name} (${i.qty || 1})`).join(', ');
      } else if (tx.items) {
        const matches = tx.items.match(/\((\d+)\)/g);
        if (matches) {
          itemsCount = matches.reduce((s: number, m: string) => {
            const num = parseInt(m.replace(/\D/g, ''), 10) || 1;
            return s + num;
          }, 0);
        }
      }

      const orderObj = {
        txId: String(tx.id),
        date: saleDate,
        time: saleTime,
        itemsList: itemsSummary,
        amount: amt,
        paymentMode,
        tx
      };

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          member: memberInfo,
          totalOrdersCount: 1,
          totalItemsCount: itemsCount,
          totalSpent: amt,
          cashSpent: isPaid ? amt : 0,
          dueSpent: !isPaid ? amt : 0,
          orders: [orderObj]
        });
      } else {
        existing.totalOrdersCount += 1;
        existing.totalItemsCount += itemsCount;
        existing.totalSpent += amt;
        if (isPaid) existing.cashSpent += amt;
        else existing.dueSpent += amt;
        existing.orders.push(orderObj);
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.totalSpent - a.totalSpent);
    return list;
  }, [filteredSales, members]);

  // Filtered customer list
  const filteredCustomerList = useMemo(() => {
    return customerPerformanceList.filter(cust => {
      const q = buyerSearch.toLowerCase().trim();
      const matchSearch = !q || 
        cust.member.fullName.toLowerCase().includes(q) ||
        cust.member.bdNo.toLowerCase().includes(q) ||
        cust.member.rank.toLowerCase().includes(q);

      const matchPay = buyerPaymentFilter === 'ALL' ||
        (buyerPaymentFilter === 'PAID' && cust.cashSpent > 0) ||
        (buyerPaymentFilter === 'DUE' && cust.dueSpent > 0);

      return matchSearch && matchPay;
    });
  }, [customerPerformanceList, buyerSearch, buyerPaymentFilter]);

  // Individual order rows for flat buyer view
  const individualOrderRows = useMemo(() => {
    const rows = filteredSales.map((tx: any) => {
      const memberInfo = getMemberDisplayName(tx);
      const isPaid = tx.status === 'PAID' || tx.paymentStatus === 'PAID' || String(tx.gateway || tx.paymentMethod || '').toUpperCase() === 'CASH';
      const paymentMode: 'CASH' | 'DUE' = isPaid ? 'CASH' : 'DUE';
      const saleDate = formatCanteenDate(tx.date || tx.created_at || tx.timestamp);

      let saleTime = '—';
      if (typeof tx.id === 'number' && tx.id > 1000000000000) {
        saleTime = new Date(tx.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      let itemsSummary = tx.items || '—';
      let totalQty = 1;
      if (tx.soldItems && Array.isArray(tx.soldItems)) {
        totalQty = tx.soldItems.reduce((s: number, i: any) => s + Number(i.qty || 1), 0);
        itemsSummary = tx.soldItems.map((i: any) => `${i.menuItemName || i.name} (${i.qty || 1})`).join(', ');
      }

      return {
        txId: String(tx.id),
        date: saleDate,
        time: saleTime,
        member: memberInfo,
        itemsList: itemsSummary,
        totalQty,
        amount: Number(tx.amount || 0),
        paymentMode,
        rawTx: tx
      };
    });

    return rows.filter(row => {
      const q = buyerSearch.toLowerCase().trim();
      const matchSearch = !q ||
        row.member.fullName.toLowerCase().includes(q) ||
        row.member.bdNo.toLowerCase().includes(q) ||
        row.member.rank.toLowerCase().includes(q) ||
        row.itemsList.toLowerCase().includes(q);

      const matchPay = buyerPaymentFilter === 'ALL' || row.paymentMode === buyerPaymentFilter;
      return matchSearch && matchPay;
    });
  }, [filteredSales, buyerSearch, buyerPaymentFilter, members]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* 1. TOP HEADER & DATE CONTROLS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide uppercase">
                  CAFE PERFORMANCE & DAILY SALES
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                দৈনিক বিক্রয় বিশ্লেষণ: কোন আইটেম কতটি বিক্রি হলো এবং কার কার কাছে সেল দেওয়া হলো
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              type="button"
              onClick={loadTransactions}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer shadow-sm"
              title="Refresh Sales Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowPrintReportModal(true)}
              className="px-3.5 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
            <button
              type="button"
              onClick={() => setDateFilterMode('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === 'today'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              আজ (Today)
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('yesterday')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === 'yesterday'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              গতকাল (Yesterday)
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === 'week'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              গত ৭ দিন (7 Days)
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === 'month'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              চলতি মাস (This Month)
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              সব রেকর্ড (All Time)
            </button>
          </div>

          {/* Custom Date Input */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">Specific Date:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilterMode('custom');
              }}
              className="bg-transparent text-xs font-mono font-bold text-white outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Current Active Period Banner */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-300 font-bold">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Viewing Period: <span className="text-emerald-400 font-mono font-black">{activeDateLabel}</span></span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 font-semibold">
            {filteredSales.length} Transactions Found
          </span>
        </div>
      </div>

      {/* 2. TOP KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Sales Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TOTAL SALES REVENUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            ৳{kpiMetrics.totalRevenue.toLocaleString()}
          </h4>
          <div className="flex items-center space-x-2 mt-2 text-[10px] font-mono">
            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              Cash: ৳{kpiMetrics.cashRevenue.toLocaleString()}
            </span>
            <span className="text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
              Due: ৳{kpiMetrics.dueRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Metric 2: Total Items Sold */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TOTAL ITEMS SOLD
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {kpiMetrics.totalUnits.toLocaleString()} <span className="text-xs text-slate-400 font-sans font-bold">pcs</span>
          </h4>
          <p className="text-[11px] text-indigo-300 font-semibold mt-2">
            Across {itemPerformanceList.length} menu items
          </p>
        </div>

        {/* Metric 3: Total Orders / Invoices */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TOTAL ORDERS
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {kpiMetrics.totalOrders.toLocaleString()} <span className="text-xs text-slate-400 font-sans font-bold">orders</span>
          </h4>
          <p className="text-[11px] text-purple-300 font-semibold mt-2">
            Avg Order: ৳{kpiMetrics.totalOrders > 0 ? Math.round(kpiMetrics.totalRevenue / kpiMetrics.totalOrders) : 0}
          </p>
        </div>

        {/* Metric 4: Unique Customers */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              CUSTOMERS SERVED
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {kpiMetrics.uniqueCustomers.toLocaleString()} <span className="text-xs text-slate-400 font-sans font-bold">members</span>
          </h4>
          <p className="text-[11px] text-amber-300 font-semibold mt-2">
            Officers & Airmen customers
          </p>
        </div>
      </div>

      {/* 3. MAIN SECTION NAVIGATION TABS */}
      <div className="flex justify-center items-center">
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('items')}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeSubTab === 'items'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>১. কোন আইটেম কতটি বিক্রি হলো (ITEM SALES)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-950/60">
              {itemPerformanceList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('buyers')}
            className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeSubTab === 'buyers'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>২. কার কার কাছে সেল দেওয়া হলো (BUYER LOG)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-950/60">
              {customerPerformanceList.length}
            </span>
          </button>
        </div>
      </div>

      {/* 4. SUB-TAB 1: ITEM-WISE PERFORMANCE */}
      {activeSubTab === 'items' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Utensils className="w-4 h-4 text-emerald-400" />
                <span>দৈনিক আইটেম অনুযায়ী বিক্রয় হিসাব (DAILY ITEM-WISE SALES)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                কোন আইটেম কত পিস বিক্রি হয়েছে এবং মোট বিক্রয়মূল্য কত (ক্লিক করে ক্রেতাদের নাম দেখুন)
              </p>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Sort by:</span>
              <select
                value={itemSortBy}
                onChange={(e) => setItemSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-xs font-bold text-white px-3 py-1.5 rounded-xl outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="qty">সর্বোচ্চ সংখ্যা (Quantity)</option>
                <option value="amount">সর্বোচ্চ টাকা (Revenue)</option>
                <option value="name">আইটেমের নাম (Name)</option>
              </select>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search items by name..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500 shadow-inner"
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setItemCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                    itemCategoryFilter === cat
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid & Performance Cards */}
          {filteredItemList.length === 0 ? (
            <div className="py-14 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <Utensils className="w-12 h-12 text-slate-600 mx-auto" />
              <h5 className="text-sm font-black text-slate-300">কোনো বিক্রয় রেকর্ড পাওয়া যায়নি</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                নির্বাচিত সময়সীমার মধ্যে কোনো আইটেম বিক্রির রেকর্ড নেই। অন্য তারিখ নির্বাচন করুন।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItemList.map((item, idx) => {
                const percentOfTotalRevenue = kpiMetrics.totalRevenue > 0
                  ? Math.round((item.totalRevenue / kpiMetrics.totalRevenue) * 100)
                  : 0;
                const relativeQtyPercent = Math.round((item.totalQty / maxSoldQty) * 100);
                const itemDp = resolveImageUrl(item.image);

                return (
                  <div
                    key={item.name}
                    className="bg-slate-950/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4.5 shadow-md transition-all hover:shadow-xl space-y-3.5 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: DP + Info */}
                      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          {itemDp ? (
                            <img
                              src={itemDp}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <Utensils className="w-6 h-6 text-emerald-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest truncate">
                              {item.category}
                            </span>
                            {idx === 0 && itemSortBy === 'qty' && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase flex items-center space-x-1">
                                <Award className="w-2.5 h-2.5" />
                                <span>Top Seller</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight mt-1 truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <p className="text-xs font-mono font-bold text-slate-400">
                            Unit Price: <span className="text-emerald-400">৳{item.unitPrice}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Quantity & Total Sold */}
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">বিক্রি হয়েছে</div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                          {item.totalQty} <span className="text-xs text-slate-300 font-sans font-bold">pcs</span>
                        </div>
                        <div className="text-xs font-black font-mono text-white mt-0.5">
                          মোট: ৳{item.totalRevenue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar for Quantity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                        <span>Sales Share: {percentOfTotalRevenue}%</span>
                        <span>{item.buyers.length} Buyers</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(8, relativeQtyPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* View Buyers Button */}
                    <div className="pt-1 flex items-center justify-between border-t border-slate-900">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Served {item.buyers.length} times
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedItemForBuyers(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>ক্রেতাদের তালিকা ({item.buyers.length})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. SUB-TAB 2: BUYER LOG (কার কার কাছে সেল দেয়া হলো) */}
      {activeSubTab === 'buyers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>কার কার কাছে সেল দেয়া হলো (CUSTOMER / BUYER SALES LOG)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                কোন মেম্বার কখন কী কী আইটেম কত টাকায় ক্রয় করলেন তার বিস্তারিত লগ
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBuyerGroupMode('individual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  buyerGroupMode === 'individual'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                আলাদা অর্ডার ({individualOrderRows.length})
              </button>
              <button
                type="button"
                onClick={() => setBuyerGroupMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  buyerGroupMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                সদস্য অনুযায়ী মোট ({customerPerformanceList.length})
              </button>
            </div>
          </div>

          {/* Search & Payment Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Member Name, Rank, or BD Number..."
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 shadow-inner"
              />
              {buyerSearch && (
                <button
                  type="button"
                  onClick={() => setBuyerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Payment Filter Pills */}
            <div className="flex items-center space-x-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBuyerPaymentFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  buyerPaymentFilter === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                সব পেমেন্ট (ALL)
              </button>
              <button
                type="button"
                onClick={() => setBuyerPaymentFilter('PAID')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  buyerPaymentFilter === 'PAID'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                নগদ (CASH)
              </button>
              <button
                type="button"
                onClick={() => setBuyerPaymentFilter('DUE')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  buyerPaymentFilter === 'DUE'
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                বাকী (DUE)
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: INDIVIDUAL ORDERS TABLE */}
          {buyerGroupMode === 'individual' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
              {individualOrderRows.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">কোনো বিক্রয় রেকর্ড মেলেনি</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3 px-4">সময় ও তারিখ</th>
                      <th className="py-3 px-4">ক্রেতা (Member)</th>
                      <th className="py-3 px-4">BD নম্বর</th>
                      <th className="py-3 px-4">ক্রয়কৃত আইটেম (Items)</th>
                      <th className="py-3 px-4 text-center">মোট পরিমাণ</th>
                      <th className="py-3 px-4 text-right">টাকা (Amount)</th>
                      <th className="py-3 px-4 text-center">পদ্ধতি</th>
                      <th className="py-3 px-4 text-right">রসিদ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {individualOrderRows.map((row) => (
                      <tr key={row.txId} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          <div>{row.date}</div>
                          <div className="text-[10px] text-slate-500">{row.time}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-white">{row.member.fullName}</div>
                          <div className="text-[10px] text-slate-400 uppercase">{row.member.rank}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          BD/{row.member.bdNo}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate" title={row.itemsList}>
                          <span className="font-semibold text-slate-200">{row.itemsList}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-indigo-300">
                          {row.totalQty} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          ৳{row.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            row.paymentMode === 'CASH'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                          }`}>
                            {row.paymentMode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTxForReceipt(row.rawTx)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="View receipt"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* VIEW MODE 2: GROUPED BY MEMBER CARDS */}
          {buyerGroupMode === 'grouped' && (
            <div className="space-y-3">
              {filteredCustomerList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">কোনো সদস্যের রেকর্ড মেলেনি</p>
                </div>
              ) : (
                filteredCustomerList.map(cust => (
                  <div
                    key={cust.member.fullName + cust.member.bdNo}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-700 to-purple-600 flex items-center justify-center text-white font-black text-sm uppercase shrink-0 shadow-md">
                        {cust.member.surname ? cust.member.surname.slice(0, 2) : 'BD'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-black text-white truncate">
                            {cust.member.fullName}
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-700">
                            BD/{cust.member.bdNo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          {cust.totalOrdersCount} Orders • {cust.totalItemsCount} Items Purchased
                        </p>
                      </div>
                    </div>

                    {/* Spend Summary */}
                    <div className="flex items-center space-x-4 self-end sm:self-auto text-right">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">মোট ক্রয়</span>
                        <span className="text-lg font-black font-mono text-emerald-400">
                          ৳{cust.totalSpent.toLocaleString()}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[9px] font-mono mt-0.5">
                          {cust.cashSpent > 0 && (
                            <span className="text-emerald-400 font-bold">Cash: ৳{cust.cashSpent}</span>
                          )}
                          {cust.dueSpent > 0 && (
                            <span className="text-amber-400 font-bold">Due: ৳{cust.dueSpent}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (cust.orders.length > 0) {
                            setSelectedTxForReceipt(cust.orders[0].tx);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-xs font-bold text-slate-200 hover:text-white transition-all border border-slate-800 cursor-pointer"
                      >
                        Orders ({cust.orders.length})
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL: ITEM BUYERS BREAKDOWN */}
      {selectedItemForBuyers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">
                    {selectedItemForBuyers.name} - ক্রেতাদের তালিকা
                  </h3>
                  <p className="text-xs text-slate-400">
                    মোট বিক্রি: <span className="text-emerald-400 font-bold font-mono">{selectedItemForBuyers.totalQty} pcs</span> • মোট মূল্য: <span className="text-emerald-400 font-bold font-mono">৳{selectedItemForBuyers.totalRevenue}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForBuyers(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Buyers Table */}
            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 bg-slate-950/80">
                    <th className="py-2.5 px-3">সময়</th>
                    <th className="py-2.5 px-3">ক্রেতা (Member)</th>
                    <th className="py-2.5 px-3">BD নম্বর</th>
                    <th className="py-2.5 px-3 text-center">পরিমাণ</th>
                    <th className="py-2.5 px-3 text-right">টাকা</th>
                    <th className="py-2.5 px-3 text-center">পেমেন্ট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {selectedItemForBuyers.buyers.map((b: any, bIdx: number) => (
                    <tr key={bIdx} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {b.time}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {b.member.fullName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400 text-[11px]">
                        BD/{b.member.bdNo}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-300">
                        {b.qty} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ৳{b.amount}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          b.paymentMode === 'CASH'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                        }`}>
                          {b.paymentMode}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-800 shrink-0 text-right">
              <button
                type="button"
                onClick={() => setSelectedItemForBuyers(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: RECEIPT PREVIEW */}
      {selectedTxForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  বিক্রয় রসিদ (SALE RECEIPT)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxForReceipt(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3 font-mono text-xs">
              <div className="text-center pb-2 border-b border-slate-800">
                <h4 className="font-black text-white text-sm">🍽️ CAFE UAV 🍽️</h4>
                <p className="text-[10px] text-slate-400">Air Force Base Canteen</p>
                <p className="text-[10px] text-slate-500">Tx ID: {String(selectedTxForReceipt.id).slice(-8)}</p>
              </div>

              <div className="flex justify-between text-slate-300 text-[11px]">
                <span>Date:</span>
                <span className="text-white font-bold">{formatCanteenDate(selectedTxForReceipt.date)}</span>
              </div>

              <div className="flex justify-between text-slate-300 text-[11px]">
                <span>Customer:</span>
                <span className="text-white font-bold">{selectedTxForReceipt.rank} {selectedTxForReceipt.memberName}</span>
              </div>

              <div className="flex justify-between text-slate-300 text-[11px]">
                <span>BD No:</span>
                <span className="text-amber-400 font-bold">BD/{selectedTxForReceipt.bdNo}</span>
              </div>

              <div className="py-2 border-t border-b border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block">Items:</span>
                <p className="text-white font-bold">{selectedTxForReceipt.items || 'ক্যাফে আইটেম'}</p>
              </div>

              <div className="flex justify-between text-slate-300 text-sm font-black pt-1">
                <span>Total Amount:</span>
                <span className="text-emerald-400">৳{selectedTxForReceipt.amount}</span>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Status:</span>
                <span className={`font-black ${
                  selectedTxForReceipt.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {selectedTxForReceipt.status || selectedTxForReceipt.paymentStatus || 'PAID'}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTxForReceipt(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: PRINT DAILY SALES REPORT */}
      {showPrintReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <Printer className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    CAFE UAV - DAILY SALES REPORT
                  </h3>
                  <p className="text-xs text-slate-400">Report Date: {activeDateLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintReportModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Paper Body */}
            <div id="cafe-printable-report" className="bg-white text-slate-900 p-6 rounded-2xl overflow-y-auto flex-1 space-y-6 font-sans">
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-2xl font-black tracking-widest uppercase">CAFE UAV</h2>
                <h4 className="text-sm font-bold uppercase text-slate-600">DAILY SALES & PERFORMANCE STATEMENT</h4>
                <p className="text-xs text-slate-500 mt-1 font-mono">Statement Period: {activeDateLabel}</p>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-4 gap-2 text-center p-3 bg-slate-100 rounded-xl font-mono text-xs border border-slate-300">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Sales</span>
                  <span className="text-base font-black text-emerald-700">৳{kpiMetrics.totalRevenue.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Cash Sales</span>
                  <span className="text-base font-black text-blue-700">৳{kpiMetrics.cashRevenue.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Due Sales</span>
                  <span className="text-base font-black text-amber-700">৳{kpiMetrics.dueRevenue.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Items Sold</span>
                  <span className="text-base font-black text-slate-800">{kpiMetrics.totalUnits} pcs</span>
                </div>
              </div>

              {/* Section 1: Item-wise Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  ১. আইটেমভিত্তিক বিক্রয় তালিকা (Item-wise Sales Breakdown):
                </h4>
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                    <tr className="border-b border-slate-300">
                      <th className="py-2 px-3 border-r border-slate-300">ক্রমিক</th>
                      <th className="py-2 px-3 border-r border-slate-300">আইটেমের নাম</th>
                      <th className="py-2 px-3 border-r border-slate-300">ক্যাটাগরি</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-right">একক মূল্য</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center">বিক্রিত সংখ্যা</th>
                      <th className="py-2 px-3 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemPerformanceList.map((item, idx) => (
                      <tr key={item.name} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-bold">{item.name}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 uppercase text-[10px]">{item.category}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono">৳{item.unitPrice}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-bold">{item.totalQty}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-black">৳{item.totalRevenue.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                      <td colSpan={4} className="py-2 px-3 text-right uppercase">সর্বমোট (Grand Total):</td>
                      <td className="py-2 px-3 text-center font-mono font-black">{kpiMetrics.totalUnits}</td>
                      <td className="py-2 px-3 text-right font-mono font-black">৳{kpiMetrics.totalRevenue.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Buyers Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  ২. ক্রেতাদের সংক্ষিপ্ত হিসাব (Customer Summary - Top Buyers):
                </h4>
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                    <tr className="border-b border-slate-300">
                      <th className="py-2 px-3 border-r border-slate-300">ক্রমিক</th>
                      <th className="py-2 px-3 border-r border-slate-300">সদস্যের নাম ও পদবী</th>
                      <th className="py-2 px-3 border-r border-slate-300">BD নম্বর</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center">অর্ডার সংখ্যা</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center">আইটেম সংখ্যা</th>
                      <th className="py-2 px-3 text-right">মোট ক্রয় মূল্য</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customerPerformanceList.slice(0, 20).map((cust, idx) => (
                      <tr key={cust.member.fullName + cust.member.bdNo}>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-bold">{cust.member.fullName}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px]">BD/{cust.member.bdNo}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">{cust.totalOrdersCount}</td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">{cust.totalItemsCount}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-black">৳{cust.totalSpent.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Blocks */}
              <div className="pt-10 flex justify-between text-center text-xs font-bold text-slate-800">
                <div className="border-t border-slate-800 pt-1 w-44">
                  Canteen Manager
                </div>
                <div className="border-t border-slate-800 pt-1 w-44">
                  Officer In-charge / Caterer
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0">
              <span className="text-xs text-slate-400">Ready to print or save</span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPrintReportModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
