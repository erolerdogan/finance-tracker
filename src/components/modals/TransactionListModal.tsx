import { getCategoryColor } from '@/constants/colors';
import { Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface TransactionListModalProps {
  visible: boolean;
  listType: 'INCOME' | 'EXPENSE' | 'FIXED' | 'FLEXIBLE';
  selectedMonth: string;
  monthNames: Record<string, string>;
  transactions: Transaction[];
  loading: boolean;
  onClose: () => void;
  onSelectTransaction: (trx: Transaction) => void;
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = transactions.filter((trx) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    return (
      (trx.merchant && trx.merchant.toLowerCase().includes(term)) ||
      (trx.rawDescription &&
        trx.rawDescription.toLowerCase().includes(term)) ||
      (trx.category && trx.category.toLowerCase().includes(term))
    );
  });

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={styles.flatListModalContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.flatListHeader}>
              <Text style={styles.flatListTitle}>
                {listType === 'INCOME' && 'All Income (High to Low)'}
                {listType === 'EXPENSE' && 'All Expenses (High to Low)'}
                {listType === 'FIXED' && 'Fixed Commitments'}
                {listType === 'FLEXIBLE' && 'Flexible Spending'}
              </Text>
              <Text style={styles.flatListSubTitle}>
                {monthNames[selectedMonth] || selectedMonth} •{' '}
                {filteredTransactions.length} items
              </Text>
            </View>

            {/* In-Modal Search Input Bar */}
            <View style={styles.modalSearchBox}>
              <Ionicons
                name="search-outline"
                size={16}
                color="#8E8E93"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search merchant or description..."
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            {loading ? (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginVertical: 32 }}
              />
            ) : filteredTransactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No matching records found.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {filteredTransactions.map((trx) => (
                  <TouchableOpacity
                    key={trx.id}
                    style={styles.flatTrxRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSearchQuery('');
                      onSelectTransaction(trx);
                    }}
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
                          {trx.merchant !== 'Unknown'
                            ? trx.merchant
                            : trx.rawDescription}
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
              onPress={onClose}
            >
              <Text style={styles.closeDetailButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  flatListModalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginBottom: 12,
    alignSelf: 'center',
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
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#8E8E93' },
  flatTrxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  flatTrxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  categoryBadgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  flatTrxMerchant: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  flatTrxMeta: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  flatTrxAmount: { fontSize: 14, fontWeight: '700' },
  closeDetailButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeDetailButtonText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
});