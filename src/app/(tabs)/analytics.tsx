import { getCategoryColor } from '@/constants/colors';
import {
  addFixedCostRule,
  FixedCostSummary,
  getCategoryFixedVsFlexibleSummary,
  getMonthlyCategoryTotals,
  getRecurringCandidates,
  RecurringCandidate
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [chartData, setChartData] = useState<any[]>([]);
  const [maxChartValue, setMaxChartValue] = useState<number>(100);

  // Fixed vs Flexible State
  const [fixedSummary, setFixedSummary] = useState<FixedCostSummary>({
    fixedTotal: 0,
    flexibleTotal: 0,
    fixedPercentage: 0,
    flexiblePercentage: 0,
    fixedItemsCount: 0,
  });

  // Candidate Selection State
  const [recurringCandidates, setRecurringCandidates] = useState<RecurringCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({});
  const [showSuggestionsAccordion, setShowSuggestionsAccordion] = useState(false);

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

      // Query monthly category totals for line chart
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

      // Query category-filtered Fixed vs Flexible summary
      const currentMonth = '2026-09';
      const fixedRes = await getCategoryFixedVsFlexibleSummary(
        db,
        currentMonth,
        selectedCategory,
        activeProfileId
      );
      setFixedSummary(fixedRes);

      // Query recurring candidates and filter by selected category
      const candidatesRes = await getRecurringCandidates(db, activeProfileId);
      const filteredCandidates = (candidatesRes || []).filter((c) => {
        if (selectedCategory === 'All') return true;
        return c.category.toLowerCase() === selectedCategory.toLowerCase();
      });

      setRecurringCandidates(filteredCandidates);

      const initialSelection: Record<string, boolean> = {};
      filteredCandidates.forEach((c) => {
        initialSelection[c.merchant] = true;
      });
      setSelectedCandidates(initialSelection);

      // Process chart values
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
  }, [db, selectedCategory, activeColor, activeProfileId]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  const toggleCandidateSelection = (merchant: string) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [merchant]: !prev[merchant],
    }));
  };

  const handleApproveSelectedCandidates = async () => {
    if (!db) return;
    const itemsToApprove = recurringCandidates.filter((c) => selectedCandidates[c.merchant]);
    if (itemsToApprove.length === 0) {
      Alert.alert('No Selection', 'Please select at least one item to mark as fixed.');
      return;
    }

    try {
      setLoading(true);
      for (const item of itemsToApprove) {
        await addFixedCostRule(db, item.merchant, item.category, activeProfileId);
      }

      const approvedSet = new Set(itemsToApprove.map((i) => i.merchant));
      setRecurringCandidates((prev) => prev.filter((c) => !approvedSet.has(c.merchant)));

      Alert.alert('Success', `Marked ${itemsToApprove.length} merchant(s) as recurring fixed costs!`);
      await loadAnalyticsData();
    } catch (err) {
      console.error('Failed to approve selected candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.values(selectedCandidates).filter(Boolean).length;

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
          {/* Title Header Bar */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Analytics</Text>
              <Text style={styles.subtitle}>Yearly spending trends & structure</Text>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: `${activeColor}15` }]}>
              <View style={[styles.dot, { backgroundColor: activeColor }]} />
              <Text style={[styles.badgeText, { color: activeColor }]}>{selectedCategory}</Text>
            </View>
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

          {/* 1. Line Graph Card (Spending Velocity) */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>2026 Spending Velocity ({selectedCategory})</Text>
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

          {/* 2. Fixed vs Flexible Board (Located directly UNDER Spending Velocity Chart) */}
          <View style={styles.fixedCard}>
            <View style={styles.fixedCardHeader}>
              <View style={styles.fixedHeaderLeft}>
                <Ionicons name="repeat-outline" size={18} color="#007AFF" style={{ marginRight: 6 }} />
                <Text style={styles.fixedCardTitle}>
                  {selectedCategory === 'All' ? 'Overall' : selectedCategory} Fixed vs. Flexible
                </Text>
              </View>
              <Text style={styles.fixedCardSub}>
                {fixedSummary.fixedItemsCount} recurring items
              </Text>
            </View>

            {/* Progress Track */}
            <View style={styles.splitTrack}>
              <View style={[styles.fixedFill, { width: `${fixedSummary.fixedPercentage}%` }]} />
              <View style={[styles.flexibleFill, { width: `${fixedSummary.flexiblePercentage}%` }]} />
            </View>

            {/* Split Legend Values */}
            <View style={styles.splitLabelsRow}>
              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
                <Text style={styles.splitLabelText}>Fixed: </Text>
                <Text style={styles.splitValText}>
                  €{fixedSummary.fixedTotal.toFixed(0)} ({fixedSummary.fixedPercentage}%)
                </Text>
              </View>

              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                <Text style={styles.splitLabelText}>Flexible: </Text>
                <Text style={styles.splitValText}>
                  €{fixedSummary.flexibleTotal.toFixed(0)} ({fixedSummary.flexiblePercentage}%)
                </Text>
              </View>
            </View>

            {/* In-Card Category-Filtered Candidates Accordion */}
            {recurringCandidates.length > 0 && (
              <View style={styles.inCardSuggestionsContainer}>
                <TouchableOpacity
                  style={styles.inCardHeader}
                  activeOpacity={0.7}
                  onPress={() => setShowSuggestionsAccordion(!showSuggestionsAccordion)}
                >
                  <View style={styles.inCardHeaderLeft}>
                    <Ionicons name="sparkles" size={14} color="#007AFF" style={{ marginRight: 6 }} />
                    <Text style={styles.inCardHeaderTitle}>
                      {recurringCandidates.length} Unclassified Recurring in {selectedCategory}
                    </Text>
                  </View>
                  <Ionicons
                    name={showSuggestionsAccordion ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {showSuggestionsAccordion && (
                  <View style={styles.inCardBody}>
                    <Text style={styles.inCardSub}>
                      Select items to mark as fixed recurring commitments:
                    </Text>

                    {recurringCandidates.map((c) => {
                      const isSelected = !!selectedCandidates[c.merchant];
                      return (
                        <TouchableOpacity
                          key={c.merchant}
                          style={styles.candidateCheckboxRow}
                          activeOpacity={0.7}
                          onPress={() => toggleCandidateSelection(c.merchant)}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={isSelected ? '#007AFF' : '#8E8E93'}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.candidateMerchantText} numberOfLines={1}>
                              {c.merchant}
                            </Text>
                            <Text style={styles.candidateCategoryText}>{c.category}</Text>
                          </View>
                          <Text style={styles.candidateAmountText}>
                            €{c.averageAmount.toFixed(0)}/mo
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={[
                        styles.approveSelectedBtn,
                        selectedCount === 0 && styles.approveSelectedBtnDisabled,
                      ]}
                      activeOpacity={0.8}
                      disabled={selectedCount === 0}
                      onPress={handleApproveSelectedCandidates}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.approveSelectedBtnText}>
                        Mark Selected ({selectedCount}) as Fixed
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 3. Metric Summary Grid */}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
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

  // Fixed vs Flexible Card
  fixedCard: {
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
  fixedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fixedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fixedCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  fixedCardSub: {
    fontSize: 11,
    color: '#8E8E93',
  },
  splitTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E5EA',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  fixedFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  flexibleFill: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  splitLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  splitLabelText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  splitValText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },

  // In-Card Auto-Detection Accordion
  inCardSuggestionsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  inCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inCardHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  inCardBody: {
    marginTop: 10,
  },
  inCardSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 8,
  },
  candidateCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  candidateMerchantText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  candidateCategoryText: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 1,
  },
  candidateAmountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  approveSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  approveSelectedBtnDisabled: {
    backgroundColor: '#C7C7CC',
  },
  approveSelectedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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