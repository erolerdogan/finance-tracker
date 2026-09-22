import { FixedCostSummary } from '@/db/database';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FixedFlexibleCardProps {
  summary: FixedCostSummary;
  onPress: () => void;
}

export function FixedFlexibleCard({ summary, onPress }: FixedFlexibleCardProps) {
  const { fixedTotal, flexibleTotal, fixedPercentage, flexiblePercentage, fixedItemsCount } = summary;

  return (
    <TouchableOpacity style={styles.cardContainer} activeOpacity={0.8} onPress={onPress}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Fixed vs. Flexible</Text>
          <Text style={styles.cardSubtitle}>
            {fixedPercentage}% of total spending is locked in
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{fixedItemsCount} Fixed</Text>
        </View>
      </View>

      {/* Two-Tone Progress Bar */}
      <View style={styles.barContainer}>
        <View style={[styles.fixedBar, { width: `${fixedPercentage}%` }]} />
        <View style={[styles.flexibleBar, { width: `${flexiblePercentage}%` }]} />
      </View>

      {/* Metrics Row */}
      <View style={styles.statsRow}>
        {/* Fixed Column */}
        <View style={styles.statCol}>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#5856D6' }]} />
            <Text style={styles.statLabel}>Fixed Overhead</Text>
          </View>
          <Text style={styles.statAmount}>€{fixedTotal.toFixed(0)}</Text>
          <Text style={styles.statPercent}>{fixedPercentage}% of expenses</Text>
        </View>

        <View style={styles.divider} />

        {/* Flexible Column */}
        <View style={styles.statCol}>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#FF9500' }]} />
            <Text style={styles.statLabel}>Flexible Spending</Text>
          </View>
          <Text style={styles.statAmount}>€{flexibleTotal.toFixed(0)}</Text>
          <Text style={styles.statPercent}>{flexiblePercentage}% of expenses</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#5856D615',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5856D6',
  },
  barContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E5EA',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  fixedBar: {
    backgroundColor: '#5856D6',
    height: '100%',
  },
  flexibleBar: {
    backgroundColor: '#FF9500',
    height: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 12,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  statAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statPercent: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
});