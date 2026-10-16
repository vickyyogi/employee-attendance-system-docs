import { StorageService } from './storage.interface';
import { LocalStorageService } from './local-storage.service';

let storageInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new LocalStorageService();
  }
  return storageInstance;
}

export function setStorageService(service: StorageService | null): void {
  storageInstance = service;
}
