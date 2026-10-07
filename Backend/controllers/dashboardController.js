// ===============================================================
//  dashboardController.js
//  Handles business logic for the financial dashboard, using
//  MongoDB aggregation to calculate totals, balances, and trends.
// ===============================================================

const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget'); 

const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const userTz = req.query.timezone || 'UTC';
    const selectedMonthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(req.query.month || '');

    if (req.query.month && !selectedMonthMatch) {
      return res.status(400).json({ success: false, message: 'month must use YYYY-MM format' });
    }

    const selectedMonthNumber = selectedMonthMatch ? Number(selectedMonthMatch[2]) : null;
    const selectedYear = selectedMonthMatch ? Number(selectedMonthMatch[1]) : null;
    const selectedMonthExpr = selectedMonthMatch ? { $and: [
      { $eq: [{ $month: { date: '$transactionDate', timezone: userTz } }, selectedMonthNumber] },
      { $eq: [{ $year: { date: '$transactionDate', timezone: userTz } }, selectedYear] }
    ] } : null;

    // Get Totals (Income, Expenses, Balance)
    const totals = await Transaction.aggregate([
      { $match: { user: userId } },
      { $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{$and: [{$eq: ["$type", "income"]}, ...(selectedMonthExpr ? [selectedMonthExpr] : [])] }, "$amount", 0] } },
          totalExpenses: { $sum: { $cond: [{$and: [{$eq: ["$type", "expense"]}, ...(selectedMonthExpr ? [selectedMonthExpr] : [])] }, "$amount", 0] } },
          currentMonthExpenses: { $sum: { $cond: [
            { $and: [
              { $eq: ["$type", "expense"] },
              { $eq: [
                { $month: { date: "$transactionDate", timezone: userTz } },
                { $month: { date: "$$NOW", timezone: userTz } }
              ] },
              { $eq: [
                { $year: { date: "$transactionDate", timezone: userTz } },
                { $year: { date: "$$NOW", timezone: userTz } }
              ] }
            ] },
            "$amount",
            0
          ] } }
        }
      }
    ]);

    const totalIncome = totals[0]?.totalIncome || 0;
    const totalExpenses = totals[0]?.totalExpenses || 0;
    const currentMonthExpenses = totals[0]?.currentMonthExpenses || 0;
    const currentBalance = totalIncome - totalExpenses;

    // Fetch User's Total Budget Limit
    const userBudgets = await Budget.find({ user: userId });
    const totalBudgetLimit = userBudgets.reduce((sum, budget) => {
      const categoryLimits = budget.categoryLimits;
      
      // Removed dead branch. Direct sum of spendingCaps
      const categoryTotal = Array.isArray(categoryLimits)
        ? categoryLimits.reduce(
            (categorySum, category) => categorySum + Number(category.spendingCap ?? 0),
            0
          )
        : Number(categoryLimits?.spendingCap ?? 0);

      return sum + categoryTotal;
    }, 0);

    // Get Recent Transactions (Limit 5)
    const recentQuery = { user: userId };
    if (selectedMonthMatch) {
      recentQuery.$expr = selectedMonthExpr;
    }
    const recentTransactions = await Transaction.find(recentQuery)
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(5)
      .populate('category', 'name color');

    // Category Spending (Drill-Down Setup: Group by category AND subCategory)
    const categorySpendingRaw = await Transaction.aggregate([
      { $match: {
          user: userId,
          type: 'expense',
          $expr: { $and: [
            { $eq: [
              { $month: { date: "$transactionDate", timezone: userTz } },
              selectedMonthMatch ? selectedMonthNumber : { $month: { date: "$$NOW", timezone: userTz } }
            ] },
            { $eq: [
              { $year: { date: "$transactionDate", timezone: userTz } },
              selectedMonthMatch ? selectedYear : { $year: { date: "$$NOW", timezone: userTz } }
            ] }
          ] }
        }
      },
      { $group: { 
          _id: { category: "$category", subCategory: "$subCategory" }, 
          value: { $sum: "$amount" } 
        } 
      },
      { $group: {
          _id: "$_id.category",
          totalValue: { $sum: "$value" },
          subCategories: { 
            $push: { 
              name: { $ifNull: ["$_id.subCategory", "General"] },
              value: "$value" 
            } 
          }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    const populatedCategories = await Category.populate(categorySpendingRaw, { path: '_id', select: 'name color' });
    const categorySpending = populatedCategories.map(cat => ({
      id: cat._id?._id,
      name: cat._id?.name || 'Uncategorized',
      value: cat.totalValue,
      color: cat._id?.color || '#94a3b8',
      subCategories: cat.subCategories
    }));

    // Monthly Data 
    const monthlyDataRaw = await Transaction.aggregate([
      { $match: { user: userId } },
      { $group: {
          _id: { 
            month: { $month: { date: "$transactionDate", timezone: userTz } }, 
            year: { $year: { date: "$transactionDate", timezone: userTz } } 
          },
          income: { $sum: { $cond: [{$eq: ["$type", "income"] }, "$amount", 0] } },
          expenses: { $sum: { $cond: [{$eq: ["$type", "expense"] }, "$amount", 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = monthlyDataRaw.map(data => ({
      month: monthNames[data._id.month - 1],
      monthNumber: data._id.month,
      year: data._id.year,
      income: data.income,
      expenses: data.expenses
    }));

    // Daily Trend Data (Last 30 Days) for Pop-Up Modals
    const now = new Date();
    const dailyDataRaw = await Transaction.aggregate([
      { $match: { 
          user: userId,
          ...(selectedMonthMatch ? { $expr: selectedMonthExpr } : (() => {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return { transactionDate: { $gte: thirtyDaysAgo, $lte: now } };
          })())
        } 
      },
      { $group: {
          _id: { 
            day: { $dayOfMonth: { date: "$transactionDate", timezone: userTz } },
            month: { $month: { date: "$transactionDate", timezone: userTz } }, 
            year: { $year: { date: "$transactionDate", timezone: userTz } } 
          },
          income: { $sum: { $cond: [{$eq: ["$type", "income"] }, "$amount", 0] } },
          expenses: { $sum: { $cond: [{$eq: ["$type", "expense"] }, "$amount", 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const dailyData = dailyDataRaw.map(data => ({
      date: new Date(Date.UTC(data._id.year, data._id.month - 1, data._id.day)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      }),
      income: data.income,
      expenses: data.expenses,
      profit: data.income - data.expenses
    }));

    // Send Response
    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        currentMonthExpenses,
        totalBalance: currentBalance, // Actual Net Profit
        totalBudgetLimit, 
        recentTransactions,
        categorySpending,
        monthlyData,
        dailyData 
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error generating dashboard summary', error: error.message });
  }
};

module.exports = { 
  getDashboardSummary 
};
