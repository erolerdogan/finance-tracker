import { MonthlySummary } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SummaryCardsProps {
  summary: MonthlySummary;
  totalTransactions: number;
  categoryCount: number;
  onOpenCardModal: (type: 'INCOME' | 'EXPENSE') => void;
}

export function SummaryCards({
  summary,
  totalTransactions,
  categoryCount,
  onOpenCardModal,
}: SummaryCardsProps) {
  const isPositiveNet = summary.netSavings >= 0;

  return (
    <View style={styles.summaryContainer}>
      <View style={styles.cardRow}>
        {/* Income Card */}
        <TouchableOpacity
          style={[styles.card, styles.incomeCard]}
          activeOpacity={0.8}
          onPress={() => onOpenCardModal('INCOME')}
        >
          <View style={styles.cardHeaderWithIcon}>
            <Text style={styles.cardLabel}>INCOME</Text>
            <Ionicons name="open-outline" size={12} color="#34C759" />
          </View>
          <Text style={styles.incomeText}>
            +€{summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </TouchableOpacity>

        {/* Expenses Card */}
        <TouchableOpacity
          style={[styles.card, styles.expenseCard]}
          activeOpacity={0.8}
          onPress={() => onOpenCardModal('EXPENSE')}
        >
          <View style={styles.cardHeaderWithIcon}>
            <Text style={styles.cardLabel}>EXPENSES</Text>
            <Ionicons name="open-outline" size={12} color="#FF3B30" />
          </View>
          <Text style={styles.expenseText}>
            -€{summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Net Cash Flow Card */}
      <View style={styles.netCard}>
        <View>
          <Text style={styles.netLabel}>NET CASH FLOW</Text>
        </View>
        <Text style={[styles.netText, { color: isPositiveNet ? '#34C759' : '#FF3B30' }]}>
          {isPositiveNet ? '+' : ''}€
          {summary.netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryContainer: { marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#FFF' },
  cardHeaderWithIcon: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  incomeCard: { borderLeftWidth: 4, borderLeftColor: '#34C759' },
  expenseCard: { borderLeftWidth: 4, borderLeftColor: '#FF3B30' },
  cardLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '700', letterSpacing: 0.5 },
  incomeText: { fontSize: 18, fontWeight: '700', color: '#34C759' },
  expenseText: { fontSize: 18, fontWeight: '700', color: '#FF3B30' },
  netCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5 },
  netSubtext: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  netText: { fontSize: 20, fontWeight: '800' },
});