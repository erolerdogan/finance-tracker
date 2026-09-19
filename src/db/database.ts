import { SQLiteDatabase } from 'expo-sqlite';

export interface Transaction {
  id: number;
  date: string;
  amount: number; // Signed numeric: negative = Outflow (Expense), positive = Inflow (Income/Refund)
  rawDescription: string;
  merchant: string;
  category: string;
  monthName: string; // Format: YYYY-MM (e.g., "2026-09")
  userOverridden?: number;
  isZeroFlagged?: number; // 1 if amount was $0.00 (pending/reversed)
  dateAmbiguous?: number; // 1 if date format (DD/MM vs MM/DD) is ambiguous
}

export interface CategoryTotal {
  category: string;
  totalAmount: number;
  count: number;
}

export interface CategoryRule {
  id: number;
  keyword: string;
  category: string;
}

export interface TransactionRecord {
  id: number;
  date: string;
  amount: number;
  category: string;
  monthName: string;
  description: string; // Aliased from rawDescription at query time
  rawDescription?: string;
}

export interface MonthlyTrend {
  monthName: string; // e.g., "2026-01"
  totalAmount: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
}

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      rawDescription TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      monthName TEXT NOT NULL,
      userOverridden INTEGER DEFAULT 0,
      isZeroFlagged INTEGER DEFAULT 0,
      dateAmbiguous INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL
    );
  `);
}

// Transaction Writes & Management
export async function insertTransactions(
  db: SQLiteDatabase,
  transactions: Omit<Transaction, 'id'>[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      await db.runAsync(
        `INSERT INTO transactions
           (date, amount, rawDescription, merchant, category, monthName, isZeroFlagged, dateAmbiguous)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          tx.date,
          Number(tx.amount), // Force floating-point representation
          tx.rawDescription,
          tx.merchant,
          tx.category,
          tx.monthName,
          tx.isZeroFlagged ?? 0,
          tx.dateAmbiguous ?? 0,
        ]
      );
    }
  });
}

export async function clearAllTransactions(db: SQLiteDatabase): Promise<void> {
  if (!db) return;
  await db.runAsync(`DELETE FROM transactions;`);
}

