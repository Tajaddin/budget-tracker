// ============================================================
// Budget App — Main Application Logic
// ============================================================

let transactions = loadTransactions();
let mealPlanUsage = loadMealPlanUsage();
recalcTotals(); // apply any saved budget overrides on load

// ── Utility ──────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const DISPLAY_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisplayDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : DISPLAY_DATE_FORMATTER.format(date);
}

function formatDisplayDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DISPLAY_DATETIME_FORMATTER.format(date);
}

function normalizeDateInput(value, fallback = new Date().toISOString().split("T")[0]) {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function getSpentByCategory(cat) {
  return transactions
    .filter((t) => t.category === cat)
    .reduce((sum, t) => sum + t.amount, 0);
}

function getTotalVariableSpent() {
  return APP_DATA.march.variable.reduce((sum, v) => sum + getSpentByCategory(v.category), 0);
}

function getDayOfMonth() {
  return new Date().getDate();
}

// Real available money = Income (base + custom) - Fixed Costs
function getAvailableToSpend() {
  return getTotalMarchIncome() - APP_DATA.march.totalFixed;
}

// Total CC debt from editable card balances
function getTotalCCDebt() {
  return APP_DATA.creditCards.reduce((sum, _, i) => sum + getCardBalance(i), 0);
}

// Total CC payments made this month (money that left the account)
function getTotalCCPayments() {
  return loadCCPayments().reduce((sum, p) => sum + p.amount, 0);
}

// Real remaining = Available - Spent - CC Payments
function getRealRemaining() {
  return getAvailableToSpend() - getTotalVariableSpent() - getTotalCCPayments();
}

// Net remaining after debt = Remaining - CC Debt
function getNetRemaining() {
  return getRealRemaining() - getTotalCCDebt();
}

function getDailyRemaining() {
  const remaining = getRealRemaining();
  const daysLeft = APP_DATA.march.daysInMonth - getDayOfMonth() + 1;
  return daysLeft > 0 ? remaining / daysLeft : remaining;
}

// ── Navigation ───────────────────────────────────────────────
$$(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    const page = item.dataset.page;
    $$(".nav-item").forEach((n) => n.classList.remove("active"));
    item.classList.add("active");
    $$(".page-section").forEach((s) => s.classList.remove("active"));
    $(`#page-${page}`).classList.add("active");
    $("#pageTitle").textContent = item.textContent.trim();
    // Close mobile sidebar
    $("#sidebar").classList.remove("open");
  });
});

function toggleSidebar() {
  $("#sidebar").classList.toggle("open");
}

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = "success") {
  const container = $("#toasts");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", type === "danger" ? "alert-triangle" : type === "warning" ? "alert-circle" : "check-circle");
  icon.setAttribute("style", "width:16px;height:16px;flex-shrink:0");
  const text = document.createTextNode(" " + message);
  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);
  lucide.createIcons({ attrs: { class: "" } });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = ".3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Modal ────────────────────────────────────────────────────
function openModal() {
  $("#modal").classList.add("open");
  $("#txnDate").value = new Date().toISOString().split("T")[0];
}

function closeModal() {
  $("#modal").classList.remove("open");
}

// Close modal on overlay click
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});

// ── Add Transaction ──────────────────────────────────────────
function addTransaction() {
  const category = $("#txnCategory").value;
  const merchant = $("#txnMerchant").value.trim();
  const amount = parseFloat($("#txnAmount").value);
  const date = $("#txnDate").value;

  if (!merchant || !amount || amount <= 0 || !date) {
    showToast("Please fill in all fields", "danger");
    return;
  }

  const txn = { id: Date.now(), category, merchant, amount, date };
  transactions.unshift(txn);
  saveTransactions(transactions);

  // Check spending alerts
  const budgetItem = APP_DATA.march.variable.find((v) => v.category === category);
  if (budgetItem) {
    const spent = getSpentByCategory(category);
    const pct = (spent / budgetItem.budgeted) * 100;
    if (pct >= 100) {
      showToast(`${category} budget EXCEEDED! ${fmt(spent)} / ${fmt(budgetItem.budgeted)}`, "danger");
    } else if (pct >= 90) {
      showToast(`${category} at ${Math.round(pct)}% — almost at limit!`, "danger");
    } else if (pct >= 75) {
      showToast(`${category} at ${Math.round(pct)}% — slow down`, "warning");
    } else {
      showToast(`Added ${fmt(amount)} to ${category}`, "success");
    }
  } else {
    showToast(`Added ${fmt(amount)} to ${category}`, "success");
  }

  // Reset form
  $("#txnMerchant").value = "";
  $("#txnAmount").value = "";
  closeModal();
  renderAll();
}

// ── Delete Transaction ───────────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions(transactions);
  showToast("Transaction removed", "success");
  renderAll();
}

// ── Meal Plan ────────────────────────────────────────────────
function useSwipe() {
  if (mealPlanUsage.swipesUsed >= 20) {
    showToast("No swipes remaining!", "danger");
    return;
  }
  mealPlanUsage.swipesUsed++;
  saveMealPlanUsage(mealPlanUsage);
  renderMealPlan();
  showToast(`Swipe used! ${20 - mealPlanUsage.swipesUsed} remaining`);
}

function undoSwipe() {
  if (mealPlanUsage.swipesUsed <= 0) return;
  mealPlanUsage.swipesUsed--;
  saveMealPlanUsage(mealPlanUsage);
  renderMealPlan();
}

function useDiningDollars() {
  const input = $("#diningDollarInput");
  const amount = parseFloat(input.value);
  if (!amount || amount <= 0) return;

  const remaining = APP_DATA.mealPlan.diningDollars - mealPlanUsage.diningDollarsUsed;
  if (amount > remaining) {
    showToast("Not enough dining dollars!", "danger");
    return;
  }

  mealPlanUsage.diningDollarsUsed += amount;
  saveMealPlanUsage(mealPlanUsage);
  input.value = "";
  renderMealPlan();
  showToast(`Spent ${fmt(amount)} in dining dollars`);
}

