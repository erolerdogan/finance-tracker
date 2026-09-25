import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function RootIndex() {
  const { hasData, isDemoMode, loadingProfiles } = useProfile();
  const { colors } = useTheme();
  const [timedOut, setTimedOut] = useState(false);

  // Safety fallback: if loadingProfiles takes more than 1 second, force render to avoid freezing
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loadingProfiles && !timedOut) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!hasData && !isDemoMode) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});