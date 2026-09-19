import { getCategoryColor } from '@/constants/colors';
import { getMonthlyCategoryTotals } from '@/db/database';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const CATEGORIES = [
  'All',
  'Housing',
  'Childcare',
  'Groceries',
  'Dining Out',
  'Transportation',
  'Utilities & Telecom',
  'Health & Care',
  'Shopping & Retail',
  'Taxes & Municipal Fees',
];

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [chartData, setChartData] = useState<any[]>([]);
  const [maxChartValue, setMaxChartValue] = useState<number>(100);
  const [summary, setSummary] = useState({
    total: 0,
    average: 0,
    highestMonth: '-',
    lowestMonth: '-',
  });

  const activeColor = getCategoryColor(selectedCategory);

  const loadAnalyticsData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      const months = [
        '2026-01', '2026-02', '2026-03', '2026-04',
        '2026-05', '2026-06', '2026-07', '2026-08',
        '2026-09', '2026-10', '2026-11', '2026-12'
      ];

      const monthlyTotals = await Promise.all(
        months.map(async (m) => {
          const totals = await getMonthlyCategoryTotals(db, m);
          let sum = 0;
          if (selectedCategory === 'All') {
            sum = totals.reduce((acc, curr) => acc + curr.totalAmount, 0);
          } else {
            const match = totals.find((c) => c.category === selectedCategory);
            sum = match ? match.totalAmount : 0;
          }
          return { month: m, amount: sum };
        })
      );

      const values = monthlyTotals.map((m) => m.amount);
      const peakVal = Math.max(...values, 10);
      const calculatedMax = Math.ceil(peakVal * 1.15);
      setMaxChartValue(calculatedMax);

      const formattedChartData = monthlyTotals.map((item) => ({
        value: Math.round(item.amount),
        label: item.month.split('-')[1],
        dataPointColor: activeColor,
      }));

      const total = values.reduce((a, b) => a + b, 0);
      const avg = total / (values.length || 1);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values.filter((v) => v > 0));

      const highest = monthlyTotals.find((m) => m.amount === maxVal)?.month || '-';
      const lowest = monthlyTotals.find((m) => m.amount === minVal)?.month || '-';

      setChartData(formattedChartData);
      setSummary({
        total,
        average: avg,
        highestMonth: highest,
        lowestMonth: lowest,
      });
    } catch (error) {
      console.error('Failed to query analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedCategory, activeColor]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadAnalyticsData();
          }}
        />
      }
    >
      {/* Title Header Bar */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Yearly spending trends</Text>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: `${activeColor}15` }]}>
          <View style={[styles.dot, { backgroundColor: activeColor }]} />
          <Text style={[styles.badgeText, { color: activeColor }]}>{selectedCategory}</Text>
        </View>
      </View>

      {/* Horizontal Filter Pills (Replaces Dropdown) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScrollView}
        contentContainerStyle={styles.pillContainer}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          const color = getCategoryColor(cat);

          return (
            <TouchableOpacity
              key={cat}
              activeOpacity={0.7}
              style={[
                styles.chipPill,
                isActive && { backgroundColor: color },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              {!isActive && (
                <View style={[styles.miniDot, { backgroundColor: color }]} />
              )}
              <Text
                style={[
                  styles.chipText,
                  isActive && styles.chipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Line Graph Card with Dynamic Y-Axis Auto-Scaling */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>2026 Spending Velocity</Text>
        {loading && !refreshing ? (
          <ActivityIndicator size="small" color={activeColor} style={{ paddingVertical: 40 }} />
        ) : (
          <View style={styles.chartWrapper}>
            <LineChart
              key={selectedCategory}
              data={chartData}
              maxValue={maxChartValue}
              noOfSections={3}
              color={activeColor}
              thickness={2.5}
              startFillColor={`${activeColor}33`}
              endFillColor={`${activeColor}00`}
              startOpacity={0.3}
              endOpacity={0.0}
              areaChart
              hideDataPoints={false}
              dataPointsColor={activeColor}
              dataPointsRadius={4}
              curved
              height={140}
              spacing={24}
              xAxisThickness={1}
              yAxisThickness={0}
              xAxisColor="#E5E5EA"
              yAxisTextStyle={{ color: '#8E8E93', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#8E8E93', fontSize: 10 }}
            />
          </View>
        )}
      </View>

      {/* Metric Summary Grid */}
      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Year Spending</Text>
          <Text style={[styles.metricValue, { color: activeColor }]}>
            €{summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Monthly Average</Text>
          <Text style={styles.metricValue}>
            €{summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Peak Month</Text>
          <Text style={styles.metricValue}>{summary.highestMonth}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Lowest Month</Text>
          <Text style={styles.metricValue}>{summary.lowestMonth}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  
  pillScrollView: { marginBottom: 16 },
  pillContainer: { gap: 8, paddingRight: 10 },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  chipTextActive: {
    color: '#FFF',
  },

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
  chartTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 12 },
  chartWrapper: { alignItems: 'center', paddingTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginTop: 4 },
});