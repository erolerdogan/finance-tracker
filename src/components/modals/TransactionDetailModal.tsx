import { getCategoryColor } from '@/constants/colors';
import { FixedOverrideState, Transaction } from '@/db/database';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: Transaction | null;
  fixedState: FixedOverrideState;
  onClose: () => void;
  onSelectFixedState: (newState: FixedOverrideState) => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  fixedState,
  onClose,
  onSelectFixedState,
}: TransactionDetailModalProps) {
  // Local state ensures immediate tab highlighting and persistence
  const [selectedState, setSelectedState] = useState<FixedOverrideState>(fixedState);

  useEffect(() => {
    if (visible) {
      setSelectedState(fixedState);
    }
  }, [visible, fixedState]);

  const handleSegmentPress = (newState: FixedOverrideState) => {
    setSelectedState(newState);
    onSelectFixedState(newState);
  };

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

                {/* Explicit 3-State Segmented Picker */}
                <View style={styles.segmentedContainer}>
                  <Text style={styles.toggleTitle}>Cost Classification</Text>
                  <Text style={styles.toggleSubtitle}>
                    Select how matches for "{transaction.merchant !== 'Unknown' ? transaction.merchant : 'this item'}" are treated.
                  </Text>

                  <View style={styles.segmentGroup}>
                    <TouchableOpacity
                      style={[styles.segmentBtn, selectedState === 'AUTO' && styles.segmentBtnActive]}
                      onPress={() => handleSegmentPress('AUTO')}
                    >
                      <Text style={[styles.segmentText, selectedState === 'AUTO' && styles.segmentTextActive]}>
                        Auto
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.segmentBtn, selectedState === 'FIXED' && styles.segmentBtnActive]}
                      onPress={() => handleSegmentPress('FIXED')}
                    >
                      <Text style={[styles.segmentText, selectedState === 'FIXED' && styles.segmentTextActive]}>
                        Fixed
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.segmentBtn, selectedState === 'FLEXIBLE' && styles.segmentBtnActive]}
                      onPress={() => handleSegmentPress('FLEXIBLE')}
                    >
                      <Text style={[styles.segmentText, selectedState === 'FLEXIBLE' && styles.segmentTextActive]}>
                        Flexible
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  
  segmentedContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  toggleSubtitle: { fontSize: 11, color: '#8E8E93', marginTop: 2, marginBottom: 10, lineHeight: 15 },
  segmentGroup: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#007AFF',
    fontWeight: '700',
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