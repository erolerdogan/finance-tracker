import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { getCategoryColor } from '@/constants/colors';
import {
  FixedOverrideState,
  getMonthlyCategoryTotals,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../../contexts/ProfileContext';

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

const MONTH_NAMES: Record<string, string> = {
  '2026-01': 'January 2026',
  '2026-02': 'February 2026',
  '2026-03': 'March 2026',
  '2026-04': 'April 2026',
  '2026-05': 'May 2026',
  '2026-06': 'June 2026',
  '2026-07': 'July 2026',
  '2026-08': 'August 2026',
  '2026-09': 'September 2026',
  '2026-10': 'October 2026',
  '2026-11': 'November 2026',
  '2026-12': 'December 2026',
};

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scrubbedMonthKey, setScrubbedMonthKey] = useState<string | null>(null);
  const [scrubbedAmount, setScrubbedAmount] = useState<number | null>(null);

  const [chartData, setChartData] = useState<any[]>([]);
  const [maxChartValue, setMaxChartValue] = useState<number>(100);

  // Drill-down Modals State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedMonthForModal, setSelectedMonthForModal] = useState('');
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [loadingModalTrx, setLoadingModalTrx] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');

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
          const totals = await getMonthlyCategoryTotals(db, m, activeProfileId);
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
        monthKey: item.month,
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
  }, [db, selectedCategory, activeProfileId]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  const handleOpenMonthDetails = async (monthKey: string) => {
    if (!db) return;
    setSelectedMonthForModal(monthKey);
    setListModalVisible(true);
    try {
      setLoadingModalTrx(true);
      const items = await getTransactionsByMonthAndCategory(
        db,
        monthKey,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(items || []);
    } catch (err) {
      console.error('Failed to query month transactions:', err);
    } finally {
      setLoadingModalTrx(false);
    }
  };

  const handleSelectTransactionFromModal = async (trx: Transaction) => {
    setSelectedTransaction(trx);
    if (db) {
      const fixedState = await getTransactionFixedState(db, trx, activeProfileId);
      setCurrentFixedState(fixedState);
    }
  };

  const handleSelectFixedStateInDetail = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;
    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;

    await setMerchantFixedOverride(
      db,
      keyword,
      selectedTransaction.category,
      newState,
      activeProfileId
    );

    setCurrentFixedState(newState);

    if (selectedMonthForModal) {
      const updated = await getTransactionsByMonthAndCategory(
        db,
        selectedMonthForModal,
        selectedCategory,
        activeProfileId
      );
      setModalTransactions(updated || []);
    }
    await loadAnalyticsData();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={{ flex: 1 }}>
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
          {/* Horizontal Filter Pills */}
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
                  onPress={() => {
                    setSelectedCategory(cat);
                    setScrubbedMonthKey(null);
                    setScrubbedAmount(null);
                  }}
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

          {/* 1. Interactive Line Graph Card */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Spending Velocity</Text>
              <Text style={styles.chartHintText}>Drag across chart to scrub</Text>
            </View>

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
                  pointerConfig={{
                    pointerStripUptoDataPoint: true,
                    pointerStripColor: activeColor,
                    pointerStripWidth: 2,
                    strokeDashArray: [4, 4],
                    pointerColor: activeColor,
                    radius: 6,
                    activatePointersOnLongPress: false,
                    pointerVanishDelay: 2000,
                    pointerLabelComponent: (items: any[]) => {
                      const item = items[0];
                      if (!item) return null;
                    
                      if (item.monthKey !== scrubbedMonthKey) {
                        requestAnimationFrame(() => {
                          setScrubbedMonthKey(item.monthKey);
                          setScrubbedAmount(item.value);
                        });
                      }
                    
                      return null;
                    },
                  }}
                />
              </View>
            )}

            {/* Inspect Banner below Chart */}
            {scrubbedMonthKey && scrubbedAmount !== null && (
              <TouchableOpacity
                style={[styles.inspectBanner, { borderLeftColor: activeColor }]}
                activeOpacity={0.8}
                onPress={() => handleOpenMonthDetails(scrubbedMonthKey)}
              >
                <View>
                  <Text style={styles.inspectMonthText}>
                    {MONTH_NAMES[scrubbedMonthKey] || scrubbedMonthKey}
                  </Text>
                  <Text style={styles.inspectAmountText}>
                    €{scrubbedAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.inspectActionBtn}>
                  <Text style={styles.inspectActionText}>Inspect Items</Text>
                  <Ionicons name="chevron-forward" size={14} color="#007AFF" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. Metric Summary Grid */}
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

        {/* Drill-down Transaction List Modal */}
        <TransactionListModal
          visible={listModalVisible}
          listType="EXPENSE"
          selectedMonth={selectedMonthForModal}
          monthNames={MONTH_NAMES}
          transactions={modalTransactions}
          loading={loadingModalTrx}
          onClose={() => setListModalVisible(false)}
          onSelectTransaction={handleSelectTransactionFromModal}
        />

        {/* Individual Transaction Detail Modal */}
        <TransactionDetailModal
          visible={selectedTransaction !== null}
          transaction={selectedTransaction}
          fixedState={currentFixedState}
          onClose={() => setSelectedTransaction(null)}
          onSelectFixedState={handleSelectFixedStateInDetail}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 16, paddingBottom: 32 },

  pillScrollView: { marginBottom: 12, marginTop: 4 },
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
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  chartHintText: { fontSize: 11, color: '#8E8E93' },
  chartWrapper: { alignItems: 'center', paddingTop: 8 },

  inspectBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  inspectMonthText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  inspectAmountText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  inspectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inspectActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },

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