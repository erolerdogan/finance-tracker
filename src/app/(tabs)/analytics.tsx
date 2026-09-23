import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FixedOverrideState,
  getAnnualTrendWithBudget,
  getCategoryGoal,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory,
  setCategoryGoal,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scrubbedMonthKey, setScrubbedMonthKey] = useState<string | null>(null);
  const [scrubbedAmount, setScrubbedAmount] = useState<number | null>(null);

  const [chartData, setChartData] = useState<any[]>([]);
  const [maxChartValue, setMaxChartValue] = useState<number>(100);
  const [categoryBudget, setCategoryBudget] = useState<number>(0);

  // Inline Quick-Set Budget State
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineInputVal, setInlineInputVal] = useState('');

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

      const trendWithBudget = await getAnnualTrendWithBudget(db, '2026', selectedCategory, activeProfileId);
      const currentGoal = await getCategoryGoal(db, selectedCategory, activeProfileId);
      setCategoryBudget(currentGoal);

      const values = trendWithBudget.map((m) => m.totalAmount);
      const peakVal = Math.max(...values, currentGoal, 10);
      const calculatedMax = Math.ceil(peakVal * 1.15);
      setMaxChartValue(calculatedMax);

      const formattedChartData = trendWithBudget.map((item) => {
        const hasData = item.totalAmount > 0;
        const val = hasData ? Math.round(item.totalAmount) : 0;
        const limit = item.budgetLimit;

        let ptColor = activeColor;
        if (limit > 0 && hasData) {
          if (val > limit) ptColor = '#FF3B30'; // Red
          else if (val === limit) ptColor = '#FFCC00'; // Yellow
          else ptColor = '#34C759'; // Green
        }

        return {
          value: val,
          label: item.monthName.split('-')[1],
          monthKey: item.monthName,
          // If no data exists for this month, hide the dot and make the point non-interactive/invisible!
          hideDataPoint: !hasData,
          dataPointColor: hasData ? ptColor : 'transparent',
          customDataPoint: hasData
            ? () => (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: ptColor,
                    borderWidth: 2,
                    borderColor: colors.card,
                  }}
                />
              )
            : undefined,
        };
      });

      const total = values.reduce((a, b) => a + b, 0);
      const avg = total / (values.length || 1);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values.filter((v) => v > 0));

      const highest = trendWithBudget.find((m) => m.totalAmount === maxVal)?.monthName || '-';
      const lowest = trendWithBudget.find((m) => m.totalAmount === minVal)?.monthName || '-';

      setChartData(formattedChartData);
      setSummary({
        total,
        average: avg,
        highestMonth: highest !== '-' ? highest : '-',
        lowestMonth: lowest !== '-' ? lowest : '-',
      });
    } catch (error) {
      console.error('Failed to query analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedCategory, activeProfileId, colors.card]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setIsEditingInline(false);
    setScrubbedMonthKey(null);
    setScrubbedAmount(null);
  };

  const handleSaveInlineBudget = async () => {
    if (!db) return;
    const parsed = parseFloat(inlineInputVal);
    if (!isNaN(parsed) && parsed >= 0) {
      await setCategoryGoal(db, selectedCategory, parsed, activeProfileId);
      setCategoryBudget(parsed);
    } else if (inlineInputVal === '' || parsed === 0) {
      await setCategoryGoal(db, selectedCategory, 0, activeProfileId);
      setCategoryBudget(0);
    }
    setIsEditingInline(false);
    await loadAnalyticsData();
  };

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadAnalyticsData();
              }}
            />
          }
        >
          {/* Top Header Bar with Settings Icon */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
            <TouchableOpacity
              style={[
                styles.settingsHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              activeOpacity={0.8}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

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
                    { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' },
                    isActive && { backgroundColor: color },
                  ]}
                  onPress={() => handleSelectCategory(cat)}
                >
                  {!isActive && (
                    <View style={[styles.miniDot, { backgroundColor: color }]} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      isActive && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Inline Budget Quick-Set Banner */}
          <View style={[styles.budgetBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.budgetBannerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                <Ionicons name="flag-outline" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.budgetBannerTitle, { color: colors.text }]}>
                  {selectedCategory === 'All' ? 'Overall Monthly Budget' : `${selectedCategory} Budget`}
                </Text>

                {isEditingInline ? (
                  <View style={styles.inlineInputRow}>
                    <TextInput
                      style={[
                        styles.inlineInput,
                        {
                          backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={inlineInputVal}
                      onChangeText={setInlineInputVal}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.inlineSaveBtn, { backgroundColor: colors.accent }]}
                      onPress={handleSaveInlineBudget}
                    >
                      <Text style={styles.inlineSaveText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inlineCancelBtn}
                      onPress={() => setIsEditingInline(false)}
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.budgetBannerSub, { color: colors.textSecondary }]}>
                    {categoryBudget > 0 ? `Limit: €${categoryBudget.toFixed(0)} / month` : 'No budget set for this category'}
                  </Text>
                )}
              </View>
            </View>

            {!isEditingInline && (
              <TouchableOpacity
                style={[styles.quickEditActionBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                onPress={() => {
                  setInlineInputVal(categoryBudget > 0 ? categoryBudget.toString() : '');
                  setIsEditingInline(true);
                }}
              >
                <Text style={[styles.quickEditText, { color: colors.accent }]}>
                  {categoryBudget > 0 ? 'Edit' : 'Set Limit'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 1. Interactive Line Graph Card */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Spending Velocity</Text>
              <Text style={[styles.chartHintText, { color: colors.textSecondary }]}>Drag to scrub trend</Text>
            </View>

            {loading && !refreshing ? (
              <ActivityIndicator size="small" color={activeColor} style={{ paddingVertical: 40 }} />
            ) : (
              <View style={styles.chartWrapper}>
                <LineChart
                  key={`${selectedCategory}-${categoryBudget}`}
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
                  curved
                  height={140}
                  spacing={24}
                  xAxisThickness={1}
                  yAxisThickness={0}
                  xAxisColor={colors.border}
                  yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                  {...(categoryBudget > 0
                    ? {
                        showReferenceLine1: true,
                        referenceLine1Position: categoryBudget,
                        referenceLine1Config: {
                          color: '#FF3B30',
                          thickness: 1.5,
                          dashWidth: 4,
                          dashGap: 4,
                        },
                      }
                    : {})}
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
                style={[
                  styles.inspectBanner,
                  { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderLeftColor: activeColor },
                ]}
                activeOpacity={0.8}
                onPress={() => handleOpenMonthDetails(scrubbedMonthKey)}
              >
                <View>
                  <Text style={[styles.inspectMonthText, { color: colors.text }]}>
                    {MONTH_NAMES[scrubbedMonthKey] || scrubbedMonthKey}
                  </Text>
                  <Text style={[styles.inspectAmountText, { color: colors.textSecondary }]}>
                    €{scrubbedAmount.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.inspectActionBtn,
                    { backgroundColor: isDark ? '#1A2942' : '#E6F0FF' },
                  ]}
                >
                  <Text style={[styles.inspectActionText, { color: colors.accent }]}>Inspect Items</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. Metric Summary Grid */}
          <View style={styles.grid}>
            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Year Spending</Text>
              <Text style={[styles.metricValue, { color: activeColor }]}>
                €{summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Monthly Average</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                €{summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Peak Month</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>{summary.highestMonth}</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Lowest Month</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>{summary.lowestMonth}</Text>
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
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  settingsHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  pillScrollView: { marginBottom: 12, marginTop: 4 },
  pillContainer: { gap: 8, paddingRight: 10 },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
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
  },
  chipTextActive: {
    color: '#FFF',
  },

  budgetBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  budgetBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetBannerTitle: { fontSize: 13, fontWeight: '700' },
  budgetBannerSub: { fontSize: 11, marginTop: 1 },

  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  inlineInput: {
    height: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    width: 90,
  },
  inlineSaveBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSaveText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  inlineCancelBtn: { padding: 4 },
  quickEditActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickEditText: { fontSize: 12, fontWeight: '600' },

  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
  chartTitle: { fontSize: 14, fontWeight: '600' },
  chartHintText: { fontSize: 11 },
  chartWrapper: { alignItems: 'center', paddingTop: 8 },

  inspectBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  inspectMonthText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inspectAmountText: {
    fontSize: 11,
    marginTop: 1,
  },
  inspectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inspectActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricLabel: { fontSize: 11, fontWeight: '500' },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
});