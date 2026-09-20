import { createProfile, getProfiles, initDatabase, Profile } from '@/db/database';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ProfileContextType {
  activeProfile: Profile | null;
  profiles: Profile[];
  switchProfile: (profile: Profile) => void;
  addNewProfile: (name: string, color?: string) => Promise<Profile | null>;
  refreshProfiles: () => Promise<void>;
  loadingProfiles: boolean;
}

const ProfileContext = createContext<ProfileContextType>({
  activeProfile: null,
  profiles: [],
  switchProfile: () => {},
  addNewProfile: async () => null,
  refreshProfiles: async () => {},
  loadingProfiles: true,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

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
    await refreshProfiles();
    if (newProf) {
      setActiveProfile(newProf);
    }
    return newProf;
  };

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        switchProfile,
        addNewProfile,
        refreshProfiles,
        loadingProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}