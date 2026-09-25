import { DemoBanner } from '@/components/DemoBanner';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import {
  FixedCostSummary,
  FixedOverrideState,
  getAnnualTrendWithBudget,
  getCategoryGoal,
  getFixedVsFlexibleSummary,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory,
  setCategoryGoal,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useRef, useState } from 'react';
import type { TextStyle } from 'react-native';
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

const formatShortMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === '-') return '-';
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;

  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const shortMonth = shortMonthNames[monthIdx] || month;
  const shortYear = year.slice(-2);

  return `${shortMonth} '${shortYear}`;
};

export default function TrendsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Scrub & Selection State Ref/State decouple to eliminate re-query flicker
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const activeScrubKey = useRef<string | null>(null);
  const activeScrubVal = useRef<number | null>(null);

  const [maxChartValue, setMaxChartValue] = useState<number>(100);
  const [categoryBudget, setCategoryBudget] = useState<number>(0);

  // Inline Quick-Set Budget State
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineInputVal, setInlineInputVal] = useState('');

  // Drill-down Modals State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedMonthForModal, setSelectedMonthForModal] = useState('');
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [modalFixedSummary, setModalFixedSummary] = useState<FixedCostSummary | undefined>(undefined);
  const [loadingModalTrx, setLoadingModalTrx] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');

  const [summary, setSummary] = useState({
    total: 0,
    average: 0,
    highestMonth: '-',
    lowestMonth: '-',
  });

  const activeColor = selectedCategory === 'All' ? colors.accent : getCategoryColor(selectedCategory);

  // Handle Scrub Drag Updates
  const handleScrubUpdate = useCallback((monthKey: string, amount: number) => {
    if (activeScrubKey.current !== monthKey) {
      activeScrubKey.current = monthKey;
      activeScrubVal.current = amount;
      Haptics.selectionAsync();
    }
  }, []);

  // Lock Selection when drag touch drops / ends
  const handleScrubDrop = useCallback(() => {
    if (activeScrubKey.current) {
      setSelectedMonthKey((prev) => {
        if (prev === activeScrubKey.current) {
          // Deselect if dropped on same month
          setSelectedAmount(null);
          return null;
        }
        setSelectedAmount(activeScrubVal.current);
        return activeScrubKey.current;
      });
    }
  }, []);
// 1. Raw SQLite data state
const [rawTrendData, setRawTrendData] = useState<any[]>([]);

