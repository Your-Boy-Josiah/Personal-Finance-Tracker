// ===============================================================
//  Transactions.jsx
//  Handles the UI for viewing, creating, updating, and deleting
//  transactions using isolated local state to ensure stability.
// ===============================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import { useSelectedMonth } from "../context/MonthContext";
import { formatDateOnly, getToday, toDateInputValue } from "../utils/dates";

// ==============================================================
// HELPER FUNCTIONS
// ==============================================================

const emptyForm = () => ({
  type: "expense",
  amount: "",
  category: "",
  subCategory: "", 
  description: "",
  transactionDate: getToday(),
});

const transactionToForm = (transaction) => ({
  type: transaction.type || "expense",
  amount: String(transaction.amount ?? ""),
  category:
    typeof transaction.category === "object"
      ? transaction.category?._id || ""
      : transaction.category || "",
  subCategory: transaction.subCategory || "",
  description: transaction.description || "",
  transactionDate: transaction.transactionDate
    ? toDateInputValue(transaction.transactionDate)
    : getToday(),
});

const formatDate = (value) => formatDateOnly(value, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatAmount = (amount) => {
  return `₦${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fetchTransactionCategories = async () => {
  const response = await api.get("/categories");
  return response.data.data || [];
};

// ==============================================================
// MAIN COMPONENT
// ==============================================================

const Transactions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedMonth } = useSelectedMonth();
  const selectedMonth = searchParams.get("month") || "";

  useEffect(() => {
    if (selectedMonth) setSelectedMonth(selectedMonth);
  }, [selectedMonth, setSelectedMonth]);

  // --- State Management ---
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [dialogMode, setDialogMode] = useState(""); 

  // ==============================================================
  // DATA FETCHING (USE EFFECTS)
  // ==============================================================

  const refreshCategories = async () => {
    try {
      setCategories(await fetchTransactionCategories());
      setCategoriesError("");
    } catch (requestError) {
      setCategoriesError(
        requestError.response?.data?.message || "Couldn't load categories."
      );
    }
  };

  useEffect(() => {
    let isCurrent = true;

    const loadTransactions = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (selectedMonth) {
          params.set("month", selectedMonth);
          params.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
        const response = await api.get(`/transactions?${params.toString()}`);
        if (!isCurrent) return;

        setTransactions(response.data.data || []);
        setPagination({
          currentPage: response.data.pagination?.currentPage || page,
          totalPages: response.data.pagination?.totalPages || 1,
          totalRecords: response.data.pagination?.totalRecords || 0,
        });
      } catch (requestError) {
        if (isCurrent) {
          setError(
            requestError.response?.data?.message ||
              "We couldn't load your transactions. Please try again."
          );
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadTransactions();
    return () => {
      isCurrent = false;
    };
  }, [page, refreshKey, selectedMonth]);

  useEffect(() => {
    let isCurrent = true;

    const loadCategories = async () => {
      try {
        const availableCategories = await fetchTransactionCategories();
        if (isCurrent) setCategories(availableCategories);
      } catch (requestError) {
        if (isCurrent) {
          setCategoriesError(
            requestError.response?.data?.message || "Couldn't load categories."
          );
        }
      }
    };

    loadCategories();
    return () => {
      isCurrent = false;
    };
  }, []);

  // ==============================================================
  // DIALOG & FORM HANDLERS
  // ==============================================================

  const openTransactionDialog = (transaction, mode) => {
    if (mode === "create") {
      setSelectedTransaction(null);
      setForm(emptyForm());
    } else {
      setSelectedTransaction(transaction);
      setForm(transactionToForm(transaction));
    }
    setFormError("");
    setDialogMode(mode);
    refreshCategories();
  };

  const closeTransactionDialog = () => {
    setDialogMode("");
    setSelectedTransaction(null);
    setFormError("");
  };

  const handleCreateTransaction = async (event) => {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);

    try {
      await api.post("/transactions", {
        ...form,
        amount: Number(form.amount),
        subCategory: form.subCategory?.trim() || null, // DB Sanitization
      });
      closeTransactionDialog();
      setPage(1);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message || "Couldn't save this transaction."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTransaction = async (event) => {
    event.preventDefault();
    if (!selectedTransaction) return;

    setFormError("");
    setIsSaving(true);
    try {
      await api.put(`/transactions/${selectedTransaction._id}`, {
        ...form,
        amount: Number(form.amount),
        subCategory: form.subCategory?.trim() || null, // DB Sanitization
      });
      closeTransactionDialog();
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message || "Couldn't update this transaction."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;

    setFormError("");
    setIsDeleting(true);
    try {
      await api.delete(`/transactions/${selectedTransaction._id}`);
      closeTransactionDialog();
      if (transactions.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        setRefreshKey((key) => key + 1);
      }
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message || "Couldn't delete this transaction."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamic filter to ensure Income transactions only show Income categories, etc.
  const filteredCategories = categories.filter(c => c.type === form.type);
  const activeCategoryObj = filteredCategories.find(c => c._id === form.category);
  const hasSubCategories = Boolean(activeCategoryObj);

  // ==============================================================
  // RENDER UI
  // ==============================================================

  return (
    <div className="mx-auto min-h-full max-w-7xl bg-slate-50 p-4 text-slate-900 dark:bg-black dark:text-neutral-100 sm:p-6 lg:p-8">
      
      {/* HEADER SECTION */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
            Money activity
          </p>
          <h1 className="mt-1 text-2xl font-bold">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            Review your income and expenses.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <label htmlFor="transaction-month" className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-neutral-300">
            Month
            <input
              id="transaction-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                const nextParams = new URLSearchParams(searchParams);
                if (event.target.value) nextParams.set("month", event.target.value);
                else nextParams.delete("month");
                setSearchParams(nextParams, { replace: true });
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
          {selectedMonth && (
            <button
              type="button"
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("month");
                setSearchParams(nextParams, { replace: true });
                setPage(1);
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
            >
              All months
            </button>
          )}
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            {pagination.totalRecords} {pagination.totalRecords === 1 ? "record" : "records"}
          </p>
          <button
            type="button"
            onClick={() => openTransactionDialog(null, "create")}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-50"
          >
            <Plus size={16} />
            Add transaction
          </button>
        </div>
      </header>

      {/* UNIFIED MODAL FOR CREATE, VIEW, EDIT, AND DELETE */}
      {dialogMode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTransactionDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-dialog-heading"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-950 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-neutral-800">
              <h2 id="transaction-dialog-heading" className="text-lg font-semibold">
                {dialogMode === "create" && "New transaction"}
                {dialogMode === "view" && "Transaction details"}
                {dialogMode === "edit" && "Edit transaction"}
                {dialogMode === "delete" && "Delete transaction?"}
              </h2>
              <button
                type="button"
                onClick={closeTransactionDialog}
                aria-label="Close transaction dialog"
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* VIEW MODE */}
            {dialogMode === "view" && selectedTransaction && (
              <>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Description</dt>
                    <dd className="mt-1 wrap-break-word text-sm font-medium">
                      {selectedTransaction.description || selectedTransaction.merchant || "Transaction"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Amount</dt>
                    <dd className="mt-1 text-sm font-semibold">{formatAmount(selectedTransaction.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Type</dt>
                    <dd className="mt-1 text-sm capitalize">{selectedTransaction.type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Category</dt>
                    <dd className="mt-1 text-sm">
                      {selectedTransaction.category?.name ||
                        categories.find((category) => category._id === form.category)?.name ||
                        (selectedTransaction.category ? "Categorized" : "Uncategorized")}
                    </dd>
                  </div>
                  
                  {selectedTransaction.subCategory && (
                    <div>
                      <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Sub-Category</dt>
                      <dd className="mt-1 text-sm">{selectedTransaction.subCategory}</dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Date</dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(selectedTransaction.transactionDate || selectedTransaction.createdAt)}
                    </dd>
                  </div>
                  {selectedTransaction.bankName && (
                    <div>
                      <dt className="text-xs font-medium uppercase text-slate-500 dark:text-neutral-400">Bank</dt>
                      <dd className="mt-1 text-sm">{selectedTransaction.bankName}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setDialogMode("delete")}
                    className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setDialogMode("edit");
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                </div>
              </>
            )}

            {/* CREATE & EDIT FORM MODE */}
            {(dialogMode === "create" || dialogMode === "edit") && (
              <form onSubmit={dialogMode === "create" ? handleCreateTransaction : handleUpdateTransaction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="transaction-type" className="mb-1.5 block text-sm font-medium">Type</label>
                  <select
                    id="transaction-type"
                    value={form.type}
                    // Reset category and subCategory state when switching types
                    onChange={(event) => setForm({ ...form, type: event.target.value, category: "", subCategory: "" })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="transaction-amount" className="mb-1.5 block text-sm font-medium">Amount</label>
                  <input
                    id="transaction-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label htmlFor="transaction-category" className="mb-1.5 block text-sm font-medium">Category</label>
                  <select
                    id="transaction-category"
                    required
                    value={form.category}
                    // Clear subCategory if the main category is changed
                    onChange={(event) => setForm({ ...form, category: event.target.value, subCategory: "" })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <option value="" disabled>
                      {categoriesError ? "Categories unavailable" : filteredCategories.length ? "Select a category" : `No ${form.type} categories available`}
                    </option>
                    {filteredCategories.map((category) => (
                      <option key={category._id} value={category._id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                {activeCategoryObj && (
                  <div>
                    <label htmlFor="transaction-subcategory" className="mb-1.5 block text-sm font-medium">Sub-category</label>
                    <input
                      id="transaction-subcategory"
                      type="text"
                      list="transaction-subcategory-options"
                      maxLength={100}
                      value={form.subCategory}
                      onChange={(event) => setForm({ ...form, subCategory: event.target.value })}
                      placeholder="Optional; choose or enter a sub-category"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <datalist id="transaction-subcategory-options">
                      {(activeCategoryObj.subCategories || []).map((sub, idx) => (
                        <option key={idx} value={sub} />
                      ))}
                    </datalist>
                  </div>
                )}

                <div className={!hasSubCategories ? "sm:col-start-2 sm:row-start-2" : ""}>
                  <label htmlFor="transaction-date" className="mb-1.5 block text-sm font-medium">Date</label>
                  <input
                    id="transaction-date"
                    type="date"
                    required
                    value={form.transactionDate}
                    onChange={(event) => setForm({ ...form, transactionDate: event.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="transaction-description" className="mb-1.5 block text-sm font-medium">Description</label>
                  <input
                    id="transaction-description"
                    type="text"
                    maxLength={255}
                    required
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="What was this transaction for?"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                {formError && <p className="text-sm text-rose-600 dark:text-rose-400 sm:col-span-2" role="alert">{formError}</p>}
                
                <div className="flex justify-end gap-2 sm:col-span-2 border-t border-slate-100 pt-4 dark:border-neutral-800">
                  <button type="button" onClick={closeTransactionDialog} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-900">Cancel</button>
                  <button
                    type="submit"
                    disabled={isSaving || filteredCategories.length === 0}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    {isSaving ? "Saving..." : (dialogMode === "create" ? "Save transaction" : "Save changes")}
                  </button>
                </div>
              </form>
            )}

            {/* DELETE CONFIRMATION MODE */}
            {dialogMode === "delete" && (
              <div>
                <p className="text-sm text-slate-600 dark:text-neutral-300">
                  Delete “{selectedTransaction.description || selectedTransaction.merchant || "Transaction"}”? This cannot be undone.
                </p>
                {formError && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">{formError}</p>}
                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-neutral-800">
                  <button type="button" onClick={() => setDialogMode("view")} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-900">Cancel</button>
                  <button
                    type="button"
                    onClick={handleDeleteTransaction}
                    disabled={isDeleting}
                    className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete transaction"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TRANSACTION TABLE */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-neutral-800 dark:bg-[#0a0a0a]" aria-label="Transaction list">
        {error ? (
          <div className="p-8 text-center text-sm text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </div>
        ) : loading ? (
          <div className="space-y-4 p-5" role="status" aria-label="Loading transactions">
            <span className="sr-only">Loading transactions</span>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 animate-pulse">
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-neutral-800" />
                <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-neutral-800" />
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-neutral-800" />
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-neutral-800" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-sm font-semibold">No transactions yet</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              Your income and expenses will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Date</th>
                    <th scope="col" className="px-5 py-3 font-medium">Description</th>
                    <th scope="col" className="px-5 py-3 font-medium">Category</th>
                    <th scope="col" className="px-5 py-3 font-medium">Type</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {transactions.map((transaction) => {
                    const isIncome = transaction.type === "income";
                    const description =
                      transaction.description || transaction.merchant || "Transaction";
                    const categoryId =
                      typeof transaction.category === "object"
                        ? transaction.category?._id
                        : transaction.category;
                    const category =
                      transaction.category?.name ||
                      categories.find((item) => String(item._id) === String(categoryId))?.name ||
                      (categoryId ? "Unknown category" : "Uncategorized");

                    return (
                      <tr key={transaction._id} className="transition-colors hover:bg-slate-50 dark:hover:bg-neutral-900/60">
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-neutral-400">
                          {formatDate(transaction.transactionDate || transaction.createdAt)}
                        </td>
                        <td className="max-w-xs truncate px-5 py-4 font-medium" title={description}>
                          {description}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-neutral-400">
                          {category}
                          {transaction.subCategory && (
                            <span className="ml-2 inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600 dark:bg-neutral-800 dark:text-neutral-400">
                              {transaction.subCategory}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${isIncome
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                          }`}>
                            {transaction.type || "expense"}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${isIncome ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                          {isIncome ? "+" : "−"}{formatAmount(transaction.amount)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openTransactionDialog(transaction, "view")}
                              aria-label={`View ${description}`}
                              title="View transaction"
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openTransactionDialog(transaction, "edit")}
                              aria-label={`Edit ${description}`}
                              title="Edit transaction"
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openTransactionDialog(transaction, "delete")}
                              aria-label={`Delete ${description}`}
                              title="Delete transaction"
                              className="rounded-md p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <footer className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Page {pagination.currentPage} of {pagination.totalPages}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page <= 1 || loading}
                  aria-label="Previous page"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(pagination.totalPages, currentPage + 1))}
                  disabled={page >= pagination.totalPages || loading}
                  aria-label="Next page"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
};

export default Transactions;
