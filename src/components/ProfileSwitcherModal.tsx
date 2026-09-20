import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';
import { useProfile } from '../contexts/ProfileContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PRESET_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6'];

export function ProfileSwitcherModal({ visible, onClose }: Props) {
  const { profiles, activeProfile, switchProfile, addNewProfile } = useProfile();
  const [isAdding, setIsAdding] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#007AFF');

  const handleClose = () => {
    setIsAdding(false);
    setNewProfileName('');
    Keyboard.dismiss();
    onClose();
  };

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    Keyboard.dismiss();
    await addNewProfile(newProfileName.trim(), selectedColor);
    setNewProfileName('');
    setIsAdding(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardContainer}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.title}>Switch Profile</Text>

                {!isAdding ? (
                  <>
                    <ScrollView style={{ maxHeight: 260 }}>
                      {profiles.map((p) => {
                        const isActive = activeProfile?.id === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.profileItem, isActive && styles.activeItem]}
                            onPress={() => {
                              switchProfile(p);
                              handleClose();
                            }}
                          >
                            <View style={styles.profileLeft}>
                              <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                                <Text style={styles.avatarText}>
                                  {p.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.profileName}>{p.name}</Text>
                            </View>
                            {isActive && (
                              <Ionicons name="checkmark-circle" size={22} color="#007AFF" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => setIsAdding(true)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="#007AFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.addButtonText}>Add New Profile</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.addForm}>
                    <Text style={styles.formLabel}>Profile Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Household, Business, Joint"
                      placeholderTextColor="#8E8E93"
                      value={newProfileName}
                      onChangeText={setNewProfileName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreate}
                    />

                    <Text style={styles.formLabel}>Theme Color</Text>
                    <View style={styles.colorRow}>
                      {PRESET_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.colorDot,
                            { backgroundColor: c },
                            selectedColor === c && styles.colorDotSelected,
                          ]}
                          onPress={() => setSelectedColor(c)}
                        />
                      ))}
                    </View>

                    <View style={styles.formActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setIsAdding(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                        <Text style={styles.saveBtnText}>Save Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  activeItem: { backgroundColor: '#F2F2F7' },
  profileLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  profileName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#E6F0FF',
    borderRadius: 12,
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#007AFF' },
  addForm: { marginTop: 4 },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginBottom: 6 },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1C1E',
    marginBottom: 16,
  },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: '#1C1C1E' },
  formActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#8E8E93', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});