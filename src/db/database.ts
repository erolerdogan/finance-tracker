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

export interface CategoryGoal {
  category: string;
  monthlyLimit: number;
}

export interface CategoryGoalWithProgress extends CategoryGoal {
  spent: number;
  percentage: number;
}

export interface FixedCostSummary {
  fixedTotal: number;
  flexibleTotal: number;
  fixedPercentage: number;
  flexiblePercentage: number;
  fixedItemsCount: number;
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

// Default Dutch & international fixed cost keywords
const DEFAULT_FIXED_KEYWORDS = [
  'HUUR', 'HYPOTHEEK', 'ZORGVERZEKERING', 'ENERGIE', 'ZIGGO',
  'KPN', 'NETFLIX', 'SPOTIFY', 'ICLOUD', 'WATER', 'STEDIN',
  'ENECO', 'ESSENT', 'VATTENFALL', 'HEALTHCITY', 'BASIC-FIT'
];

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

    CREATE TABLE IF NOT EXISTS category_goals (
      category TEXT PRIMARY KEY,
      monthly_limit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_cost_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL
    );
  `);
}

// Fixed vs. Flexible Costs Summary
export async function getFixedVsFlexibleSummary(
  db: SQLiteDatabase,
  monthName: string
): Promise<FixedCostSummary> {
  if (!db) {
    return {
      fixedTotal: 0,
      flexibleTotal: 0,
      fixedPercentage: 0,
      flexiblePercentage: 0,
      fixedItemsCount: 0,
    };
  }

  try {
    // 1. Fetch user rules and smart detected recurring merchants
    const customRules = await db.getAllAsync<{ keyword: string }>(
      `SELECT keyword FROM fixed_cost_rules;`
    );
    const detectedPatterns = await detectRecurringPatterns(db, 2);

    const recurringKeywords = new Set([
      ...DEFAULT_FIXED_KEYWORDS,
      ...customRules.map((r) => r.keyword.toUpperCase()),
      ...detectedPatterns.map((p) => p.merchant.toUpperCase()),
    ]);

    // 2. Fetch all expenses for active month
    const expenses = await db.getAllAsync<{ amount: number; rawDescription: string; merchant: string }>(
      `SELECT ABS(amount) as amount, rawDescription, merchant 
       FROM transactions 
       WHERE monthName = ? AND amount < 0;`,
      [monthName]
    );

    let fixedTotal = 0;
    let flexibleTotal = 0;
    let fixedItemsCount = 0;

    for (const exp of expenses) {
      const descUpper = `${exp.rawDescription} ${exp.merchant}`.toUpperCase();
      const isFixed = Array.from(recurringKeywords).some((kw) => descUpper.includes(kw));

      if (isFixed) {
        fixedTotal += exp.amount;
        fixedItemsCount += 1;
      } else {
        flexibleTotal += exp.amount;
      }
    }

    const grandTotal = fixedTotal + flexibleTotal;
    const fixedPercentage = grandTotal > 0 ? Math.round((fixedTotal / grandTotal) * 100) : 0;
    const flexiblePercentage = grandTotal > 0 ? 100 - fixedPercentage : 0;

    return {
      fixedTotal,
      flexibleTotal,
      fixedPercentage,
      flexiblePercentage,
      fixedItemsCount,
    };
  } catch (error) {
    console.error('Error in getFixedVsFlexibleSummary:', error);
    return {
      fixedTotal: 0,
      flexibleTotal: 0,
      fixedPercentage: 0,
      flexiblePercentage: 0,
      fixedItemsCount: 0,
    };
  }
}

export async function addFixedCostRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string = 'Subscriptions & Bills'
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO fixed_cost_rules (keyword, category) VALUES (?, ?);`,
    [keyword.toUpperCase(), category]
  );
}

// Category Goals Management
export async function getCategoryGoalsWithProgress(
  db: SQLiteDatabase,
  monthStr: string
): Promise<CategoryGoalWithProgress[]> {
  const query = `
    SELECT 
      c.category,
      COALESCE(g.monthly_limit, 0) as monthlyLimit,
      COALESCE(SUM(ABS(t.amount)), 0) as spent
    FROM (
      SELECT DISTINCT category FROM transactions WHERE amount < 0
      UNION
      SELECT category FROM category_goals
    ) c
    LEFT JOIN category_goals g ON c.category = g.category
    LEFT JOIN transactions t ON c.category = t.category 
      AND t.monthName = ? 
      AND t.amount < 0
    GROUP BY c.category
    ORDER BY spent DESC;
  `;
  const rows = await db.getAllAsync<{ category: string; monthlyLimit: number; spent: number }>(
    query,
    [monthStr]
  );

  return rows.map((r) => {
    const limit = r.monthlyLimit || 0;
    const spent = r.spent || 0;
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      category: r.category,
      monthlyLimit: limit,
      spent: spent,
      percentage: Math.round(percentage),
    };
  });
}