export async function updateTransactionCategory(
  db: SQLiteDatabase,
  id: number,
  category: string
): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET category = ?, userOverridden = 1 WHERE id = ?;`,
    [category, id]
  );
}

// Date & Overview Queries
export async function getAvailableMonths(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ monthName: string }>(
    `SELECT DISTINCT monthName FROM transactions ORDER BY monthName DESC;`
  );
  return rows.map((r) => r.monthName);
}

export async function getMonthlySummary(
  db: SQLiteDatabase,
  monthName: string
): Promise<MonthlySummary> {
  const result = await db.getFirstAsync<{ totalIncome: number; totalExpenses: number }>(
    `SELECT 
       TOTAL(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS totalIncome,
       TOTAL(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS totalExpenses
     FROM transactions
     WHERE monthName = ?;`,
    [monthName]
  );

  const totalIncome = result?.totalIncome ?? 0;
  const totalExpenses = result?.totalExpenses ?? 0;

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
  };
}

export async function getMonthlyCategoryTotals(
  db: SQLiteDatabase,
  monthName: string
): Promise<CategoryTotal[]> {
  if (!db) return [];

  try {
    const query = `
      SELECT category, TOTAL(ABS(amount)) as totalAmount, COUNT(*) as count
      FROM transactions
      WHERE monthName = ? AND amount < 0
      GROUP BY category
      ORDER BY totalAmount DESC;
    `;
    return await db.getAllAsync<CategoryTotal>(query, [monthName]);
  } catch (error) {
    console.error('Error in getMonthlyCategoryTotals:', error);
    return [];
  }
}

export async function getFullYearSpendingTrend(
  db: SQLiteDatabase,
  year: string = '2026',
  category?: string
): Promise<MonthlyTrend[]> {
  try {
    let query = `
      SELECT monthName, TOTAL(ABS(amount)) as totalAmount
      FROM transactions
      WHERE monthName LIKE ? AND amount < 0
    `;
    const params: string[] = [`${year}-%`];

    if (category && category !== 'All') {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` GROUP BY monthName ORDER BY monthName ASC;`;

    return await db.getAllAsync<MonthlyTrend>(query, params);
  } catch (error) {
    console.error('Error fetching yearly trend:', error);
    return [];
  }
}

// Filtered Transaction Queries
export async function getFilteredTransactions(
  db: SQLiteDatabase,
  monthName: string,
  typeFilter: 'EXPENSE' | 'INCOME' | 'ALL' = 'ALL'
): Promise<Transaction[]> {
  let query = `SELECT * FROM transactions WHERE monthName = ?`;
  const params: (string | number)[] = [monthName];

  if (typeFilter === 'EXPENSE') {
    query += ` AND amount < 0`;
  } else if (typeFilter === 'INCOME') {
    query += ` AND amount > 0`;
  }

  query += ` ORDER BY date DESC, id DESC;`;
  return await db.getAllAsync<Transaction>(query, params);
}

export async function getTransactionsByMonth(
  db: SQLiteDatabase,
  monthName: string,
  searchQuery: string = '',
  categoryFilter: string = 'ALL'
): Promise<Transaction[]> {
  let query = `SELECT * FROM transactions WHERE monthName = ?`;
  const params: (string | number)[] = [monthName];

  if (categoryFilter !== 'ALL') {
    query += ` AND category = ?`;
    params.push(categoryFilter);
  }

  if (searchQuery.trim().length > 0) {
    query += ` AND (rawDescription LIKE ? OR merchant LIKE ?)`;
    const searchPattern = `%${searchQuery.trim()}%`;
    params.push(searchPattern, searchPattern);
  }

  query += ` ORDER BY date DESC, id DESC;`;

  return await db.getAllAsync<Transaction>(query, params);
}

export async function getTransactionsByMonthAndCategory(
  db: SQLiteDatabase,
  monthName: string,
  category: string
): Promise<Transaction[]> {
  try {
    const query = `
      SELECT * FROM transactions
      WHERE monthName = ? AND category = ?
      ORDER BY date DESC;
    `;
    return await db.getAllAsync<Transaction>(query, [monthName, category]);
  } catch (error) {
    console.error('Error in getTransactionsByMonthAndCategory:', error);
    return [];
  }
}

export async function searchTransactions(
  db: SQLiteDatabase,
  searchQuery: string = '',
  category: string = 'All'
): Promise<TransactionRecord[]> {
  if (!db) return [];

  try {
    let sql = `
      SELECT id, date, amount, category, monthName, rawDescription AS description, rawDescription
      FROM transactions
      WHERE 1=1
    `;
    const params: string[] = [];

    if (searchQuery.trim().length > 0) {
      sql += ` AND (rawDescription LIKE ? OR merchant LIKE ? OR category LIKE ?)`;
      const term = `%${searchQuery.trim()}%`;
      params.push(term, term, term);
    }

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY date DESC LIMIT 200;`;

    return await db.getAllAsync<TransactionRecord>(sql, params);
  } catch (error) {
    console.error('Error searching transactions:', error);
    return [];
  }
}

export async function getCategoryTransactionsForMonth(
  db: SQLiteDatabase,
  monthName: string,
  category: string
): Promise<TransactionRecord[]> {
  if (!db) return [];

  try {
    const query = `
      SELECT id, date, amount, category, monthName, rawDescription AS description
      FROM transactions
      WHERE monthName = ? AND category = ?
      ORDER BY date DESC;
    `;
    return await db.getAllAsync<TransactionRecord>(query, [monthName, category]);
  } catch (error) {
    console.error('Error fetching category transactions:', error);
    return [];
  }
}

// Custom Rules Queries
export async function getCustomRules(db: SQLiteDatabase): Promise<CategoryRule[]> {
  return await db.getAllAsync<CategoryRule>(`SELECT * FROM category_rules ORDER BY keyword ASC;`);
}

export async function addCustomRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO category_rules (keyword, category) VALUES (?, ?);`,
    [keyword.toUpperCase(), category]
  );
}

export async function deleteCustomRule(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM category_rules WHERE id = ?;`, [id]);
}

export interface YearlyTrendPoint {
  monthName: string; // "2026-01"
  income: number;
  expenses: number;
  net: number;
}

export async function getFullYearTrendData(
  db: SQLiteDatabase,
  year: string = '2026'
): Promise<YearlyTrendPoint[]> {
  const rows = await db.getAllAsync<{ monthName: string; income: number; expenses: number }>(
    `SELECT 
       monthName,
       TOTAL(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
       TOTAL(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
     FROM transactions
     WHERE monthName LIKE ?
     GROUP BY monthName
     ORDER BY monthName ASC;`,
    [`${year}-%`]
  );

  return rows.map((r) => ({
    monthName: r.monthName,
    income: r.income,
    expenses: r.expenses,
    net: r.income - r.expenses,
  }));
}

export async function clearAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM transactions;');
}