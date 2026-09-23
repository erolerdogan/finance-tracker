import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

export type ExpenseFilterMode = 'ALL' | 'FIXED' | 'FLEXIBLE';

interface TransactionListModalProps {
  visible: boolean;
  listType: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE';
  selectedMonth: string;
  monthNames: Record<string, string>;
  transactions: Transaction[];
  loading: boolean;
  onClose: () => void;
  onSelectTransaction: (trx: Transaction) => void;
  profileId?: number;
}

export function TransactionListModal({
  visible,
  listType,
  selectedMonth,
  monthNames,
  transactions,
  loading,
  onClose,
  onSelectTransaction,
}: TransactionListModalProps) {
  const { colors, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ExpenseFilterMode>('ALL');

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      if (listType === 'FIXED') {
        setFilterMode('FIXED');
      } else if (listType === 'FLEXIBLE') {
        setFilterMode('FLEXIBLE');
      } else {
        setFilterMode('ALL');
      }
    }
  }, [visible, listType]);

  const monthLabel = monthNames[selectedMonth] || selectedMonth;
  const isExpenseModal = listType === 'EXPENSE' || listType === 'FIXED' || listType === 'FLEXIBLE';
  const modalTitle = isExpenseModal ? 'Expenses' : 'Income Items';

  const displayedTransactions = transactions.filter((tx) => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      const merchant = (tx.merchant || '').toLowerCase();
      const desc = (tx.rawDescription || '').toLowerCase();
      const category = (tx.category || '').toLowerCase();
      const matchesSearch = merchant.includes(query) || desc.includes(query) || category.includes(query);
      if (!matchesSearch) return false;
    }

    if (!isExpenseModal || filterMode === 'ALL') return true;
    const isFixed = tx.is_fixed === 1;
    if (filterMode === 'FIXED') return isFixed;
    if (filterMode === 'FLEXIBLE') return !isFixed;
    return true;
  });

  const totalAmount = displayedTransactions.reduce((acc, tx) => acc + Math.abs(tx.amount), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? colors.card : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{modalTitle}</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{monthLabel}</Text>
              </View>
              <View style={[styles.totalBadge, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                  €{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Search Input Bar */}
            <View
              style={[
                styles.searchBarContainer,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search merchant, description..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3-Option Segmented Filter */}
            {isExpenseModal && (
              <View style={[styles.segmentedContainer, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    filterMode === 'ALL' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                  ]}
                  onPress={() => setFilterMode('ALL')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.textSecondary },
                      filterMode === 'ALL' && [styles.segmentTextActive, { color: colors.accent }],
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    filterMode === 'FIXED' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                  ]}
                  onPress={() => setFilterMode('FIXED')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.textSecondary },
                      filterMode === 'FIXED' && [styles.segmentTextActive, { color: colors.accent }],
                    ]}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    filterMode === 'FLEXIBLE' && [styles.segmentBtnActive, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }],
                  ]}
                  onPress={() => setFilterMode('FLEXIBLE')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.textSecondary },
                      filterMode === 'FLEXIBLE' && [styles.segmentTextActive, { color: colors.accent }],
                    ]}
                  >
                    Flexible
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List Body */}
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 32 }} />
            ) : displayedTransactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery.trim().length > 0
                    ? `No matches found for "${searchQuery}"`
                    : `No ${filterMode !== 'ALL' ? filterMode.toLowerCase() : ''} transactions found for this period.`}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {displayedTransactions.map((trx) => {
                  const isFixed = trx.is_fixed === 1;
                  return (
                    <TouchableOpacity
                      key={trx.id}
                      style={[styles.trxRow, { borderBottomColor: colors.border }]}
                      activeOpacity={0.7}
                      onPress={() => onSelectTransaction(trx)}
                    >
                      <View style={styles.trxLeft}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: getCategoryColor(trx.category) },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={styles.merchantRow}>
                            <Text style={[styles.trxMerchant, { color: colors.text }]} numberOfLines={1}>
                              {trx.merchant !== 'Unknown' ? trx.merchant : trx.rawDescription}
                            </Text>
                            {isExpenseModal && filterMode === 'ALL' && (
                              <View
                                style={[
                                  styles.fixedBadge,
                                  isFixed ? styles.fixedBadgeActive : styles.flexibleBadgeActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.fixedBadgeText,
                                    isFixed ? styles.fixedBadgeTextActive : styles.flexibleBadgeTextActive,
                                  ]}
                                >
                                  {isFixed ? 'FIXED' : 'FLEX'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.trxMeta, { color: colors.textSecondary }]}>
                            {trx.date} • {trx.category}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.trxRight}>
                        <Text
                          style={[
                            styles.trxAmount,
                            { color: trx.amount < 0 ? colors.text : '#34C759' },
                          ]}
                        >
                          {trx.amount < 0
                            ? `-€${Math.abs(trx.amount).toFixed(2)}`
                            : `+€${trx.amount.toFixed(2)}`}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnText, { color: colors.accent }]}>Close</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '85%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  totalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },

  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },

  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '700',
  },

  scrollList: {
    maxHeight: 320,
  },
  trxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxMerchant: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  fixedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixedBadgeActive: {
    backgroundColor: '#5856D615',
  },
  flexibleBadgeActive: {
    backgroundColor: '#FF950015',
  },
  fixedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  fixedBadgeTextActive: {
    color: '#5856D6',
  },
  flexibleBadgeTextActive: {
    color: '#FF9500',
  },
  trxMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  trxRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '600',
  },

  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },

  closeBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});