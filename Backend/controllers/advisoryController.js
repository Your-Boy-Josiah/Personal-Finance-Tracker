// ===============================================================
//  advisoryController.js
//  API controller for the Budget and Advisory budgeting advice flow. It delegates
//  calculations to the advisory service and returns the result as JSON,
//  keeping the route layer separate from business logic.
// ===============================================================

const AdvisoryService = require('../services/advisoryService');

const advisoryService = new AdvisoryService();

// ============================================================== 
// @desc    Generate monthly spending advice for the logged-in user
// @route   GET /api/budget/advisory
// @access  Private
// ============================================================== 
const getAdvisory = async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: 'month must use YYYY-MM format' });
    }
    const timezone = req.query.timezone || 'UTC';
    const advisory = await advisoryService.getAdvice(req.user._id, month, timezone);
    res.status(200).json(advisory);
  } catch (error) {
    res.status(500).json({ message: 'Server error generating financial advice', error: error.message });
  }
};

// ============================================================
// EXPORT CONTROLLERS
// ============================================================

module.exports = { getAdvisory };
