const STORAGE_KEY = 'finance-tracker-data';
const ACCOUNTS_KEY = 'finance-tracker-accounts';
const DEFAULT_ACCOUNTS = [
  { name: 'Savings', balance: 0 },
  { name: 'Cash', balance: 0 },
  { name: 'True Money', balance: 0 },
  { name: 'Easy Pass', balance: 0 },
  { name: 'Credit Card', balance: 0 },
];

// Firebase imports (available via window)
const firestore = window.firestore || {};

// Use Firestore for data storage
let db = window.db;
let userId = null;

const form = document.getElementById('transaction-form');
const formModeText = document.getElementById('form-mode');
const transactionIdInput = document.getElementById('transaction-id');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');
const categoryInput = document.getElementById('category');
const accountInput = document.getElementById('account');
const fromAccountInput = document.getElementById('from-account');
const toAccountInput = document.getElementById('to-account');
const amountInput = document.getElementById('amount');
const descriptionInput = document.getElementById('description');
const receiptInput = document.getElementById('receipt');
const newAccountNameInput = document.getElementById('new-account-name');
const newAccountBalanceInput = document.getElementById('new-account-balance');
const addAccountButton = document.getElementById('add-account');
const accountsListEl = document.getElementById('accounts-tbody');
const balancesEl = document.getElementById('balances');
const analysisEl = document.getElementById('expense-analysis');
const monthlySummaryEl = document.getElementById('monthly-summary');
const summaryChartEl = document.getElementById('summary-chart');
const tableBody = document.querySelector('#transaction-table tbody');
const exportJsonButton = document.getElementById('export-json');
const exportCsvButton = document.getElementById('export-csv');
const clearDataButton = document.getElementById('clear-data');
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit');
const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const userStatusEl = document.getElementById('user-status');

const typeDirection = {
  expense: -1,
  income: 1,
};

let accounts = [];
let transactions = [];
let editingId = null;
let editingAccountIndex = -1;

async function loadAccounts() {
  if (db && userId && db.doc) {
    const accountsRef = db.doc(`users/${userId}/data/accounts`);
    try {
      const docSnap = await accountsRef.get();
      if (docSnap.exists) {
        accounts = docSnap.data().accounts || [...DEFAULT_ACCOUNTS];
      } else {
        // Fallback to localStorage if Firebase doc doesn't exist
        const saved = localStorage.getItem(ACCOUNTS_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length) {
              if (typeof parsed[0] === 'string') {
                accounts = parsed.map(name => ({ name, balance: 0 }));
              } else {
                accounts = parsed;
              }
            } else {
              accounts = [...DEFAULT_ACCOUNTS];
            }
          } catch {
            accounts = [...DEFAULT_ACCOUNTS];
          }
        } else {
          accounts = [...DEFAULT_ACCOUNTS];
        }
      }
      // Set up real-time listener
      accountsRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
          accounts = docSnap.data().accounts || [...DEFAULT_ACCOUNTS];
          refreshApp();
        }
      });
      return accounts;
    } catch (error) {
      console.error('Error loading accounts:', error);
      // Fallback to localStorage on error
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            if (typeof parsed[0] === 'string') {
              return parsed.map(name => ({ name, balance: 0 }));
            } else {
              return parsed;
            }
          }
        } catch {
          return [...DEFAULT_ACCOUNTS];
        }
      }
      return [...DEFAULT_ACCOUNTS];
    }
  }
  // Fallback to localStorage
  const saved = localStorage.getItem(ACCOUNTS_KEY);
  if (!saved) return [...DEFAULT_ACCOUNTS];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length) {
      if (typeof parsed[0] === 'string') {
        return parsed.map(name => ({ name, balance: 0 }));
      }
      return parsed;
    }
    return [...DEFAULT_ACCOUNTS];
  } catch {
    return [...DEFAULT_ACCOUNTS];
  }
}

