const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");

const ROOT = process.cwd();
const TODAY_ISO = new Date().toISOString().split("T")[0];

function approx(actual, expected, label, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`
  );
}

async function startStaticServer(rootDir) {
  const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8"
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";

      const filePath = path.join(rootDir, pathname);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const stat = await fsp.stat(filePath).catch(() => null);
      if (!stat || stat.isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    return chromium.launch({ headless: true });
  }
}

async function withDialogs(page, responses, action) {
  const queue = [...responses];
  const handler = async (dialog) => {
    assert.ok(queue.length > 0, `Unexpected dialog: ${dialog.message()}`);
    const response = queue.shift();
    if (response === null) await dialog.dismiss();
    else await dialog.accept(String(response));
  };

  page.on("dialog", handler);
  try {
    await action();
    await page.waitForTimeout(100);
    assert.equal(queue.length, 0, `Unused dialog responses: ${queue.length}`);
  } finally {
    page.off("dialog", handler);
  }
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.Chart && window.lucide && typeof renderAll === "function");
  await page.waitForSelector("#summaryCards .summary-card");
}

async function gotoPage(page, pageName, title) {
  await page.locator(`.nav-item[data-page="${pageName}"]`).click();
  await page.waitForFunction(
    ({ pageName, title }) =>
      document.querySelector(`#page-${pageName}`).classList.contains("active") &&
      document.querySelector("#pageTitle").textContent.trim() === title,
    { pageName, title }
  );
}

async function openExpenseModal(page, triggerLocator) {
  await triggerLocator.click();
  await page.waitForFunction(() => document.querySelector("#modal").classList.contains("open"));
}

async function closeExpenseModal(page, closeAction) {
  await closeAction();
  await page.waitForFunction(() => !document.querySelector("#modal").classList.contains("open"));
}

async function addTransaction(page, txn) {
  await openExpenseModal(page, page.locator(".top-header .btn-primary"));
  await page.selectOption("#txnCategory", txn.category);
  await page.fill("#txnMerchant", txn.merchant);
  await page.fill("#txnAmount", String(txn.amount));
  await page.fill("#txnDate", txn.date);
  await page.getByRole("button", { name: "Add Expense" }).last().click();
  await page.waitForFunction(() => !document.querySelector("#modal").classList.contains("open"));
}

async function readState(page) {
  return page.evaluate(() => ({
    activeSection: document.querySelector(".page-section.active")?.id || null,
    pageTitle: document.querySelector("#pageTitle").textContent.trim(),
    totalIncome: Number(getTotalMarchIncome().toFixed(2)),
    plannedIncome: Number(getPlannedMarchIncome().toFixed(2)),
    pendingIncome: Number(getPendingMarchIncome().toFixed(2)),
    available: Number(getAvailableToSpend().toFixed(2)),
    ccDebt: Number(getTotalCCDebt().toFixed(2)),
    ccPayments: Number(getTotalCCPayments().toFixed(2)),
    remaining: Number(getRealRemaining().toFixed(2)),
    netRemaining: Number(getNetRemaining().toFixed(2)),
    dailyRemaining: Number(getDailyRemaining().toFixed(2)),
    variableSpent: Number(getTotalVariableSpent().toFixed(2)),
    groceriesSpent: Number(getSpentByCategory("Groceries").toFixed(2)),
    variableBudget0: Number(getVariableBudget(0).toFixed(2)),
    fixed0: Number(getFixedAmount(0).toFixed(2)),
    baseIncome0Name: getBaseIncomeName(0),
    baseIncome0Amount: Number(getBaseIncomeAmount(0).toFixed(2)),
    baseIncome0Received: isBaseIncomeReceived(0),
    customIncome: loadCustomIncome(),
    transactions: loadTransactions(),
    cardBalances: APP_DATA.creditCards.map((_, index) => Number(getCardBalance(index).toFixed(2))),
    paymentHistory: loadCCPayments(),
    swipesUsed: mealPlanUsage.swipesUsed,
    diningUsed: Number(mealPlanUsage.diningDollarsUsed.toFixed(2)),
    activeSubTotal: document.querySelector("#activeSubTotal")?.textContent.trim() || "",
    cancelledSubTotal: document.querySelector("#cancelledSubTotal")?.textContent.trim() || "",
    merchantRows: document.querySelectorAll("#merchantList .merchant-row").length,
    zelleRows: document.querySelectorAll("#zelleList .zelle-row").length,
    comparisonRows: document.querySelectorAll("#comparisonBars .compare-row").length,
    tierCards: document.querySelectorAll("#tierCards .tier-card").length,
    chartCount: Object.keys(Chart.instances || {}).length,
    exportPreview: document.querySelector("#exportPreview")?.textContent || "",
    incomeMarkup: document.querySelector("#marchIncome")?.innerHTML || "",
    sidebarOpen: document.querySelector("#sidebar").classList.contains("open")
  }));
}

