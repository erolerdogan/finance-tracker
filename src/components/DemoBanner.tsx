import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearAllData } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DemoBanner() {
  const { isDemoMode, setIsDemoMode, activeProfile, refreshProfiles } = useProfile();
  const { colors, isDark } = useTheme();
  const db = useSQLiteContext();
  const activeProfileId = activeProfile?.id ?? 1;

  // If not in demo mode, render nothing
  if (!isDemoMode) return null;

  const handleEndDemo = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (db) {
        await clearAllData(db, activeProfileId);
      }
      setIsDemoMode(false);
      await refreshProfiles();
      router.replace('/welcome');
    } catch (err) {
      console.error('Failed to end demo mode:', err);
      router.replace('/welcome');
    }
  };

  return (
    <View 
      style={[
        styles.banner, 
        { 
          backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)', 
          borderColor: colors.accent + '44' 
        }
      ]}
    >
      <View style={styles.leftContent}>
        <Ionicons name="sparkles" size={16} color={colors.accent} />
        <Text style={[styles.bannerText, { color: colors.text }]}>
          Demo Workspace Active
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.exitButton, { backgroundColor: colors.accent }]} 
        onPress={handleEndDemo}
        activeOpacity={0.8}
      >
        <Text style={styles.exitButtonText}>Exit Demo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  exitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});