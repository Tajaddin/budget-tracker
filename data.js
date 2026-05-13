// ============================================================
// Personal Finance Data — Sample / Demo Data
// Replace with your own values to use this app.
// ============================================================

const APP_DATA = {
  user: {
    name: "Demo User",
    location: "Your City, ST",
    occupation: "Graduate Student",
    car: "Your Vehicle"
  },

  // ── February 2026 Actuals ──────────────────────────────────
  february: {
    income: {
      total: 5000.00,
      sources: [
        { name: "Primary Income", amount: 4500.00, type: "transfer" },
        { name: "Side Work", amount: 300.00, type: "side" },
        { name: "Reimbursement", amount: 100.00, type: "zelle" },
        { name: "Other", amount: 100.00, type: "deposit" }
      ]
    },
    spending: {
      total: 2500,
      byCard: {
        primaryCard: 1800.00,
        secondaryCard: 500.00,
        debitCard: 200.00
      },
      categories: [
        { name: "Dining Out", amount: 400, icon: "utensils" },
        { name: "Amazon/Shopping", amount: 300, icon: "shopping-bag" },
        { name: "Auto/Transport", amount: 250, icon: "wrench" },
        { name: "Gas", amount: 200, icon: "fuel" },
        { name: "Groceries", amount: 175, icon: "shopping-cart" },
        { name: "Subscriptions", amount: 120, icon: "repeat" },
        { name: "Pharmacy/Health", amount: 80, icon: "heart-pulse" },
        { name: "Personal Care", amount: 75, icon: "scissors" },
        { name: "Entertainment", amount: 50, icon: "film" },
        { name: "Dental", amount: 150, icon: "smile" },
        { name: "Misc", amount: 100, icon: "more-horizontal" }
      ],
      merchants: [
        { name: "Restaurant A", amount: 80.00, visits: 3, category: "Dining Out" },
        { name: "Restaurant B", amount: 45.00, visits: 1, category: "Dining Out" },
        { name: "Fast Food", amount: 35.00, visits: 2, category: "Dining Out" },
        { name: "Movie Theater", amount: 70.00, visits: 3, category: "Entertainment" },
        { name: "Auto Parts Store", amount: 220.00, visits: 1, category: "Auto/Transport" },
        { name: "Amazon", amount: 350.00, visits: 5, category: "Amazon/Shopping" },
        { name: "Gas Station", amount: 200.00, visits: 6, category: "Gas" },
        { name: "Grocery Store", amount: 175.00, visits: 4, category: "Groceries" },
        { name: "Pharmacy", amount: 80.00, visits: 2, category: "Pharmacy/Health" },
        { name: "Dental Office", amount: 150.00, visits: 1, category: "Dental" },
        { name: "Barber", amount: 50.00, visits: 1, category: "Personal Care" }
      ]
    },
    zelleSent: {
      total: 500.00,
      transfers: [
        { recipient: "Rent", amount: 450.00 },
        { recipient: "Split Bill", amount: 50.00 }
      ]
    }
  },

  // ── March 2026 Budget ──────────────────────────────────────
  march: {
    income: {
      total: 4500.00,
      sources: [
        { name: "Primary Income", amount: 4200.00, type: "transfer" },
        { name: "Side Work / Other", amount: 300.00, type: "side" }
      ]
    },
    fixed: [
      { category: "Rent", amount: 900.00, icon: "home" },
      { category: "Auto Loan", amount: 400.00, icon: "car" },
      { category: "Insurance", amount: 200.00, icon: "shield" },
      { category: "Meal Plan", amount: 150.00, icon: "utensils-crossed" },
      { category: "Dental Insurance", amount: 7.00, icon: "smile" },
      { category: "Subscriptions", amount: 25.00, icon: "apple" }
    ],
    variable: [
      { category: "Groceries", budgeted: 150.00, icon: "shopping-cart" },
      { category: "Gas/Fuel", budgeted: 150.00, icon: "fuel" },
      { category: "Dining Out", budgeted: 100.00, icon: "utensils" },
      { category: "Personal Care", budgeted: 50.00, icon: "scissors" },
      { category: "Other/Flex", budgeted: 200.00, icon: "layers" }
    ],
    totalFixed: 1682.00,
    totalVariable: 650.00,
    dailyAllowance: 21.00,
    daysInMonth: 31
  },

  // ── Credit Cards ───────────────────────────────────────────
  creditCards: [
    {
      name: "Primary Card",
      issuer: "Bank A",
      apr: 20.00,
      installment: { amount: 50.00, item: "Electronics ($1,000)", endDate: "Dec 2027" },
      monthlyCharges: [
        { month: "Nov 2025", amount: 1100.00 },
        { month: "Dec 2025", amount: 1800.00 },
        { month: "Feb 2026", amount: 1800.00 }
      ],
      currentBalance: 0
    },
    {
      name: "Secondary Card",
      last4: "0000",
      creditLimit: 700,
      apr: 23.00,
      currentBalance: 0,
      febPurchases: 350.00,
      febPayments: 350.00
    }
  ],

  // ── Subscriptions ──────────────────────────────────────────
  subscriptions: [
    { name: "Streaming Service", amount: 15.99, budgeted: 20.00, status: "active" },
    { name: "Dental Insurance", amount: 7.00, status: "active" },
    { name: "Cloud Storage", amount: 2.99, status: "active" },
    { name: "Old Phone Plan", amount: 70.00, status: "cancelled", savings: 70.00 },
    { name: "Dating App", amount: 30.00, status: "cancelled", savings: 30.00 },
    { name: "Unused Subscription", amount: 25.00, status: "cancelled", savings: 25.00 }
  ],

  // ── Cancelled / Eliminated Costs ───────────────────────────
  cancelled: [
    { item: "Old Phone Plan", savings: 70.00 },
    { item: "Dating App", savings: 30.00 },
    { item: "Unused Subscription", savings: 25.00 },
    { item: "Online Shopping (self-ban)", savings: 300 },
    { item: "Auto Parts (none this month)", savings: 250 }
  ],
  totalMonthlySavings: 675,

  // ── Meal Plan ──────────────────────────────────────────────
  mealPlan: {
    name: "Grad Plan",
    cost: 150,
    totalSwipes: 20,
    diningDollars: 25.00,
    costPerSwipe: 6.25,
    note: "All-you-can-eat dining halls, funds never expire while enrolled"
  },

  // ── Spending Comparison ────────────────────────────────────
  monthlyComparison: [
    { month: "Nov 2025", total: 1100.00 },
    { month: "Dec 2025", total: 1800.00 },
    { month: "Feb 2026", total: 2500.00 },
    { month: "Mar 2026 (Budget)", total: 650.00 }
  ],

  // ── Lifestyle Tiers ────────────────────────────────────────
  lifestyleTiers: {
    tight: {
      label: "Tight (March)",
      total: 2200,
      breakdown: { fixed: 1682, groceries: 100, gas: 120, dining: 50, personal: 40, subs: 0, entertainment: 0, shopping: 0, savings: 0, emergency: 0, flex: 208 }
    },
    comfortable: {
      label: "Comfortable",
      total: 3400,
      breakdown: { fixed: 1682, groceries: 150, gas: 150, dining: 150, personal: 80, subs: 50, entertainment: 100, shopping: 100, savings: 500, emergency: 200, flex: 238 }
    },
    good: {
      label: "Good Life",
      total: 4500,
      breakdown: { fixed: 1682, groceries: 200, gas: 150, dining: 250, personal: 100, subs: 100, entertainment: 200, shopping: 200, savings: 1000, emergency: 300, flex: 318 }
    }
  },

  // ── Bank Account ───────────────────────────────────────────
  bankAccount: {
    name: "Checking Account",
    beginningBalance: 600.00,
    endingBalance: 350.00,
    totalDeposits: 5000.00,
    totalSubtractions: 5250.00
  },

  // ── Pending / Debt ─────────────────────────────────────────
  pendingDebt: {
    ccPending: 1500.00,
    ccBalance: 600.00,
    total: 2100.00
  },

  // ── April Outlook ──────────────────────────────────────────
  aprilOutlook: {
    debtFreed: 2100,
    monthlySavingsTarget: 1500,
    comfortableBudget: 4500,
    goodLifeBudget: 6000
  }
};

