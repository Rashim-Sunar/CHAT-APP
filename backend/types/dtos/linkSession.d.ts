export interface CreateLinkSessionDto {
  tempPublicKey: Record<string, unknown>;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    label?: string;
  };
}

export interface LinkSessionRespondDto {
  sessionId: string;
  action: 'approve' | 'reject';
}

export interface LinkSessionCompleteDto {
  sessionId: string;
  encryptedSecret: {
    encryptedPayload: string;
    encryptedAesKey: string;
    iv: string;
  };
}
