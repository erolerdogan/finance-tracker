import { RecurringCandidate } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal, ScrollView, StyleSheet, Text,
    TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';

interface Props {
  visible: boolean;
  candidates: RecurringCandidate[];
  onClose: () => void;
  onApproveAll: () => void;
}

export function RecurringSuggestionsModal({
  visible,
  candidates,
  onClose,
  onApproveAll,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="sparkles" size={20} color="#007AFF" style={{ marginRight: 8 }} />
                <Text style={styles.title}>Recurring Subscriptions</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Detected {candidates.length} merchants that recur monthly across your uploaded statements:
            </Text>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {candidates.map((item) => (
                <View key={item.merchant} style={styles.candidateRow}>
                  <View style={styles.candidateLeft}>
                    <Ionicons name="repeat-outline" size={16} color="#007AFF" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.merchantText} numberOfLines={1}>
                        {item.merchant}
                      </Text>
                      <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                  </View>
                  <View style={styles.candidateRight}>
                    <Text style={styles.amountText}>€{item.averageAmount.toFixed(2)}/mo</Text>
                    <Text style={styles.occurrenceText}>{item.occurrenceCount} months</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.approveButton}
                activeOpacity={0.8}
                onPress={() => {
                  onApproveAll();
                  onClose();
                }}
              >
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.approveButtonText}>
                  Mark All ({candidates.length}) as Fixed Costs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 16,
  },
  candidateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
  },
  candidateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  merchantText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  categoryText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  candidateRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  occurrenceText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    marginTop: 16,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});