export async function setCategoryGoal(
  db: SQLiteDatabase,
  category: string,
  monthlyLimit: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO category_goals (category, monthly_limit)
     VALUES (?, ?)
     ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit;`,
    [category, monthlyLimit]
  );
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

export interface DetectedRecurringItem {
  merchant: string;
  category: string;
  averageAmount: number;
  type: 'INCOME' | 'EXPENSE';
  occurrenceCount: number; // Number of months detected
  monthsSeen: string[]; // List of YYYY-MM strings
}

/**
 * Smart Pattern Detection: Scans historical transactions across consecutive months
 * to auto-detect recurring fixed expenses and recurring incomes.
 */
export async function detectRecurringPatterns(
  db: SQLiteDatabase,
  minMonthsThreshold: number = 2
): Promise<DetectedRecurringItem[]> {
  if (!db) return [];

  try {
    // Group transactions by merchant/description pattern and month
    const rows = await db.getAllAsync<{
      merchantKey: string;
      category: string;
      monthName: string;
      avgAmount: number;
    }>(`
      SELECT 
        UPPER(TRIM(COALESCE(NULLIF(merchant, 'Unknown'), rawDescription))) AS merchantKey,
        category,
        monthName,
        AVG(amount) AS avgAmount
      FROM transactions
      GROUP BY merchantKey, monthName
      ORDER BY merchantKey, monthName DESC;
    `);

    // Group month occurrences per merchant
    const merchantMap: Record<
      string,
      {
        category: string;
        amounts: number[];
        monthsSeen: string[];
      }
    > = {};

    for (const row of rows) {
      if (!row.merchantKey || row.merchantKey.trim().length === 0) continue;

      if (!merchantMap[row.merchantKey]) {
        merchantMap[row.merchantKey] = {
          category: row.category,
          amounts: [],
          monthsSeen: [],
        };
      }

      merchantMap[row.merchantKey].amounts.push(row.avgAmount);
      merchantMap[row.merchantKey].monthsSeen.push(row.monthName);
    }

    const detectedList: DetectedRecurringItem[] = [];

    for (const [merchant, data] of Object.entries(merchantMap)) {
      // Must appear in at least N distinct months to qualify as recurring
      if (data.monthsSeen.length >= minMonthsThreshold) {
        const sum = data.amounts.reduce((a, b) => a + b, 0);
        const averageAmount = sum / data.amounts.length;

        detectedList.push({
          merchant,
          category: data.category,
          averageAmount,
          type: averageAmount > 0 ? 'INCOME' : 'EXPENSE',
          occurrenceCount: data.monthsSeen.length,
          monthsSeen: data.monthsSeen,
        });
      }
    }

    return detectedList.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
  } catch (error) {
    console.error('Failed to detect recurring patterns:', error);
    return [];
  }
}

/**
 * Evaluates whether a given merchant/description is classified as a Fixed Cost
 * via custom rules, default keywords, OR smart recurring pattern detection.
 */
 export async function isTransactionFixed(
  db: SQLiteDatabase,
  merchantOrDesc: string
): Promise<boolean> {
  if (!db || !merchantOrDesc) return false;
  const targetUpper = merchantOrDesc.toUpperCase().trim();

  // 1. Check custom user rules
  const customRules = await db.getAllAsync<{ keyword: string }>(
    `SELECT keyword FROM fixed_cost_rules;`
  );
  const customKeywords = customRules.map((r) => r.keyword.toUpperCase());

  // 2. Check smart detected recurring patterns
  const detectedPatterns = await detectRecurringPatterns(db, 2);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS,
    ...customKeywords,
    ...detectedKeywords,
  ]);

  return Array.from(allFixedKeywords).some((kw) => targetUpper.includes(kw));
}

export async function toggleFixedCostRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string = 'Subscriptions & Bills'
): Promise<boolean> {
  if (!db || !keyword) return false;
  const kwUpper = keyword.toUpperCase().trim();
  const currentlyFixed = await isTransactionFixed(db, kwUpper);

  if (currentlyFixed) {
    await db.runAsync(`DELETE FROM fixed_cost_rules WHERE keyword = ?;`, [kwUpper]);
    return false; // Now unfixed
  } else {
    await db.runAsync(
      `INSERT OR REPLACE INTO fixed_cost_rules (keyword, category) VALUES (?, ?);`,
      [kwUpper, category]
    );
    return true; // Now fixed
  }
}

export async function getFixedOrFlexibleTransactions(
  db: SQLiteDatabase,
  monthName: string,
  isFixedTarget: boolean
): Promise<Transaction[]> {
  if (!db) return [];

  try {
    const customRules = await db.getAllAsync<{ keyword: string }>(
      `SELECT keyword FROM fixed_cost_rules;`
    );
    const detectedPatterns = await detectRecurringPatterns(db, 2);

    const recurringKeywords = Array.from(
      new Set([
        ...DEFAULT_FIXED_KEYWORDS,
        ...customRules.map((r) => r.keyword.toUpperCase()),
        ...detectedPatterns.map((p) => p.merchant.toUpperCase()),
      ])
    );

    const expenses = await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions WHERE monthName = ? AND amount < 0 ORDER BY ABS(amount) DESC;`,
      [monthName]
    );

    return expenses.filter((exp) => {
      const descUpper = `${exp.rawDescription} ${exp.merchant}`.toUpperCase();
      const isFixed = recurringKeywords.some((kw) => descUpper.includes(kw));
      return isFixedTarget ? isFixed : !isFixed;
    });
  } catch (error) {
    console.error('Error in getFixedOrFlexibleTransactions:', error);
    return [];
  }
}