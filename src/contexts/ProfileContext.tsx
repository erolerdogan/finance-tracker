import { createProfile, getProfiles, initDatabase, Profile } from '@/db/database';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ProfileContextType {
  activeProfile: Profile | null;
  profiles: Profile[];
  isDemoMode: boolean;
  hasData: boolean;
  loadingProfiles: boolean;
  setIsDemoMode: (isDemo: boolean) => void;
  switchProfile: (profile: Profile) => void;
  addNewProfile: (name: string, color?: string) => Promise<Profile | null>;
  editProfile: (id: number, name: string, color: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  checkDataState: () => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType>({
  activeProfile: null,
  profiles: [],
  isDemoMode: false,
  hasData: false,
  loadingProfiles: true,
  setIsDemoMode: () => {},
  switchProfile: () => {},
  addNewProfile: async () => null,
  editProfile: async () => {},
  refreshProfiles: async () => {},
  checkDataState: async () => false,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);

  const checkDataState = async (): Promise<boolean> => {
    if (!db) return false;
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM transactions;'
      );
      const exists = (result?.count ?? 0) > 0;
      setHasData(exists);
      return exists;
    } catch (error) {
      console.error('Error checking transaction count:', error);
      return false;
    }
  };

  const refreshProfiles = async () => {
    if (!db) return;
    try {
      setLoadingProfiles(true);
      await initDatabase(db);
      const list = await getProfiles(db);
      setProfiles(list);
      if (list.length > 0 && !activeProfile) {
        setActiveProfile(list[0]);
      }
      await checkDataState();
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, [db]);

  const switchProfile = (profile: Profile) => {
    setActiveProfile(profile);
  };

  const addNewProfile = async (name: string, color?: string): Promise<Profile | null> => {
    if (!db || !name.trim()) return null;
    const newProf = await createProfile(db, name.trim(), color || '#007AFF');
    if (newProf) {
      setProfiles((prev) => [...prev, newProf]);
      setActiveProfile(newProf);
    }
    return newProf;
  };

  const editProfile = async (id: number, name: string, color: string): Promise<void> => {
    if (!db || !name.trim()) return;
    try {
      await db.runAsync(
        'UPDATE profiles SET name = ?, avatarColor = ? WHERE id = ?;',
        [name.trim(), color, id]
      );
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name.trim(), avatarColor: color } : p))
      );
      if (activeProfile?.id === id) {
        setActiveProfile((prev) => (prev ? { ...prev, name: name.trim(), avatarColor: color } : null));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        isDemoMode,
        hasData,
        loadingProfiles,
        setIsDemoMode,
        switchProfile,
        addNewProfile,
        editProfile,
        refreshProfiles,
        checkDataState,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}