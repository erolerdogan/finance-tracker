import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { processBatchImport } from '@/services/importService';
import { parseCSVContent, parseExcelContent } from '@/utils/parser';
import { generateSampleData } from '@/utils/sampleData';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const { setIsDemoMode, refreshProfiles, activeProfile } = useProfile();
  const { colors, isDark } = useTheme();
  const activeProfileId = activeProfile?.id ?? 1;

  const [importing, setImporting] = useState(false);

  const handleImportDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImporting(true);

      const asset = result.assets[0];
      const fileUri = asset.uri;
      const fileName = (asset.name || '').toLowerCase();

      let parsedTransactions = [];
      const file = new File(fileUri);

      // Exactly matches settings.tsx file parsing logic
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        parsedTransactions = parseExcelContent(arrayBuffer);
      } else {
        const csvText = await file.text();
        parsedTransactions = parseCSVContent(csvText);
      }

      if (!parsedTransactions || parsedTransactions.length === 0) {
        Alert.alert('Import Warning', 'No valid transactions found in file.');
        setImporting(false);
        return;
      }

      if (db) {
        // Execute batch deduplication import
        const summary = await processBatchImport(db, parsedTransactions, activeProfileId);
        
        // Refresh app state and jump straight into the dashboard tabs
        await refreshProfiles();
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Welcome Import Error:', error);
      Alert.alert('Import Failed', error?.message || 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  const handleDemoMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (db) {
      await generateSampleData(db, activeProfileId);
      setIsDemoMode(true);
      await refreshProfiles();
      router.replace('/(tabs)');
    }
  };

  const gradientColors = isDark 
    ? (['#0F172A', '#1E1B4B', '#09090B'] as readonly [string, string, ...string[]])
    : (['#F8FAFC', '#E2E8F0', '#CBD5E1'] as readonly [string, string, ...string[]]);

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Visual Hero / Brand Icon Slot */}
        <View style={styles.heroSlot}>
          <View style={[styles.iconGlowRing, { borderColor: colors.accent + '33' }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="wallet-outline" size={38} color={colors.accent} />
            </View>
          </View>
          
          <View style={styles.badgeRow}>
            <Ionicons name="shield-checkmark" size={13} color="#34C759" />
            <Text style={styles.badgeText}>100% LOCAL-FIRST & PRIVATE</Text>
          </View>
        </View>

        {/* Copywriting Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Your Wealth,{'\n'}Your Device.
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Take absolute control of your financial records with zero cloud trackers. Import statements or explore instantly.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.accent, shadowColor: colors.accent }]} 
            onPress={handleImportDocument} 
            activeOpacity={0.85}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonIcon} />
            ) : (
              <Ionicons name="document-text-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            )}
            <View style={styles.buttonTextWrapper}>
              <Text style={styles.primaryButtonText}>
                {importing ? 'Processing Statement...' : 'Import Bank Statement'}
              </Text>
              <Text style={styles.buttonSubtext}>CSV or XLSX file format</Text>
            </View>
            {!importing && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.secondaryButton, 
              { 
                backgroundColor: isDark ? 'rgba(28, 28, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)', 
                borderColor: colors.border 
              }
            ]} 
            onPress={handleDemoMode} 
            activeOpacity={0.85}
            disabled={importing}
          >
            <Ionicons name="sparkles-outline" size={20} color={colors.accent} style={styles.buttonIcon} />
            <View style={styles.buttonTextWrapper}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Explore Demo Workspace</Text>
              <Text style={[styles.buttonSubtextSecondary, { color: colors.textSecondary }]}>
                Pre-loaded sample transactions & analytics
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heroSlot: {
    alignItems: 'center',
    marginTop: 36,
  },
  iconGlowRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34C759',
    letterSpacing: 0.8,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  actionContainer: {
    width: '100%',
    gap: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 16,
  },
  buttonTextWrapper: {
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  buttonSubtextSecondary: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});