import { getCategoryColor } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { FixedOverrideState, Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
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
  parentTitle?: string;
  onClose: () => void; // Called when clicking Back Button
  onDismiss?: () => void; // Called when tapping backdrop / dismiss
  onSelectFixedState: (newState: FixedOverrideState) => void;
}

export function TransactionDetailModal({
  visible,
  transaction,
  fixedState,
  parentTitle = 'Back',
  onClose,
  onSelectFixedState,
}: TransactionDetailModalProps) {
  const { colors, isDark } = useTheme();
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.detailCardContainer,
              {
                backgroundColor: isDark ? colors.card : '#FFF',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Restored Header Nav Bar with Back Button */}
            <View style={styles.headerNavRow}>
              <TouchableOpacity
                style={[
                  styles.backBtn,
                  { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                ]}
                activeOpacity={0.7}
                onPress={onClose}
              >
                <Ionicons name="chevron-back" size={16} color={colors.accent} />
                <Text style={[styles.backBtnText, { color: colors.accent }]}>
                  {parentTitle}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.detailCardTitle, { color: colors.text }]}>
                Details
              </Text>

              <View style={styles.headerSpacer} />
            </View>

            {transaction && (
              <View style={styles.detailContent}>
                <View style={styles.detailAmountGroup}>
                  <Text style={[styles.detailAmountLabel, { color: colors.textSecondary }]}>
                    AMOUNT
                  </Text>
                  <Text
                    style={[
                      styles.detailAmountValue,
                      { color: transaction.amount < 0 ? colors.text : '#34C759' },
                    ]}
                  >
                    {transaction.amount < 0
                      ? `-€${Math.abs(transaction.amount).toFixed(2)}`
                      : `+€${transaction.amount.toFixed(2)}`}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Merchant</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {transaction.merchant}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Full Description
                  </Text>
                  <Text style={[styles.detailValueSelectable, { color: colors.text }]} selectable>
                    {transaction.rawDescription}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {transaction.date}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Category</Text>
                  <View style={styles.detailCategoryBadge}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: getCategoryColor(transaction.category) },
                      ]}
                    />
                    <Text style={[styles.detailCategoryText, { color: colors.text }]}>
                      {transaction.category}
                    </Text>
                  </View>
                </View>

                {/* Classification Segment */}
                <View
                  style={[
                    styles.segmentedContainer,
                    { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                  ]}
                >
                  <Text style={[styles.toggleTitle, { color: colors.text }]}>
                    Cost Classification
                  </Text>
                  <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                    Select how matches for "
                    {transaction.merchant !== 'Unknown' ? transaction.merchant : 'this item'}" are treated.
                  </Text>

                  <View
                    style={[
                      styles.segmentGroup,
                      { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.segmentBtn,
                        selectedState === 'AUTO' && [
                          styles.segmentBtnActive,
                          { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' },
                        ],
                      ]}
                      onPress={() => handleSegmentPress('AUTO')}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: colors.textSecondary },
                          selectedState === 'AUTO' && [
                            styles.segmentTextActive,
                            { color: colors.accent },
                          ],
                        ]}
                      >
                        Auto
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.segmentBtn,
                        selectedState === 'FIXED' && [
                          styles.segmentBtnActive,
                          { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' },
                        ],
                      ]}
                      onPress={() => handleSegmentPress('FIXED')}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: colors.textSecondary },
                          selectedState === 'FIXED' && [
                            styles.segmentTextActive,
                            { color: colors.accent },
                          ],
                        ]}
                      >
                        Fixed
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.segmentBtn,
                        selectedState === 'FLEXIBLE' && [
                          styles.segmentBtnActive,
                          { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' },
                        ],
                      ]}
                      onPress={() => handleSegmentPress('FLEXIBLE')}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: colors.textSecondary },
                          selectedState === 'FLEXIBLE' && [
                            styles.segmentTextActive,
                            { color: colors.accent },
                          ],
                        ]}
                      >
                        Flexible
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.closeDetailButton,
                { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.closeDetailButtonText, { color: colors.accent }]}>
                Close
              </Text>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    alignSelf: 'center',
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 2,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 80,
  },
  detailContent: { marginVertical: 4 },
  detailAmountGroup: { alignItems: 'center', marginBottom: 20 },
  detailAmountLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  detailAmountValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '600' },
  detailValueSelectable: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  detailCategoryBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  detailCategoryText: { fontSize: 14, fontWeight: '600' },

  segmentedContainer: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  toggleTitle: { fontSize: 14, fontWeight: '600' },
  toggleSubtitle: { fontSize: 11, marginTop: 2, marginBottom: 10, lineHeight: 15 },
  segmentGroup: {
    flexDirection: 'row',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
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

  closeDetailButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeDetailButtonText: { fontSize: 15, fontWeight: '700' },
});