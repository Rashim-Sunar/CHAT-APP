import { apiFetch } from "./client";

export interface BackupEnvelope {
  backupEnabled: boolean;
  encryptedPrivateKey: string | null;
  salt: string | null;
  iv: string | null;
}

export const getEncryptedBackup = (): Promise<BackupEnvelope> =>
  apiFetch<BackupEnvelope>("/backup");

export const enableEncryptedBackup = (payload: {
  cipher: string;
  salt: string;
  iv: string;
}): Promise<unknown> => apiFetch("/backup/enable", { method: "POST", body: JSON.stringify(payload) });
