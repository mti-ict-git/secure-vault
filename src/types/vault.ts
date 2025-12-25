export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  folderId?: string;
  createdAt: Date;
  updatedAt: Date;
  favorite: boolean;
}

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
}

export interface VaultState {
  isLocked: boolean;
  entries: PasswordEntry[];
  folders: Folder[];
  lastActivity: Date;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';
