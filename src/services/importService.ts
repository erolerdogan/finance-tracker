import { insertTransactions, Transaction } from '@/db/database';
import { SQLiteDatabase } from 'expo-sqlite';

export interface ImportTransactionPayload {
  date: string;
  amount: number;
  rawDescription: string;
  merchant: string;
  category: string;
  monthName?: string;
  isZeroFlagged?: number;
  dateAmbiguous?: number;
}

export interface ImportResultSummary {
  totalProcessed: number;
  insertedCount: number;
  skippedCount: number;
}

/**
 * Normalizes date (YYYY-MM-DD), amount (2 decimal places), and description string 
 * to guarantee identical fingerprint hashes for Excel and CSV rows.
 */
export function generateTransactionHash(date: string, amount: number, rawDescription: string): string {
  // Normalize date string (e.g., extract YYYY-MM-DD from ISO strings)
  const cleanDate = (date || '').split('T')[0].trim();

  // Standardize amount to strict 2-decimal string
  const cleanAmount = Math.abs(Number(amount)).toFixed(2);
  const sign = Number(amount) < 0 ? '-' : '+';

  // Standardize description text
  const cleanDesc = (rawDescription || '')
    .trim()
    .toLowerCase()
    .replace(/^pending:\s*/i, '')
    .replace(/\s+/g, ' ');

  return `${cleanDate}_${sign}${cleanAmount}_${cleanDesc}`;
}

export async function processBatchImport(
  db: SQLiteDatabase,
  items: ImportTransactionPayload[],
  profileId: number = 1
): Promise<ImportResultSummary> {
  if (!items || items.length === 0) {
    return { totalProcessed: 0, insertedCount: 0, skippedCount: 0 };
  }

  // 1. Fetch existing transactions to populate hash set
  const existingRows = await db.getAllAsync<{ date: string; amount: number; rawDescription: string }>(
    `SELECT date, amount, rawDescription FROM transactions WHERE profileId = ?;`,
    [profileId]
  );

  const existingHashSet = new Set<string>(
    existingRows.map((r) => generateTransactionHash(r.date, r.amount, r.rawDescription))
  );

  const cleanTransactionsToInsert: Omit<Transaction, 'id'>[] = [];
  let skippedCount = 0;

  for (const item of items) {
    const hash = generateTransactionHash(item.date, item.amount, item.rawDescription);

    if (existingHashSet.has(hash)) {
      skippedCount++;
    } else {
      existingHashSet.add(hash);
      const cleanDate = (item.date || '').split('T')[0].trim();
      cleanTransactionsToInsert.push({
        profileId,
        date: cleanDate,
        amount: Number(item.amount),
        rawDescription: item.rawDescription,
        merchant: item.merchant,
        category: item.category,
        monthName: item.monthName || cleanDate.slice(0, 7),
        isZeroFlagged: item.isZeroFlagged ?? 0,
        dateAmbiguous: item.dateAmbiguous ?? 0,
      });
    }
  }

  // 2. Insert filtered non-duplicate transactions
  const { insertedCount, skippedCount: dbSkipped } = await insertTransactions(
    db,
    cleanTransactionsToInsert,
    profileId
  );

  return {
    totalProcessed: items.length,
    insertedCount,
    skippedCount: skippedCount + dbSkipped,
  };
}