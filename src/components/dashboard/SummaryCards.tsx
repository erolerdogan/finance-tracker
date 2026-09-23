import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SummaryCardsProps {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
  };
  totalTransactions: number;
  categoryCount: number;
  onOpenCardModal: (type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE') => void;
}

export function SummaryCards({
  summary,
  totalTransactions,
  categoryCount,
  onOpenCardModal,
}: SummaryCardsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => onOpenCardModal('INCOME')}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Total Income</Text>
          <Text style={[styles.amount, { color: '#34C759' }]}>
            €{summary.totalIncome.toFixed(2)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => onOpenCardModal('EXPENSE')}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Total Expenses</Text>
          <Text style={[styles.amount, { color: '#FF3B30' }]}>
            €{summary.totalExpenses.toFixed(2)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.netCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>NET CASH FLOW</Text>
          <Text
            style={[
              styles.netAmount,
              { color: summary.netSavings >= 0 ? '#34C759' : '#FF3B30' },
            ]}
          >
            €{summary.netSavings.toFixed(2)}
          </Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    borderRadius: 16.5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  netCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3 },
  amount: { fontSize: 20, fontWeight: '700' },
  netAmount: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  statsMeta: { alignItems: 'flex-end', justifyContent: 'center' },
  metaText: { fontSize: 11, fontWeight: '500' },
});