// ── Render: Summary Cards ────────────────────────────────────
function renderSummaryCards() {
  const spent = getTotalVariableSpent();
  const available = getAvailableToSpend();
  const remaining = getRealRemaining();
  const debt = getTotalCCDebt();

  const income = getTotalMarchIncome();
  const pendingIncome = getPendingMarchIncome();
  const incomeSub = pendingIncome > 0 ? `${fmt(getPlannedMarchIncome())} planned • ${fmt(pendingIncome)} not yet` : "March 2026";

  let html = `
    <div class="summary-card accent">
      <div class="summary-card-label"><i data-lucide="trending-up"></i> Income</div>
      <div class="summary-card-value">${fmt(income)}</div>
      <div class="summary-card-sub">${incomeSub}</div>
    </div>
    <div class="summary-card red">
      <div class="summary-card-label"><i data-lucide="lock"></i> Fixed Costs</div>
      <div class="summary-card-value">${fmt(APP_DATA.march.totalFixed)}</div>
      <div class="summary-card-sub">Bills & obligations</div>
    </div>
    <div class="summary-card amber">
      <div class="summary-card-label"><i data-lucide="shopping-bag"></i> Spent</div>
      <div class="summary-card-value">${fmt(spent)}</div>
      <div class="summary-card-sub">of ${fmt(available)} available</div>
    </div>`;

  if (debt > 0) {
    const afterDebt = remaining - debt;
    html += `
    <div class="summary-card red">
      <div class="summary-card-label"><i data-lucide="credit-card"></i> CC Debt</div>
      <div class="summary-card-value">${fmt(debt)}</div>
      <div class="summary-card-sub" style="color:${afterDebt >= 0 ? 'var(--green)' : 'var(--red)'}">After debt: ${fmt(afterDebt)}</div>
    </div>`;
  }

  html += `
    <div class="summary-card green">
      <div class="summary-card-label"><i data-lucide="piggy-bank"></i> Remaining</div>
      <div class="summary-card-value">${fmt(remaining)}</div>
      <div class="summary-card-sub">Income − Fixed − Spent</div>
    </div>`;

  $("#summaryCards").innerHTML = html;
}

// ── Render: Daily Widget ─────────────────────────────────────
function renderDailyWidget() {
  const spent = getTotalVariableSpent();
  const available = getAvailableToSpend();
  const remaining = getRealRemaining();
  const daily = getDailyRemaining();
  const dayNum = getDayOfMonth();
  const pct = Math.round((dayNum / APP_DATA.march.daysInMonth) * 100);
  const budgetPct = available > 0 ? Math.min(100, Math.round((spent / available) * 100)) : 0;

  const circumference = 2 * Math.PI * 36;
  const offset = circumference * (1 - pct / 100);

  const color = daily >= 15 ? "var(--accent)" : daily >= 8 ? "var(--amber)" : "var(--red)";

  $("#dailyWidget").innerHTML = `
    <div class="daily-left">
      <h3>Today's Spending Allowance</h3>
      <div class="daily-amount" style="color:${color}">${fmt(daily)}</div>
      <div class="daily-sub">Day ${dayNum} of ${APP_DATA.march.daysInMonth} &middot; ${fmt(remaining)} remaining</div>
    </div>
    <div class="daily-ring">
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border)" stroke-width="5" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="${color}" stroke-width="5"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                stroke-linecap="round" />
      </svg>
      <div class="daily-ring-text">
        <strong>${budgetPct}%</strong>
        spent
      </div>
    </div>
  `;
}

// ── Render: Variable Budget Progress ─────────────────────────
function renderVariableBudget(containerId = "variableBudget") {
  const container = $(`#${containerId}`);
  const iconMap = {
    "Groceries": "shopping-cart",
    "Gas/Fuel": "fuel",
    "Dining Out": "utensils",
    "Personal Care": "scissors",
    "Other/Flex": "layers"
  };
  const bgColors = ["#00d4aa22", "#3b82f622", "#f59e0b22", "#a855f722", "#6366f122"];

  container.innerHTML = APP_DATA.march.variable
    .map((v, i) => {
      const budgeted = getVariableBudget(i);
      const spent = getSpentByCategory(v.category);
      const pct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
      const color = pct >= 90 ? "red" : pct >= 70 ? "amber" : "green";
      return `
        <div class="budget-row">
          <div class="budget-icon" style="background:${bgColors[i]}">
            <i data-lucide="${iconMap[v.category] || "circle"}" style="width:18px;height:18px;color:var(--accent)"></i>
          </div>
          <div class="budget-info">
            <div class="budget-info-top">
              <span class="budget-name">${v.category}</span>
              <span class="budget-amounts"><span>${fmt(spent)}</span> / ${fmt(budgeted)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${color}" style="width:${pct}%"></div>
            </div>
          </div>
          <button class="btn-edit" onclick="editVariable(${i})" title="Edit budget">
            <i data-lucide="pencil" style="width:14px;height:14px"></i>
          </button>
        </div>`;
    })
    .join("");
}

// ── Edit Variable Budget ─────────────────────────────────────
function editVariable(index) {
  const v = APP_DATA.march.variable[index];
  const current = getVariableBudget(index);
  const newVal = prompt(`Edit budget for "${v.category}"\nCurrent: $${current.toFixed(2)}`, current.toFixed(2));
  if (newVal === null) return;
  const parsed = parseFloat(newVal);
  if (isNaN(parsed) || parsed < 0) { showToast("Invalid amount", "danger"); return; }
  const overrides = loadBudgetOverrides();
  overrides.variable[index] = parsed;
  saveBudgetOverrides(overrides);
  recalcTotals();
  renderAll();
  showToast(`${v.category} budget updated to ${fmt(parsed)}`, "success");
}

// ── Render: Fixed Costs ──────────────────────────────────────
function renderFixedCosts(containerId = "fixedCosts") {
  const container = $(`#${containerId}`);
  container.innerHTML = APP_DATA.march.fixed
    .map(
      (f, i) => {
        const amount = getFixedAmount(i);
        return `
        <div class="fixed-row">
          <div class="fixed-left">
            <div class="fixed-icon"><i data-lucide="${f.icon}" style="width:16px;height:16px;color:var(--accent)"></i></div>
            <span class="fixed-name">${f.category}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="fixed-amount">${fmt(amount)}</span>
            <button class="btn-edit" onclick="editFixed(${i})" title="Edit amount">
              <i data-lucide="pencil" style="width:14px;height:14px"></i>
            </button>
          </div>
        </div>`;
      }
    )
    .join("");
}

// ── Edit Fixed Cost ──────────────────────────────────────────
function editFixed(index) {
  const f = APP_DATA.march.fixed[index];
  const current = getFixedAmount(index);
  const newVal = prompt(`Edit "${f.category}"\nCurrent: $${current.toFixed(2)}`, current.toFixed(2));
  if (newVal === null) return;
  const parsed = parseFloat(newVal);
  if (isNaN(parsed) || parsed < 0) { showToast("Invalid amount", "danger"); return; }
  const overrides = loadBudgetOverrides();
  overrides.fixed[index] = parsed;
  saveBudgetOverrides(overrides);
  recalcTotals();
  renderAll();
  showToast(`${f.category} updated to ${fmt(parsed)}`, "success");
}

// ── Add Income ──────────────────────────────────────────────
function addIncome() {
  const name = prompt("Income source name:");
  if (!name || !name.trim()) return;
  const amtStr = prompt(`Amount for "${name.trim()}":`);
  if (amtStr === null) return;
  const amount = parseFloat(amtStr);
  if (isNaN(amount) || amount <= 0) { showToast("Invalid amount", "danger"); return; }
  const date = normalizeDateInput(prompt(`Date for "${name.trim()}" (YYYY-MM-DD):`, new Date().toISOString().split("T")[0]));

  const entries = loadCustomIncome();
  entries.unshift({ id: Date.now(), name: name.trim(), amount, date, received: true });
  saveCustomIncome(entries);
  renderAll();
  showToast(`Added ${fmt(amount)} income from ${name.trim()}`, "success");
}

