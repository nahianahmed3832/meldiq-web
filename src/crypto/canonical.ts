/** Canonical strings that are signed. Must match server/src/crypto.ts and android crypto/EnvelopeCrypto.kt exactly. */

export type MessageClass = "message" | "control";

export interface EnvelopeHeader {
  messageId: string;
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  sentAt: number;
  cls: MessageClass;
}

export type AuthPurpose = "register" | "login" | "add-device";

export const canonical = {
  deviceCert: (identityKey: string, signingKey: string, encryptionKey: string): string => `griip-device-cert-v1\n${identityKey}\n${signingKey}\n${encryptionKey}`,
  authProof: (purpose: AuthPurpose, nonce: string, signingKey: string): string => `griip-auth-v1\n${purpose}\n${nonce}\n${signingKey}`,
  header: (h: EnvelopeHeader): string => `griip-envelope-v1\n${h.messageId}\n${h.conversationId}\n${h.senderUserId}\n${h.senderDeviceId}\n${h.sentAt}\n${h.cls}`,
};
