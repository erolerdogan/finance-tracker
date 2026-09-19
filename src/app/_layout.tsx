import { initDatabase } from '@/db/database';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

function AppInitializer() {
  const db = useSQLiteContext();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (db) {
        try {
          // 1. Create tables first
          await initDatabase(db);
          // 2. Seed test data
          //await seedLargeTestData(db);
        } catch (error) {
          console.error('Database initialization failed:', error);
        } finally {
          setIsReady(true);
        }
      }
    }
    init();
  }, [db]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="fintrack.db">
      <AppInitializer />
    </SQLiteProvider>
  );
}