// ===============================================================
//  Dashboard.jsx
//  High-density financial overview with interactive data visualization,
//  privacy blur, calendar catalog, and unwinding pie chart modals.
// ===============================================================

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSelectedMonth } from "../context/MonthContext";
import { getAvatarUrl } from "../utils/avatar";
import { formatDateOnly, getToday } from "../utils/dates";
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid 
} from "recharts";
import { 
  Plus, ArrowRight, TrendingUp, AlertCircle, X, 
  RefreshCw, Landmark, Eye, EyeOff, Calendar
} from "lucide-react";
import { DashboardSkeleton } from "../components/LoadingState";

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#06b6d4', '#d946ef'];

const MemoizedBarChart = React.memo(({ data, formatYAxis }) => (
  <ResponsiveContainer width="100%" height="85%">
    <BarChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#737373' }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#737373' }} tickFormatter={formatYAxis} width={50} />
      <RechartsTooltip cursor={{ fill: 'rgba(115, 115, 115, 0.1)' }} contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', backgroundColor: '#171717', color: '#fff' }} />
      <Bar dataKey="income" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
      <Bar dataKey="expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
    </BarChart>
  </ResponsiveContainer>
));

const MemoizedPieChart = React.memo(({ data, isEmpty, onPieClick }) => (
  <ResponsiveContainer width="100%" height="85%">
    <PieChart>
      <Pie 
        data={data} innerRadius={65} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none"
        onClick={!isEmpty ? (entry) => onPieClick(entry.payload) : undefined}
        cursor={!isEmpty ? "pointer" : "default"}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={isEmpty ? '#262626' : (entry.color || COLORS[index % COLORS.length])} className={!isEmpty ? "hover:opacity-80 transition-opacity outline-none" : "outline-none"} />
        ))}
      </Pie>
      {!isEmpty && <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', backgroundColor: '#171717', color: '#fff' }} />}
    </PieChart>
  </ResponsiveContainer>
));

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedMonth: selectedDashboardMonth, setSelectedMonth } = useSelectedMonth();
  
  // Data States
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI Interactive States
  const [activeModal, setActiveModal] = useState(null); 
  const [pieModalData, setPieModalData] = useState(null); 
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false); 
  
  // Quick Action & Sync States
  const [quickAction, setQuickAction] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bankSyncError, setBankSyncError] = useState("");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [quickForm, setQuickForm] = useState({ amount: "", category: "", subCategory: "", description: "" });

  const fetchDashboardData = async (month = selectedDashboardMonth) => {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const params = new URLSearchParams({ timezone: userTz, month });
      const [dashRes, catRes] = await Promise.all([
        api.get(`/dashboard/summary?${params.toString()}`),
        api.get('/categories')
      ]);
      setSummary(dashRes.data.data || dashRes.data);
      setCategories(catRes.data.data || []);
      
    } catch (err) {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleBankSync = async () => {
    setBankSyncError("");
    if (!user?.bankConnected) {
      setBankSyncError("Connect a bank account before syncing transactions.");
      return;
    }

    setIsSyncing(true);
    try {
      await api.post('/transactions/sync'); 
      await fetchDashboardData(); 
    } catch (err) {
      setBankSyncError(err.response?.data?.message || "Bank sync failed. Please try again.");
    }
    finally { setIsSyncing(false); }
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingQuick(true);
    try {
      // Timezone-aware date string generation (YYYY-MM-DD)
      const now = new Date();
      const localDateString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      await api.post("/transactions", {
        type: quickAction,
        amount: Number(quickForm.amount),
        category: quickForm.category,
        subCategory: quickForm.subCategory || null,
        description: quickForm.description || (quickAction === 'income' ? 'Quick Deposit' : 'Quick Transfer'),
        transactionDate: getToday() || localDateString
      });
      setQuickAction(null);
      setQuickForm({ amount: "", category: "", subCategory: "", description: "" });
      await fetchDashboardData();
    } catch (err) { alert(err.response?.data?.message || "Failed to add transaction"); } 
    finally { setIsSubmittingQuick(false); }
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="p-8 text-sm text-rose-500">{error}</div>;

  // --- Core Metrics Math ---
  const income = summary?.totalIncome || 0;
  const expenses = summary?.totalExpenses || 0;
  const budgetExpenses = expenses;
  const netProfit = income - expenses; 
  
  const realBudgetLimit = summary?.totalBudgetLimit || 0;
  const hasBudgetLimit = realBudgetLimit > 0;
  const budgetPercentage = hasBudgetLimit ? Math.round(Math.min((budgetExpenses / realBudgetLimit) * 100, 100)) : 0;
  const isOverBudget = budgetPercentage >= 100;
  
  const recentTransactions = summary?.recentTransactions || [];
  const dailyData = summary?.dailyData || [];
  const now = new Date();
  const selectedMonthNumber = Number(selectedDashboardMonth.slice(5, 7));
  const selectedYear = Number(selectedDashboardMonth.slice(0, 4));
  const currentMonthName = new Date(selectedYear, selectedMonthNumber - 1).toLocaleString('default', { month: 'short' });
  const currentYear = selectedYear;
  const currentYearData = summary?.monthlyData?.filter(month => month.year === currentYear) || [];
  const barData = currentYearData.length > 0
    ? currentYearData
    : [{ month: currentMonthName, income, expenses }];

  const isCategoryEmpty = !summary?.categorySpending?.length;
  const categoryData = isCategoryEmpty ? [{ name: 'No Data', value: 1 }] : summary.categorySpending;
  const selectedMonthName = new Date(selectedYear, selectedMonthNumber - 1).toLocaleString('default', { month: 'short' });
  const selectedMonthData = summary?.monthlyData?.find(month => month.year === selectedYear && month.monthNumber === selectedMonthNumber);
  const availableBalance = (selectedMonthData?.income || 0) - (selectedMonthData?.expenses || 0);

  const selectDashboardMonth = (monthNumber) => {
    const monthKey = `${currentYear}-${String(monthNumber).padStart(2, '0')}`;
    setSelectedMonth(monthKey);
    setShowCalendar(false);
    fetchDashboardData(monthKey);
  };

  const handlePieClick = (payload) => {
    if (payload.subCategories && payload.subCategories.length > 0) {
      setPieModalData(payload);
    }
  };

  const formatYAxis = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value;
  };

  const blurText = (text) => isBlurred ? "••••••" : text;
  const formatCurrency = (amount) => new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: user?.baseCurrency || "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  const modalConfig = {
    revenue: { title: "Revenue Trend", key: "income", color: "#8b5cf6" },
    expenses: { title: "Expense Trend", key: "expenses", color: "#f43f5e" },
    profit: { title: "Net Profit Trend", key: "profit", color: "#10b981" }
  };

  const filteredCategories = categories.filter(c => c.type === quickAction);
  const selectedQuickCategory = filteredCategories.find(c => c._id === quickForm.category);
  const openQuickAction = (action) => {
    setQuickForm({ amount: "", category: "", subCategory: "", description: "" });
    setQuickAction(action);
  };
  const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const avatarUrl = getAvatarUrl(user?.avatar);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6 mx-auto max-w-[1600px] relative">
      
      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}
      
      {/* TREND GRAPHS MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold dark:text-white">{modalConfig[activeModal].title} · {selectedMonthName} {selectedYear}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {dailyData.length > 0
                    ? `${dailyData[0].date} – ${dailyData[dailyData.length - 1].date}`
                    : `No transactions available in ${selectedMonthName} ${selectedYear}`}
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="h-64 w-full sm:h-100">
              {dailyData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No transactions available in {selectedMonthName} {selectedYear}.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`color-${activeModal}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={modalConfig[activeModal].color} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={modalConfig[activeModal].color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#737373' }} minTickGap={30} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#737373' }} tickFormatter={formatYAxis} width={60} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '13px', border: 'none', backgroundColor: '#171717', color: '#fff' }} formatter={(value) => [formatCurrency(value), modalConfig[activeModal].key.charAt(0).toUpperCase() + modalConfig[activeModal].key.slice(1)]}/>
                    <Area type="monotone" dataKey={modalConfig[activeModal].key} stroke={modalConfig[activeModal].color} strokeWidth={3} fillOpacity={1} fill={`url(#color-${activeModal})`} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UNWINDING PIE MODAL */}
      {pieModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPieModalData(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pieModalData.color }}></span>
                {pieModalData.name} Breakdown
              </h2>
              <button onClick={() => setPieModalData(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <p className="text-2xl font-bold mb-6 dark:text-white">Total: {formatCurrency(pieModalData.value)}</p>
            
            <div className="space-y-3 max-h-75 overflow-y-auto pr-2">
              {pieModalData.subCategories.map((sub, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <span className="text-sm font-medium dark:text-neutral-300">{sub.name}</span>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold dark:text-white">{formatCurrency(sub.value)}</span>
                    <span className="text-[10px] text-slate-500">{Math.round((sub.value / pieModalData.value) * 100)}% of {pieModalData.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR CATALOG MODAL */}
      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowCalendar(false)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-neutral-800">
              <h2 className="text-xl font-bold dark:text-white">Annual Financial Catalog · {currentYear}</h2>
              <button onClick={() => setShowCalendar(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allMonths.map((monthStr, idx) => {
                const monthNumber = idx + 1;
                const monthKey = `${currentYear}-${String(monthNumber).padStart(2, '0')}`;
                const monthData = summary?.monthlyData?.find(m => m.monthNumber === monthNumber && m.year === currentYear);
                const isCurrent = monthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const isSelected = selectedDashboardMonth === monthKey;
                
                return (
                  <button key={idx} type="button" onClick={() => selectDashboardMonth(monthNumber)} aria-pressed={isSelected} aria-label={`View ${monthStr} ${currentYear} expenses`} className={`w-full p-4 rounded-xl border text-left transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/30 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                    <span className="mb-3 flex items-center justify-between text-sm font-bold dark:text-white">
                      {monthStr}
                      {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">Current</span>}
                    </span>
                    {monthData ? (
                      <span className="block space-y-2 text-xs">
                        <span className="flex justify-between"><span className="text-slate-500 dark:text-neutral-400">In:</span> <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(monthData.income)}</span></span>
                        <span className="flex justify-between"><span className="text-slate-500 dark:text-neutral-400">Out:</span> <span className="font-medium text-rose-600 dark:text-rose-400">{formatCurrency(monthData.expenses)}</span></span>
                        <span className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-neutral-700 dark:text-white">
                          <span>Net:</span> <span>{formatCurrency(monthData.income - monthData.expenses)}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="flex h-20 items-center justify-center text-xs text-slate-400 dark:text-neutral-600">No data</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL */}
      {quickAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setQuickAction(null)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-4">
              <h2 className="text-lg font-bold dark:text-white">{quickAction === 'income' ? 'Add Money (Income)' : 'Transfer (Expense)'}</h2>
              <button onClick={() => setQuickAction(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleQuickSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium dark:text-neutral-300">Amount ({user?.baseCurrency || "NGN"})</label>
                <input type="number" min="0.01" step="0.01" required value={quickForm.amount} onChange={e => setQuickForm({...quickForm, amount: e.target.value})} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" placeholder="0.00"/>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium dark:text-neutral-300">Category</label>
                <select required value={quickForm.category} onChange={e => setQuickForm({...quickForm, category: e.target.value, subCategory: ""})} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="" disabled>Select category</option>
                  {filteredCategories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              {selectedQuickCategory && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium dark:text-neutral-300">Sub-category</label>
                  <input type="text" list="quick-subcategory-options" maxLength={100} value={quickForm.subCategory} onChange={e => setQuickForm({...quickForm, subCategory: e.target.value})} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" placeholder="Optional; choose or enter a sub-category" />
                  <datalist id="quick-subcategory-options">
                    {(selectedQuickCategory.subCategories || []).map((subCategory) => <option key={subCategory} value={subCategory} />)}
                  </datalist>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium dark:text-neutral-300">Description <span className="text-neutral-500 font-normal">(Optional)</span></label>
                <input type="text" value={quickForm.description} onChange={e => setQuickForm({...quickForm, description: e.target.value})} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" placeholder="What was this for?"/>
              </div>
              <button type="submit" disabled={isSubmittingQuick} className={`mt-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${quickAction === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {isSubmittingQuick ? "Saving..." : "Log Transaction"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN DASHBOARD LAYOUT */}
      {/* ========================================================= */}
      
      {/* HEADER SECTION with Privacy, Calendar & User Avatar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold dark:text-white">{greeting}, {user?.firstName || "there"}</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">Here’s your financial overview.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          >
            <Calendar size={16} /> Annual View
          </button>
          <button 
            onClick={() => setIsBlurred(!isBlurred)}
            className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          >
            {isBlurred ? <EyeOff size={16} /> : <Eye size={16} />} 
            {isBlurred ? "Hidden" : "Visible"}
          </button>
          
          {/* USER AVATAR DISPLAY */}
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 sm:ml-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="User Profile" className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-400 uppercase">
                {user?.firstName?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: MAIN CHARTS */}
        <div className="xl:col-span-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => setActiveModal('revenue')} className="group bg-white dark:bg-[#0a0a0a] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-emerald-500/30 transition-all duration-300">
              <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Revenue · {selectedMonthName} {selectedYear}</p>
              <h3 className={`text-xl font-bold mt-1 text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors ${isBlurred ? 'filter blur-sm select-none' : ''}`}>{blurText(formatCurrency(income))}</h3>
            </div>
            
            <div onClick={() => setActiveModal('expenses')} className="group bg-white dark:bg-[#0a0a0a] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-rose-500/30 transition-all duration-300">
              <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Expenses · {selectedMonthName} {selectedYear}</p>
              <h3 className={`text-xl font-bold mt-1 text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors ${isBlurred ? 'filter blur-sm select-none' : ''}`}>{blurText(formatCurrency(expenses))}</h3>
            </div>
            
            <div onClick={() => setActiveModal('profit')} className="group bg-white dark:bg-[#0a0a0a] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-indigo-500/30 transition-all duration-300">
              <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Net profit · {selectedMonthName} {selectedYear}</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className={`text-xl font-bold transition-colors ${netProfit > 0 ? 'text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-300' : netProfit < 0 ? 'text-rose-600 dark:text-rose-400 group-hover:text-rose-500' : 'text-slate-600 dark:text-neutral-300'} ${isBlurred ? 'filter blur-sm select-none' : ''}`}>{blurText(formatCurrency(netProfit))}</h3>
                {netProfit > 0 && <TrendingUp size={16} className="text-emerald-500" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-white dark:bg-[#0a0a0a] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm h-[300px] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${isBlurred ? 'filter blur-[3px] select-none pointer-events-none' : ''}`}>
              <h3 className="text-sm font-bold mb-4 dark:text-white">Revenue & expenses</h3>
              <MemoizedBarChart data={barData} formatYAxis={formatYAxis} />
            </div>
            
            <div className={`bg-white dark:bg-[#0a0a0a] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm h-[300px] relative hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col ${isBlurred ? 'filter blur-[3px] select-none pointer-events-none' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold dark:text-white truncate pr-2">Expenses by Category · {selectedMonthName} {currentYear}</h3>
                <Link to={`/app/transactions?month=${selectedDashboardMonth}`} className="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Transactions</Link>
              </div>
              <div className="flex-1 relative">
                <MemoizedPieChart data={categoryData} isEmpty={isCategoryEmpty} onPieClick={handlePieClick} />
                {isCategoryEmpty && <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs text-neutral-500">No category data.</span></div>}
                {!isCategoryEmpty && <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none pb-2"><span className="text-[10px] text-slate-400 dark:text-neutral-500">Click a slice for breakdown</span></div>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-sm font-bold dark:text-white">Recent transactions · {selectedMonthName} {selectedYear}</h3>
              <Link to={`/app/transactions?month=${selectedDashboardMonth}`} className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-neutral-800/50">
              {recentTransactions.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-900" onClick={() => navigate(`/app/transactions?month=${selectedDashboardMonth}`)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold" style={{ color: tx.category?.color || '#8b5cf6' }}>
                      {tx.category?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium dark:text-white">
                        <span className="truncate">{tx.description || tx.merchant || 'Transaction'}</span>
                        {tx.subCategory && <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600 dark:bg-neutral-800 dark:text-neutral-400">{tx.subCategory}</span>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-neutral-500">{formatDateOnly(tx.transactionDate || tx.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-sm font-medium ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-900 dark:text-white'} ${isBlurred ? 'filter blur-sm select-none' : ''}`}>
                    {tx.type === 'income' ? '+' : '-'}{blurText(formatCurrency(tx.amount))}
                  </span>
                </div>
              ))}
              {recentTransactions.length === 0 && <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-500">No recent transactions recorded yet.</div>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDE PANEL */}
        <div className="xl:col-span-4 space-y-5">
          
          <div className="relative overflow-hidden rounded-xl bg-[#1e1b4b] p-4 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border dark:border-neutral-800 dark:bg-black sm:p-5">
            <p className="text-xs font-medium text-indigo-200 dark:text-neutral-400">Available balance</p>
            <h3 className={`mt-1 break-words text-2xl font-bold sm:text-3xl ${isBlurred ? 'filter blur-md select-none' : ''}`}>{blurText(formatCurrency(availableBalance))}</h3>
            
            <div className="flex gap-2 mt-6">
              <button onClick={() => openQuickAction('income')} className="flex-1 bg-white dark:bg-neutral-800 text-[#1e1b4b] dark:text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 hover:bg-indigo-50 dark:hover:bg-neutral-700 transition-colors"><Plus size={14} /> Add money</button>
              <button onClick={() => openQuickAction('expense')} className="flex-1 bg-indigo-800 dark:bg-white dark:text-black text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 hover:bg-indigo-700 dark:hover:bg-neutral-200 border border-indigo-700 dark:border-white transition-colors"><ArrowRight size={14} /> Transfer</button>
            </div>
          </div>

          {/* DYNAMIC BANK HUB */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold dark:text-white flex items-center gap-2">
                <Landmark size={16} className="text-indigo-500"/> Connected Banks
              </h3>
              <button onClick={handleBankSync} disabled={isSyncing || !user?.bankConnected} className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Syncing" : "Sync"}
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-slate-100 p-3 dark:border-neutral-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"><Landmark size={14} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.bankConnected ? "Bank account connected" : "No bank connected"}</p>
                  {!user?.bankConnected && <Link to="/app/account" className="text-[10px] text-indigo-600 hover:underline dark:text-indigo-400">Connect in Account Settings</Link>}
                </div>
              </div>
              {bankSyncError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{bankSyncError}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold dark:text-white">Monthly Budget · {selectedMonthName} {selectedYear}</h3>
              <Link to="/app/budget" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Manage</Link>
            </div>
            {!hasBudgetLimit ? (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 mt-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">You haven't set a budget yet. Set a spending limit to track goals!</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 leading-relaxed">
                  Spent <strong className={isBlurred ? 'filter blur-sm select-none' : ''}>{blurText(formatCurrency(budgetExpenses))}</strong> of <span className={isBlurred ? 'filter blur-sm select-none' : ''}>{blurText(formatCurrency(realBudgetLimit))}</span>
                </p>
                <div className="w-full h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-rose-500' : budgetPercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${budgetPercentage}%` }}></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
