// ===============================================================
//  advisoryService.js
//  Advisory engine. Turns expense history into practical guidance.
//  Upgraded to provide positive reinforcement and flag uncategorized data.
//  Now strictly supports granular sub-category budget tracking.
// ===============================================================

const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

const ESSENTIAL_KEYWORDS = [
  'rent', 'housing', 'mortgage', 'utility', 'utilities', 'electricity',
  'water', 'food', 'groceries', 'health', 'medical', 'medicine',
  'transport', 'transportation', 'fuel', 'education', 'insurance',
];

const NON_ESSENTIAL_KEYWORDS = [
  'dining', 'restaurant', 'takeout', 'entertainment', 'movie', 'shopping',
  'clothing', 'subscription', 'vacation', 'travel', 'gaming', 'alcohol',
];

class AdvisoryService {
  classifyTransaction(transaction) {
    const categoryName = transaction.category && transaction.category.name ? transaction.category.name : '';
    // NEW: Include the subCategory in the string we evaluate for keywords
    const subCategoryName = transaction.subCategory || '';
    const text = `${categoryName} ${subCategoryName} ${transaction.description || ''}`.toLowerCase();

    if (ESSENTIAL_KEYWORDS.some((keyword) => text.includes(keyword))) return 'essential';
    if (NON_ESSENTIAL_KEYWORDS.some((keyword) => text.includes(keyword))) return 'non-essential/cut-back';
    return 'miscellaneous';
  }

  async getAdvice(userId, month = null, timezone = 'UTC') {
    const now = new Date();
    const selectedMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
    const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1));

    const [budget, transactions] = await Promise.all([
      Budget.findOne({ user: userId }).populate({
        path: 'categoryLimits.category',
        select: 'name type color',
        match: { $or: [{ user: userId }, { user: null }], type: 'expense' },
      }),
      Transaction.find({
        user: userId,
        type: 'expense',
        $expr: { $and: [
          { $eq: [{ $month: { date: '$transactionDate', timezone } }, monthNumber] },
          { $eq: [{ $year: { date: '$transactionDate', timezone } }, year] },
        ] },
      }).populate('category', 'name type color'),
    ]);

    const classifiedTransactions = transactions.map((transaction) => ({
      transactionId: transaction._id,
      amount: transaction.amount,
      category: transaction.category,
      subCategory: transaction.subCategory, // Explicitly carry over the subCategory
      description: transaction.description,
      transactionDate: transaction.transactionDate,
      classification: this.classifyTransaction(transaction),
    }));

    const classificationTotals = classifiedTransactions.reduce((totals, transaction) => {
      totals[transaction.classification] += transaction.amount;
      return totals;
    }, { essential: 0, miscellaneous: 0, 'non-essential/cut-back': 0 });

    // NEW LOGIC: Calculate totals mapped by Category AND SubCategory
    const categoryTotals = new Map();
    for (const transaction of classifiedTransactions) {
      const categoryId = transaction.category && transaction.category._id ? String(transaction.category._id) : 'uncategorized';
      // Treat null/empty subCategory as "MAIN" to group general expenses together
      const subKey = transaction.subCategory ? transaction.subCategory.trim().toLowerCase() : 'MAIN';
      
      const compositeKey = `${categoryId}_${subKey}`;

      const current = categoryTotals.get(compositeKey) || { 
        category: transaction.category, 
        subCategory: transaction.subCategory || null,
        spent: 0 
      };
      
      current.spent += transaction.amount;
      categoryTotals.set(compositeKey, current);
    }

    const advice = [];

    // FIX 1: Explicitly warn the user about uncategorized bank transactions
    const uncategorizedCount = classifiedTransactions.filter(t => !t.category).length;
    if (uncategorizedCount > 0) {
      advice.push({
        category: null,
        subCategory: null,
        status: 'warning',
        message: `You have ${uncategorizedCount} uncategorized transaction(s). Categorize them so they count toward your budget limits!`
      });
    }

    // FIX 2: Evaluate spending vs caps using granular sub-category keys
    const overspentCategories = [];
    (budget ? budget.categoryLimits.filter(limit => limit.category) : []).forEach(limit => {
      const categoryId = String(limit.category && limit.category._id ? limit.category._id : limit.category);
      
      // Look up the exact matching total using the subCategory logic
      const targetSub = limit.subCategory ? limit.subCategory.trim().toLowerCase() : 'MAIN';
      const compositeKey = `${categoryId}_${targetSub}`;

      const spentObj = categoryTotals.get(compositeKey);
      const spent = spentObj ? spentObj.spent : 0;
      const difference = spent - limit.spendingCap;

      const displayLabel = limit.subCategory ? `${limit.category.name} (${limit.subCategory})` : limit.category.name;

      if (difference > 0) {
        overspentCategories.push({ 
          category: limit.category, 
          subCategory: limit.subCategory, 
          spendingCap: limit.spendingCap, 
          spent, 
          amountOver: difference 
        });
        advice.push({
          category: limit.category,
          subCategory: limit.subCategory,
          status: 'over_budget',
          message: `Your ${displayLabel} spending is ${difference.toFixed(2)} over the cap. Review non-essential spending here.`
        });
      } else if (difference < 0) {
        advice.push({
          category: limit.category,
          subCategory: limit.subCategory,
          status: 'under_budget',
          message: `Great job! You are ${Math.abs(difference).toFixed(2)} under your ${displayLabel} cap.`
        });
      } else {
        advice.push({
          category: limit.category,
          subCategory: limit.subCategory,
          status: 'on_budget',
          message: `You have exactly hit your ${displayLabel} spending cap.`
        });
      }
    });

    if (classificationTotals['non-essential/cut-back'] > 0) {
      advice.push({
        category: null,
        subCategory: null,
        status: 'info',
        message: `You spent ${classificationTotals['non-essential/cut-back'].toFixed(2)} on non-essential items this month. Consider redirecting part of this toward savings.`,
      });
    }

    return {
      period: { month: selectedMonth, start: monthStart, end: nextMonthStart },
      classificationTotals,
      categoryTotals: Array.from(categoryTotals.values()),
      overspentCategories,
      advice,
      transactions: classifiedTransactions,
    };
  }
}

module.exports = AdvisoryService;
