export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  folderId?: string;
  teamId?: string; // If set, this is a shared team entry
  createdAt: Date;
  updatedAt: Date;
  favorite: boolean;
  createdBy?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  teamId?: string; // If set, this is a team folder
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
  description?: string;
  vaultId?: string;
  members: TeamMember[];
  createdAt: Date;
  createdBy: string;
  // In production: encrypted team key for each member
  encryptedTeamKey?: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt?: Date;
  // In production: team key encrypted with member's public key
  encryptedKeyShare?: string;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired';
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';
