import { Injectable } from '@angular/core';

export interface Folder {
  folderId: string;
  title: string;
  hasChildren: boolean;
}

const FOLDERS = {
  '_root_': [
    { id: 'rocks', label: 'Rocks' },
    { id: 'animals', label: 'Animals' },
    { id: 'plants', label: 'Plants' },
    { id: 'fungus', label: 'Fungus' },
  ],
  'animals': [
    { id: 'platypus', label: 'Platypus' },
    { id: 'mammals', label: 'Mammals', },
    { id: 'birds', label: 'Birds' },
  ],
  'mammals': [
    { id: 'felines', label: 'Felines' },
    { id: 'canines', label: 'Doggos' },
    { id: 'horse', label: 'Horse' }
  ],
  'felines': [
    { id: 'cats', label: 'Cats' },
    { id: 'tigers', label: 'tigers' }
  ],
  'canines': [
    { id: 'hyena', label: 'Hyena' },
    { id: 'big-dog', label: 'Big dogs' },
    { id: 'small-dog', label: 'Small dogs' },
  ],
  'birds': [
    { id: 'pigeon', label: 'Pigeaon' },
    { id: 'eagle', label: 'Eagle' },
  ],
  'plants': [
    { id: 'oak', label: 'Oak' },
    { id: 'willow', label: 'Willow' },
  ],
};

const VERBOSE: boolean = true;
const DEFAULT_FOLDER_ID = 'rocks';


@Injectable({
  providedIn: 'root'
})
export class FoldersService {

  public getRootFolders(DELAY = 1000): Promise<Folder[]> {
    const folders = FOLDERS['_root_'].map(d => this.formatFolder(d));
    if (VERBOSE) { console.log('[FoldersSrv::getRootFolders] query start'); }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (VERBOSE) { console.log('[FoldersSrv::getRootFolders] query end'); }
        resolve(folders);
      }, DELAY)
    });
  }

  public getSubFolders(folderId: string, DELAY = 2000): Promise<Folder[]> {
    // @ts-ignore
    const rawSubFolders = FOLDERS[folderId] || [];
    const subFolders = rawSubFolders.map((d: any) => this.formatFolder(d));
    if (VERBOSE) { console.log('[FoldersSrv::getSubFolder] query start', { folderId }); }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (VERBOSE) { console.log('[FoldersSrv::getSubFolder] query end', { folderId }); }
        resolve(subFolders);
      }, DELAY)
    });
  }

  public getDefaultFolderId(): string {
    // An empty string corresponds to no folder selected by default.
    return DEFAULT_FOLDER_ID;
  }

  private formatFolder(raw: { id: string, label: string }): Folder {
    // @ts-ignore
    const hasChildren = !!FOLDERS[raw.id];
    return {
      folderId: raw.id,
      title: raw.label,
      hasChildren: hasChildren,
    };
  }
}