function updateBaseIncomeOverride(index, patch) {
  const overrides = loadIncomeOverrides();
  const current = overrides[index] || {};
  const defaults = APP_DATA.march.income.sources[index];
  const next = { ...current, ...patch };

  if (!next.name || next.name === defaults.name) delete next.name;
  if (next.amount === undefined || next.amount === defaults.amount) delete next.amount;
  if (next.received === undefined || next.received === true) delete next.received;

  if (Object.keys(next).length === 0) delete overrides[index];
  else overrides[index] = next;

  saveIncomeOverrides(overrides);
}

function editBaseIncome(index) {
  const currentName = getBaseIncomeName(index);
  const currentAmount = getBaseIncomeAmount(index);
  const newName = prompt("Income source name:", currentName);
  if (newName === null) return;
  const newVal = prompt(`Amount for "${(newName.trim() || currentName)}":`, currentAmount.toFixed(2));
  if (newVal === null) return;
  const parsed = parseFloat(newVal);
  if (isNaN(parsed) || parsed < 0) { showToast("Invalid amount", "danger"); return; }
  updateBaseIncomeOverride(index, {
    name: newName.trim() || currentName,
    amount: parsed
  });
  renderAll();
  showToast(`${newName.trim() || currentName} updated to ${fmt(parsed)}`, "success");
}

function toggleBaseIncomeReceived(index) {
  const nextState = !isBaseIncomeReceived(index);
  updateBaseIncomeOverride(index, { received: nextState });
  renderAll();
  showToast(nextState ? "Income is counted again" : "Income marked as not yet", nextState ? "success" : "warning");
}

function editCustomIncome(id) {
  const entries = loadCustomIncome();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  const newName = prompt("Income source name:", entry.name);
  if (newName === null) return;
  const newAmt = prompt(`Amount for "${newName.trim() || entry.name}":`, entry.amount.toFixed(2));
  if (newAmt === null) return;
  const parsed = parseFloat(newAmt);
  if (isNaN(parsed) || parsed <= 0) { showToast("Invalid amount", "danger"); return; }
  const newDate = normalizeDateInput(prompt(`Date for "${newName.trim() || entry.name}" (YYYY-MM-DD):`, entry.date || new Date().toISOString().split("T")[0]), entry.date || new Date().toISOString().split("T")[0]);
  entry.name = newName.trim() || entry.name;
  entry.amount = parsed;
  entry.date = newDate;
  saveCustomIncome(entries);
  renderAll();
  showToast(`Updated to ${fmt(parsed)} from ${entry.name}`, "success");
}

function toggleCustomIncomeReceived(id) {
  const entries = loadCustomIncome();
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  entry.received = entry.received === false;
  saveCustomIncome(entries);
  renderAll();
  showToast(entry.received ? "Income is counted again" : "Income marked as not yet", entry.received ? "success" : "warning");
}

function deleteIncome(id) {
  const entries = loadCustomIncome().filter((e) => e.id !== id);
  saveCustomIncome(entries);
  renderAll();
  showToast("Income entry removed", "success");
}

function renderIncomeRow(entry, actions) {
  const toggleClass = entry.received ? "received" : "pending";
  const toggleLabel = entry.received ? "Not Yet" : "Count It";
  const toggleIcon = entry.received ? "clock-3" : "check-circle";

  return `
    <div class="fixed-row income-row ${entry.received ? "" : "pending"}">
      <div class="fixed-left">
        <div class="fixed-icon"><i data-lucide="${entry.kind === "base" ? "dollar-sign" : "plus-circle"}" style="width:16px;height:16px;color:${entry.kind === "base" ? "var(--accent)" : "var(--green)"}"></i></div>
        <div class="income-name-block">
          <div class="fixed-name">${escapeHtml(entry.name)}</div>
          <div class="income-meta">${escapeHtml(entry.date ? `${formatDisplayDate(entry.date)} • ${entry.received ? "Counted in March" : "Pending"}` : entry.received ? "Counted in March" : "Pending - not counted yet")}</div>
        </div>
      </div>
      <div class="income-actions">
        <button class="income-toggle-btn ${toggleClass}" onclick="${actions.toggle}" title="Toggle whether this income counts now">
          <i data-lucide="${toggleIcon}"></i> ${toggleLabel}
        </button>
        <span class="fixed-amount income-amount ${entry.received ? "" : "pending"}">${fmt(entry.amount)}</span>
        <button class="btn-edit" onclick="${actions.edit}" title="Edit income">
          <i data-lucide="pencil" style="width:14px;height:14px"></i>
        </button>
        ${actions.remove ? `<button class="btn-edit" onclick="${actions.remove}" title="Remove income" style="color:var(--red)"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>` : ""}
      </div>
    </div>`;
}

// ── Render: Income Sources ───────────────────────────────────
function renderIncome() {
  const marchEntries = getAllMarchIncomeEntries();
  const receivedTotal = getTotalMarchIncome();
  const plannedTotal = getPlannedMarchIncome();
  const pendingTotal = getPendingMarchIncome();
  const receivedCount = marchEntries.filter((entry) => entry.received).length;
  const pendingCount = marchEntries.length - receivedCount;

  $("#incomeSummary").innerHTML = `
    <div class="summary-card green">
      <div class="summary-card-label"><i data-lucide="wallet"></i> Received</div>
      <div class="summary-card-value">${fmt(receivedTotal)}</div>
      <div class="summary-card-sub">${receivedCount} source${receivedCount === 1 ? "" : "s"} counted</div>
    </div>
    <div class="summary-card amber">
      <div class="summary-card-label"><i data-lucide="clock-3"></i> Not Yet</div>
      <div class="summary-card-value">${fmt(pendingTotal)}</div>
      <div class="summary-card-sub">${pendingCount} pending source${pendingCount === 1 ? "" : "s"}</div>
    </div>
    <div class="summary-card accent">
      <div class="summary-card-label"><i data-lucide="trending-up"></i> Planned</div>
      <div class="summary-card-value">${fmt(plannedTotal)}</div>
    </div>
    <div class="summary-card blue">
      <div class="summary-card-label"><i data-lucide="trending-up"></i> Feb Income</div>
      <div class="summary-card-value">${fmt(APP_DATA.february.income.total)}</div>
    </div>`;

  const baseRows = APP_DATA.march.income.sources
    .map((_, index) => renderIncomeRow(
      getAllMarchIncomeEntries().find((entry) => entry.id === `base-${index}`),
      {
        toggle: `toggleBaseIncomeReceived(${index})`,
        edit: `editBaseIncome(${index})`
      }
    ))
    .join("");

  const customRows = loadCustomIncome()
    .map((entry) => renderIncomeRow(
      {
        ...entry,
        kind: "custom",
        received: entry.received !== false
      },
      {
        toggle: `toggleCustomIncomeReceived(${entry.id})`,
        edit: `editCustomIncome(${entry.id})`,
        remove: `deleteIncome(${entry.id})`
      }
    ))
    .join("");

  $("#marchIncome").innerHTML = baseRows + customRows;

  $("#febIncome").innerHTML = APP_DATA.february.income.sources
    .map((s) => `
      <div class="fixed-row">
        <div class="fixed-left">
          <div class="fixed-icon"><i data-lucide="dollar-sign" style="width:16px;height:16px;color:var(--accent)"></i></div>
          <span class="fixed-name">${escapeHtml(s.name)}</span>
        </div>
        <span class="fixed-amount" style="color:var(--green)">${fmt(s.amount)}</span>
      </div>`)
    .join("");
}