function saveAccounts() {
  if (db && userId && db.doc) {
    const accountsRef = db.doc(`users/${userId}/data/accounts`);
    accountsRef.set({ accounts }).catch((error) => {
      console.error('Error saving accounts:', error);
    });
  }
  // Also save to localStorage as backup
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function loadTransactions() {
  if (db && userId && db.doc) {
    const transactionsRef = db.doc(`users/${userId}/data/transactions`);
    try {
      const docSnap = await transactionsRef.get();
      if (docSnap.exists) {
        transactions = docSnap.data().transactions || [];
      } else {
        // Fallback to localStorage if Firebase doc doesn't exist
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            transactions = JSON.parse(saved);
          } catch {
            transactions = [];
          }
        } else {
          transactions = [];
        }
      }
      // Set up real-time listener
      transactionsRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
          transactions = docSnap.data().transactions || [];
          refreshApp();
        }
      });
      return transactions;
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Fallback to localStorage on error
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
      return [];
    }
  }
  // Fallback to localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveTransactions() {
  if (db && userId && db.doc) {
    const transactionsRef = db.doc(`users/${userId}/data/transactions`);
    transactionsRef.set({ transactions }).catch((error) => {
      console.error('Error saving transactions:', error);
    });
  }
  // Also save to localStorage as backup
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function clearLocalData() {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function adjustAccountBalance(account, amount, direction) {
  if (account === 'Credit Card') {
    return amount * direction * -1;
  }
  return amount * direction;
}

function computeBalances() {
  const balances = accounts.reduce((result, account) => {
    result[account.name] = account.balance;
    return result;
  }, {});

  transactions.forEach((item) => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'transfer') {
      if (item.fromAccount && balances[item.fromAccount] !== undefined) {
        balances[item.fromAccount] += adjustAccountBalance(item.fromAccount, amount, -1);
      }
      if (item.toAccount && balances[item.toAccount] !== undefined) {
        balances[item.toAccount] += adjustAccountBalance(item.toAccount, amount, 1);
      }
    } else {
      const account = item.account;
      if (!account || balances[account] === undefined) return;
      balances[account] += adjustAccountBalance(account, amount, typeDirection[item.type] || 1);
    }
  });

  return balances;
}

function computeExpenseAnalysis() {
  const categoryTotals = {};
  let totalExpenses = 0;

  transactions
    .filter((item) => item.type === 'expense')
    .forEach((item) => {
      const amount = Number(item.amount) || 0;
      totalExpenses += amount;
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + amount;
    });

  return { totalExpenses, categoryTotals };
}

function computeMonthlySummary() {
  const summary = {};

  transactions.forEach((item) => {
    const month = item.date ? item.date.slice(0, 7) : 'Unknown';
    if (!summary[month]) {
      summary[month] = {
        income: 0,
        expense: 0,
        net: 0,
      };
    }
    const amount = Number(item.amount) || 0;
    if (item.type === 'income' || item.type === 'expense') {
      summary[month][item.type] += amount;
      summary[month].net += amount * (typeDirection[item.type] || 0);
    }
  });

  return summary;
}

function populateAccountSelect(select) {
  select.innerHTML = '';
  accounts.forEach((account) => {
    const option = document.createElement('option');
    option.value = account.name;
    option.textContent = account.name;
    select.appendChild(option);
  });
}

function populateAccountLists() {
  populateAccountSelect(accountInput);
  populateAccountSelect(fromAccountInput);
  populateAccountSelect(toAccountInput);
}

