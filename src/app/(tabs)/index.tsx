import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CategoryTotal,
  FixedCostSummary,
  FixedOverrideState,
  getAvailableMonths,
  getFilteredTransactions,
  getFixedOrFlexibleTransactions,
  getFixedVsFlexibleSummary, getIncomeFixedVsFlexibleSummary, getMonthlyCategoryTotals,
  getMonthlySummary,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory, MonthlySummary,
  setMerchantFixedOverride,
  Transaction
} from '@/db/database';
import { generateSampleData } from '@/utils/sampleData';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../../contexts/ProfileContext';

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

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

interface MonthCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  minDate?: string;
  maxDate?: string;
  label: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Modals & Selection State
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');
  const [detailParentTitle, setDetailParentTitle] = useState<string>('Back');
  const [wasOpenedFromList, setWasOpenedFromList] = useState(false);

  // Card Modal State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE'>('EXPENSE');
  const [listModalTransactions, setListModalTransactions] = useState<Transaction[]>([]);
  const [loadingListModal, setLoadingListModal] = useState(false);

  // Filters & State
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [coverageStatus, setCoverageStatus] = useState<MonthCoverageStatus>({
    status: 'EMPTY',
    label: '',
  });

  // Dashboard Data

  const [incomeSummary, setIncomeSummary] = useState<FixedCostSummary>({
    fixedTotal: 0,
    flexibleTotal: 0,
    fixedPercentage: 0,
    flexiblePercentage: 0,
    fixedItemsCount: 0,
  });
  
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
  const [selectedBarCategory, setSelectedBarCategory] = useState<string | null>(null);

  const [selectedCategoryTransactions, setSelectedCategoryTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const currentMonthKey = getCurrentMonthKey();

  const loadDashboardData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      const dbMonths = await getAvailableMonths(db, activeProfileId);
      setAvailableMonths(dbMonths);

      if (dbMonths.length === 0) {
        setCoverageStatus({ status: 'EMPTY', label: 'Statement Pending' });
        setSummary({ totalIncome: 0, totalExpenses: 0, netSavings: 0 });
        setCategoryData([]);
        setFixedSummary({
          fixedTotal: 0,
          flexibleTotal: 0,
          fixedPercentage: 0,
          flexiblePercentage: 0,
          fixedItemsCount: 0,
        });
        return;
      }

      const activeMonth = selectedMonth && dbMonths.includes(selectedMonth)
        ? selectedMonth
        : dbMonths[0];

      if (activeMonth !== selectedMonth) {
        setSelectedMonth(activeMonth);
      }

      const [summaryRes, categoryRes, fixedRes, incomeFixedRes, dateRangeRes] = await Promise.all([
        getMonthlySummary(db, activeMonth, activeProfileId),
        getMonthlyCategoryTotals(db, activeMonth, activeProfileId),
        getFixedVsFlexibleSummary(db, activeMonth, activeProfileId),
        getIncomeFixedVsFlexibleSummary(db, activeMonth, activeProfileId),
        db.getFirstAsync<{ minDate: string; maxDate: string }>(
          `SELECT MIN(date) as minDate, MAX(date) as maxDate FROM transactions WHERE monthName = ? AND profileId = ?;`,
          [activeMonth, activeProfileId]
        ),
      ]);
      
      setSummary(summaryRes);
      setCategoryData(categoryRes || []);
      setFixedSummary(fixedRes);
      setIncomeSummary(incomeFixedRes);

      if (!dateRangeRes || !dateRangeRes.minDate) {
        setCoverageStatus({ status: 'EMPTY', label: 'Statement Pending' });
      } else {
        const isCurrentMonth = activeMonth === currentMonthKey;
        const maxDay = parseInt(dateRangeRes.maxDate.slice(-2), 10);

        if (isCurrentMonth) {
          setCoverageStatus({
            status: 'IN_PROGRESS',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `In Progress (${dateRangeRes.minDate.slice(5)} – ${dateRangeRes.maxDate.slice(5)})`,
          });
        } else if (maxDay < 25) {
          setCoverageStatus({
            status: 'PARTIAL',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `Partial Statement (${dateRangeRes.minDate.slice(5)} – ${dateRangeRes.maxDate.slice(5)})`,
          });
        } else {
          setCoverageStatus({
            status: 'COMPLETE',
            minDate: dateRangeRes.minDate,
            maxDate: dateRangeRes.maxDate,
            label: `Full Statement (${dateRangeRes.minDate.slice(5)} – ${dateRangeRes.maxDate.slice(5)})`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to query dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, selectedMonth, activeProfileId, currentMonthKey]);

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
      setSelectedBarCategory(null);
      setSelectedCategoryTransactions([]);
    }
  };

  const handleNextMonth = () => {
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
      setSelectedBarCategory(null);
      setSelectedCategoryTransactions([]);
    }
  };

  const handleSelectTransaction = async (trx: Transaction, customParentTitle?: string) => {
    setSelectedTransaction(trx);

    if (customParentTitle) {
      setDetailParentTitle(customParentTitle);
    } else if (selectedBarCategory) {
      setDetailParentTitle(selectedBarCategory);
    } else {
      setDetailParentTitle(trx.amount > 0 ? 'Income Items' : 'Expenses');
    }

    if (db && trx) {
      const overrideState = await getTransactionFixedState(db, trx, activeProfileId);
      setCurrentFixedState(overrideState);
    }
  };

  const handleSelectFromFlatList = (trx: Transaction) => {
    const parentTitleMap: Record<string, string> = {
      INCOME: 'Income Items',
      EXPENSE: 'Expenses',
      FIXED: 'Fixed Transactions',
      FLEXIBLE: 'Flexible Transactions',
    };

    const parentTitle = parentTitleMap[listModalType] || 'Back';
    setWasOpenedFromList(true);
    setListModalVisible(false);

    setTimeout(() => {
      handleSelectTransaction(trx, parentTitle);
    }, 250);
  };

  // Back Button Press: Step back to list modal if opened from list
  const handleGoBackFromDetail = () => {
    setSelectedTransaction(null);
    if (wasOpenedFromList) {
      setWasOpenedFromList(false);
      setTimeout(() => {
        setListModalVisible(true);
      }, 250);
    }
  };

  // Outer Backdrop Tap / Dismiss: Close everything directly
  const handleDismissDetailDirectly = () => {
    setWasOpenedFromList(false);
    setSelectedTransaction(null);
  };

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;
  
    setCurrentFixedState(newState);
  
    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;
  
    try {
      // 1. Update DB rule & transaction overrides
      await setMerchantFixedOverride(
        db,
        keyword,
        selectedTransaction.category,
        newState,
        activeProfileId
      );
  
      // 2. Derive updated numeric is_fixed value (1 for FIXED, 0 for FLEXIBLE, NULL for AUTO)
      let updatedIsFixedVal: number | null = null;
      if (newState === 'FIXED') updatedIsFixedVal = 1;
      if (newState === 'FLEXIBLE') updatedIsFixedVal = 0;
  
      // 3. Update currently open selectedTransaction state
      setSelectedTransaction((prev) =>
        prev
          ? {
              ...prev,
              is_fixed: updatedIsFixedVal,
            }
          : null
      );
  
      // 4. Update the list modal transactions state so list tags update instantly
      setListModalTransactions((prevList) =>
        prevList.map((tx) => {
          const txKeyword =
            tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription;
          if (
            txKeyword.toUpperCase().trim() === keyword.toUpperCase().trim()
          ) {
            return {
              ...tx,
              is_fixed: updatedIsFixedVal,
            };
          }
          return tx;
        })
      );
  
      // 5. Refresh category drill-down list if open
      if (selectedBarCategory) {
        const updatedItems = await getTransactionsByMonthAndCategory(
          db,
          selectedMonth,
          selectedBarCategory,
          activeProfileId
        );
        setSelectedCategoryTransactions(updatedItems || []);
      }
  
      // 6. Reload overall dashboard metrics & summary cards
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to update fixed state override:', error);
    }
  };

  const handleOpenCardModal = async (type: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE') => {
    setListModalType(type);
    setListModalVisible(true);
    if (!db) return;

    try {
      setLoadingListModal(true);

      let items: Transaction[] = [];
      if (type === 'FIXED' || type === 'FLEXIBLE') {
        items = await getFixedOrFlexibleTransactions(db, selectedMonth, type === 'FIXED', activeProfileId);
      } else {
        items = await getFilteredTransactions(db, selectedMonth, type, activeProfileId);
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

  const handleBarPress = async (categoryName: string) => {
    if (selectedBarCategory === categoryName) {
      setSelectedBarCategory(null);
      setSelectedCategoryTransactions([]);
    } else {
      setSelectedBarCategory(categoryName);
      if (db) {
        try {
          setLoadingTransactions(true);
          const items = await getTransactionsByMonthAndCategory(db, selectedMonth, categoryName, activeProfileId);
          setSelectedCategoryTransactions(items || []);
        } catch (error) {
          console.error(`Failed to load transactions for ${categoryName}:`, error);
        } finally {
          setLoadingTransactions(false);
        }
      }
    }
  };

  const handleLoadDemo = async () => {
    if (!db) return;
    try {
      setLoadingDemo(true);
      await generateSampleData(db, activeProfileId);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to load sample data:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const totalTransactions = categoryData.reduce((a, b) => a + (b.count || 0), 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {/* Top Header Bar */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Overview</Text>

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

          {/* Conditional Empty State Landing View */}
          {availableMonths.length === 0 ? (
            <WelcomeHero
              onImportPress={() => router.push('/settings')}
              onLoadDemoPress={handleLoadDemo}
              loadingDemo={loadingDemo}
            />
          ) : (
            <>
              {/* Month Stepper Navigation */}
              <MonthStepper
                selectedMonth={selectedMonth}
                availableMonths={availableMonths}
                monthNames={MONTH_NAMES}
                coverageStatus={coverageStatus}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onOpenMonthPicker={() => setMonthPickerVisible(true)}
              />

              {/* Hero Summary Cards */}
              <SummaryCards
                summary={summary}
                totalTransactions={totalTransactions}
                categoryCount={categoryData.length}
                onOpenCardModal={handleOpenCardModal}
              />

              {/* Spending Allocation Donut Chart */}
              <AllocationChart
                categoryData={categoryData}
                selectedBarCategory={selectedBarCategory}
                selectedCategoryTransactions={selectedCategoryTransactions}
                loadingTransactions={loadingTransactions}
                onBarPress={handleBarPress}
                onSelectTransaction={(trx) => {
                  setWasOpenedFromList(false);
                  handleSelectTransaction(trx, selectedBarCategory ?? 'Category');
                }}
              />
            </>
          )}
        </ScrollView>

        <TransactionListModal
          visible={listModalVisible}
          listType={listModalType}
          selectedMonth={selectedMonth}
          monthNames={MONTH_NAMES}
          transactions={listModalTransactions}
          loading={loadingListModal}
          fixedSummary={listModalType === 'INCOME' ? incomeSummary : fixedSummary}
          onClose={() => setListModalVisible(false)}
          onSelectTransaction={handleSelectFromFlatList}
        />

        <TransactionDetailModal
          visible={selectedTransaction !== null}
          transaction={selectedTransaction}
          fixedState={currentFixedState}
          parentTitle={detailParentTitle}
          onClose={handleGoBackFromDetail}
          onDismiss={handleDismissDetailDirectly}
          onSelectFixedState={handleSelectFixedState}
        />

        {/* Month Picker Sheet Modal */}
        <Modal visible={monthPickerVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMonthPickerVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Month</Text>
                </View>
                <ScrollView style={{ maxHeight: 320 }}>
                  {availableMonths.map((m) => {
                    const isSelected = selectedMonth === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.sheetItem,
                          { borderBottomColor: colors.border },
                          isSelected && [
                            styles.sheetItemActive,
                            { backgroundColor: colors.tintBackground },
                          ],
                        ]}
                        onPress={() => {
                          setSelectedMonth(m);
                          setSelectedBarCategory(null);
                          setSelectedCategoryTransactions([]);
                          setMonthPickerVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.sheetItemText,
                            { color: colors.text },
                            isSelected && [styles.sheetItemTextActive, { color: colors.accent }],
                          ]}
                        >
                          {MONTH_NAMES[m] || m}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
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
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemActive: { borderRadius: 12 },
  sheetItemText: { fontSize: 16, fontWeight: '500' },
  sheetItemTextActive: { fontWeight: '700' },
});