import { getCategoryColor } from '@/constants/colors';
import { Transaction } from '@/db/database';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: Transaction | null;
  isFixed: boolean;
  onClose: () => void;
  onToggleFixed: () => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  isFixed,
  onClose,
  onToggleFixed,
}: TransactionDetailModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={styles.detailCardContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.detailCardTitle}>Transaction Details</Text>

            {transaction && (
              <View style={styles.detailContent}>
                <View style={styles.detailAmountGroup}>
                  <Text style={styles.detailAmountLabel}>AMOUNT</Text>
                  <Text
                    style={[
                      styles.detailAmountValue,
                      { color: transaction.amount < 0 ? '#1C1C1E' : '#34C759' },
                    ]}
                  >
                    {transaction.amount < 0
                      ? `-€${Math.abs(transaction.amount).toFixed(2)}`
                      : `+€${transaction.amount.toFixed(2)}`}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Merchant</Text>
                  <Text style={styles.detailValue}>{transaction.merchant}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Description</Text>
                  <Text style={styles.detailValueSelectable} selectable>
                    {transaction.rawDescription}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{transaction.date}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <View style={styles.detailCategoryBadge}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: getCategoryColor(transaction.category) },
                      ]}
                    />
                    <Text style={styles.detailCategoryText}>{transaction.category}</Text>
                  </View>
                </View>

                {/* Fixed / Recurring Switch Toggle */}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.toggleTitle}>Mark as Fixed / Recurring</Text>
                    <Text style={styles.toggleSubtitle}>
                      Treat matches for "{transaction.merchant !== 'Unknown' ? transaction.merchant : 'this item'}" as fixed monthly commitments.
                    </Text>
                  </View>
                  <Switch
                    value={isFixed}
                    onValueChange={onToggleFixed}
                    trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.closeDetailButton} onPress={onClose}>
              <Text style={styles.closeDetailButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCardContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6', marginBottom: 12, alignSelf: 'center' },
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
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
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
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  toggleSubtitle: { fontSize: 11, color: '#8E8E93', marginTop: 2, lineHeight: 15 },
  closeDetailButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeDetailButtonText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
});