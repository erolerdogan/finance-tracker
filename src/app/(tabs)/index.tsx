import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { FixedFlexibleCard } from '@/components/dashboard/FixedFlexibleCard';
import { MonthStepper } from '@/components/dashboard/MonthStepper';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import { TransactionListModal } from '@/components/modals/TransactionListModal';
import { ProfileSwitcherModal } from '@/components/ProfileSwitcherModal';
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
  const [selectedBarCategory, setSelectedBarCategory] = useState<string | null>(null);

  const [selectedCategoryTransactions, setSelectedCategoryTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

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

      if (selectedBarCategory) {
        const updatedItems = await getTransactionsByMonthAndCategory(db, selectedMonth, selectedBarCategory, activeProfileId);
        setSelectedCategoryTransactions(updatedItems || []);
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
            }
          },
        },
      ]
    );
  };

  const totalTransactions = categoryData.reduce((a, b) => a + (b.count || 0), 0);

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

          {/* Interactive Spending Allocation Pie Chart with Inline Item Breakdown */}
          <AllocationChart
            categoryData={categoryData}
            selectedBarCategory={selectedBarCategory}
            selectedCategoryTransactions={selectedCategoryTransactions}
            loadingTransactions={loadingTransactions}
            onBarPress={handleBarPress}
            onSelectTransaction={handleSelectTransaction}
          />

          {/* Inline Transaction Drill-down when a Category is selected */}
          {selectedBarCategory && (
            <View style={styles.drilldownCard}>
              <View style={styles.drilldownHeader}>
                <Text style={styles.drilldownTitle}>{selectedBarCategory} Items</Text>
                <TouchableOpacity onPress={() => setSelectedBarCategory(null)}>
                  <Ionicons name="close-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              {loadingTransactions ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ paddingVertical: 12 }} />
              ) : selectedCategoryTransactions.length === 0 ? (
                <Text style={styles.noTrxText}>No recorded items for this category.</Text>
              ) : (
                selectedCategoryTransactions.map((trx) => (
                  <TouchableOpacity
                    key={trx.id}
                    style={styles.trxRow}
                    activeOpacity={0.7}
                    onPress={() => handleSelectTransaction(trx)}
                  >
                    <View style={styles.trxLeft}>
                      <Ionicons name="receipt-outline" size={14} color="#8E8E93" style={{ marginRight: 8 }} />
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

          {/* Fixed vs Flexible Board */}
          <FixedFlexibleCard
            summary={fixedSummary}
            onPress={() => handleOpenCardModal('EXPENSE')}
          />
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
                          setSelectedBarCategory(null);
                          setSelectedCategoryTransactions([]);
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

  drilldownCard: {
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
  drilldownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  drilldownTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  noTrxText: { fontSize: 12, color: '#8E8E93', fontStyle: 'italic', paddingVertical: 8 },

  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  trxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  trxDesc: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  trxDate: { fontSize: 10, color: '#8E8E93', marginTop: 1 },
  trxAmount: { fontSize: 13, fontWeight: '600' },

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