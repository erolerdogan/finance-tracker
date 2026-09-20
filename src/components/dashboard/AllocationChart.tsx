import { getCategoryColor } from '@/constants/colors';
import { CategoryTotal } from '@/db/database';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

function formatCompactCurrency(val: number): string {
  if (val >= 1000) {
    return `€${(val / 1000).toFixed(1)}k`;
  }
  return `€${Math.round(val)}`;
}

interface AllocationChartProps {
  categoryData: CategoryTotal[];
  selectedBarCategory: string | null;
  onBarPress: (categoryName: string) => void;
}

export function AllocationChart({
  categoryData,
  selectedBarCategory,
  onBarPress,
}: AllocationChartProps) {
  if (categoryData.length === 0) return null;

  const maxCategoryAmount = Math.max(...categoryData.map((c) => c.totalAmount || 0), 1);

  const barData = categoryData.slice(0, 6).map((item) => {
    const isSelected = selectedBarCategory === item.category;
    const isDimmed = selectedBarCategory !== null && !isSelected;
    const color = getCategoryColor(item.category);

    return {
      value: Math.round(item.totalAmount),
      label: item.category.length > 6 ? `${item.category.substring(0, 5)}…` : item.category,
      topLabelComponent: () => (
        <View style={styles.barTopLabelContainer}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.barTopLabel, isDimmed && { opacity: 0.3 }]}
          >
            {formatCompactCurrency(item.totalAmount)}
          </Text>
        </View>
      ),
      frontColor: isDimmed ? 'rgba(229, 229, 234, 0.8)' : color,
      onPress: () => onBarPress(item.category),
    };
  });

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.sectionTitle}>Spending Allocation</Text>
        {selectedBarCategory && (
          <TouchableOpacity onPress={() => onBarPress(selectedBarCategory)}>
            <Text style={styles.resetFilterText}>Show All</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.chartWrapper}>
        <BarChart
          data={barData}
          barWidth={24}
          spacing={16}
          roundedTop
          roundedBottom
          hideRules
          xAxisThickness={1}
          yAxisThickness={0}
          xAxisColor="#E5E5EA"
          yAxisTextStyle={{ color: '#8E8E93', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: '#8E8E93', fontSize: 10, fontWeight: '500' }}
          height={130}
          noOfSections={3}
          maxValue={Math.ceil(maxCategoryAmount * 1.25)}
          isAnimated
          animationDuration={300}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  resetFilterText: { fontSize: 12, color: '#007AFF', fontWeight: '500' },
  chartWrapper: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  barTopLabelContainer: {
    width: 48,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTopLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 2,
    textAlign: 'center',
  },
});