function buildExportSection(icon, title, body, includeIcons = true) {
  return `
    <section class="export-section">
      <div class="export-section-title">${includeIcons ? `<i data-lucide="${icon}"></i>` : ""}${escapeHtml(title)}</div>
      ${body}
    </section>`;
}

function buildExportRows(items, emptyMessage, mapper) {
  if (!items.length) return `<div class="export-empty">${escapeHtml(emptyMessage)}</div>`;
  return `<div class="export-list">${items.map(mapper).join("")}</div>`;
}

function buildExportRow(label, meta, value, valueClass = "") {
  return `
    <div class="export-row">
      <div class="export-row-main">
        <div class="export-row-label">${escapeHtml(label)}</div>
        ${meta ? `<div class="export-row-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
      <div class="export-row-value ${valueClass}">${value}</div>
    </div>`;
}

function buildExportData() {
  const incomeEntries = getAllMarchIncomeEntries();
  const fixedCosts = APP_DATA.march.fixed.map((item, index) => ({
    category: item.category,
    amount: getFixedAmount(index),
    icon: item.icon
  }));
  const variableBudget = APP_DATA.march.variable.map((item, index) => {
    const budgeted = getVariableBudget(index);
    const spent = getSpentByCategory(item.category);
    return {
      category: item.category,
      budgeted,
      spent,
      remaining: budgeted - spent,
      icon: item.icon
    };
  });
  const ccPayments = loadCCPayments();
  const cardBalances = loadCardBalances();
  const liveCards = APP_DATA.creditCards.map((card, index) => ({
    ...card,
    currentBalance: getCardBalance(index)
  }));
  const generatedAt = new Date().toISOString();

  return {
    meta: {
      generatedAt,
      generatedFor: APP_DATA.user.name,
      month: "March 2026"
    },
    report: {
      user: APP_DATA.user,
      overview: {
        receivedIncome: getTotalMarchIncome(),
        plannedIncome: getPlannedMarchIncome(),
        pendingIncome: getPendingMarchIncome(),
        fixedTotal: APP_DATA.march.totalFixed,
        variableBudgetTotal: APP_DATA.march.totalVariable,
        variableSpent: getTotalVariableSpent(),
        remaining: getRealRemaining(),
        ccDebt: getTotalCCDebt()
      },
      march: {
        incomeEntries,
        fixedCosts,
        variableBudget,
        transactions: [...transactions],
        creditCards: liveCards,
        ccPayments,
        subscriptions: APP_DATA.subscriptions.map((sub) => ({ ...sub })),
        mealPlan: {
          ...APP_DATA.mealPlan,
          swipesUsed: mealPlanUsage.swipesUsed,
          swipesRemaining: APP_DATA.mealPlan.totalSwipes - mealPlanUsage.swipesUsed,
          diningDollarsUsed: mealPlanUsage.diningDollarsUsed,
          diningDollarsRemaining: APP_DATA.mealPlan.diningDollars - mealPlanUsage.diningDollarsUsed
        }
      },
      reference: {
        february: {
          income: APP_DATA.february.income,
          spending: APP_DATA.february.spending,
          zelleSent: APP_DATA.february.zelleSent
        },
        cancelled: APP_DATA.cancelled,
        monthlyComparison: APP_DATA.monthlyComparison,
        lifestyleTiers: APP_DATA.lifestyleTiers,
        aprilOutlook: APP_DATA.aprilOutlook,
        bankAccount: APP_DATA.bankAccount,
        pendingDebt: APP_DATA.pendingDebt
      }
    },
    raw: {
      appData: APP_DATA,
      storage: {
        transactions: [...transactions],
        mealPlanUsage,
        budgetOverrides: loadBudgetOverrides(),
        incomeOverrides: loadIncomeOverrides(),
        customIncome: loadCustomIncome(),
        cardBalances,
        ccPayments
      }
    }
  };
}

function buildExportReportMarkup(snapshot, options = {}) {
  const includeIcons = options.includeIcons !== false;
  const { meta, report } = snapshot;
  const incomeRows = buildExportRows(report.march.incomeEntries, "No income entries saved.", (entry) => buildExportRow(
    entry.name,
    entry.date ? `${formatDisplayDate(entry.date)} • ${entry.received ? "counted now" : "pending"}` : (entry.received ? "counted now" : "pending"),
    `${fmt(entry.amount)}${includeIcons ? "" : ` <span class="export-pill ${entry.received ? "received" : "pending"}">${entry.received ? "Received" : "Not Yet"}</span>`}`,
    entry.received ? "" : "pending"
  ));
  const fixedRows = buildExportRows(report.march.fixedCosts, "No fixed costs saved.", (item) => buildExportRow(item.category, "Current monthly fixed cost", fmt(item.amount)));
  const variableRows = buildExportRows(report.march.variableBudget, "No variable budget saved.", (item) => buildExportRow(
    item.category,
    `${fmt(item.spent)} spent of ${fmt(item.budgeted)}`,
    fmt(item.remaining)
  ));
  const txnRows = buildExportRows(report.march.transactions, "No transactions recorded yet.", (txn) => buildExportRow(
    txn.merchant,
    `${txn.category} • ${formatDisplayDate(txn.date)}`,
    `-${fmt(txn.amount)}`
  ));
  const cardRows = buildExportRows(report.march.creditCards, "No credit cards saved.", (card) => buildExportRow(
    card.name,
    `${card.issuer || "Bank"} • APR ${card.apr}%`,
    fmt(card.currentBalance)
  ));
  const paymentRows = buildExportRows(report.march.ccPayments, "No card payments recorded yet.", (payment) => buildExportRow(
    payment.cardName || "Card payment",
    payment.date ? formatDisplayDate(payment.date) : "Payment log",
    `-${fmt(payment.amount)}`
  ));
  const subscriptionRows = buildExportRows(report.march.subscriptions, "No subscriptions saved.", (sub) => buildExportRow(
    sub.name,
    sub.status === "cancelled" && sub.savings ? `Cancelled • saves ${fmt(sub.savings)}` : `${sub.status} subscription`,
    fmt(sub.amount)
  ));
  const mealPlanRows = `
    <div class="export-list">
      ${buildExportRow(report.march.mealPlan.name, "Semester plan", fmt(report.march.mealPlan.cost))}
      ${buildExportRow("Meal swipes", `${report.march.mealPlan.swipesUsed} used • ${report.march.mealPlan.swipesRemaining} remaining`, `${report.march.mealPlan.totalSwipes} total`)}
      ${buildExportRow("Dining dollars", `${fmt(report.march.mealPlan.diningDollarsRemaining)} remaining`, fmt(report.march.mealPlan.diningDollars))}
    </div>`;
  const febIncomeRows = buildExportRows(report.reference.february.income.sources, "No February income sources saved.", (item) => buildExportRow(item.name, "February source", fmt(item.amount)));
  const febSpendingRows = buildExportRows(report.reference.february.spending.categories, "No February categories saved.", (item) => buildExportRow(item.name, "February spend", fmt(item.amount)));
  const febZelleRows = buildExportRows(report.reference.february.zelleSent.transfers, "No February Zelle transfers saved.", (item) => buildExportRow(item.recipient, "Sent in February", fmt(item.amount)));
  const savingsRows = buildExportRows(report.reference.cancelled, "No cancelled items saved.", (item) => buildExportRow(item.item, "Monthly savings", fmt(item.savings)));
  const comparisonRows = buildExportRows(report.reference.monthlyComparison, "No comparison data saved.", (item) => buildExportRow(item.month, "Monthly comparison", fmt(item.total)));
  const tierRows = buildExportRows(Object.values(report.reference.lifestyleTiers), "No lifestyle tiers saved.", (tier) => buildExportRow(
    tier.label,
    Object.entries(tier.breakdown).map(([key, amount]) => `${key}: ${fmt(amount)}`).join(" • "),
    fmt(tier.total)
  ));

  return `
    <div class="export-report">
      <div class="export-report-header">
        <div>
          <div class="export-report-title">Budget Export Snapshot</div>
          <div class="export-report-meta">${escapeHtml(report.user.name)} • ${escapeHtml(report.user.location)} • Generated ${escapeHtml(formatDisplayDateTime(meta.generatedAt))}</div>
        </div>
        <div class="export-report-meta">${escapeHtml(meta.month)} live snapshot<br/>PDF for reading, JSON for backup/restore</div>
      </div>

      <div class="export-report-stats">
        <div class="export-stat">
          <div class="export-stat-label">Received</div>
          <div class="export-stat-value">${fmt(report.overview.receivedIncome)}</div>
        </div>
        <div class="export-stat">
          <div class="export-stat-label">Not Yet</div>
          <div class="export-stat-value">${fmt(report.overview.pendingIncome)}</div>
        </div>
        <div class="export-stat">
          <div class="export-stat-label">Spent</div>
          <div class="export-stat-value">${fmt(report.overview.variableSpent)}</div>
        </div>
        <div class="export-stat">
          <div class="export-stat-label">Debt</div>
          <div class="export-stat-value">${fmt(report.overview.ccDebt)}</div>
        </div>
      </div>

      <div class="export-sections">
        <div class="export-grid">
          ${buildExportSection("wallet", "March Income", incomeRows, includeIcons)}
          ${buildExportSection("receipt", "March Budget", `${fixedRows}<div class="export-note" style="margin:14px 0 8px">Variable budget snapshot</div>${variableRows}`, includeIcons)}
        </div>
        <div class="export-grid">
          ${buildExportSection("list", "Transactions", txnRows, includeIcons)}
          ${buildExportSection("credit-card", "Cards and Payments", `${cardRows}<div class="export-note" style="margin:14px 0 8px">Payment history saved in this browser</div>${paymentRows}`, includeIcons)}
        </div>
        <div class="export-grid">
          ${buildExportSection("repeat", "Subscriptions and Savings", `${subscriptionRows}<div class="export-note" style="margin:14px 0 8px">Cancelled or removed costs</div>${savingsRows}`, includeIcons)}
          ${buildExportSection("utensils-crossed", "Meal Plan", mealPlanRows, includeIcons)}
        </div>
        <div class="export-grid">
          ${buildExportSection("archive", "February Reference", `${febIncomeRows}<div class="export-note" style="margin:14px 0 8px">Spending categories</div>${febSpendingRows}<div class="export-note" style="margin:14px 0 8px">Zelle transfers sent</div>${febZelleRows}`, includeIcons)}
          ${buildExportSection("line-chart", "Planning Snapshot", `${comparisonRows}<div class="export-note" style="margin:14px 0 8px">Lifestyle tiers</div>${tierRows}<div class="export-note" style="margin-top:14px">April outlook: debt freed ${fmt(report.reference.aprilOutlook.debtFreed)}, monthly savings target ${fmt(report.reference.aprilOutlook.monthlySavingsTarget)}, comfortable budget ${fmt(report.reference.aprilOutlook.comfortableBudget)}.</div>`, includeIcons)}
        </div>
      </div>
    </div>`;
}

function getExportPrintStyles() {
  return `
    :root {
      --bg: #ffffff;
      --surface: #f7f8fb;
      --border: #d9deea;
      --text: #1f2430;
      --muted: #5c667a;
      --green: #15803d;
      --amber: #b45309;
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
    }
    .export-report {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .export-report-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .export-report-title {
      font-size: 24px;
      font-weight: 700;
    }
    .export-report-meta,
    .export-note,
    .export-empty,
    .export-row-meta {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
    }
    .export-report-stats,
    .export-grid {
      display: grid;
      gap: 12px;
    }
    .export-report-stats {
      grid-template-columns: repeat(4, 1fr);
      margin-bottom: 18px;
    }
    .export-grid {
      grid-template-columns: 1fr 1fr;
      margin-bottom: 16px;
    }
    .export-section,
    .export-stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      break-inside: avoid;
    }
    .export-section-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .export-stat-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .export-stat-value {
      font-size: 18px;
      font-weight: 700;
    }
    .export-list {
      display: grid;
      gap: 8px;
    }
    .export-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .export-row:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }
    .export-row-label,
    .export-row-value {
      font-size: 13px;
      font-weight: 600;
    }
    .export-row-value.pending { color: var(--amber); }
    .export-pill {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      vertical-align: middle;
    }
    .export-pill.received {
      color: var(--green);
      background: #dcfce7;
    }
    .export-pill.pending {
      color: var(--amber);
      background: #fef3c7;
    }
    @media print {
      body { padding: 0; }
      .export-report { border: none; padding: 0; }
    }
  `;
}

function renderExport() {
  const snapshot = buildExportData();
  $("#exportSummary").innerHTML = `
    <div class="summary-card accent">
      <div class="summary-card-label"><i data-lucide="wallet"></i> Received Income</div>
      <div class="summary-card-value">${fmt(snapshot.report.overview.receivedIncome)}</div>
      <div class="summary-card-sub">What counts right now</div>
    </div>
    <div class="summary-card amber">
      <div class="summary-card-label"><i data-lucide="clock-3"></i> Not Yet</div>
      <div class="summary-card-value">${fmt(snapshot.report.overview.pendingIncome)}</div>
      <div class="summary-card-sub">Saved but excluded from totals</div>
    </div>
    <div class="summary-card blue">
      <div class="summary-card-label"><i data-lucide="list"></i> Transactions</div>
      <div class="summary-card-value">${snapshot.report.march.transactions.length}</div>
      <div class="summary-card-sub">Current browser history</div>
    </div>
    <div class="summary-card red">
      <div class="summary-card-label"><i data-lucide="credit-card"></i> Card Debt</div>
      <div class="summary-card-value">${fmt(snapshot.report.overview.ccDebt)}</div>
      <div class="summary-card-sub">Live balances included in export</div>
    </div>`;

  $("#exportPreview").innerHTML = buildExportReportMarkup(snapshot);
}

function downloadJsonExport() {
  const snapshot = buildExportData();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `budget-export-${snapshot.meta.generatedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("JSON export downloaded", "success");
}

