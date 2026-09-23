import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { FixedFlexibleCard } from '@/components/dashboard/FixedFlexibleCard';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
import { getCategoryColor } from '@/constants/colors';
import {
  CategoryTotal,
  clearAllTransactions,
  FixedCostSummary,
  FixedOverrideState,
  getAvailableMonths,
  getFilteredTransactions,
  getFixedOrFlexibleTransactions,
  getFixedVsFlexibleSummary,
  getMonthlyCategoryTotals,
  getMonthlySummary,
  getTransactionFixedState,
  getTransactionsByMonthAndCategory,
  insertTransactions,
  MonthlySummary,
  setMerchantFixedOverride,
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
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id ?? 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isPickingRef = useRef(false);

  // Modals & Selection State
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentFixedState, setCurrentFixedState] = useState<FixedOverrideState>('AUTO');

  // Card Modal State
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE'>('EXPENSE');
  const [listModalTransactions, setListModalTransactions] = useState<Transaction[]>([]);
  const [loadingListModal, setLoadingListModal] = useState(false);

  // Filters & State
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [coverageStatus, setCoverageStatus] = useState<MonthCoverageStatus>({
    status: 'EMPTY',
    label: '',
  });

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

  const [categoryTransactionsMap, setCategoryTransactionsMap] = useState<Record<string, Transaction[]>>({});
  const [loadingTransactionsMap, setLoadingTransactionsMap] = useState<Record<string, boolean>>({});

  const currentMonthKey = getCurrentMonthKey();

  const loadDashboardData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);

      const dbMonths = await getAvailableMonths(db, activeProfileId);

      let monthsList = dbMonths.length > 0 ? [...dbMonths] : [currentMonthKey];
      if (!monthsList.includes(currentMonthKey)) {
        monthsList = [currentMonthKey, ...monthsList];
      }

      setAvailableMonths(monthsList);

      const activeMonth = selectedMonth && monthsList.includes(selectedMonth)
        ? selectedMonth
        : monthsList[0];

      if (activeMonth !== selectedMonth) {
        setSelectedMonth(activeMonth);
      }

      const [summaryRes, categoryRes, fixedRes, dateRangeRes] = await Promise.all([
        getMonthlySummary(db, activeMonth, activeProfileId),
        getMonthlyCategoryTotals(db, activeMonth, activeProfileId),
        getFixedVsFlexibleSummary(db, activeMonth, activeProfileId),
        db.getFirstAsync<{ minDate: string; maxDate: string }>(
          `SELECT MIN(date) as minDate, MAX(date) as maxDate FROM transactions WHERE monthName = ? AND profileId = ?;`,
          [activeMonth, activeProfileId]
        ),
      ]);

      setSummary(summaryRes);
      setCategoryData(categoryRes || []);
      setFixedSummary(fixedRes);

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

  const handleSelectTransaction = async (trx: Transaction) => {
    setSelectedTransaction(trx);
    if (db && trx) {
      const overrideState = await getTransactionFixedState(db, trx, activeProfileId);
      setCurrentFixedState(overrideState);
    }
  };

  const handleSelectFromFlatList = (trx: Transaction) => {
    setListModalVisible(false);
    setTimeout(() => {
      handleSelectTransaction(trx);
    }, 200);
  };

  const handleSelectFixedState = async (newState: FixedOverrideState) => {
    if (!db || !selectedTransaction) return;

    setCurrentFixedState(newState);

    const keyword =
      selectedTransaction.merchant !== 'Unknown'
        ? selectedTransaction.merchant
        : selectedTransaction.rawDescription;

    try {
      await setMerchantFixedOverride(
        db,
        keyword,
        selectedTransaction.category,
        newState,
        activeProfileId
      );

      setCategoryTransactionsMap({});

      if (listModalVisible) {
        if (listModalType === 'FIXED' || listModalType === 'FLEXIBLE') {
          const isFixedTarget = listModalType === 'FIXED';
          const updatedItems = await getFixedOrFlexibleTransactions(
            db,
            selectedMonth,
            isFixedTarget,
            activeProfileId
          );
          setListModalTransactions(updatedItems);
        }
      }

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

  const fetchCategoryTransactions = async (catName: string) => {
    if (categoryTransactionsMap[catName] || !db) return;
    try {
      setLoadingTransactionsMap((prev) => ({ ...prev, [catName]: true }));
      const items = await getTransactionsByMonthAndCategory(db, selectedMonth, catName, activeProfileId);
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

        await insertTransactions(db, parsedTransactions, activeProfileId);
        await cancelCurrentMonthReminders();

        Alert.alert('Success', `Successfully imported ${parsedTransactions.length} transactions for ${activeProfile?.name || 'this profile'}!`);
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
      'Reset Profile Transactions',
      `Are you sure you want to delete all imported transactions for ${activeProfile?.name || 'this profile'}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllTransactions(db, activeProfileId);
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
  const totalTransactions = categoryData.reduce((a, b) => a + (b.count || 0), 0);

  const displayedCategories = categoryData.filter((c) => {
    if (selectedBarCategory && c.category !== selectedBarCategory) return false;
    return true;
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
            <View style={styles.headerLeftGroup}>
              <Text style={styles.title}>Dashboard</Text>

              {activeProfile && (
                <TouchableOpacity
                  style={[styles.profilePill, { backgroundColor: activeProfile.avatarColor }]}
                  activeOpacity={0.8}
                  onPress={() => setProfileModalVisible(true)}
                >
                  <Text style={styles.profilePillText}>{activeProfile.name}</Text>
                  <Ionicons name="chevron-down" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.goalsHeaderButton}
              onPress={() => router.push('/goals')}
            >
              <Ionicons name="disc-outline" size={18} color="#007AFF" style={{ marginRight: 4 }} />
              <Text style={styles.goalsHeaderText}>Budget Goals</Text>
            </TouchableOpacity>
          </View>

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

          {/* Fixed vs Flexible Board (Moved Above Spending Allocation) */}
          <FixedFlexibleCard
            summary={fixedSummary}
            onPress={() => handleOpenCardModal('EXPENSE')}
          />

          {/* Allocation Bar Chart */}
          <AllocationChart
            categoryData={categoryData}
            selectedBarCategory={selectedBarCategory}
            onBarPress={handleBarPress}
          />

          {/* Category Breakdown */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Categories {selectedBarCategory ? `(${selectedBarCategory})` : ''}
            </Text>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 24 }} />
          ) : displayedCategories.length === 0 ? (
            <View style={styles.pendingCard}>
              <View style={styles.pendingIconCircle}>
                <Ionicons name="document-text-outline" size={26} color="#007AFF" />
              </View>
              <Text style={styles.pendingTitle}>
                {MONTH_NAMES[selectedMonth] || selectedMonth} Statement Pending
              </Text>
              <Text style={styles.pendingSubtext}>
                No transactions uploaded for this month yet. Import a CSV or Excel statement to populate your overview.
              </Text>
              <TouchableOpacity
                style={styles.pendingImportBtn}
                activeOpacity={0.8}
                onPress={handleImportFile}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.pendingImportBtnText}>Import Statement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.categoryCardList}>
              {displayedCategories.map((item, index) => {
                const percentOfTotal = grandTotal > 0 ? Math.round((item.totalAmount / grandTotal) * 100) : 0;
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

        <TouchableOpacity
          style={styles.fabButton}
          activeOpacity={0.8}
          onPress={() => setActionMenuVisible(true)}
        >
          <Ionicons name="options-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <ProfileSwitcherModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
        />

        <TransactionListModal
          visible={listModalVisible}
          listType={listModalType}
          selectedMonth={selectedMonth}
          monthNames={MONTH_NAMES}
          transactions={listModalTransactions}
          loading={loadingListModal}
          onClose={() => setListModalVisible(false)}
          onSelectTransaction={handleSelectFromFlatList}
        />

        <TransactionDetailModal
          visible={selectedTransaction !== null}
          transaction={selectedTransaction}
          fixedState={currentFixedState}
          onClose={() => setSelectedTransaction(null)}
          onSelectFixedState={handleSelectFixedState}
        />

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
                  <Text style={[styles.actionSheetItemText, { color: '#FF3B30' }]}>Reset Profile Transactions</Text>
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
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  profilePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  goalsHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goalsHeaderText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },

  sectionHeaderRow: { marginBottom: 10, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
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

  pendingCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    textAlign: 'center',
  },
  pendingSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  pendingImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pendingImportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

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
});