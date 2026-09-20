import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MonthCoverageStatus {
  status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY';
  minDate?: string;
  maxDate?: string;
  label: string;
}

interface MonthStepperProps {
  selectedMonth: string;
  availableMonths: string[];
  monthNames: Record<string, string>;
  coverageStatus: MonthCoverageStatus;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenMonthPicker: () => void;
}

export function MonthStepper({
  selectedMonth,
  availableMonths,
  monthNames,
  coverageStatus,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
}: MonthStepperProps) {
  const currentIndex = availableMonths.indexOf(selectedMonth);

  return (
    <View style={styles.container}>
      {/* Month Stepper Navigation */}
      <View style={styles.monthNavRow}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex >= availableMonths.length - 1 && styles.navButtonDisabled]}
          onPress={onPrevMonth}
          disabled={currentIndex >= availableMonths.length - 1}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={currentIndex >= availableMonths.length - 1 ? '#C7C7CC' : '#007AFF'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.monthTitleButton} onPress={onOpenMonthPicker}>
          <Text style={styles.monthLabelText}>
            {monthNames[selectedMonth] || selectedMonth || 'Select Month'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#8E8E93" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentIndex <= 0 && styles.navButtonDisabled]}
          onPress={onNextMonth}
          disabled={currentIndex <= 0}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={currentIndex <= 0 ? '#C7C7CC' : '#007AFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Month Statement Coverage Status Badge */}
      {coverageStatus.status !== 'EMPTY' && (
        <View style={styles.coverageBadgeRow}>
          <View
            style={[
              styles.coverageDot,
              coverageStatus.status === 'IN_PROGRESS' && { backgroundColor: '#FF9500' },
              coverageStatus.status === 'PARTIAL' && { backgroundColor: '#FF3B30' },
              coverageStatus.status === 'COMPLETE' && { backgroundColor: '#34C759' },
            ]}
          />
          <Text
            style={[
              styles.coverageText,
              coverageStatus.status === 'IN_PROGRESS' && { color: '#D97706' },
              coverageStatus.status === 'PARTIAL' && { color: '#DC2626' },
              coverageStatus.status === 'COMPLETE' && { color: '#16A34A' },
            ]}
          >
            {coverageStatus.label}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
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
  coverageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  coverageText: {
    fontSize: 11,
    fontWeight: '600',
  },
});