function populateAccountsList() {
  const balances = computeBalances();
  accountsListEl.innerHTML = '';
  accounts.forEach((account, index) => {
    const currentBalance = balances[account.name] !== undefined ? balances[account.name] : account.balance;
    const tr = document.createElement('tr');
    tr.setAttribute('draggable', 'true');
    tr.dataset.index = index;
    tr.innerHTML = `
      <td>${account.name}</td>
      <td>${formatCurrency(currentBalance)}</td>
      <td>
        <button class="secondary edit-account" data-index="${index}">Edit</button>
        <button class="action-button delete-account" data-index="${index}">Delete</button>
      </td>
    `;

    tr.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index);
      tr.classList.add('dragging');
    });

    tr.addEventListener('dragover', (event) => {
      event.preventDefault();
      tr.classList.add('drag-over');
    });

    tr.addEventListener('dragleave', () => {
      tr.classList.remove('drag-over');
    });

    tr.addEventListener('drop', (event) => {
      event.preventDefault();
      tr.classList.remove('drag-over');
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
      const toIndex = Number(tr.dataset.index);
      if (fromIndex === toIndex || Number.isNaN(fromIndex) || Number.isNaN(toIndex)) return;

      const [movedAccount] = accounts.splice(fromIndex, 1);
      accounts.splice(toIndex, 0, movedAccount);
      saveAccounts();
      refreshApp();
    });

    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
      document.querySelectorAll('.accounts-list tr').forEach((row) => row.classList.remove('drag-over'));
    });

    accountsListEl.appendChild(tr);
  });
}

function addNewAccount() {
  const name = newAccountNameInput.value.trim();
  const balance = Number(newAccountBalanceInput.value) || 0;
  if (!name) {
    alert('Enter a valid account name.');
    return;
  }
  if (accounts.some(acc => acc.name === name)) {
    alert('That account already exists.');
    return;
  }
  accounts.push({ name, balance });
  saveAccounts();
  populateAccountLists();
  populateAccountsList();
  newAccountNameInput.value = '';
  newAccountBalanceInput.value = '';
  refreshApp();
}

function editAccount(index) {
  const account = accounts[index];
  if (!account) return;

  const tr = accountsListEl.children[index];
  tr.innerHTML = `
    <td><input type="text" value="${account.name}" class="edit-name" /></td>
    <td><input type="number" step="0.01" value="${account.balance}" class="edit-balance" /></td>
    <td>
      <button class="secondary save-edit" data-index="${index}">Save</button>
      <button class="secondary cancel-edit-account">Cancel</button>
    </td>
  `;

  // Add real-time balance update
  const balanceInput = tr.querySelector('.edit-balance');
  balanceInput.addEventListener('input', () => {
    const newBalance = Number(balanceInput.value) || 0;
    // Temporarily update the account balance for balance calculation
    const originalBalance = accounts[index].balance;
    accounts[index].balance = newBalance;
    updateBalances();
    accounts[index].balance = originalBalance; // Restore original for now
  });
}

function saveAccountEdit(index) {
  const tr = accountsListEl.children[index];
  const nameInput = tr.querySelector('.edit-name');
  const balanceInput = tr.querySelector('.edit-balance');
  const newName = nameInput.value.trim();
  const newBalance = Number(balanceInput.value) || 0;

  if (!newName) {
    alert('Enter a valid account name.');
    return;
  }
  if (accounts.some((acc, i) => i !== index && acc.name === newName)) {
    alert('That account name already exists.');
    return;
  }

  accounts[index].name = newName;
  accounts[index].balance = newBalance;
  saveAccounts();
  populateAccountLists();
  populateAccountsList();
  refreshApp();
}

function cancelAccountEdit(index) {
  populateAccountsList();
  updateBalances(); // Restore balances after canceling edit
}

function deleteAccount(index) {
  const account = accounts[index];
  if (!account) return;
  if (!confirm(`Delete account "${account.name}"? This will not remove transactions.`)) return;
  accounts.splice(index, 1);
  saveAccounts();
  populateAccountLists();
  populateAccountsList();
}

function updateBalances() {
  const balances = computeBalances();
  balancesEl.innerHTML = '';

  Object.entries(balances).forEach(([account, amount]) => {
    const item = document.createElement('div');
    item.className = 'balance-card';
    item.innerHTML = `
      <div>
        <strong>${account}</strong>
        <span>${account === 'Credit Card' ? 'Outstanding balance' : 'Available balance'}</span>
      </div>
      <div>${formatCurrency(amount)}</div>
    `;
    balancesEl.appendChild(item);
  });

  // Calculate total remaining balance
  const totalBalance = Object.values(balances).reduce((sum, amount) => sum + amount, 0);

  // Add total balance item
  const totalItem = document.createElement('div');
  totalItem.className = 'balance-card total-balance';
  totalItem.innerHTML = `
    <div>
      <strong>Total Remaining Balance</strong>
      <span>Sum of all accounts</span>
    </div>
    <div>${formatCurrency(totalBalance)}</div>
  `;
  balancesEl.appendChild(totalItem);
}

