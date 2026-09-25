import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { generateSampleData } from '@/utils/sampleData';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const { setIsDemoMode, refreshProfiles } = useProfile();
  const { colors, isDark } = useTheme();

  const handleImport = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)');
  };

  const handleDemoMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (db) {
      await generateSampleData(db);
      setIsDemoMode(true);
      await refreshProfiles();
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.badge}>LOCAL-FIRST & PRIVATE</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Track Your Finances
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your financial data stays 100% on this device. Start by importing your bank statement or explore with sample data.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: colors.accent }]} 
          onPress={handleImport} 
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Import Bank Statement</Text>
          <Text style={styles.buttonSubtext}>CSV or XLSX file</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.secondaryButton, 
            { 
              backgroundColor: colors.card, 
              borderColor: colors.border 
            }
          ]} 
          onPress={handleDemoMode} 
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
            Explore Demo Workspace
          </Text>
          <Text style={[styles.buttonSubtextSecondary, { color: colors.textSecondary }]}>
            Pre-loaded sample transactions
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginTop: 48,
    alignItems: 'center',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  actionContainer: {
    gap: 16,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  buttonSubtextSecondary: {
    fontSize: 12,
    marginTop: 2,
  },
});