function exportDataPdf() {
  const snapshot = buildExportData();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Popup blocked. Allow popups to export PDF.", "danger");
    return;
  }

  const title = `budget-export-${snapshot.meta.generatedAt.slice(0, 10)}`;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>${getExportPrintStyles()}</style>
    </head>
    <body>
      ${buildExportReportMarkup(snapshot, { includeIcons: false })}
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.print();
          }, 150);
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  showToast("Print dialog opened. Choose Save as PDF.", "success");
}

// ── Render: Expense Summary ──────────────────────────────────
function renderExpenseSummary() {
  const spent = getTotalVariableSpent();
  const income = getTotalMarchIncome();
  const available = getAvailableToSpend();
  const remaining = getRealRemaining();
  $("#expenseSummary").innerHTML = `
    <div class="summary-card red">
      <div class="summary-card-label"><i data-lucide="lock"></i> Fixed</div>
      <div class="summary-card-value">${fmt(APP_DATA.march.totalFixed)}</div>
    </div>
    <div class="summary-card accent">
      <div class="summary-card-label"><i data-lucide="wallet"></i> Available</div>
      <div class="summary-card-value">${fmt(available)}</div>
      <div class="summary-card-sub">${fmt(income)} income − fixed</div>
    </div>
    <div class="summary-card amber">
      <div class="summary-card-label"><i data-lucide="shopping-bag"></i> Spent</div>
      <div class="summary-card-value">${fmt(spent)}</div>
    </div>
    <div class="summary-card green">
      <div class="summary-card-label"><i data-lucide="piggy-bank"></i> Remaining</div>
      <div class="summary-card-value">${fmt(remaining)}</div>
      <div class="summary-card-sub">${fmt(getDailyRemaining())}/day</div>
    </div>`;
}

