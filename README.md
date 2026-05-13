# budget-tracker

Personal budget SPA. Vanilla JS, no framework, no backend. Edits persist to LocalStorage. Tracks income, expenses, credit cards, subscriptions, meal plans, and three lifestyle tiers. Playwright functional-check ships in `scripts/`.

Live demo: https://tajaddin.github.io/budget-tracker/

## Hero numbers

| Metric | Value |
|---|---|
| Logic | 1,619 lines of vanilla JS in `app.js` |
| Seed data | 391 lines in `data.js`, override per user |
| Framework | None. Plain HTML, CSS, and one JS file |
| Persistence | LocalStorage. No server, no login |
| Lifestyle tiers | 3 (Tight, Comfortable, Good Life) with per-tier budget targets |
| Functional check | Playwright script in `scripts/full-functional-check.cjs` |

## Modules in one file

| Section | Where in `app.js` |
|---|---|
| Income tracker | Base sources plus custom entries |
| Expense breakdown | By category, drill into merchants |
| Credit cards | Balance, minimum payment, payoff calculator |
| Fixed vs variable | Side-by-side monthly plan |
| Lifestyle tiers | Three target budgets you swap between |
| Subscriptions | Monthly cost, savings calculator on cancel |
| Meal plan | Swipes plus dining dollars, weekly burn rate |
| Persistence | Wraps every mutation in a LocalStorage write |

## Run

```
npm install
npx http-server . -p 8080
```

App at http://localhost:8080.

No build step. Edit `app.js`, refresh the browser.

## Tests

```
node scripts/full-functional-check.cjs
```

The Playwright script launches Chromium, exercises the seven modules above, and asserts the LocalStorage shape after each mutation.

## Customize

`data.js` carries the seed values. Replace with your own income sources, expense categories, credit cards, subscriptions, and tier targets. The UI writes user edits back to LocalStorage on every change, so the seed only matters on first load.

## Repository layout

```
budget-tracker/
  index.html                                One-page shell
  app.js                                    1,619 LOC of UI logic and persistence
  data.js                                   391 LOC of seed data
  styles.css                                Layout and palette
  scripts/full-functional-check.cjs         Playwright smoke test
  budget-app-requirements (2).md            Original requirements doc
  package.json                              http-server plus Playwright deps
```

## Stack

Vanilla JavaScript, HTML5, CSS3, http-server for local dev, Playwright for the smoke test.

## License

MIT, see `LICENSE`.
