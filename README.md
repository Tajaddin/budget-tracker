# Budget Tracker

A personal budget tracker — single-page application for managing income, expenses, credit cards, and savings goals. Runs entirely in the browser with no backend or login required.

## Features

- Monthly income tracking (base sources + custom entries)
- Expense breakdown by category with merchant-level detail
- Credit card balance management and payment tracking
- Fixed vs variable budget planning
- Lifestyle tier modeling (Tight / Comfortable / Good Life)
- Subscription manager with savings calculator
- Meal plan tracker (swipes + dining dollars)
- LocalStorage persistence — all edits saved in browser

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Plain HTML/CSS
- `http-server` for local development
- Playwright for automated tests

## Usage

```bash
npm install
npx http-server . -p 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Customization

Edit `data.js` to replace the sample data with your own income sources, spending categories, credit cards, and budget targets. All edits made through the UI are persisted automatically via LocalStorage.

## Author

[Tajaddin Gafarov](https://github.com/Tajaddin)

## License

MIT — see [LICENSE](LICENSE)