// ── Render: Transactions ─────────────────────────────────────
function renderTransactions() {
  const list = $("#transactionList");
  if (transactions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox" style="width:40px;height:40px"></i>
        <p>No transactions yet. Click "Add Expense" to start tracking.</p>
      </div>`;
    return;
  }

  const iconMap = {
    "Groceries": "shopping-cart",
    "Gas/Fuel": "fuel",
    "Dining Out": "utensils",
    "Personal Care": "scissors",
    "Other/Flex": "layers"
  };

  list.innerHTML = transactions
    .map(
      (t) => `
      <div class="txn-row">
        <div class="txn-left">
          <div class="txn-icon"><i data-lucide="${iconMap[t.category] || "circle"}" style="width:16px;height:16px;color:var(--accent)"></i></div>
          <div>
            <div class="txn-merchant">${escapeHtml(t.merchant)}</div>
            <div class="txn-category">${escapeHtml(t.category)}</div>
          </div>
        </div>
        <div class="txn-right" style="display:flex;align-items:center;gap:10px">
          <div>
            <div class="txn-amount">-${fmt(t.amount)}</div>
            <div class="txn-date">${t.date}</div>
          </div>
          <button onclick="deleteTransaction(${t.id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px" title="Delete">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </div>
      </div>`
    )
    .join("");
}

// ── Render: Merchant List ────────────────────────────────────
function renderMerchants() {
  const sorted = [...APP_DATA.february.spending.merchants].sort((a, b) => b.amount - a.amount).slice(0, 15);
  $("#merchantList").innerHTML = sorted
    .map(
      (m) => `
      <div class="merchant-row">
        <span class="merchant-name">${m.name}</span>
        <span class="merchant-visits">${m.visits} visit${m.visits > 1 ? "s" : ""}</span>
        <span class="merchant-amount">${fmt(m.amount)}</span>
      </div>`
    )
    .join("");
}

// ── Edit Credit Card Balance ────────────────────────────────
function editCardBalance(index) {
  const card = APP_DATA.creditCards[index];
  const current = getCardBalance(index);
  const newVal = prompt(`Edit balance for "${card.name}"\nCurrent: $${current.toFixed(2)}`, current.toFixed(2));
  if (newVal === null) return;
  const parsed = parseFloat(newVal);
  if (isNaN(parsed) || parsed < 0) { showToast("Invalid amount", "danger"); return; }
  const balances = loadCardBalances();
  balances[index] = parsed;
  saveCardBalances(balances);
  renderAll();
  showToast(`${card.name} balance updated to ${fmt(parsed)}`, "success");
}

// ── Pay Credit Card ─────────────────────────────────────────
function payCardBalance(index) {
  const card = APP_DATA.creditCards[index];
  const current = getCardBalance(index);
  if (current <= 0) { showToast("No balance to pay", "warning"); return; }
  const payment = prompt(`Pay "${card.name}"\nCurrent balance: $${current.toFixed(2)}\n\nEnter payment amount:`, current.toFixed(2));
  if (payment === null) return;
  const parsed = parseFloat(payment);
  if (isNaN(parsed) || parsed <= 0) { showToast("Invalid amount", "danger"); return; }
  if (parsed > current) { showToast("Payment exceeds balance", "danger"); return; }

  // Reduce card balance
  const newBalance = Math.round((current - parsed) * 100) / 100;
  const balances = loadCardBalances();
  balances[index] = newBalance;
  saveCardBalances(balances);

  // Record the payment (deducts from budget)
  const payments = loadCCPayments();
  payments.unshift({
    id: Date.now(),
    cardIndex: index,
    cardName: card.name,
    amount: parsed,
    date: new Date().toISOString().split("T")[0]
  });
  saveCCPayments(payments);

  renderAll();
  if (newBalance === 0) {
    showToast(`${card.name} paid off! 🎉`, "success");
  } else {
    showToast(`Paid ${fmt(parsed)} on ${card.name}. Remaining: ${fmt(newBalance)}`, "success");
  }
}

// ── Revert CC Payment ───────────────────────────────────────
function revertCCPayment(id) {
  const payments = loadCCPayments();
  const payment = payments.find(p => p.id === id);
  if (!payment) return;

  // Restore card balance
  const balances = loadCardBalances();
  const currentBalance = balances[payment.cardIndex] !== undefined
    ? balances[payment.cardIndex]
    : APP_DATA.creditCards[payment.cardIndex].currentBalance;
  balances[payment.cardIndex] = Math.round((currentBalance + payment.amount) * 100) / 100;
  saveCardBalances(balances);

  // Remove the payment record
  saveCCPayments(payments.filter(p => p.id !== id));

  renderAll();
  showToast(`Reverted ${fmt(payment.amount)} payment on ${payment.cardName}`, "success");
}

// ── Render: Credit Cards ─────────────────────────────────────
function renderCreditCards() {
  const cards = APP_DATA.creditCards;
  $("#creditCards").innerHTML = cards
    .map(
      (c, i) => {
        const balance = getCardBalance(i);
        return `
      <div class="cc-card">
        <div class="cc-name">${c.issuer || "Bank A"}</div>
        <div class="cc-issuer">${c.name}</div>
        <div class="cc-balance-label">Current Balance</div>
        <div style="display:flex;align-items:center;gap:10px;justify-content:center">
          <div class="cc-balance">${fmt(balance)}</div>
          <button class="btn-edit" onclick="editCardBalance(${i})" title="Edit balance">
            <i data-lucide="pencil" style="width:14px;height:14px"></i>
          </button>
        </div>
        ${balance > 0 ? `<button class="btn btn-pay" onclick="payCardBalance(${i})"><i data-lucide="banknote" style="width:14px;height:14px"></i> Pay</button>` : ''}
        <div class="cc-details">
          <div>
            <div class="cc-detail-label">APR</div>
            <div class="cc-detail-value">${c.apr}%</div>
          </div>
          ${c.creditLimit ? `<div><div class="cc-detail-label">Credit Limit</div><div class="cc-detail-value">${fmt(c.creditLimit)}</div></div>` : ""}
          ${c.installment ? `<div><div class="cc-detail-label">Installment</div><div class="cc-detail-value">${fmt(c.installment.amount)}/mo</div></div>` : ""}
          ${c.febPurchases ? `<div><div class="cc-detail-label">Feb Purchases</div><div class="cc-detail-value">${fmt(c.febPurchases)}</div></div>` : ""}
        </div>
      </div>`;
      }
    )
    .join("");

  // Debt tracker — calculated from actual card balances
  const totalDebt = cards.reduce((sum, _, i) => sum + getCardBalance(i), 0);
  const income = getTotalMarchIncome();
  const debtPct = income > 0 ? Math.min(100, Math.round((totalDebt / income) * 100)) : 0;

  if (totalDebt > 0) {
    const remaining = getRealRemaining();
    const afterDebt = remaining - totalDebt;
    const afterColor = afterDebt >= 0 ? "var(--green)" : "var(--red)";

    $("#debtTracker").innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:.82rem;color:var(--text-secondary)">Total CC debt</span>
        <span style="font-size:.88rem;font-weight:700;color:var(--red)">${fmt(totalDebt)}</span>
      </div>
      <div class="debt-bar-wrap">
        <div class="debt-bar-fill" style="width:${debtPct}%">${debtPct}% of income</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        ${cards.map((c, i) => `<div style="font-size:.75rem;color:var(--text-muted)">${c.name}: ${fmt(getCardBalance(i))}</div>`).join("")}
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.88rem;color:var(--text-secondary)">After debt paid</span>
        <span style="font-size:1.1rem;font-weight:700;color:${afterColor}">${fmt(afterDebt)}</span>
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px;text-align:right">
        ${fmt(remaining)} remaining − ${fmt(totalDebt)} debt
      </div>
    `;
  } else {
    $("#debtTracker").innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:1.4rem;font-weight:700;color:var(--green);margin-bottom:4px">$0.00</div>
        <div style="font-size:.82rem;color:var(--text-muted)">No credit card debt — you're clean! 🎉</div>
      </div>
    `;
  }
}

// ── Render: CC Payment History ──────────────────────────────
function renderCCPayments() {
  const payments = loadCCPayments();
  const container = $("#ccPaymentHistory");
  if (!container) return;

  if (payments.length === 0) {
    container.innerHTML = "";
    return;
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  container.innerHTML = `
    <div class="card">
      <div class="card-title"><i data-lucide="receipt"></i> CC Payments Made</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <span style="font-size:.82rem;color:var(--text-secondary)">Total paid this month</span>
        <span style="font-size:1rem;font-weight:700;color:var(--green)">${fmt(totalPaid)}</span>
      </div>
      ${payments.map(p => `
        <div class="txn-row">
          <div class="txn-left">
            <div class="txn-icon"><i data-lucide="credit-card" style="width:16px;height:16px;color:var(--green)"></i></div>
            <div>
              <div class="txn-merchant">${p.cardName}</div>
              <div class="txn-category">CC Payment</div>
            </div>
          </div>
          <div class="txn-right" style="display:flex;align-items:center;gap:10px">
            <div>
              <div class="txn-amount" style="color:var(--green)">-${fmt(p.amount)}</div>
              <div class="txn-date">${p.date}</div>
            </div>
            <button onclick="revertCCPayment(${p.id})" class="btn-edit" title="Revert payment" style="color:var(--red)">
              <i data-lucide="undo" style="width:14px;height:14px"></i>
            </button>
          </div>
        </div>
      `).join("")}
    </div>`;
}

// ── Render: Subscriptions ────────────────────────────────────
function renderSubscriptions() {
  const active = APP_DATA.subscriptions.filter((s) => s.status === "active");
  const cancelled = APP_DATA.subscriptions.filter((s) => s.status === "cancelled");

  const activeTotal = active.reduce((s, x) => s + x.amount, 0);
  const cancelledTotal = cancelled.reduce((s, x) => s + x.amount, 0);

  $("#activeSubTotal").textContent = fmt(activeTotal);
  $("#cancelledSubTotal").textContent = fmt(cancelledTotal);

  const renderSub = (sub) => `
    <div class="sub-row">
      <div class="sub-left">
        <div class="sub-status ${sub.status}"></div>
        <span class="sub-name">${sub.name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="sub-amount ${sub.status === "cancelled" ? "cancelled" : ""}">${fmt(sub.amount)}/mo</span>
        <span class="sub-tag ${sub.status}">${sub.status === "active" ? "Active" : "Cancelled"}</span>
      </div>
    </div>`;

  $("#activeSubs").innerHTML = active.map(renderSub).join("");
  $("#cancelledSubs").innerHTML = cancelled.map(renderSub).join("");
}

// ── Render: Zelle ────────────────────────────────────────────
function renderZelle() {
  const transfers = APP_DATA.february.zelleSent.transfers;
  // Group by recipient
  const grouped = {};
  transfers.forEach((t) => {
    if (!grouped[t.recipient]) grouped[t.recipient] = { total: 0, count: 0 };
    grouped[t.recipient].total += t.amount;
    grouped[t.recipient].count++;
  });

  $("#zelleList").innerHTML = Object.entries(grouped)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([name, data]) => `
      <div class="zelle-row">
        <div class="zelle-left">
          <div class="zelle-avatar">${escapeHtml(name.split(" ").map((w) => w[0]).join(""))}</div>
          <div>
            <div class="zelle-name">${escapeHtml(name)}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${data.count} transfer${data.count > 1 ? "s" : ""}</div>
          </div>
        </div>
        <span class="zelle-amount">-${fmt(data.total)}</span>
      </div>`
    )
    .join("");
}

// ── Render: Meal Plan ────────────────────────────────────────
function renderMealPlan() {
  const remaining = 20 - mealPlanUsage.swipesUsed;
  const ddLeft = APP_DATA.mealPlan.diningDollars - mealPlanUsage.diningDollarsUsed;
  const ddPct = (ddLeft / APP_DATA.mealPlan.diningDollars) * 100;

  $("#swipesRemaining").textContent = remaining;
  $("#swipesUsed").textContent = mealPlanUsage.swipesUsed;

  // Swipe dots
  let dots = "";
  for (let i = 1; i <= 20; i++) {
    dots += `<div class="swipe-dot ${i <= mealPlanUsage.swipesUsed ? "used" : ""}">${i}</div>`;
  }
  $("#swipeDots").innerHTML = dots;

  // Dining dollars
  $("#diningDollarsLeft").textContent = fmt(ddLeft);
  const bar = $("#diningDollarsBar");
  bar.style.width = ddPct + "%";
  bar.className = `progress-fill ${ddPct > 50 ? "green" : ddPct > 20 ? "amber" : "red"}`;
}

// ── Render: Comparison ───────────────────────────────────────
function renderComparison() {
  const data = APP_DATA.monthlyComparison;
  const max = Math.max(...data.map((d) => d.total));
  const colors = ["var(--indigo)", "var(--blue)", "var(--red)", "var(--accent)"];

  $("#comparisonBars").innerHTML = data
    .map(
      (d, i) => `
      <div class="compare-row">
        <span class="compare-label">${d.month}</span>
        <div class="compare-bar-wrap">
          <div class="compare-bar" style="width:${(d.total / max) * 100}%;background:${colors[i]}">${fmt(d.total)}</div>
        </div>
      </div>`
    )
    .join("");
}

// ── Render: Lifestyle Tiers ──────────────────────────────────
function renderTiers() {
  const tiers = APP_DATA.lifestyleTiers;
  const labels = { fixed: "Fixed Bills", groceries: "Groceries", gas: "Gas", dining: "Dining Out", personal: "Personal", subs: "Subscriptions", entertainment: "Entertainment", shopping: "Shopping", savings: "Savings", emergency: "Emergency", flex: "Flex" };

  $("#tierCards").innerHTML = Object.entries(tiers)
    .map(
      ([key, tier]) => `
      <div class="tier-card ${key === "tight" ? "current" : ""}">
        <div class="tier-label">${tier.label}</div>
        <div class="tier-total" style="color:${key === "tight" ? "var(--accent)" : key === "comfortable" ? "var(--blue)" : "var(--green)"}">${fmtInt(tier.total)}</div>
        <div class="tier-per-month">/month</div>
        <div class="tier-breakdown">
          ${Object.entries(tier.breakdown)
            .map(([k, v]) => `<div class="tier-row"><span>${labels[k] || k}</span><span>${v > 0 ? fmt(v) : "—"}</span></div>`)
            .join("")}
        </div>
      </div>`
    )
    .join("");
}

// ── Charts ───────────────────────────────────────────────────
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

Chart.defaults.color = "#8892a6";
Chart.defaults.borderColor = "#1e2536";
Chart.defaults.font.family = "'Inter', sans-serif";

function renderChartSpending() {
  destroyChart("spending");
  const cats = APP_DATA.february.spending.categories;
  const colors = ["#00d4aa", "#6366f1", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#8b5cf6"];

  chartInstances["spending"] = new Chart($("#chartSpending"), {
    type: "doughnut",
    data: {
      labels: cats.map((c) => c.name),
      datasets: [{
        data: cats.map((c) => c.amount),
        backgroundColor: colors.slice(0, cats.length),
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "right", labels: { boxWidth: 10, padding: 8, font: { size: 11 } } }
      }
    }
  });
}

function renderChartIncome() {
  destroyChart("income");
  const marchBySource = getAllMarchIncomeEntries()
    .filter((entry) => entry.received)
    .reduce((map, entry) => {
      map[entry.name] = (map[entry.name] || 0) + entry.amount;
      return map;
    }, {});
  const febBySource = APP_DATA.february.income.sources.reduce((map, entry) => {
    map[entry.name] = (map[entry.name] || 0) + entry.amount;
    return map;
  }, {});
  const labels = Array.from(new Set([...Object.keys(marchBySource), ...Object.keys(febBySource)]));

  chartInstances["income"] = new Chart($("#chartIncome"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "March",
          data: labels.map((label) => marchBySource[label] || 0),
          backgroundColor: "#00d4aa88",
          borderRadius: 4
        },
        {
          label: "February",
          data: labels.map((label) => febBySource[label] || 0),
          backgroundColor: "#6366f188",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: {
        y: { grid: { color: "#1e253644" }, ticks: { callback: (v) => "$" + v.toLocaleString() } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderChartCardHistory() {
  destroyChart("cardHistory");
  const data = APP_DATA.creditCards[0].monthlyCharges;

  chartInstances["cardHistory"] = new Chart($("#chartCardHistory"), {
    type: "line",
    data: {
      labels: data.map((d) => d.month),
      datasets: [{
        label: "Primary Card Charges",
        data: data.map((d) => d.amount),
        borderColor: "#00d4aa",
        backgroundColor: "#00d4aa22",
        fill: true,
        tension: .3,
        pointRadius: 5,
        pointBackgroundColor: "#00d4aa"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "#1e253644" }, ticks: { callback: (v) => "$" + v.toLocaleString() } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderChartExpenseBreakdown() {
  destroyChart("expenseBreakdown");
  const cats = APP_DATA.february.spending.categories.sort((a, b) => b.amount - a.amount);
  const colors = ["#ef4444", "#f59e0b", "#00d4aa", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#8b5cf6"];

  chartInstances["expenseBreakdown"] = new Chart($("#chartExpenseBreakdown"), {
    type: "bar",
    data: {
      labels: cats.map((c) => c.name),
      datasets: [{
        data: cats.map((c) => c.amount),
        backgroundColor: colors.slice(0, cats.length),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#1e253644" }, ticks: { callback: (v) => "$" + v } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

function renderChartComparison() {
  destroyChart("comparison");
  const data = APP_DATA.monthlyComparison;

  chartInstances["comparison"] = new Chart($("#chartComparison"), {
    type: "bar",
    data: {
      labels: data.map((d) => d.month),
      datasets: [{
        label: "Total Spending",
        data: data.map((d) => d.total),
        backgroundColor: ["#6366f1", "#3b82f6", "#ef4444", "#00d4aa"],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "#1e253644" }, ticks: { callback: (v) => "$" + v.toLocaleString() } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Master Render ────────────────────────────────────────────
function renderAll() {
  renderSummaryCards();
  renderDailyWidget();
  renderVariableBudget("variableBudget");
  renderVariableBudget("expenseVariable");
  renderFixedCosts("fixedCosts");
  renderFixedCosts("expenseFixed");
  renderIncome();
  renderExport();
  renderExpenseSummary();
  renderTransactions();
  renderMerchants();
  renderCreditCards();
  renderCCPayments();
  renderSubscriptions();
  renderZelle();
  renderMealPlan();
  renderComparison();
  renderTiers();

  // Charts
  renderChartSpending();
  renderChartIncome();
  renderChartCardHistory();
  renderChartExpenseBreakdown();
  renderChartComparison();

  // Re-init lucide icons
  lucide.createIcons({ attrs: { class: "" } });
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
});
