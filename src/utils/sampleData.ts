import { ImportTransactionPayload, processBatchImport } from '@/services/importService';
import { SQLiteDatabase } from 'expo-sqlite';

export async function generateSampleData(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<number> {
  const months = [
    '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08',
    '2026-09', '2026-10', '2026-11', '2026-12'
  ];

  const sampleTransactions: ImportTransactionPayload[] = [];

  for (const m of months) {
    // -------------------------------------------------------------
    // 1. INCOME (Multiple sources: Salary + Side/Freelance Transfer)
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-01`,
        amount: 3200.00,
        rawDescription: 'SALARY EMPLOYER BV MONTHLY PAYROLL',
        merchant: 'Employer BV',
        category: 'Income',
        monthName: m,
      },
      {
        date: `${m}-15`,
        amount: 350.00,
        rawDescription: 'WISE PAYMENTS FREELANCE ADVISORY',
        merchant: 'Wise',
        category: 'Income',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 2. HOUSING & FIXED UTILITIES
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-02`,
        amount: -1150.00,
        rawDescription: 'VESTEDA HOUSING MORTGAGE / RENT',
        merchant: 'Vesteda',
        category: 'Housing',
        monthName: m,
      },
      {
        date: `${m}-03`,
        amount: -420.00,
        rawDescription: 'KOREIN KINDEROPVANG NURSERY',
        merchant: 'Korein',
        category: 'Childcare',
        monthName: m,
      },
      {
        date: `${m}-10`,
        amount: -110.00,
        rawDescription: 'ZIGGO INTERNET & TV SUBSCRIPTION',
        merchant: 'Ziggo',
        category: 'Utilities & Telecom',
        monthName: m,
      },
      {
        date: `${m}-12`,
        amount: -145.00,
        rawDescription: 'VATTENFALL ENERGY & GAS',
        merchant: 'Vattenfall',
        category: 'Utilities & Telecom',
        monthName: m,
      },
      {
        date: `${m}-14`,
        amount: -42.50,
        rawDescription: 'BRABANT WATER SUPPLY',
        merchant: 'Brabant Water',
        category: 'Utilities & Telecom',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 3. GROCERIES (4-5 Transactions per month)
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-04`,
        amount: -88.40,
        rawDescription: 'ALBERT HEIJN EINDHOVEN',
        merchant: 'Albert Heijn',
        category: 'Groceries',
        monthName: m,
      },
      {
        date: `${m}-11`,
        amount: -64.20,
        rawDescription: 'JUMBO SUPERMARKT EINDHOVEN',
        merchant: 'Jumbo',
        category: 'Groceries',
        monthName: m,
      },
      {
        date: `${m}-18`,
        amount: -92.50,
        rawDescription: 'LIDL EINDHOVEN GROCERIES',
        merchant: 'Lidl',
        category: 'Groceries',
        monthName: m,
      },
      {
        date: `${m}-25`,
        amount: -78.10,
        rawDescription: 'ALBERT HEIJN EINDHOVEN',
        merchant: 'Albert Heijn',
        category: 'Groceries',
        monthName: m,
      },
      {
        date: `${m}-28`,
        amount: -34.80,
        rawDescription: 'EKOPLAZA ORGANIC MARKET',
        merchant: 'Ekoplaza',
        category: 'Groceries',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 4. TRANSPORTATION (EV Charging & Public Transport)
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-06`,
        amount: -28.50,
        rawDescription: 'QWELLO CHARGING EV EINDHOVEN',
        merchant: 'Qwello',
        category: 'Transportation',
        monthName: m,
      },
      {
        date: `${m}-16`,
        amount: -32.10,
        rawDescription: 'QWELLO CHARGING EV EINDHOVEN',
        merchant: 'Qwello',
        category: 'Transportation',
        monthName: m,
      },
      {
        date: `${m}-21`,
        amount: -45.00,
        rawDescription: 'SHELL RECHARGE EV STRENGTH',
        merchant: 'Shell',
        category: 'Transportation',
        monthName: m,
      },
      {
        date: `${m}-24`,
        amount: -18.60,
        rawDescription: 'NS-REIZEN TRAIN TICKET AMSTERDAM',
        merchant: 'NS',
        category: 'Transportation',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 5. DINING OUT & ENTERTAINMENT
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-07`,
        amount: -52.40,
        rawDescription: 'RESTAURANT LS DODO EINDHOVEN',
        merchant: 'Ls Dodo',
        category: 'Dining Out',
        monthName: m,
      },
      {
        date: `${m}-13`,
        amount: -24.50,
        rawDescription: 'UBER EATS TAKEAWAY',
        merchant: 'Uber Eats',
        category: 'Dining Out',
        monthName: m,
      },
      {
        date: `${m}-20`,
        amount: -68.90,
        rawDescription: 'CAFE DOWNTOWN DRINKS & DINNER',
        merchant: 'Downtown Cafe',
        category: 'Dining Out',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 6. HEALTH & CARE
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-09`,
        amount: -38.50,
        rawDescription: 'KRUIDVAT PHARMACY & CARE',
        merchant: 'Kruidvat',
        category: 'Health & Care',
        monthName: m,
      },
      {
        date: `${m}-22`,
        amount: -22.90,
        rawDescription: 'ETOS PERSONAL HYGIENE',
        merchant: 'Etos',
        category: 'Health & Care',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 7. SHOPPING & RETAIL
    // -------------------------------------------------------------
    sampleTransactions.push(
      {
        date: `${m}-17`,
        amount: -49.99,
        rawDescription: 'BOL.COM ONLINE RETAIL',
        merchant: 'Bol.com',
        category: 'Shopping & Retail',
        monthName: m,
      },
      {
        date: `${m}-26`,
        amount: -85.00,
        rawDescription: 'DECATHLON SPORTING GOODS',
        merchant: 'Decathlon',
        category: 'Shopping & Retail',
        monthName: m,
      }
    );

    // -------------------------------------------------------------
    // 8. QUARTERLY & SEASONAL EXPENSES (Taxes, Babypark, Insurance)
    // -------------------------------------------------------------
    if (['2026-03', '2026-06', '2026-09', '2026-12'].includes(m)) {
      sampleTransactions.push({
        date: `${m}-27`,
        amount: -185.00,
        rawDescription: 'GEMEENTE BELASTING EINDHOVEN TAX',
        merchant: 'Gemeente Eindhoven',
        category: 'Taxes & Municipal Fees',
        monthName: m,
      });
    }

    if (['2026-02', '2026-05', '2026-08', '2026-11'].includes(m)) {
      sampleTransactions.push({
        date: `${m}-19`,
        amount: -210.00,
        rawDescription: 'BABYPARK EINDHOVEN INFANT GEAR',
        merchant: 'Babypark',
        category: 'Childcare',
        monthName: m,
      });
    }
  }

  const summary = await processBatchImport(db, sampleTransactions, profileId);
  return summary.insertedCount;
}