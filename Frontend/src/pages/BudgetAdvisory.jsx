// ===============================================================
//  BudgetAdvisory.jsx
//  Rule-based financial insights. Grades financial health,
//  categorizes spending, and calculates daily survival limits.
// ===============================================================

import { useEffect, useState, useMemo } from "react";
import { 
  TrendingUp, AlertTriangle, CheckCircle, Info, 
  PieChart, BrainCircuit, Activity, CalendarClock, Target
} from "lucide-react";
import api from "../services/api";
import { useSelectedMonth } from "../context/MonthContext";
import { PageSkeleton } from "../components/LoadingState";

// ==============================================================
// HELPER FUNCTIONS
// ==============================================================

const formatAmount = (amount) => {
  return `₦${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// ==============================================================
// MAIN COMPONENT
// ==============================================================

const BudgetAdvisory = () => {
  const { selectedMonth } = useSelectedMonth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const fetchAdvisory = async () => {
      try {
        setLoading(true);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const params = new URLSearchParams({ month: selectedMonth, timezone });
        const response = await api.get(`/budget/advisory?${params.toString()}`);
        if (isCurrent) {
          setData(response.data);
          setError("");
        }
      } catch (err) {
        if (isCurrent) setError(err.response?.data?.message || "Failed to load advisory data.");
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchAdvisory();
    return () => { isCurrent = false; };
  }, [selectedMonth]);

  // --- Financial health calculations ---
  const today = new Date();
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate();
  const isSelectedMonthCurrent = selectedYear === today.getFullYear() && selectedMonthNumber === today.getMonth() + 1;
  const isSelectedMonthFuture = selectedYear > today.getFullYear() || (selectedYear === today.getFullYear() && selectedMonthNumber > today.getMonth() + 1);
  const daysLeft = isSelectedMonthFuture ? daysInMonth : isSelectedMonthCurrent ? daysInMonth - today.getDate() + 1 : 0;
  const monthElapsed = isSelectedMonthFuture ? 0 : isSelectedMonthCurrent ? today.getDate() / daysInMonth : 1;
  const selectedMonthLabel = new Date(selectedYear, selectedMonthNumber - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const healthScore = useMemo(() => {
    if (!data) return null;
    let score = 100;
    
    // Penalize heavily for overages
    const overages = data.overspentCategories?.length || 0;
    score -= (overages * 15); 
    
    // Penalize for high non-essential spending (>30% of total)
    const essential = data.classificationTotals?.essential || 0;
    const nonEss = data.classificationTotals?.["non-essential/cut-back"] || 0;
    const misc = data.classificationTotals?.miscellaneous || 0;
    const totalSpent = essential + nonEss + misc;
    
    if (totalSpent > 0 && (nonEss / totalSpent) > 0.3) {
      score -= 15;
    }
    
    if (score < 30) score = 30; // Floor value

    if (score >= 90) return { score, grade: 'A', color: 'text-emerald-500', bg: 'bg-emerald-500', title: 'Excellent Health' };
    if (score >= 80) return { score, grade: 'B', color: 'text-blue-500', bg: 'bg-blue-500', title: 'Good Standing' };
    if (score >= 70) return { score, grade: 'C', color: 'text-amber-500', bg: 'bg-amber-500', title: 'Caution Advised' };
    return { score, grade: 'F', color: 'text-rose-500', bg: 'bg-rose-500', title: 'Critical Action Needed' };
  }, [data]);

  // ==============================================================
  // RENDER UI
  // ==============================================================

  if (loading) return <PageSkeleton rows={5} />;
  if (error) return <div className="mx-auto max-w-4xl p-8 text-center text-sm text-rose-600 dark:text-rose-400">{error}</div>;
  if (!data) return null;

  const { classificationTotals, advice, overspentCategories } = data;

  return (
    <div className="mx-auto min-h-full max-w-6xl p-4 sm:p-6 lg:p-8">
      
      {/* HEADER SECTION */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <BrainCircuit size={14} /> Rules-Based Insights
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Financial Advisory</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            Actionable insights and spending advice for {selectedMonthLabel}.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* TOP ROW: HEALTH SCORE & CALENDAR MATH */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-[#0a0a0a] sm:gap-6 sm:p-6">
            <div className="absolute -right-6 -top-6 opacity-5 dark:opacity-10">
              <Activity size={120} className={healthScore.color} />
            </div>
            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 ${healthScore.color.replace('text-', 'border-')} bg-slate-50 dark:bg-neutral-900`}>
              <span className={`text-3xl font-black ${healthScore.color}`}>{healthScore.grade}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Health Score</h2>
              <p className={`mt-1 text-lg font-bold sm:text-xl ${healthScore.color}`}>{healthScore.title}</p>
              <p className="text-xs text-slate-500 mt-1">Based on category pacing & ratios.</p>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-6">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
              <CalendarClock size={18} />
              <h2 className="text-sm font-bold">Month Trajectory</h2>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{daysLeft}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Days Remaining</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {Math.round(monthElapsed * 100)}%
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Month Elapsed</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${monthElapsed * 100}%` }}></div>
            </div>
          </div>
        </div>

        {/* TOP ROW: CLASSIFICATIONS */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:border-neutral-800 dark:bg-[#0a0a0a]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle size={16} /></div>
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-300">Essential</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">{formatAmount(classificationTotals?.essential)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:border-neutral-800 dark:bg-[#0a0a0a]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"><AlertTriangle size={16} /></div>
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-300">Non-Essential</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">{formatAmount(classificationTotals?.["non-essential/cut-back"])}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:border-neutral-800 dark:bg-[#0a0a0a]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><PieChart size={16} /></div>
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-300">Miscellaneous</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">{formatAmount(classificationTotals?.miscellaneous)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* LEFT COLUMN: ADVICE FEED */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
            <TrendingUp size={20} className="text-indigo-500" />
            AI Behavioral Analysis
          </h2>
          
          <div className="space-y-3">
            {advice.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-8">
                Not enough transaction data for {selectedMonthLabel} to generate an AI behavior profile.
              </div>
            ) : (
              advice.map((item, index) => {
                let bgClass = "bg-white dark:bg-[#0a0a0a] border-slate-200 dark:border-neutral-800";
                let icon = <Info size={18} className="text-blue-500 mt-0.5" />;
                
                if (item.status === 'over_budget' || item.status === 'warning') {
                  bgClass = "bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50";
                  icon = <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 mt-0.5" />;
                } else if (item.status === 'under_budget') {
                  bgClass = "bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50";
                  icon = <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 mt-0.5" />;
                }

                return (
                  <div key={index} className={`flex gap-3 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${bgClass}`}>
                    <div className="shrink-0">{icon}</div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-neutral-200 leading-relaxed">{item.message}</p>
                      {item.category && (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-200/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-neutral-800 dark:text-neutral-400">
                          <Target size={10} /> {item.category.name} {item.subCategory ? `› ${item.subCategory}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