// 2. Fetch SQLite data (without setChartData inside)
const loadAnalyticsData = useCallback(async () => {
  if (!db) return;
  try {
    setLoading(true);

    const trendWithBudget = await getAnnualTrendWithBudget(db, '2026', selectedCategory, activeProfileId);
    const currentGoal = await getCategoryGoal(db, selectedCategory, activeProfileId);
    setCategoryBudget(currentGoal);

    setRawTrendData(trendWithBudget || []);

    const values = (trendWithBudget || []).map((m) => m.totalAmount);
    const peakVal = Math.max(...values, currentGoal, 10);
    setMaxChartValue(Math.ceil(peakVal * 1.15));

    const total = values.reduce((a, b) => a + b, 0);
    const activeValues = values.filter((v) => v > 0);
    const avg = activeValues.length > 0 ? total / activeValues.length : 0;

    const maxVal = Math.max(...values);
    const minVal = Math.min(...(activeValues.length > 0 ? activeValues : [0]));

    const highest = trendWithBudget.find((m) => m.totalAmount === maxVal && m.totalAmount > 0)?.monthName || '-';
    const lowest = trendWithBudget.find((m) => m.totalAmount === minVal && m.totalAmount > 0)?.monthName || '-';

    setSummary({
      total,
      average: avg,
      highestMonth: highest !== '-' ? highest : '-',
      lowestMonth: lowest !== '-' ? lowest : '-',
    });
  } catch (error) {
    console.error('Failed to query trends data:', error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [db, selectedCategory, activeProfileId]);

// 3. Compute chartData dynamically via useMemo (No duplicate variable declaration)
const chartData = React.useMemo(() => {
  return rawTrendData.map((item) => {
    const hasData = item.totalAmount > 0;
    const val = hasData ? Math.round(item.totalAmount) : 0;
    const isSelected = item.monthName === selectedMonthKey;
    let ptColor = activeColor;

    if (item.budgetLimit > 0 && hasData) {
      if (val > item.budgetLimit) ptColor = '#FF3B30';
      else if (val === item.budgetLimit) ptColor = '#FFCC00';
      else ptColor = '#34C759';
    }

    const labelStyle: TextStyle = isSelected
      ? { color: activeColor, fontWeight: '800', fontSize: 11 }
      : { color: colors.textSecondary, fontWeight: '400', fontSize: 10 };

    return {
      value: val,
      label: item.monthName.split('-')[1],
      monthKey: item.monthName,
      hideDataPoint: !hasData,
      labelTextStyle: labelStyle,
      // Dynamic Custom Node Component that updates when selectedMonthKey changes
      customDataPoint: hasData
        ? () => (
            <View
              style={{
                width: isSelected ? 18 : 8,
                height: isSelected ? 18 : 8,
                borderRadius: isSelected ? 9 : 4,
                backgroundColor: isSelected ? activeColor : ptColor,
                borderWidth: isSelected ? 3 : 1.5,
                borderColor: isSelected ? '#FFFFFF' : colors.card,
                shadowColor: activeColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isSelected ? 1 : 0,
                shadowRadius: isSelected ? 8 : 0,
                elevation: isSelected ? 6 : 0,
                transform: [
                  { translateX: isSelected ? -5 : 0 },
                  { translateY: isSelected ? -5 : 0 },
                ],
              }}
            />
          )
        : undefined,
    };
  });
}, [rawTrendData, selectedMonthKey, activeColor, colors.card, colors.textSecondary]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setIsEditingInline(false);
    setSelectedMonthKey(null);
    setSelectedAmount(null);
    activeScrubKey.current = null;
    activeScrubVal.current = null;
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

      const fixedSummaryData = await getFixedVsFlexibleSummary(
        db,
        monthKey,
        activeProfileId
      );
      setModalFixedSummary(fixedSummaryData);
    } catch (err) {
      console.error('Failed to query month transactions:', err);
    } finally {
      setLoadingModalTrx(false);
    }
  };

  const handleSelectTransactionFromModal = async (trx: Transaction) => {
    setListModalVisible(false);

    setTimeout(async () => {
      setSelectedTransaction(trx);
      if (db) {
        const fixedState = await getTransactionFixedState(db, trx, activeProfileId);
        setCurrentFixedState(fixedState);
      }
    }, 250);
  };

  const handleCloseDetailModal = () => {
    setSelectedTransaction(null);

    if (selectedMonthForModal) {
      setTimeout(() => {
        setListModalVisible(true);
      }, 250);
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

      const updatedSummary = await getFixedVsFlexibleSummary(
        db,
        selectedMonthForModal,
        activeProfileId
      );
      setModalFixedSummary(updatedSummary);
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
          {/* Demo Workspace Banner */}
          <DemoBanner />

          {/* Header Bar */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Trends</Text>
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
              const color = cat === 'All' ? colors.accent : getCategoryColor(cat);

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
                  <View style={[styles.miniDot, { backgroundColor: color }]} />
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

          {/* Metric Summary Layout */}
          <View style={styles.metricsContainer}>
            {/* Hero Card */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroHeader}>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                  {selectedCategory === 'All' ? 'Total 2026 Spending' : `Total 2026 ${selectedCategory}`}
                </Text>
                <View style={[styles.heroBadge, { backgroundColor: `${activeColor}18` }]}>
                  <Text style={[styles.heroBadgeText, { color: activeColor }]}>Annual</Text>
                </View>
              </View>
              <Text style={[styles.heroValue, { color: activeColor }]}>
                €{summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </Text>
            </View>

            {/* 3-Column Sub-Row */}
            <View style={styles.subRow}>
              <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Monthly Avg
                </Text>
                <Text style={[styles.subValue, { color: colors.text }]}>
                  €{summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </Text>
              </View>

              <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Peak Month
                </Text>
                <Text style={[styles.subValue, { color: colors.text }]}>
                  {formatShortMonth(summary.highestMonth)}
                </Text>
              </View>

              <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.subLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Lowest Month
                </Text>
                <Text style={[styles.subValue, { color: colors.text }]}>
                  {formatShortMonth(summary.lowestMonth)}
                </Text>
              </View>
            </View>
          </View>

          {/* Annual Expenses Chart Card */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Annual Expenses</Text>
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => {
                  if (selectedMonthKey) {
                    setSelectedMonthKey(null);
                    setSelectedAmount(null);
                  }
                }}
              >
                <Text style={[styles.chartHintText, { color: colors.textSecondary }]}>
                  {selectedMonthKey
                    ? `${MONTH_NAMES[selectedMonthKey] || selectedMonthKey} (Tap to clear)`
                    : 'Drag across line to select month'}
                </Text>
              </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
              <ActivityIndicator size="small" color={activeColor} style={{ paddingVertical: 40 }} />
            ) : (
              <View style={styles.chartWrapper} onTouchEnd={handleScrubDrop}>
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
                    pointerVanishDelay: 0,
                    persistPointer: false,
                    pointerLabelComponent: (items: any[]) => {
                      const item = items[0];
                      if (!item) return null;
                  
                      requestAnimationFrame(() => {
                        handleScrubUpdate(item.monthKey, item.value);
                      });
                      return null;
                    },
                  }}
                />

              </View>
            )}

            {/* Grid Layout Banners — Clean Render Without Flashes */}
            {selectedMonthKey && selectedAmount !== null && (
              <View style={styles.bannerGridContainer}>
                <View style={styles.bannerGridRow}>
                  {/* Inspect Card */}
                  <TouchableOpacity
                    style={[
                      styles.gridCard,
                      { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderLeftColor: activeColor },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleOpenMonthDetails(selectedMonthKey)}
                  >
                    <View style={styles.gridCardHeader}>
                      <Text style={[styles.gridCardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {formatShortMonth(selectedMonthKey)} Spent
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.gridCardHeroValue, { color: colors.text }]}>
                      €{selectedAmount.toLocaleString()}
                    </Text>
                    <Text style={[styles.gridCardSubtext, { color: colors.accent }]}>Inspect Items</Text>
                  </TouchableOpacity>

                  {/* Goal Target Card */}
                  <View
                    style={[
                      styles.gridCard,
                      { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderLeftColor: activeColor },
                    ]}
                  >
                    <View style={styles.gridCardHeader}>
                      <Text style={[styles.gridCardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        Goal Target
                      </Text>
                      {!isEditingInline && (
                        <TouchableOpacity
                          onPress={() => {
                            setInlineInputVal(categoryBudget > 0 ? categoryBudget.toString() : '');
                            setIsEditingInline(true);
                          }}
                        >
                          <Text style={[styles.quickEditText, { color: colors.accent }]}>
                            {categoryBudget > 0 ? 'Edit' : 'Set'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditingInline ? (
                      <View style={styles.inlineInputRow}>
                        <TextInput
                          style={[
                            styles.inlineInput,
                            {
                              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                              color: colors.text,
                              borderColor: colors.border,
                            },
                          ]}
                          placeholder="Goal"
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
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.gridCardHeroValue, { color: colors.text }]}>
                          {categoryBudget > 0 ? `€${categoryBudget.toFixed(0)}` : 'None'}
                        </Text>
                        <Text style={[styles.gridCardSubtext, { color: colors.textSecondary }]}>
                          {categoryBudget > 0 ? 'Monthly Limit' : 'No target set'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Dismiss Button */}
                <TouchableOpacity
                  style={[styles.dismissBtn, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}
                  onPress={() => {
                    setSelectedMonthKey(null);
                    setSelectedAmount(null);
                    activeScrubKey.current = null;
                    activeScrubVal.current = null;
                  }}
                >
                  <Ionicons name="close-circle-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>
                    Deselect {MONTH_NAMES[selectedMonthKey] || selectedMonthKey}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modals */}
        <TransactionListModal
          visible={listModalVisible}
          listType="EXPENSE"
          selectedMonth={selectedMonthForModal}
          monthNames={MONTH_NAMES}
          transactions={modalTransactions}
          fixedSummary={modalFixedSummary}
          loading={loadingModalTrx}
          onClose={() => setListModalVisible(false)}
          onSelectTransaction={handleSelectTransactionFromModal}
        />

        <TransactionDetailModal
          visible={selectedTransaction !== null}
          transaction={selectedTransaction}
          fixedState={currentFixedState}
          parentTitle={selectedCategory === 'All' ? 'Expenses' : selectedCategory}
          onClose={handleCloseDetailModal}
          onDismiss={() => setSelectedTransaction(null)}
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

  metricsContainer: {
    marginBottom: 12,
    gap: 10,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },

  subRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  subValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },

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

  bannerGridContainer: {
    marginTop: 14,
    gap: 10,
  },
  bannerGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCard: {
    flex: 1,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    justifyContent: 'space-between',
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridCardHeroValue: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  gridCardSubtext: {
    fontSize: 11,
    fontWeight: '600',
  },

  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  inlineInput: {
    flex: 1,
    height: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineSaveBtn: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSaveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  quickEditText: { fontSize: 11, fontWeight: '700' },

  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});