function updateExpenseAnalysis() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  const monthExpenses = transactions.filter(
    (item) => item.type === 'expense' && item.date && item.date.startsWith(currentMonthStr)
  );

  const totalExpenses = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const categoryTotals = monthExpenses.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + Number(item.amount || 0);
    return result;
  }, {});

  const todayExpenses = transactions
    .filter((item) => item.type === 'expense' && item.date === todayStr)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const yesterdayExpenses = transactions
    .filter((item) => item.type === 'expense' && item.date === yesterdayStr)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  analysisEl.innerHTML = '';

  const monthSummary = document.createElement('div');
  monthSummary.className = 'expense-summary-card';
  monthSummary.innerHTML = `
    <div>
      <strong>This month expenses</strong>
      <span>${formatCurrency(totalExpenses)}</span>
    </div>
  `;
  analysisEl.appendChild(monthSummary);

  const dailySection = document.createElement('section');
  dailySection.className = 'expense-section';
  dailySection.innerHTML = `<div class="section-title">Today vs Yesterday</div>`;
  dailySection.appendChild(createExpenseLine('Today', todayExpenses, formatDate(todayStr)));
  dailySection.appendChild(createExpenseLine('Yesterday', yesterdayExpenses, formatDate(yesterdayStr)));
  analysisEl.appendChild(dailySection);

  const categorySection = document.createElement('section');
  categorySection.className = 'expense-section';
  categorySection.innerHTML = `<div class="section-title">Category summary</div>`;

  if (totalExpenses === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No expense data available for the current month.';
    categorySection.appendChild(empty);
  } else {
    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, amount]) => {
        const pct = totalExpenses ? ((amount / totalExpenses) * 100).toFixed(1) : '0.0';
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `<span>${category}</span><span>${formatCurrency(amount)} (${pct}%)</span>`;
        categorySection.appendChild(item);
      });
  }

  analysisEl.appendChild(categorySection);
}

function createExpenseLine(label, amount, dateLabel) {
  const line = document.createElement('div');
  line.className = 'expense-item daily-expense';
  const title = dateLabel ? `${label} (${dateLabel})` : label;
  line.innerHTML = `<span>${title}</span><span>${formatCurrency(amount)}</span>`;
  return line;
}

function updateMonthlySummary() {
  const summary = computeMonthlySummary();
  monthlySummaryEl.innerHTML = '';
  summaryChartEl.innerHTML = '';

  const monthKeys = Object.keys(summary).sort();
  if (monthKeys.length === 0) {
    monthlySummaryEl.textContent = 'No monthly data yet.';
    return;
  }

  const latestMonth = monthKeys[monthKeys.length - 1];
  const latestTotals = summary[latestMonth];
  const latestSummary = document.createElement('div');
  latestSummary.className = 'latest-month-summary';
  latestSummary.innerHTML = `
    <div>
      <span class="latest-month-label">Latest month</span>
      <strong>${latestMonth}</strong>
    </div>
    <div class="latest-month-value">Net ${formatCurrency(latestTotals.net)}</div>
  `;
  monthlySummaryEl.appendChild(latestSummary);

  const maxValue = Math.max(
    ...monthKeys.map((month) => {
      const totals = summary[month];
      return Math.max(totals.income, totals.expense, Math.abs(totals.net));
    })
  );

  monthKeys.forEach((month) => {
    const totals = summary[month];
    const incoming = totals.income;
    const outgoing = totals.expense;
    const monthRow = document.createElement('div');
    monthRow.className = 'month-row';
    monthRow.innerHTML = `
      <div class="month-label">
        <strong>${month}</strong>
        <span>Net ${formatCurrency(totals.net)}</span>
      </div>
      <div class="bars">
        <div class="bar-item">
          <span>In</span>
          <div class="bar-outer"><div class="bar bar-in" style="width: ${maxValue ? (incoming / maxValue) * 100 : 0}%"></div></div>
          <span>${formatCurrency(incoming)}</span>
        </div>
        <div class="bar-item">
          <span>Out</span>
          <div class="bar-outer"><div class="bar bar-out" style="width: ${maxValue ? (outgoing / maxValue) * 100 : 0}%"></div></div>
          <span>${formatCurrency(outgoing)}</span>
        </div>
      </div>
    `;
    monthlySummaryEl.appendChild(monthRow);
  });
}