{/* RIGHT COLUMN: ACTIONABLE OVERAGES */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* DYNAMIC HEADER: Only red if there are actual overages */}
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${overspentCategories.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {overspentCategories.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
            {overspentCategories.length > 0 ? "Immediate Action Required" : "Budget Status"}
          </h2>
          
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-[#0a0a0a] sm:p-5">
            {overspentCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                <CheckCircle size={40} className="mb-3 text-emerald-500/50" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">Perfect Discipline.</p>
                <p className="text-xs mt-1">You have zero breached budget caps.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {overspentCategories.map((overage, idx) => (
                  <div key={idx} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0 dark:border-neutral-800">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">
                        {overage.category?.name || "Unknown"}
                        {overage.subCategory && <span className="ml-1 text-slate-500 font-medium">({overage.subCategory})</span>}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm font-black text-rose-600 dark:text-rose-400">
                        +{formatAmount(overage.amountOver)} Over
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
                      <span>Cap: {formatAmount(overage.spendingCap)}</span>
                      <span>Spent: {formatAmount(overage.spent)}</span>
                    </div>
                    
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
                      <div className="h-full w-full bg-rose-500" />
                    </div>

                    <div className="mt-3 rounded bg-rose-50 p-2.5 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-900/30">
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        {daysLeft > 0
                          ? `With ${daysLeft} days left in ${selectedMonthLabel}, pause spending in this category to avoid exceeding the cap further.`
                          : `This category exceeded its cap in ${selectedMonthLabel}. Review the transactions to understand the overage.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetAdvisory;
