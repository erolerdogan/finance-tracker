import { useProfile } from '@/contexts/ProfileContext';
import { clearAllData } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DemoBanner() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { isDemoMode, setIsDemoMode, activeProfile } = useProfile();

  if (!isDemoMode) return null;

  const handleEndDemo = () => {
    Alert.alert(
      'Exit Demo Mode?',
      'This will clear demo transactions and return you to the main page to import your dataset.',
      [
        { text: 'Keep Exploring', style: 'cancel' },
        {
          text: 'Exit & Import Data',
          style: 'destructive',
          onPress: async () => {
            try {
              if (db && activeProfile?.id) {
                await clearAllData(db, activeProfile.id);
              }
              setIsDemoMode(false);
              router.replace('/');
            } catch (err) {
              console.error('Failed to end demo mode:', err);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.leftContent}>
        <Ionicons name="sparkles" size={14} color="#FF9500" />
        <Text style={styles.bannerText}>Demo Workspace Active</Text>
      </View>
      <TouchableOpacity style={styles.exitBtn} onPress={handleEndDemo} activeOpacity={0.8}>
        <Text style={styles.exitBtnText}>End Demo</Text>
        <Ionicons name="exit-outline" size={13} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFE0B2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
  },
  leftContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerText: { fontSize: 12, fontWeight: '700', color: '#CC7A00' },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exitBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});