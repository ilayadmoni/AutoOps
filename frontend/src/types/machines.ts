export type TrustStatus = 'UNTRUSTED' | 'TRUSTED' | 'KEY_CHANGED';

export interface Machine {
  id: number; name: string; hostname: string; sshPort: number; operatingSystem?: string; osVersion?: string;
  preferredCredentialId?: number | null; folderId?: number | null; trustStatus: TrustStatus;
  hostKeyAlgorithm?: string; sshFingerprint?: string; fingerprintVerifiedAt?: string;
  mismatchFingerprint?: string; mismatchDetectedAt?: string; lastTestStatus?: string; lastTestedAt?: string; createdAt: string;
}

export interface MachineFolder { id: number; name: string; path: string; parentId: number | null }

export interface Discovery {
  machineId: number; hostname: string; port: number; algorithm: string; fingerprint: string;
  currentTrustStatus: TrustStatus; trustedFingerprint?: string; matchesTrusted: boolean;
}

export interface MachineTest {
  ssh: string; hostVerification: string; authentication: string; os: string; sudo: string;
  osName?: string; osVersion?: string; osFamily?: string | null; message: string;
}
