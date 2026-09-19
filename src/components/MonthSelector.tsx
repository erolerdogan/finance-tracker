import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MonthSelectorProps {
  currentMonth: string; // Format: YYYY-MM
  availableMonths: string[];
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ currentMonth, availableMonths, onMonthChange }: MonthSelectorProps) {
  const currentIndex = availableMonths.indexOf(currentMonth);

  const handlePrev = () => {
    if (currentIndex < availableMonths.length - 1) {
      onMonthChange(availableMonths[currentIndex + 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      onMonthChange(availableMonths[currentIndex - 1]);
    }
  };

  // Format YYYY-MM into readable "September 2026"
  const formatMonthLabel = (isoMonth: string) => {
    if (!isoMonth || isoMonth.length < 7) return 'All Time';
    const [year, month] = isoMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const canGoPrev = currentIndex < availableMonths.length - 1;
  const canGoNext = currentIndex > 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.arrowButton, !canGoPrev && styles.disabledButton]}
        onPress={handlePrev}
        disabled={!canGoPrev}
      >
        <Text style={[styles.arrowText, !canGoPrev && styles.disabledText]}>‹</Text>
      </TouchableOpacity>

      <View style={styles.labelContainer}>
        <Text style={styles.monthLabel}>{formatMonthLabel(currentMonth)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.arrowButton, !canGoNext && styles.disabledButton]}
        onPress={handleNext}
        disabled={!canGoNext}
      >
        <Text style={[styles.arrowText, !canGoNext && styles.disabledText]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  arrowText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: -2,
  },
  disabledText: {
    color: '#C7C7CC',
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});