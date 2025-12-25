import { useState, useCallback, useEffect, useRef } from 'react';
import { PasswordEntry, Folder, VaultState } from '@/types/vault';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const DEMO_ENTRIES: PasswordEntry[] = [
  {
    id: '1',
    title: 'GitHub',
    username: 'developer@example.com',
    password: 'Gh!tHub_S3cur3_2024',
    url: 'https://github.com',
    notes: 'Personal GitHub account',
    folderId: 'dev',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-20'),
    favorite: true,
  },
  {
    id: '2',
    title: 'AWS Console',
    username: 'admin@company.com',
    password: 'Aws_Pr0d_Acc3ss!Key',
    url: 'https://aws.amazon.com/console',
    notes: 'Production AWS account - handle with care',
    folderId: 'dev',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-05-15'),
    favorite: false,
  },
  {
    id: '3',
    title: 'Gmail',
    username: 'john.doe@gmail.com',
    password: 'Gm@il_P3rs0nal_2024!',
    url: 'https://mail.google.com',
    notes: 'Personal email account',
    folderId: 'personal',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-03-22'),
    favorite: true,
  },
  {
    id: '4',
    title: 'Bank of America',
    username: 'johndoe2024',
    password: 'B0A_B@nking_S3cur3!',
    url: 'https://bankofamerica.com',
    notes: 'Main checking account',
    folderId: 'finance',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-04-10'),
    favorite: false,
  },
  {
    id: '5',
    title: 'Netflix',
    username: 'family@example.com',
    password: 'N3tfl!x_Str3@m_2024',
    url: 'https://netflix.com',
    notes: 'Family subscription',
    folderId: 'personal',
    createdAt: new Date('2024-02-28'),
    updatedAt: new Date('2024-02-28'),
    favorite: false,
  },
];

const DEMO_FOLDERS: Folder[] = [
  { id: 'dev', name: 'Development', icon: 'code' },
  { id: 'personal', name: 'Personal', icon: 'user' },
  { id: 'finance', name: 'Finance', icon: 'credit-card' },
  { id: 'work', name: 'Work', icon: 'briefcase' },
];

export function useVault() {
  const [state, setState] = useState<VaultState>({
    isLocked: true,
    entries: [],
    folders: [],
    lastActivity: new Date(),
  });
  
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    setState(prev => ({ ...prev, lastActivity: new Date() }));
    
    inactivityTimer.current = setTimeout(() => {
      lock();
    }, INACTIVITY_TIMEOUT);
  }, []);

  const unlock = useCallback((masterPassword: string): boolean => {
    // In production, this would derive keys using Argon2 and decrypt the vault
    // For demo purposes, accept any password with 8+ characters
    if (masterPassword.length >= 8) {
      setState({
        isLocked: false,
        entries: DEMO_ENTRIES,
        folders: DEMO_FOLDERS,
        lastActivity: new Date(),
      });
      resetInactivityTimer();
      return true;
    }
    return false;
  }, [resetInactivityTimer]);

  const lock = useCallback(() => {
    // Clear sensitive data from memory
    setState({
      isLocked: true,
      entries: [],
      folders: [],
      lastActivity: new Date(),
    });
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const addEntry = useCallback((entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEntry: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry],
    }));
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const updateEntry = useCallback((id: string, updates: Partial<PasswordEntry>) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.map(entry =>
        entry.id === id
          ? { ...entry, ...updates, updatedAt: new Date() }
          : entry
      ),
    }));
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const deleteEntry = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id),
    }));
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const toggleFavorite = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.map(entry =>
        entry.id === id
          ? { ...entry, favorite: !entry.favorite }
          : entry
      ),
    }));
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Track user activity
  useEffect(() => {
    if (state.isLocked) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [state.isLocked, resetInactivityTimer]);

  return {
    ...state,
    unlock,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
  };
}
