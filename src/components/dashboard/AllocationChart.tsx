import { getCategoryColor } from '@/constants/colors';
import { CategoryTotal, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface AllocationChartProps {
  categoryData: CategoryTotal[];
  selectedBarCategory: string | null;
  selectedCategoryTransactions: Transaction[];
  loadingTransactions: boolean;
  onBarPress: (categoryName: string) => void;
  onSelectTransaction: (trx: Transaction) => void;
}

export function AllocationChart({
  categoryData,
  selectedBarCategory,
  selectedCategoryTransactions,
  loadingTransactions,
  onBarPress,
  onSelectTransaction,
}: AllocationChartProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  if (categoryData.length === 0) return null;

  const totalSpending = categoryData.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const displayedCategories = showAllCategories ? categoryData : categoryData.slice(0, 4);

  // Geometry Setup for Hero Donut Chart
  const radius = 68;
  const strokeWidth = 18;
  const center = radius + strokeWidth;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  return (
    <View style={styles.chartCard}>
      {/* Header */}
      <View style={styles.chartHeaderRow}>
        <Text style={styles.sectionTitle}>Spending Allocation</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (selectedBarCategory) {
              onBarPress(selectedBarCategory);
            } else {
              setShowAllCategories(!showAllCategories);
            }
          }}
        >
          <Text style={styles.resetFilterText}>
            {selectedBarCategory ? 'Show All Categories' : showAllCategories ? 'Collapse' : 'Show All'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero Donut Chart */}
      <View style={styles.centerChartWrapper}>
        <View style={styles.svgContainer}>
          <Svg width={center * 2} height={center * 2}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              {displayedCategories.map((item, index) => {
                const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
                const strokeDasharray = `${(circumference * percentage) / 100} ${circumference}`;
                const strokeDashoffset = -((circumference * accumulatedPercentage) / 100);
                accumulatedPercentage += percentage;

                const isSelected = selectedBarCategory === item.category;
                const isDimmed = selectedBarCategory !== null && !isSelected;
                const color = isDimmed ? '#E5E5EA' : getCategoryColor(item.category);

                return (
                  <Path
                    key={`${item.category}-${index}`}
                    d={`M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centerTextContainer}>
            <Text style={styles.totalAmount}>€{totalSpending.toFixed(0)}</Text>
            <Text style={styles.totalLabel}>Total Expenses</Text>
          </View>
        </View>
      </View>

      {/* Structured Category List with Inline Item Breakdown */}
      <View style={styles.bottomLegendList}>
        {displayedCategories.map((item) => {
          const percentage = totalSpending > 0 ? (item.totalAmount / totalSpending) * 100 : 0;
          const isSelected = selectedBarCategory === item.category;
          const isDimmed = selectedBarCategory !== null && !isSelected;
          const color = getCategoryColor(item.category);

          return (
            <View key={item.category} style={styles.categoryContainer}>
              <TouchableOpacity
                style={[styles.legendRow, isSelected && styles.legendRowActive]}
                activeOpacity={0.7}
                onPress={() => onBarPress(item.category)}
              >
                <View style={styles.legendLeft}>
                  <View style={[styles.dot, { backgroundColor: isDimmed ? '#C7C7CC' : color }]} />
                  <Text style={[styles.legendLabel, isDimmed && styles.dimmedText]} numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>

                <View style={styles.legendRight}>
                  <Text style={[styles.amountText, isDimmed && styles.dimmedText]}>
                    €{item.totalAmount.toFixed(0)}
                  </Text>
                  <Text style={[styles.percentBadge, isDimmed && styles.dimmedBadge]}>
                    {percentage.toFixed(0)}%
                  </Text>
                  <Ionicons
                    name={isSelected ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#8E8E93"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>

              {/* Inline Items List directly inside the Spending Allocation Card */}
              {isSelected && (
                <View style={styles.inlineTrxContainer}>
                  {loadingTransactions ? (
                    <ActivityIndicator size="small" color="#007AFF" style={{ paddingVertical: 10 }} />
                  ) : selectedCategoryTransactions.length === 0 ? (
                    <Text style={styles.noTrxText}>No recorded items for this category.</Text>
                  ) : (
                    selectedCategoryTransactions.map((trx, idx) => {
                      const isLast = idx === selectedCategoryTransactions.length - 1;
                      return (
                        <TouchableOpacity
                          key={trx.id}
                          style={[styles.trxRow, !isLast && styles.trxRowBorder]}
                          activeOpacity={0.7}
                          onPress={() => onSelectTransaction(trx)}
                        >
                          <View style={styles.trxLeft}>
                            <Ionicons name="receipt-outline" size={13} color="#8E8E93" style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.trxDesc} numberOfLines={1}>
                                {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
                              </Text>
                              <Text style={styles.trxDate}>{trx.date}</Text>
                            </View>
                          </View>
                          <Text style={[styles.trxAmount, { color: trx.amount < 0 ? '#1C1C1E' : '#34C759' }]}>
                            {trx.amount < 0 ? `-€${Math.abs(trx.amount).toFixed(2)}` : `+€${trx.amount.toFixed(2)}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })}

        {!showAllCategories && categoryData.length > 4 && (
          <TouchableOpacity
            style={styles.expandLegendBtn}
            activeOpacity={0.7}
            onPress={() => setShowAllCategories(true)}
          >
            <Text style={styles.expandLegendText}>
              View All {categoryData.length} Categories
            </Text>
            <Ionicons name="chevron-down" size={14} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  resetFilterText: { fontSize: 12, color: '#007AFF', fontWeight: '600' },

  centerChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  svgContainer: {
    position: 'relative',
    width: (68 + 18) * 2,
    height: (68 + 18) * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  totalLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 1,
  },

  bottomLegendList: {
    marginTop: 8,
    gap: 6,
  },
  categoryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FAF9F9',
  },
  legendRowActive: {
    backgroundColor: '#E6F0FF',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  percentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dimmedText: {
    color: '#C7C7CC',
  },
  dimmedBadge: {
    backgroundColor: '#F2F2F7',
    color: '#C7C7CC',
  },

  /* Inline Item List Styling */
  inlineTrxContainer: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -4,
  },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  trxRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  trxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  trxDesc: { fontSize: 12, fontWeight: '500', color: '#1C1C1E' },
  trxDate: { fontSize: 10, color: '#8E8E93', marginTop: 1 },
  trxAmount: { fontSize: 12, fontWeight: '600' },
  noTrxText: { fontSize: 11, color: '#8E8E93', fontStyle: 'italic', paddingVertical: 6 },

  expandLegendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  expandLegendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
});