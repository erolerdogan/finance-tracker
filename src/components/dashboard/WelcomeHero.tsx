import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WelcomeHeroProps {
  onImportPress: () => void;
  onLoadDemoPress: () => void;
  loadingDemo?: boolean;
}

export function WelcomeHero({ onImportPress, onLoadDemoPress, loadingDemo = false }: WelcomeHeroProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconBadge, { backgroundColor: colors.tintBackground }]}>
        <Ionicons name="wallet-outline" size={36} color={colors.accent} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Welcome to Financial Analytics</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Track income, expenses, and fixed vs. flexible costs—100% offline and stored securely on your device.
      </Text>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        activeOpacity={0.8}
        onPress={onImportPress}
      >
        <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
        <Text style={styles.primaryBtnText}>Import Bank Statement (.csv / .xlsx)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
        activeOpacity={0.7}
        onPress={onLoadDemoPress}
        disabled={loadingDemo}
      >
        <Ionicons name="sparkles-outline" size={16} color={colors.text} />
        <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
          {loadingDemo ? 'Generating Demo Data...' : 'Explore with Sample Data'}
        </Text>
      </TouchableOpacity>

      <View style={styles.privacyFooter}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          100% On-Device Storage • No Cloud Required
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '500',
  },
});