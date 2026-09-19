import { getCategoryColor } from '@/constants/colors';
import {
  CategoryTotal,
  clearAllTransactions,
  FixedCostSummary,
  getAvailableMonths,
  getFilteredTransactions,
  getFixedOrFlexibleTransactions,
  getFixedVsFlexibleSummary,
  getMonthlyCategoryTotals,
  getMonthlySummary,
  getTransactionsByMonthAndCategory,
  insertTransactions, isTransactionFixed, MonthlySummary, toggleFixedCostRule,
  Transaction
} from '@/db/database';
import { cancelCurrentMonthReminders } from '@/utils/notifications';
import { parseCSVContent, parseExcelContent } from '@/utils/parser';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function formatCompactCurrency(val: number): string {
  if (val >= 1000) {
    return `€${(val / 1000).toFixed(1)}k`;
  }
  return `€${Math.round(val)}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Concurrency Guard Lock
  const isPickingRef = useRef(false);

  // Modals & Selection State
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isCurrentTrxFixed, setIsCurrentTrxFixed] = useState(false);

  // Card Modal State (Flat Income/Expense List)
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE'>('EXPENSE');
  const [listModalTransactions, setListModalTransactions] = useState<Transaction[]>([]);
  const [loadingListModal, setLoadingListModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Filters & State
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Dashboard Data
  const [summary, setSummary] = useState<MonthlySummary>({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
  });
  const [fixedSummary, setFixedSummary] = useState<FixedCostSummary>({
    fixedTotal: 0,
    flexibleTotal: 0,
    fixedPercentage: 0,
    flexiblePercentage: 0,
    fixedItemsCount: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedBarCategory, setSelectedBarCategory] = useState<string | null>(null);

  // In-line sub-transactions cache
  const [categoryTransactionsMap, setCategoryTransactionsMap] = useState<Record<string, Transaction[]>>({});
  const [loadingTransactionsMap, setLoadingTransactionsMap] = useState<Record<string, boolean>>({});

  const loadDashboardData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      const dbMonths = await getAvailableMonths(db);
      const monthsList =
        dbMonths.length > 0
          ? dbMonths
          : [
              '2026-08', '2026-07', '2026-06', '2026-05',
              '2026-04', '2026-03', '2026-02', '2026-01',
            ];

      setAvailableMonths(monthsList);

      const activeMonth = selectedMonth && monthsList.includes(selectedMonth)
        ? selectedMonth
        : monthsList[0];

      if (activeMonth !== selectedMonth) {
        setSelectedMonth(activeMonth);
      }

      const [summaryRes, categoryRes, fixedRes] = await Promise.all([
        getMonthlySummary(db, activeMonth),
        getMonthlyCategoryTotals(db, activeMonth),
        getFixedVsFlexibleSummary(db, activeMonth),
      ]);

      setSummary(summaryRes);
      setCategoryData(categoryRes || []);
      setFixedSummary(fixedRes);
    } catch (error) {
      console.error('Failed to query dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedMonth]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const currentIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
      resetSelectionStates();
    }
  };

  const handleNextMonth = () => {
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
      resetSelectionStates();
    }
  };

  const resetSelectionStates = () => {
    setSelectedBarCategory(null);
    setExpandedCategories({});
    setTypeFilter('ALL');
    setCategoryTransactionsMap({});
  };

  // Select transaction & evaluate fixed status
  const handleSelectTransaction = async (trx: Transaction) => {
    setSelectedTransaction(trx);
    if (db && trx) {
      const keyword = trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription;
      // Evaluates against defaults + custom rules + recurring pattern engine
      const isFixed = await isTransactionFixed(db, keyword);
      setIsCurrentTrxFixed(isFixed);
    }
  };

  // Safe multi-modal transition handler (prevents UI lockup)
  const handleSelectFromFlatList = (trx: Transaction) => {
    setListModalVisible(false);
    setTimeout(() => {
      handleSelectTransaction(trx);
    }, 200);
  };

  // Toggle fixed cost switch handler with deferred async re-queries
  const handleToggleFixedCost = async () => {
    if (!db || !selectedTransaction) return;
    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;

    const newState = await toggleFixedCostRule(db, keyword, selectedTransaction.category);
    setIsCurrentTrxFixed(newState);

    setTimeout(async () => {
      if (listModalVisible) {
        if (listModalType === 'FIXED' || listModalType === 'FLEXIBLE') {
          const isFixedTarget = listModalType === 'FIXED';
          const updatedItems = await getFixedOrFlexibleTransactions(db, selectedMonth, isFixedTarget);
          setListModalTransactions(updatedItems);
        }
      }
      await loadDashboardData();
    }, 100);
  };

  // Open Flat List Dialog
  const handleOpenCardModal = async (type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE') => {
    setListModalType(type);
    setModalSearchQuery('');
    setListModalVisible(true);
    if (!db) return;

    try {
      setLoadingListModal(true);

      let items: Transaction[] = [];
      if (type === 'FIXED' || type === 'FLEXIBLE') {
        items = await getFixedOrFlexibleTransactions(db, selectedMonth, type === 'FIXED');
      } else {
        items = await getFilteredTransactions(db, selectedMonth, type);
      }

      const sortedItems = [...(items || [])].sort(
        (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
      );

      setListModalTransactions(sortedItems);
    } catch (error) {
      console.error(`Failed to load ${type} list:`, error);
    } finally {
      setLoadingListModal(false);
    }
  };

  // Fetch category sub-items
  const fetchCategoryTransactions = async (catName: string) => {
    if (categoryTransactionsMap[catName] || !db) return;
    try {
      setLoadingTransactionsMap((prev) => ({ ...prev, [catName]: true }));
      const items = await getTransactionsByMonthAndCategory(db, selectedMonth, catName);
      setCategoryTransactionsMap((prev) => ({ ...prev, [catName]: items || [] }));
    } catch (error) {
      console.error(`Failed to load transactions for ${catName}:`, error);
    } finally {
      setLoadingTransactionsMap((prev) => ({ ...prev, [catName]: false }));
    }
  };

  const toggleCategoryExpand = async (catName: string) => {
    const isCurrentlyExpanded = !!expandedCategories[catName];
    setExpandedCategories((prev) => ({ ...prev, [catName]: !isCurrentlyExpanded }));
    if (!isCurrentlyExpanded) {
      await fetchCategoryTransactions(catName);
    }
  };

  const handleBarPress = (categoryName: string) => {
    if (selectedBarCategory === categoryName) {
      setSelectedBarCategory(null);
      setExpandedCategories({});
    } else {
      setSelectedBarCategory(categoryName);
      setExpandedCategories({ [categoryName]: true });
      fetchCategoryTransactions(categoryName);
    }
  };

  // Import Action
  const handleImportFile = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;

    setActionMenuVisible(false);

    setTimeout(async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'text/csv',
            'text/comma-separated-values',
            'application/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            '*/*',
          ],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return;
        }

        setLoading(true);
        const asset = result.assets[0];
        const fileUri = asset.uri;
        const fileName = (asset.name || '').toLowerCase();

        let parsedTransactions: Omit<Transaction, 'id'>[] = [];

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          try {
            const file = new File(fileUri);
            const arrayBuffer = await file.arrayBuffer();
            parsedTransactions = parseExcelContent(arrayBuffer);
          } catch (excelErr) {
            console.error('Excel Parsing Error:', excelErr);
            Alert.alert('File Read Error', 'Failed to read binary content from Excel file.');
            return;
          }
        } else {
          try {
            const file = new File(fileUri);
            const csvText = await file.text();
            parsedTransactions = parseCSVContent(csvText);
          } catch (csvErr) {
            console.error('CSV Parsing Error:', csvErr);
            Alert.alert('File Read Error', 'Failed to read text content from CSV file.');
            return;
          }
        }

        if (!parsedTransactions || parsedTransactions.length === 0) {
          Alert.alert(
            'Import Warning',
            'No valid transaction records were found in this file. Please verify column headers.'
          );
          return;
        }

        await insertTransactions(db, parsedTransactions);
        await cancelCurrentMonthReminders();

        Alert.alert('Success', `Successfully imported ${parsedTransactions.length} transactions!`);
        await loadDashboardData();
      } catch (error: any) {
        console.error('File import failed:', error);
        Alert.alert('Import Error', error?.message || 'An unexpected error occurred during import.');
      } finally {
        setLoading(false);
        isPickingRef.current = false;
      }
    }, 300);
  };

  const handleResetDatabase = () => {
    setActionMenuVisible(false);
    Alert.alert(
      'Reset Database',
      'Are you sure you want to delete all imported transactions? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllTransactions(db);
              await loadDashboardData();
            } catch (error) {
              console.error('Failed to reset DB:', error);
              Alert.alert('Error', 'Failed to reset the database.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const grandTotal = summary.totalExpenses;
  const maxCategoryAmount = Math.max(...categoryData.map((c) => c.totalAmount || 0), 1);
  const totalTransactions = categoryData.reduce((a, b) => a + (b.count || 0), 0);
  const isPositiveNet = summary.netSavings >= 0;

  const displayedCategories = categoryData.filter((c) => {
    if (selectedBarCategory && c.category !== selectedBarCategory) return false;
    return true;
  });

  const filteredModalTransactions = listModalTransactions.filter((trx) => {
    if (!modalSearchQuery.trim()) return true;
    const term = modalSearchQuery.toLowerCase().trim();
    return (
      (trx.merchant && trx.merchant.toLowerCase().includes(term)) ||
      (trx.rawDescription && trx.rawDescription.toLowerCase().includes(term)) ||
      (trx.category && trx.category.toLowerCase().includes(term))
    );
  });

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
      onPress: () => handleBarPress(item.category),
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Header Bar */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Dashboard</Text>
            <TouchableOpacity
              style={styles.goalsHeaderButton}
              onPress={() => router.push('/goals')}
            >
              <Ionicons name="disc-outline" size={18} color="#007AFF" style={{ marginRight: 4 }} />
              <Text style={styles.goalsHeaderText}>Budget Goals</Text>
            </TouchableOpacity>
          </View>

          {/* Month Stepper Navigation */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex >= availableMonths.length - 1 && styles.navButtonDisabled]}
              onPress={handlePrevMonth}
              disabled={currentIndex >= availableMonths.length - 1}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={currentIndex >= availableMonths.length - 1 ? '#C7C7CC' : '#007AFF'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.monthTitleButton} onPress={() => setMonthPickerVisible(true)}>
              <Text style={styles.monthLabelText}>
                {MONTH_NAMES[selectedMonth] || selectedMonth || 'Select Month'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#8E8E93" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, currentIndex <= 0 && styles.navButtonDisabled]}
              onPress={handleNextMonth}
              disabled={currentIndex <= 0}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={currentIndex <= 0 ? '#C7C7CC' : '#007AFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Import Status Indicator Badge */}
          <View style={styles.importStatusBadge}>
            <Ionicons
              name={categoryData.length > 0 ? 'checkmark-circle' : 'alert-circle-outline'}
              size={14}
              color={categoryData.length > 0 ? '#34C759' : '#FF9500'}
            />
            <Text
              style={[
                styles.importStatusText,
                { color: categoryData.length > 0 ? '#28A745' : '#D97706' },
              ]}
            >
              {categoryData.length > 0
                ? `${MONTH_NAMES[selectedMonth] || selectedMonth}: Up to date ✓`
                : `${MONTH_NAMES[selectedMonth] || selectedMonth}: Statement pending`}
            </Text>
          </View>

          {/* Hero Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.cardRow}>
              {/* Income Card */}
              <TouchableOpacity
                style={[styles.card, styles.incomeCard]}
                activeOpacity={0.8}
                onPress={() => handleOpenCardModal('INCOME')}
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
                onPress={() => handleOpenCardModal('EXPENSE')}
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
                <Text style={styles.netSubtext}>
                  {totalTransactions} expense items across {categoryData.length} categories
                </Text>
              </View>
              <Text style={[styles.netText, { color: isPositiveNet ? '#34C759' : '#FF3B30' }]}>
                {isPositiveNet ? '+' : ''}€
                {summary.netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Fixed vs. Flexible Spending Split Card */}
          <View style={styles.fixedCard}>
            <View style={styles.fixedCardHeader}>
              <View style={styles.fixedHeaderLeft}>
                <Ionicons name="repeat-outline" size={18} color="#007AFF" style={{ marginRight: 6 }} />
                <Text style={styles.fixedCardTitle}>Fixed vs. Flexible Split</Text>
              </View>
              <Text style={styles.fixedCardSub}>
                {fixedSummary.fixedItemsCount} recurring commitments
              </Text>
            </View>

            {/* Progress Bar Track */}
            <View style={styles.splitTrack}>
              <View style={[styles.fixedFill, { width: `${fixedSummary.fixedPercentage}%` }]} />
              <View style={[styles.flexibleFill, { width: `${fixedSummary.flexiblePercentage}%` }]} />
            </View>

            {/* Interactive Tappable Legend Buttons */}
            <View style={styles.splitLabelsRow}>
              <TouchableOpacity
                style={styles.splitLegendItem}
                activeOpacity={0.7}
                onPress={() => handleOpenCardModal('FIXED')}
              >
                <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
                <Text style={styles.splitLabelText}>Fixed: </Text>
                <Text style={styles.splitValText}>
                  €{fixedSummary.fixedTotal.toFixed(0)} ({fixedSummary.fixedPercentage}%)
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#007AFF" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.splitLegendItem}
                activeOpacity={0.7}
                onPress={() => handleOpenCardModal('FLEXIBLE')}
              >
                <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                <Text style={styles.splitLabelText}>Flexible: </Text>
                <Text style={styles.splitValText}>
                  €{fixedSummary.flexibleTotal.toFixed(0)} ({fixedSummary.flexiblePercentage}%)
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#34C759" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bar Chart Visual */}
          {barData.length > 0 && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.sectionTitle}>Spending Allocation</Text>
                {selectedBarCategory && (
                  <TouchableOpacity onPress={() => handleBarPress(selectedBarCategory)}>
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
          )}

          {/* Category Breakdown */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Categories {selectedBarCategory ? `(${selectedBarCategory})` : ''}
            </Text>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 24 }} />
          ) : displayedCategories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No expenses for this month</Text>
            </View>
          ) : (
            <View style={styles.categoryCardList}>
              {displayedCategories.map((item, index) => {
                const percentOfTotal = grandTotal > 0 ? ((item.totalAmount / grandTotal) * 100).toFixed(1) : '0';
                const catColor = getCategoryColor(item.category);
                const isLast = index === displayedCategories.length - 1;
                const isExpanded = !!expandedCategories[item.category];

                const rawTrxList = categoryTransactionsMap[item.category] || [];
                const filteredTrxList = rawTrxList.filter((trx) => {
                  if (typeFilter === 'INCOME') return trx.amount > 0;
                  if (typeFilter === 'EXPENSE') return trx.amount < 0;
                  return true;
                });

                const isTrxLoading = !!loadingTransactionsMap[item.category];

                return (
                  <View key={item.category} style={[!isLast && styles.categoryRowBorder]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.categoryRow}
                      onPress={() => toggleCategoryExpand(item.category)}
                    >
                      <View style={styles.categoryLeft}>
                        <View style={[styles.colorDot, { backgroundColor: catColor }]} />
                        <View>
                          <Text style={styles.categoryName}>{item.category}</Text>
                          <Text style={styles.categoryMeta}>{item.count} transactions</Text>
                        </View>
                      </View>

                      <View style={styles.categoryRight}>
                        <Text style={styles.categoryAmount}>€{item.totalAmount.toFixed(2)}</Text>
                        <View style={styles.percentGroup}>
                          <Text style={styles.categoryPercent}>{percentOfTotal}%</Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color="#8E8E93"
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Inline Sub-Transactions */}
                    {isExpanded && (
                      <View style={styles.transactionsContainer}>
                        {isTrxLoading ? (
                          <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 8 }} />
                        ) : filteredTrxList.length === 0 ? (
                          <Text style={styles.noTransactionsText}>No matching transactions recorded.</Text>
                        ) : (
                          filteredTrxList.map((trx) => (
                            <TouchableOpacity
                              key={trx.id}
                              style={styles.trxRow}
                              activeOpacity={0.7}
                              onPress={() => handleSelectTransaction(trx)}
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
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fabButton}
          activeOpacity={0.8}
          onPress={() => setActionMenuVisible(true)}
        >
          <Ionicons name="options-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Flat List Bottom Sheet Modal (Income, Expenses, Fixed, Flexible) */}
        <Modal visible={listModalVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setListModalVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.flatListModalContainer}>
                <View style={styles.sheetHandle} />
                
                <View style={styles.flatListHeader}>
                  <Text style={styles.flatListTitle}>
                    {listModalType === 'INCOME' && 'All Income (High to Low)'}
                    {listModalType === 'EXPENSE' && 'All Expenses (High to Low)'}
                    {listModalType === 'FIXED' && 'Fixed Commitments'}
                    {listModalType === 'FLEXIBLE' && 'Flexible Spending'}
                  </Text>
                  <Text style={styles.flatListSubTitle}>
                    {MONTH_NAMES[selectedMonth] || selectedMonth} • {filteredModalTransactions.length} items
                  </Text>
                </View>

                {/* In-Modal Search Input Bar */}
                <View style={styles.modalSearchBox}>
                  <Ionicons name="search-outline" size={16} color="#8E8E93" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search merchant or description..."
                    placeholderTextColor="#8E8E93"
                    value={modalSearchQuery}
                    onChangeText={setModalSearchQuery}
                    clearButtonMode="while-editing"
                  />
                </View>

                {loadingListModal ? (
                  <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 32 }} />
                ) : filteredModalTransactions.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No matching records found.</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 400 }}>
                    {filteredModalTransactions.map((trx) => (
                      <TouchableOpacity
                        key={trx.id}
                        style={styles.flatTrxRow}
                        activeOpacity={0.7}
                        onPress={() => handleSelectFromFlatList(trx)}
                      >
                        <View style={styles.flatTrxLeft}>
                          <View
                            style={[
                              styles.categoryBadgeDot,
                              { backgroundColor: getCategoryColor(trx.category) },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.flatTrxMerchant} numberOfLines={1}>
                              {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
                            </Text>
                            <Text style={styles.flatTrxMeta}>
                              {trx.date} • {trx.category}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.flatTrxAmount,
                            { color: trx.amount < 0 ? '#1C1C1E' : '#34C759' },
                          ]}
                        >
                          {trx.amount < 0
                            ? `-€${Math.abs(trx.amount).toFixed(2)}`
                            : `+€${trx.amount.toFixed(2)}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={styles.closeDetailButton}
                  onPress={() => setListModalVisible(false)}
                >
                  <Text style={styles.closeDetailButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Action Menu Sheet */}
        <Modal visible={actionMenuVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActionMenuVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.actionSheetContainer}>
                <View style={styles.sheetHandle} />
                <Text style={styles.actionSheetTitle}>Data Management</Text>

                <TouchableOpacity style={styles.actionSheetItem} onPress={handleImportFile}>
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" style={{ marginRight: 12 }} />
                  <Text style={styles.actionSheetItemText}>Import CSV / Excel File</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionSheetItem} onPress={handleResetDatabase}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" style={{ marginRight: 12 }} />
                  <Text style={[styles.actionSheetItemText, { color: '#FF3B30' }]}>Reset Database</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionSheetItem, styles.cancelActionItem]}
                  onPress={() => setActionMenuVisible(false)}
                >
                  <Text style={styles.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Transaction Detail Modal with Fixed/Recurring Switch Toggle */}
        <Modal visible={selectedTransaction !== null} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedTransaction(null)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.detailCardContainer}>
                <View style={styles.sheetHandle} />
                <Text style={styles.detailCardTitle}>Transaction Details</Text>

                {selectedTransaction && (
                  <View style={styles.detailContent}>
                    <View style={styles.detailAmountGroup}>
                      <Text style={styles.detailAmountLabel}>AMOUNT</Text>
                      <Text
                        style={[
                          styles.detailAmountValue,
                          { color: selectedTransaction.amount < 0 ? '#1C1C1E' : '#34C759' },
                        ]}
                      >
                        {selectedTransaction.amount < 0
                          ? `-€${Math.abs(selectedTransaction.amount).toFixed(2)}`
                          : `+€${selectedTransaction.amount.toFixed(2)}`}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Merchant</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.merchant}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Full Description</Text>
                      <Text style={styles.detailValueSelectable} selectable>
                        {selectedTransaction.rawDescription}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.date}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category</Text>
                      <View style={styles.detailCategoryBadge}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: getCategoryColor(selectedTransaction.category) },
                          ]}
                        />
                        <Text style={styles.detailCategoryText}>{selectedTransaction.category}</Text>
                      </View>
                    </View>

                    {/* Fixed / Recurring Switch Toggle */}
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.toggleTitle}>Mark as Fixed / Recurring</Text>
                        <Text style={styles.toggleSubtitle}>
                          Treat matches for "{selectedTransaction.merchant !== 'Unknown' ? selectedTransaction.merchant : 'this item'}" as fixed monthly commitments.
                        </Text>
                      </View>
                      <Switch
                        value={isCurrentTrxFixed}
                        onValueChange={handleToggleFixedCost}
                        trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeDetailButton}
                  onPress={() => setSelectedTransaction(null)}
                >
                  <Text style={styles.closeDetailButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Month Selection Modal */}
        <Modal visible={monthPickerVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMonthPickerVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHandle} />
                  <Text style={styles.sheetTitle}>Select Month</Text>
                </View>
                <ScrollView style={{ maxHeight: 320 }}>
                  {availableMonths.map((m) => {
                    const isSelected = selectedMonth === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                        onPress={() => {
                          setSelectedMonth(m);
                          resetSelectionStates();
                          setMonthPickerVisible(false);
                        }}
                      >
                        <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextActive]}>
                          {MONTH_NAMES[m] || m}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color="#007AFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingBottom: 90 },
  headerRow: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  goalsHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goalsHeaderText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },

  // Month Stepper Navigation
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: { backgroundColor: '#F9F9F9' },
  monthTitleButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  monthLabelText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },

  // Import Status Badge
  importStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  importStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Hero Summary Cards
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

  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
  sectionHeaderRow: { marginBottom: 10 },
  categoryCardList: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  categoryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  categoryName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  categoryMeta: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  categoryRight: { alignItems: 'flex-end' },
  categoryAmount: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  percentGroup: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  categoryPercent: { fontSize: 11, color: '#8E8E93' },

  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  transactionsContainer: {
    backgroundColor: '#FAF9F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  trxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  trxDesc: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  trxDate: { fontSize: 10, color: '#8E8E93', marginTop: 1 },
  trxAmount: { fontSize: 13, fontWeight: '600' },
  noTransactionsText: { fontSize: 12, color: '#8E8E93', fontStyle: 'italic', paddingVertical: 4 },

  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#8E8E93' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6', marginBottom: 12, alignSelf: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sheetItemActive: { backgroundColor: '#F2F2F7', borderRadius: 12 },
  sheetItemText: { fontSize: 16, fontWeight: '500', color: '#1C1C1E' },
  sheetItemTextActive: { color: '#007AFF', fontWeight: '700' },

  flatListModalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  flatListHeader: { alignItems: 'center', marginBottom: 12 },
  flatListTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  flatListSubTitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  flatTrxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  flatTrxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  categoryBadgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  flatTrxMerchant: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  flatTrxMeta: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  flatTrxAmount: { fontSize: 14, fontWeight: '700' },

  actionSheetContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: '#8E8E93', textAlign: 'center', marginBottom: 16 },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  actionSheetItemText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  cancelActionItem: { justifyContent: 'center', marginTop: 8, borderBottomWidth: 0 },
  cancelActionText: { fontSize: 16, fontWeight: '600', color: '#8E8E93' },

  detailCardContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  detailCardTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 16 },
  detailContent: { marginVertical: 8 },
  detailAmountGroup: { alignItems: 'center', marginBottom: 20 },
  detailAmountLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5 },
  detailAmountValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '500', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  detailValueSelectable: { fontSize: 15, fontWeight: '500', color: '#1C1C1E', lineHeight: 20 },
  detailCategoryBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  detailCategoryText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 15,
  },
  closeDetailButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeDetailButtonText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
});