// ── LocalStorage persistence for transactions ────────────────
function loadTransactions() {
  const saved = localStorage.getItem("budget_transactions");
  return saved ? JSON.parse(saved) : [];
}

function saveTransactions(txns) {
  localStorage.setItem("budget_transactions", JSON.stringify(txns));
}

function loadMealPlanUsage() {
  const saved = localStorage.getItem("budget_mealplan");
  return saved ? JSON.parse(saved) : { swipesUsed: 0, diningDollarsUsed: 0 };
}

function saveMealPlanUsage(usage) {
  localStorage.setItem("budget_mealplan", JSON.stringify(usage));
}

// ── LocalStorage persistence for budget edits ────────────────
function loadBudgetOverrides() {
  const saved = localStorage.getItem("budget_overrides");
  return saved ? JSON.parse(saved) : { fixed: {}, variable: {} };
}

function saveBudgetOverrides(overrides) {
  localStorage.setItem("budget_overrides", JSON.stringify(overrides));
}

function getFixedAmount(index) {
  const overrides = loadBudgetOverrides();
  if (overrides.fixed[index] !== undefined) return overrides.fixed[index];
  return APP_DATA.march.fixed[index].amount;
}

function getVariableBudget(index) {
  const overrides = loadBudgetOverrides();
  if (overrides.variable[index] !== undefined) return overrides.variable[index];
  return APP_DATA.march.variable[index].budgeted;
}