function renderTransactions() {
  tableBody.innerHTML = '';
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const transactionsByDate = {};

  sortedTransactions.forEach((item) => {
    if (!transactionsByDate[item.date]) {
      transactionsByDate[item.date] = [];
    }
    transactionsByDate[item.date].push(item);
  });

  const dates = Object.keys(transactionsByDate).sort((a, b) => new Date(b) - new Date(a));
  const showAll = tableBody.dataset.showAll === 'true';
  const datesToShow = showAll ? dates : dates.slice(0, 5);
  const hasMore = dates.length > 5 && !showAll;

  datesToShow.forEach((date) => {
    const separatorRow = document.createElement('tr');
    separatorRow.className = 'day-separator';
    separatorRow.innerHTML = `<td colspan="8"><div class="day-separator-line"></div></td>`;
    tableBody.appendChild(separatorRow);

    const dateRow = document.createElement('tr');
    dateRow.className = 'date-label-row';
    dateRow.innerHTML = `<td colspan="8" class="date-label">${formatDate(date)}</td>`;
    tableBody.appendChild(dateRow);

    transactionsByDate[date].forEach((item) => {
      const accountText = item.type === 'transfer' ? `${item.fromAccount || '—'} → ${item.toAccount || '—'}` : item.account;
      const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '';
      const tr = document.createElement('tr');
      if (item.type === 'income') {
        tr.classList.add('income-row');
      }
      if (item.type === 'transfer') {
        tr.classList.add('transfer-row');
      }

      tr.innerHTML = `
        <td>${item.date}</td>
        <td>${item.type}</td>
        <td>${item.category}</td>
        <td>${accountText}</td>
        <td>${sign}${formatCurrency(item.amount)}</td>
        <td>${item.description || ''}</td>
        <td>${item.receipt ? `<img src="${item.receipt}" alt="receipt" class="receipt-preview" />` : '—'}</td>
        <td>
          <button class="secondary edit-button" data-id="${item.id}">Edit</button>
          <button class="action-button" data-id="${item.id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  });

  if (hasMore) {
    const showMoreRow = document.createElement('tr');
    showMoreRow.className = 'show-more-row';
    showMoreRow.innerHTML = `<td colspan="8" style="text-align: center; padding: 16px;"><button id="show-more-btn" class="secondary">Show More (${dates.length - 5} more days)</button></td>`;
    tableBody.appendChild(showMoreRow);

    setTimeout(() => {
      const showMoreBtn = document.getElementById('show-more-btn');
      if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
          tableBody.dataset.showAll = 'true';
          renderTransactions();
        });
      }
    }, 0);
  } else if (showAll && dates.length > 5) {
    const showLessRow = document.createElement('tr');
    showLessRow.className = 'show-more-row';
    showLessRow.innerHTML = `<td colspan="8" style="text-align: center; padding: 16px;"><button id="show-less-btn" class="secondary">Show Less</button></td>`;
    tableBody.appendChild(showLessRow);

    setTimeout(() => {
      const showLessBtn = document.getElementById('show-less-btn');
      if (showLessBtn) {
        showLessBtn.addEventListener('click', () => {
          tableBody.dataset.showAll = 'false';
          renderTransactions();
        });
      }
    }, 0);
  }
}

function addTransaction(transaction) {
  transactions.push(transaction);
  saveTransactions();
  refreshApp();
}

function updateTransaction(updated) {
  transactions = transactions.map((item) => (item.id === updated.id ? updated : item));
  saveTransactions();
  refreshApp();
}

function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  refreshApp();
}

function resetFormState() {
  editingId = null;
  transactionIdInput.value = '';
  form.reset();
  submitButton.textContent = 'Save transaction';
  formModeText.textContent = 'Enter a new transaction or select one to edit.';
  toggleTransferFields();
}

function toggleTransferFields() {
  const isTransfer = typeInput.value === 'transfer';
  document.querySelectorAll('.transfer-fields').forEach((el) => el.classList.toggle('hidden', !isTransfer));
  document.querySelector('.regular-account').classList.toggle('hidden', isTransfer);
  if (isTransfer) {
    fromAccountInput.required = true;
    toAccountInput.required = true;
    accountInput.required = false;
  } else {
    fromAccountInput.required = false;
    toAccountInput.required = false;
    accountInput.required = true;
  }
}

function startEditTransaction(id) {
  const item = transactions.find((transaction) => transaction.id === id);
  if (!item) return;

  editingId = id;
  transactionIdInput.value = id;
  dateInput.value = item.date;
  typeInput.value = item.type;
  categoryInput.value = item.category;
  amountInput.value = item.amount;
  descriptionInput.value = item.description;
  receiptInput.value = '';

  if (item.type === 'transfer') {
    fromAccountInput.value = item.fromAccount || accounts[0]?.name || '';
    toAccountInput.value = item.toAccount || accounts[0]?.name || '';
  } else {
    accountInput.value = item.account || accounts[0]?.name || '';
  }

  submitButton.textContent = 'Update transaction';
  formModeText.textContent = 'Editing transaction. Save to update or cancel to reset.';
  toggleTransferFields();
}

function refreshApp() {
  populateAccountLists();
  populateAccountsList();
  updateBalances();
  updateExpenseAnalysis();
  updateMonthlySummary();
  renderTransactions();
}

function readReceiptFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = typeInput.value;
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount greater than zero.');
    return;
  }

  const receiptFile = receiptInput.files[0];
  const existingReceipt = editingId ? transactions.find((item) => item.id === editingId)?.receipt : null;
  const receiptData = receiptFile ? await readReceiptFile(receiptFile) : existingReceipt;

  const transaction = {
    id: editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: dateInput.value || new Date().toISOString().slice(0, 10),
    type,
    category: categoryInput.value,
    account: type === 'transfer' ? '' : accountInput.value,
    fromAccount: type === 'transfer' ? fromAccountInput.value : null,
    toAccount: type === 'transfer' ? toAccountInput.value : null,
    amount: amount.toFixed(2),
    description: descriptionInput.value.trim(),
    receipt: receiptData,
  };

  if (type === 'transfer') {
    if (!transaction.fromAccount || !transaction.toAccount) {
      alert('Select both source and destination accounts for a transfer.');
      return;
    }
    if (transaction.fromAccount === transaction.toAccount) {
      alert('Transfer source and destination must be different accounts.');
      return;
    }
  } else if (!transaction.account) {
    alert('Select an account for this transaction.');
    return;
  }

  if (editingId) {
    updateTransaction(transaction);
  } else {
    addTransaction(transaction);
  }

  resetFormState();
});

tableBody.addEventListener('click', (event) => {
  const target = event.target;
  const id = target.dataset.id;
  if (!id) return;

  if (target.classList.contains('edit-button')) {
    startEditTransaction(id);
    return;
  }

  if (target.classList.contains('action-button')) {
    deleteTransaction(id);
  }
});

accountsListEl.addEventListener('click', (event) => {
  const target = event.target;
  const index = target.dataset.index;
  if (index === undefined) return;

  if (target.classList.contains('edit-account')) {
    editAccount(index);
  } else if (target.classList.contains('delete-account')) {
    deleteAccount(index);
  } else if (target.classList.contains('save-edit')) {
    saveAccountEdit(index);
  } else if (target.classList.contains('cancel-edit-account')) {
    cancelAccountEdit(index);
  }
});

addAccountButton.addEventListener('click', addNewAccount);

cancelEditButton.addEventListener('click', resetFormState);

typeInput.addEventListener('change', toggleTransferFields);

function downloadFile(filename, contents) {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const type = isCsv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
  const blobContents = isCsv ? ['\ufeff', contents] : [contents]; // Add BOM for CSV
  const blob = new Blob(blobContents, { type });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function escapeCsvField(field) {
  if (typeof field !== 'string') return field;
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

exportJsonButton.addEventListener('click', () => {
  const exportData = transactions.map((item) => ({
    ...item,
    expenseAmount: item.type === 'expense' ? item.amount : '0.00',
    incomeAmount: item.type === 'income' ? item.amount : '0.00',
    transferAmount: item.type === 'transfer' ? item.amount : '0.00',
  }));
  const json = JSON.stringify(exportData, null, 2);
  downloadFile('finance-data.json', json);
});

exportCsvButton.addEventListener('click', () => {
  const header = ['Date', 'Type', 'Category', 'Account', 'From Account', 'To Account', 'Amount', 'Expense Amount', 'Income Amount', 'Transfer Amount', 'Description', 'Receipt'];
  const rows = transactions.map((item) => {
    const expenseAmount = item.type === 'expense' ? item.amount : '0.00';
    const incomeAmount = item.type === 'income' ? item.amount : '0.00';
    const transferAmount = item.type === 'transfer' ? item.amount : '0.00';
    return [
      item.date,
      item.type,
      escapeCsvField(item.category),
      escapeCsvField(item.account || ''),
      escapeCsvField(item.fromAccount || ''),
      escapeCsvField(item.toAccount || ''),
      item.amount,
      expenseAmount,
      incomeAmount,
      transferAmount,
      escapeCsvField(item.description || ''),
      item.receipt ? 'Included' : 'None',
    ];
  });
  const csv = [header.map(escapeCsvField), ...rows].map((row) => row.join(',')).join('\n');
  downloadFile('finance-data.csv', csv);
});

clearDataButton.addEventListener('click', () => {
  if (!confirm('Clear all saved finance data, including accounts?')) return;
  accounts = [...DEFAULT_ACCOUNTS];
  transactions = [];
  clearLocalData();
  saveAccounts();
  saveTransactions();
  resetFormState();
  refreshApp();
});

async function initApp() {
  async function finishInit() {
    accounts = await loadAccounts();
    transactions = await loadTransactions();
    populateAccountLists();
    resetFormState();
    dateInput.value = new Date().toISOString().slice(0, 10);
    refreshApp();
  }

  if (window.auth) {
    window.auth.onAuthStateChanged(async (user) => {
      if (user) {
        userId = user.uid;
      } else {
        userId = null;
      }
      updateAuthUI(user);
      await finishInit();
      if (user && !user.isAnonymous) {
        saveAccounts();
        saveTransactions();
      }
    });

    // Handle redirect result
    window.auth.getRedirectResult().then((result) => {
      if (result.user) {
        console.log('Signed in via redirect:', result.user.email);
      }
    }).catch((error) => {
      console.error('Redirect sign-in error:', error);
    });
  } else {
    await finishInit();
  }
}

function updateAuthUI(user) {
  if (!user || user.isAnonymous) {
    if (signInButton) {
      signInButton.style.display = 'inline-block';
      signInButton.textContent = 'Sign In with Google';
    }
    if (signOutButton) signOutButton.style.display = 'none';
    if (userStatusEl) userStatusEl.textContent = '';
    return;
  }

  if (signInButton) {
    signInButton.style.display = 'inline-block';
    signInButton.textContent = user.email ? `Sign in as ${user.email}` : 'Sign in';
  }
  if (signOutButton) signOutButton.style.display = 'inline-block';
  if (userStatusEl) {
    userStatusEl.textContent = '';
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

if (signInButton) {
  signInButton.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch((error) => {
      console.error('Google sign-in failed:', error);
    });
  });
}

if (signOutButton) {
  signOutButton.addEventListener('click', () => {
    firebase.auth().signOut().catch((error) => {
      console.error('Sign-out failed:', error);
    });
  });
}
