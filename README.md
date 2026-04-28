# Finance Tracker App

A simple finance tracker for daily income, expenses, transfers, balances, receipts, and export support.

## Features

- Record income, expense, and transfer transactions
- Add custom accounts with initial balances (e.g., Savings, Cash, True Money, Easy Pass, Credit Card, Investment)
- Edit account names and balances
- Delete accounts (transactions remain)
- View remaining balances for all accounts
- Analyze expenses by category (in Thai)
- Attach receipt images to transactions
- Export data as JSON or CSV
- Save data in browser local storage

## Usage

1. Open `index.html` in your browser.
2. Add new transactions with date, type (income/expense/transfer), category, account, amount, description, and receipt image.
3. For transfers, select from and to accounts.
4. In Account Management, add new accounts with initial balances, edit existing ones, or delete them.
5. Review updated balances, expense analysis, and monthly summaries.
6. Export saved data using the JSON or CSV buttons.

## Notes

- This project is a static web app and does not require installation.
- All data is stored locally in the browser and is cleared only when you click "Clear all data" or clear browser storage.
- Categories are in Thai for localization, including subscriptions, fuel, and tolls.
- Currency is displayed in Thai Baht (฿).
- Dates are shown in dd/mm/yyyy format.