// ── Migrate fixed-cost overrides (CC entries removed, indices shifted by -2) ──
function migrateFixedOverrides() {
  if (localStorage.getItem("budget_fixed_v2")) return;
  const overrides = loadBudgetOverrides();
  const newFixed = {};
  // Old indices 2-7 → new 0-5 (old 0,1 were CC entries, now deleted)
  for (let oldIdx = 2; oldIdx <= 7; oldIdx++) {
    if (overrides.fixed[oldIdx] !== undefined) {
      newFixed[oldIdx - 2] = overrides.fixed[oldIdx];
    }
  }
  overrides.fixed = newFixed;
  saveBudgetOverrides(overrides);
  localStorage.setItem("budget_fixed_v2", "1");
}

// Run migration before anything else
migrateFixedOverrides();

function recalcTotals() {
  let fixedTotal = 0;
  APP_DATA.march.fixed.forEach((_, i) => { fixedTotal += getFixedAmount(i); });
  APP_DATA.march.totalFixed = fixedTotal;

  let varTotal = 0;
  APP_DATA.march.variable.forEach((_, i) => { varTotal += getVariableBudget(i); });
  APP_DATA.march.totalVariable = varTotal;

  // Income stays fixed — it's independent of expenses
  // APP_DATA.march.income.total is NOT overwritten
  const daysLeft = APP_DATA.march.daysInMonth - new Date().getDate() + 1;
  APP_DATA.march.dailyAllowance = daysLeft > 0 ? varTotal / daysLeft : varTotal;
}

// ── LocalStorage persistence for custom income entries ──────────
function loadCustomIncome() {
  const saved = localStorage.getItem("budget_custom_income");
  const entries = saved ? JSON.parse(saved) : [];
  return entries.map((entry) => ({
    ...entry,
    date: entry.date || new Date().toISOString().split("T")[0],
    received: entry.received !== false
  }));
}

function saveCustomIncome(entries) {
  localStorage.setItem("budget_custom_income", JSON.stringify(entries));
}

// ── LocalStorage overrides for base income sources ──────────────
function loadIncomeOverrides() {
  const saved = localStorage.getItem("budget_income_overrides");
  const overrides = saved ? JSON.parse(saved) : {};
  const normalized = {};
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "number") {
      normalized[key] = { amount: value };
      return;
    }
    normalized[key] = value || {};
  });
  return normalized;
}

function saveIncomeOverrides(overrides) {
  localStorage.setItem("budget_income_overrides", JSON.stringify(overrides));
}

function getBaseIncomeAmount(index) {
  const overrides = loadIncomeOverrides();
  if (overrides[index] && overrides[index].amount !== undefined) return overrides[index].amount;
  return APP_DATA.march.income.sources[index].amount;
}

function getBaseIncomeName(index) {
  const overrides = loadIncomeOverrides();
  if (overrides[index] && overrides[index].name) return overrides[index].name;
  return APP_DATA.march.income.sources[index].name;
}

function isBaseIncomeReceived(index) {
  const overrides = loadIncomeOverrides();
  return overrides[index] ? overrides[index].received !== false : true;
}

function getAllMarchIncomeEntries() {
  const baseEntries = APP_DATA.march.income.sources.map((source, index) => ({
    id: `base-${index}`,
    kind: "base",
    name: getBaseIncomeName(index),
    amount: getBaseIncomeAmount(index),
    type: source.type,
    received: isBaseIncomeReceived(index),
    date: null
  }));

  const customEntries = loadCustomIncome().map((entry) => ({
    ...entry,
    kind: "custom",
    received: entry.received !== false
  }));

  return [...baseEntries, ...customEntries];
}

function getPlannedMarchIncome() {
  return getAllMarchIncomeEntries().reduce((sum, entry) => sum + entry.amount, 0);
}

function getPendingMarchIncome() {
  return getAllMarchIncomeEntries()
    .filter((entry) => !entry.received)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function getTotalMarchIncome() {
  return getAllMarchIncomeEntries()
    .filter((entry) => entry.received)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

// ── LocalStorage persistence for credit card balances ──────────
function loadCardBalances() {
  const saved = localStorage.getItem("budget_card_balances");
  return saved ? JSON.parse(saved) : {};
}

function saveCardBalances(balances) {
  localStorage.setItem("budget_card_balances", JSON.stringify(balances));
}

function getCardBalance(index) {
  const balances = loadCardBalances();
  if (balances[index] !== undefined) return balances[index];
  return APP_DATA.creditCards[index].currentBalance;
}

// ── LocalStorage persistence for CC payments ───────────────────
function loadCCPayments() {
  const saved = localStorage.getItem("budget_cc_payments");
  return saved ? JSON.parse(saved) : [];
}

function saveCCPayments(payments) {
  localStorage.setItem("budget_cc_payments", JSON.stringify(payments));
}
