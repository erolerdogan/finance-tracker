import { getCategoryColor } from '@/constants/colors';
import {
    CategoryGoalWithProgress,
    getCategoryGoalsWithProgress,
    setCategoryGoal
} from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GoalsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  
  // Current active month (e.g., "2026-09")
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<CategoryGoalWithProgress[]>([]);

  // Modal State for Editing Goal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('');

  const loadGoals = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const items = await getCategoryGoalsWithProgress(db, currentMonthStr);
      setGoals(items);
    } catch (err) {
      console.error('Failed to load category goals:', err);
    } finally {
      setLoading(false);
    }
  }, [db, currentMonthStr]);

  React.useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleOpenEdit = (item: CategoryGoalWithProgress) => {
    setSelectedCategory(item.category);
    setLimitInput(item.monthlyLimit > 0 ? item.monthlyLimit.toString() : '');
    setEditModalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!selectedCategory || !db) return;
    const numValue = parseFloat(limitInput) || 0;
    try {
      await setCategoryGoal(db, selectedCategory, numValue);
      setEditModalVisible(false);
      await loadGoals();
    } catch (err) {
      console.error('Failed to set goal:', err);
    }
  };

  const getProgressColor = (pct: number, hasLimit: boolean) => {
    if (!hasLimit) return '#C7C7CC';
    if (pct >= 100) return '#FF3B30'; // Red - Over Budget
    if (pct >= 80) return '#FF9500';  // Amber - Warning
    return '#34C759';                 // Green - Safe
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Category Goals</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Set spend limits for your spending categories. Progress reflects your current month's expenses.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 32 }} />
        ) : goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No category expenses recorded yet.</Text>
          </View>
        ) : (
          goals.map((item) => {
            const catColor = getCategoryColor(item.category);
            const hasLimit = item.monthlyLimit > 0;
            const progressColor = getProgressColor(item.percentage, hasLimit);
            const fillWidth = hasLimit ? `${Math.min(item.percentage, 100)}%` : '0%';

            return (
              <TouchableOpacity
                key={item.category}
                style={styles.goalCard}
                activeOpacity={0.8}
                onPress={() => handleOpenEdit(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.categoryBadge}>
                    <View style={[styles.colorDot, { backgroundColor: catColor }]} />
                    <Text style={styles.categoryName}>{item.category}</Text>
                  </View>
                  <Text style={styles.limitText}>
                    {hasLimit ? `Limit: €${item.monthlyLimit.toFixed(0)}` : 'Set Limit'}
                  </Text>
                </View>

                {/* Progress Bar Track */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: fillWidth as any, backgroundColor: progressColor },
                    ]}
                  />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.spentText}>
                    Spent: €{item.spent.toFixed(2)}
                  </Text>
                  <Text style={[styles.pctText, { color: progressColor }]}>
                    {hasLimit ? `${item.percentage}%` : 'No Limit'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Edit Budget Goal Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Set Limit: {selectedCategory}
            </Text>
            <Text style={styles.modalSub}>Enter maximum monthly spending limit in Euros (€):</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>€</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#C7C7CC"
                value={limitInput}
                onChangeText={setLimitInput}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleSaveGoal}
              >
                <Text style={styles.saveBtnText}>Save Limit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 13, color: '#8E8E93', marginBottom: 16, lineHeight: 18 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#8E8E93' },

  goalCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  categoryName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  limitText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },

  progressTrack: { height: 8, backgroundColor: '#E5E5EA', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spentText: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  pctText: { fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginBottom: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 20,
  },
  currencyPrefix: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F2F2F7' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
  saveBtn: { backgroundColor: '#007AFF' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});