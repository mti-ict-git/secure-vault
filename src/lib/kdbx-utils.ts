import * as kdbxweb from 'kdbxweb';
import { PasswordEntry, Folder } from '@/types/vault';

export interface KdbxImportedEntry extends Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt' | 'folderId'> {
  folderSourceId?: string;
}

export interface KdbxImportedFolder extends Omit<Folder, 'id' | 'parentId'> {
  sourceId: string;
  parentSourceId?: string;
}

export interface KdbxImportResult {
  entries: KdbxImportedEntry[];
  folders: KdbxImportedFolder[];
  stats: {
    totalEntries: number;
    totalGroups: number;
  };
}

export interface KdbxExportOptions {
  databaseName?: string;
  description?: string;
}

/**
 * Import entries from a KeePass .kdbx file
 * All parsing happens client-side - the .kdbx file is never sent to any server
 */
export async function importKdbx(
  file: File,
  masterPassword: string,
  keyFile?: File
): Promise<KdbxImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Create credentials
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(masterPassword),
    keyFile ? await keyFile.arrayBuffer() : undefined
  );

  // Load the database
  const db = await kdbxweb.Kdbx.load(arrayBuffer, credentials);

  const entries: KdbxImportedEntry[] = [];
  const folders: KdbxImportedFolder[] = [];

  // Process groups (folders)
  function processGroup(group: kdbxweb.KdbxGroup, parentUuid?: string) {
    const groupUuid = group.uuid.toString();
    
    // Skip the root group itself but process its children
    if (group.name && group !== db.getDefaultGroup()) {
      folders.push({
        sourceId: groupUuid,
        name: group.name,
        parentSourceId: parentUuid,
        icon: getIconName(group.icon),
      });
    }

    // Process entries in this group
    for (const entry of group.entries) {
      const title = entry.fields.get('Title');
      const username = entry.fields.get('UserName');
      const password = entry.fields.get('Password');
      const url = entry.fields.get('URL');
      const notes = entry.fields.get('Notes');

      // Get string values (handle ProtectedValue)
      const getStringValue = (value: kdbxweb.KdbxEntryField | undefined): string => {
        if (!value) return '';
        if (value instanceof kdbxweb.ProtectedValue) {
          return value.getText();
        }
        return String(value);
      };

      entries.push({
        title: getStringValue(title) || 'Untitled',
        username: getStringValue(username),
        password: getStringValue(password),
        url: getStringValue(url) || undefined,
        notes: getStringValue(notes) || undefined,
        folderSourceId: group === db.getDefaultGroup() ? undefined : groupUuid,
        favorite: false,
      });
    }

    // Process subgroups
    for (const subgroup of group.groups) {
      processGroup(subgroup, group === db.getDefaultGroup() ? undefined : groupUuid);
    }
  }

  // Start processing from root
  const rootGroup = db.getDefaultGroup();
  if (rootGroup) {
    processGroup(rootGroup);
  }

  return {
    entries,
    folders,
    stats: {
      totalEntries: entries.length,
      totalGroups: folders.length,
    },
  };
}

/**
 * Export entries to a KeePass .kdbx file
 * All encryption happens client-side
 */
export async function exportKdbx(
  entries: PasswordEntry[],
  folders: Folder[],
  masterPassword: string,
  options: KdbxExportOptions = {}
): Promise<ArrayBuffer> {
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(masterPassword)
  );

  // Create a new database
  const db = kdbxweb.Kdbx.create(credentials, options.databaseName || 'Vault Export');

  const rootGroup = db.getDefaultGroup();
  if (!rootGroup) {
    throw new Error('Failed to create database');
  }

  // Create folder groups
  const folderGroupMap = new Map<string, kdbxweb.KdbxGroup>();
  
  // First pass: create all folder groups
  for (const folder of folders) {
    if (!folder.teamId) { // Only export personal folders
      const group = db.createGroup(rootGroup, folder.name);
      if (folder.icon) {
        group.icon = getKdbxIcon(folder.icon);
      }
      folderGroupMap.set(folder.id, group);
    }
  }

  // Add entries to appropriate groups
  for (const entry of entries) {
    if (entry.teamId) continue; // Skip team entries

    const parentGroup = entry.folderId 
      ? folderGroupMap.get(entry.folderId) || rootGroup
      : rootGroup;

    const kdbxEntry = db.createEntry(parentGroup);
    
    kdbxEntry.fields.set('Title', entry.title);
    kdbxEntry.fields.set('UserName', entry.username);
    kdbxEntry.fields.set('Password', kdbxweb.ProtectedValue.fromString(entry.password));
    
    if (entry.url) {
      kdbxEntry.fields.set('URL', entry.url);
    }
    if (entry.notes) {
      kdbxEntry.fields.set('Notes', entry.notes);
    }

    // Set times
    kdbxEntry.times.creationTime = entry.createdAt;
    kdbxEntry.times.lastModTime = entry.updatedAt;
  }

  // Save to ArrayBuffer
  const data = await db.save();
  return data;
}

/**
 * Download an ArrayBuffer as a file
 */
export function downloadFile(data: ArrayBuffer, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Map KeePass icons to our icon names
 */
function getIconName(icon: number | undefined): string | undefined {
  const iconMap: Record<number, string> = {
    0: 'key',
    1: 'globe',
    2: 'warning',
    3: 'server',
    4: 'folder',
    5: 'user',
    12: 'wifi',
    18: 'terminal',
    19: 'printer',
    23: 'percent',
    27: 'globe',
    30: 'code',
    34: 'settings',
    38: 'credit-card',
    39: 'certificate',
    41: 'smartphone',
    48: 'email',
    49: 'briefcase',
    68: 'shield',
  };
  
  return icon !== undefined ? iconMap[icon] : undefined;
}

/**
 * Map our icon names to KeePass icons
 */
function getKdbxIcon(iconName: string): number {
  const iconMap: Record<string, number> = {
    'key': 0,
    'globe': 1,
    'server': 3,
    'folder': 4,
    'user': 5,
    'wifi': 12,
    'terminal': 18,
    'code': 30,
    'settings': 34,
    'credit-card': 38,
    'smartphone': 41,
    'email': 48,
    'briefcase': 49,
    'shield': 68,
  };
  
  return iconMap[iconName] || 0;
}

/**
 * Validate that a file is a valid .kdbx file (basic check)
 */
export function isValidKdbxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.kdbx');
}
