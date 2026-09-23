import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WelcomeHeroProps {
  onImportPress: () => void;
  onLoadDemoPress: () => void;
  loadingDemo?: boolean;
}

export function WelcomeHero({ onImportPress, onLoadDemoPress, loadingDemo = false }: WelcomeHeroProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.outerWrapper}>
      {/* Hero Header Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#F8F9FE',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.badgeGlow, { backgroundColor: isDark ? '#007AFF25' : '#007AFF15' }]}>
          <Ionicons name="sparkles" size={28} color={colors.accent} />
        </View>

        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Master Your Money, <Text style={{ color: colors.accent }}>Privately.</Text>
        </Text>

        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Automatic expense breakdown, fixed vs. flexible analysis, and custom budget tracking—100% on-device.
        </Text>

        {/* Core Value Pillars */}
        <View style={styles.featureGrid}>
          <View style={[styles.featurePill, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="pie-chart-outline" size={14} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>Smart Categorization</Text>
          </View>

          <View style={[styles.featurePill, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="options-outline" size={14} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>Fixed vs. Flexible</Text>
          </View>

          <View style={[styles.featurePill, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>100% Offline</Text>
          </View>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={onImportPress}
        >
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Import Statement (.csv / .xlsx)</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Secondary Demo Button */}
        <TouchableOpacity
          style={[
            styles.secondaryActionBtn,
            { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderColor: colors.border },
          ]}
          activeOpacity={0.7}
          onPress={onLoadDemoPress}
          disabled={loadingDemo}
        >
          {loadingDemo ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                Explore Demo Workspace
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Security Footer Note */}
      <View style={styles.securityNoteRow}>
        <Ionicons name="shield-checkmark" size={14} color="#34C759" />
        <Text style={[styles.securityNoteText, { color: colors.textSecondary }]}>
          Bank-grade local privacy. No accounts, cloud tracking, or remote database servers.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    marginVertical: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  badgeGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120, 120, 128, 0.15)',
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  securityNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
  },
  securityNoteText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});