async function assertInitialState(page) {
  const state = await readState(page);
  approx(state.totalIncome, 4713.39, "initial total income");
  approx(state.plannedIncome, 4713.39, "initial planned income");
  approx(state.pendingIncome, 0, "initial pending income");
  approx(state.available, 2849.17, "initial available");
  approx(state.remaining, 2849.17, "initial remaining");
  approx(state.netRemaining, 2849.17, "initial net remaining");
  approx(state.variableSpent, 0, "initial variable spent");
  assert.equal(state.transactions.length, 0, "initial transactions");
  assert.equal(state.paymentHistory.length, 0, "initial payment history");
  assert.equal(state.customIncome.length, 0, "initial custom income");
  assert.ok(state.chartCount >= 5, `expected at least 5 charts, got ${state.chartCount}`);
}

async function verifyNavigation(page) {
  const pages = [
    ["dashboard", "Dashboard"],
    ["income", "Income"],
    ["expenses", "Expenses"],
    ["transactions", "Transactions"],
    ["export", "Data Export"],
    ["cards", "Credit Cards"],
    ["subscriptions", "Subscriptions"],
    ["zelle", "Zelle Transfers"],
    ["mealplan", "Meal Plan"],
    ["comparison", "Comparison"],
    ["tiers", "Lifestyle Tiers"]
  ];

  for (const [pageName, title] of pages) {
    await gotoPage(page, pageName, title);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mobile-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#sidebar").classList.contains("open"));
  await page.locator('.nav-item[data-page="income"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("#page-income").classList.contains("active") &&
      !document.querySelector("#sidebar").classList.contains("open")
  );
  await page.setViewportSize({ width: 1440, height: 1200 });
}

async function verifyTransactions(page) {
  await gotoPage(page, "dashboard", "Dashboard");

  await openExpenseModal(page, page.locator(".top-header .btn-primary"));
  const defaultDate = await page.inputValue("#txnDate");
  assert.equal(defaultDate, TODAY_ISO, "modal date default");
  await closeExpenseModal(page, () => page.getByRole("button", { name: "Cancel" }).click());

  await openExpenseModal(page, page.locator(".top-header .btn-primary"));
  await closeExpenseModal(page, () => page.locator("#modal").click({ position: { x: 8, y: 8 } }));

  await addTransaction(page, {
    category: "Groceries",
    merchant: "Trader Joe's",
    amount: 42.5,
    date: TODAY_ISO
  });

  let state = await readState(page);
  assert.equal(state.transactions.length, 1, "transaction count after first add");
  approx(state.groceriesSpent, 42.5, "groceries spent after first add");
  approx(state.variableSpent, 42.5, "variable spent after first add");

  await gotoPage(page, "transactions", "Transactions");
  await openExpenseModal(page, page.locator("#page-transactions .btn-primary"));
  await page.selectOption("#txnCategory", "Dining Out");
  await page.fill("#txnMerchant", "Chipotle");
  await page.fill("#txnAmount", "10");
  await page.fill("#txnDate", TODAY_ISO);
  await page.getByRole("button", { name: "Add Expense" }).last().click();
  await page.waitForFunction(() => !document.querySelector("#modal").classList.contains("open"));

  state = await readState(page);
  assert.equal(state.transactions.length, 2, "transaction count after second add");

  await page.locator("#transactionList .txn-row").first().getByTitle("Delete").click();
  await page.waitForFunction(() => loadTransactions().length === 1);

  state = await readState(page);
  assert.equal(state.transactions.length, 1, "transaction count after delete");
  assert.equal(state.transactions[0].merchant, "Trader Joe's", "remaining transaction merchant");
}

async function verifyBudgetEditing(page) {
  await gotoPage(page, "expenses", "Expenses");

  await withDialogs(page, ["150.00"], async () => {
    await page.locator("#expenseVariable .btn-edit").first().click();
  });
  await page.waitForFunction(() => getVariableBudget(0) === 150);

  await withDialogs(page, ["900.00"], async () => {
    await page.locator("#expenseFixed .btn-edit").first().click();
  });
  await page.waitForFunction(() => getFixedAmount(0) === 900);

  const state = await readState(page);
  approx(state.variableBudget0, 150, "updated variable budget");
  approx(state.fixed0, 900, "updated fixed cost");
}

async function verifyIncomeFlows(page) {
  await gotoPage(page, "income", "Income");

  await withDialogs(page, ["Family Support", "4500.00"], async () => {
    await page.locator("#marchIncome .btn-edit").first().click();
  });
  await page.waitForFunction(() => getBaseIncomeName(0) === "Family Support" && getBaseIncomeAmount(0) === 4500);

  await page.locator("#marchIncome .income-toggle-btn").first().click();
  await page.waitForFunction(() => !isBaseIncomeReceived(0));
  let state = await readState(page);
  assert.equal(state.baseIncome0Received, false, "base income pending");
  approx(state.pendingIncome, 4500, "pending income after toggling base off");
  approx(state.totalIncome, 218.39, "received income after toggling base off");

  await page.locator("#marchIncome .income-toggle-btn").first().click();
  await page.waitForFunction(() => isBaseIncomeReceived(0));
  state = await readState(page);
  assert.equal(state.baseIncome0Received, true, "base income restored");
  approx(state.totalIncome, 4718.39, "income after base edit");

  await withDialogs(page, ["Bonus <Spring>", "123.45", "not-a-date"], async () => {
    await page.getByRole("button", { name: "Add Income" }).click();
  });
  await page.waitForFunction(() => loadCustomIncome().length === 1);

  state = await readState(page);
  assert.equal(state.customIncome.length, 1, "custom income count after add");
  assert.equal(state.customIncome[0].name, "Bonus <Spring>", "custom income name after add");
  assert.equal(state.customIncome[0].date, TODAY_ISO, "invalid date falls back to today");

  const keptRow = page.locator("#marchIncome .income-row").filter({ hasText: "Bonus <Spring>" });
  await withDialogs(page, ["Bonus Revised <Q1>", "150.00", "2026-03-05"], async () => {
    await keptRow.getByTitle("Edit income").click();
  });
  await page.waitForFunction(
    () => loadCustomIncome()[0]?.name === "Bonus Revised <Q1>" && loadCustomIncome()[0]?.amount === 150
  );

  const revisedRow = page.locator("#marchIncome .income-row").filter({ hasText: "Bonus Revised <Q1>" });
  await revisedRow.getByRole("button", { name: "Not Yet" }).click();
  await page.waitForFunction(() => getPendingMarchIncome() === 150);
  await revisedRow.getByRole("button", { name: "Count It" }).click();
  await page.waitForFunction(() => getPendingMarchIncome() === 0);

  await withDialogs(page, ["Delete Me", "50.00", "2026-03-06"], async () => {
    await page.getByRole("button", { name: "Add Income" }).click();
  });
  await page.waitForFunction(() => loadCustomIncome().length === 2);

  await page.locator("#marchIncome .income-row").filter({ hasText: "Delete Me" }).getByTitle("Remove income").click();
  await page.waitForFunction(() => loadCustomIncome().length === 1);

  state = await readState(page);
  approx(state.totalIncome, 4868.39, "income after custom flows");
  approx(state.plannedIncome, 4868.39, "planned income after custom flows");
  approx(state.pendingIncome, 0, "pending income after custom flows");
  assert.equal(state.customIncome[0].name, "Bonus Revised <Q1>", "kept custom income name");
  assert.ok(
    state.incomeMarkup.includes("Bonus Revised &lt;Q1&gt;"),
    "custom income name should be escaped in markup"
  );
}

async function verifyCardFlows(page) {
  await gotoPage(page, "cards", "Credit Cards");

  await withDialogs(page, ["200.00"], async () => {
    await page.locator("#creditCards .btn-edit").first().click();
  });
  await page.waitForFunction(() => getCardBalance(0) === 200);

  await withDialogs(page, ["50.00"], async () => {
    await page.locator("#creditCards .btn-pay").first().click();
  });
  await page.waitForFunction(() => getCardBalance(0) === 150 && loadCCPayments().length === 1);

  await page.locator("#ccPaymentHistory .btn-edit").click();
  await page.waitForFunction(() => getCardBalance(0) === 200 && loadCCPayments().length === 0);

  await withDialogs(page, ["75.00"], async () => {
    await page.locator("#creditCards .btn-pay").first().click();
  });
  await page.waitForFunction(() => getCardBalance(0) === 125 && loadCCPayments().length === 1);

  await withDialogs(page, ["80.00"], async () => {
    await page.locator("#creditCards .btn-edit").nth(1).click();
  });
  await page.waitForFunction(() => getCardBalance(1) === 80);

  const state = await readState(page);
  assert.deepEqual(state.cardBalances, [125, 80], "card balances after edits");
  approx(state.ccDebt, 205, "credit card debt after edits");
  approx(state.ccPayments, 75, "cc payments after pay flow");
  assert.equal(state.paymentHistory.length, 1, "payment history after final payment");
  assert.equal(state.paymentHistory[0].cardName, "Apple Card", "payment history card name");
}

async function verifyStaticPages(page) {
  await gotoPage(page, "subscriptions", "Subscriptions");
  let state = await readState(page);
  assert.equal(state.activeSubTotal, "$28.39", "active subscriptions total");
  assert.equal(state.cancelledSubTotal, "$227.27", "cancelled subscriptions total");

  await gotoPage(page, "zelle", "Zelle Transfers");
  state = await readState(page);
  assert.equal(state.zelleRows, 5, "grouped zelle rows");
  await page.locator("#zelleList .zelle-row").first().waitFor();
  const zelleText = await page.locator("#zelleList .zelle-row").first().textContent();
  assert.ok(zelleText.includes("Saheddin Amer"), "zelle top recipient");
  assert.ok(zelleText.includes("$1,655.00"), "zelle top total");

  await gotoPage(page, "mealplan", "Meal Plan");
  await page.getByRole("button", { name: "Use Swipe" }).click();
  await page.getByRole("button", { name: "Use Swipe" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.fill("#diningDollarInput", "5.50");
  await page.getByRole("button", { name: "Spend" }).click();
  await page.fill("#diningDollarInput", "30");
  await page.getByRole("button", { name: "Spend" }).click();

  state = await readState(page);
  assert.equal(state.swipesUsed, 1, "meal swipe usage");
  approx(state.diningUsed, 5.5, "dining dollars usage");

  await gotoPage(page, "comparison", "Comparison");
  state = await readState(page);
  assert.equal(state.comparisonRows, 4, "comparison rows");

  await gotoPage(page, "tiers", "Lifestyle Tiers");
  state = await readState(page);
  assert.equal(state.tierCards, 3, "tier card count");
}

async function verifyExport(page, context) {
  await gotoPage(page, "export", "Data Export");

  let state = await readState(page);
  assert.ok(state.exportPreview.includes("Bonus Revised <Q1>"), "export preview custom income");
  assert.ok(state.exportPreview.includes("Trader Joe's"), "export preview transaction");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download JSON" }).click()
  ]);
  const downloadPath = await download.path();
  const exported = JSON.parse(await fsp.readFile(downloadPath, "utf8"));

  approx(exported.report.overview.receivedIncome, 4868.39, "exported received income");
  approx(exported.report.overview.fixedTotal, 1874.22, "exported fixed total");
  approx(exported.report.overview.variableSpent, 42.5, "exported variable spent");
  approx(exported.report.overview.ccDebt, 205, "exported cc debt");
  assert.equal(exported.report.march.transactions.length, 1, "exported transaction count");
  assert.equal(exported.report.march.incomeEntries.length, 3, "exported income entry count");
  assert.equal(exported.report.march.ccPayments.length, 1, "exported payment count");
  assert.equal(exported.report.march.mealPlan.swipesUsed, 1, "exported swipe usage");
  assert.equal(exported.report.march.mealPlan.diningDollarsUsed, 5.5, "exported dining usage");
  assert.ok(
    exported.report.march.incomeEntries.some((entry) => entry.name === "Bonus Revised <Q1>"),
    "exported custom income name"
  );

  const pdfPagePromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Save PDF" }).click();
  const pdfPage = await pdfPagePromise;
  await pdfPage.waitForLoadState("domcontentloaded");
  await pdfPage.waitForFunction(() => document.body.textContent.includes("Budget Export Snapshot"));
  const pdfText = await pdfPage.locator("body").textContent();
  assert.ok(pdfText.includes("Cards and Payments"), "print page cards section");
  assert.ok(pdfText.includes("Bonus Revised <Q1>"), "print page custom income");
  await pdfPage.close();
}

async function verifyFinalDerivedState(page) {
  await gotoPage(page, "dashboard", "Dashboard");
  const state = await readState(page);
  approx(state.totalIncome, 4868.39, "final income");
  approx(state.plannedIncome, 4868.39, "final planned income");
  approx(state.pendingIncome, 0, "final pending income");
  approx(state.available, 2994.17, "final available");
  approx(state.variableSpent, 42.5, "final variable spent");
  approx(state.ccDebt, 205, "final cc debt");
  approx(state.ccPayments, 75, "final cc payments");
  approx(state.remaining, 2876.67, "final remaining");
  approx(state.netRemaining, 2671.67, "final net remaining");
  approx(state.dailyRemaining, 119.86, "final daily remaining");
}

async function verifyPersistence(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const state = await readState(page);

  approx(state.totalIncome, 4868.39, "persisted income");
  approx(state.variableBudget0, 150, "persisted variable budget");
  approx(state.fixed0, 900, "persisted fixed cost");
  assert.equal(state.transactions.length, 1, "persisted transactions");
  assert.equal(state.customIncome.length, 1, "persisted custom income");
  assert.deepEqual(state.cardBalances, [125, 80], "persisted card balances");
  assert.equal(state.paymentHistory.length, 1, "persisted payment history");
  assert.equal(state.swipesUsed, 1, "persisted swipe usage");
  approx(state.diningUsed, 5.5, "persisted dining dollars usage");

  await gotoPage(page, "export", "Data Export");
  const exportText = await page.locator("#exportPreview").textContent();
  assert.ok(exportText.includes("Bonus Revised <Q1>"), "persisted export preview");
}

async function main() {
  const { server, url } = await startStaticServer(ROOT);
  const browser = await launchBrowser();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitForApp(page);

    await assertInitialState(page);
    await verifyNavigation(page);
    await verifyTransactions(page);
    await verifyBudgetEditing(page);
    await verifyIncomeFlows(page);
    await verifyCardFlows(page);
    await verifyStaticPages(page);
    await verifyExport(page, context);
    await verifyFinalDerivedState(page);
    await verifyPersistence(page);

    assert.deepEqual(consoleErrors, [], `Console errors:\n${consoleErrors.join("\n")}`);
    assert.deepEqual(pageErrors, [], `Page errors:\n${pageErrors.join("\n")}`);

    console.log("Full functional check passed.");
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
