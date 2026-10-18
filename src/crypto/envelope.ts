import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { type Bytes, fromB64, fromUtf8, randomBytes, toB64, utf8 } from "./bytes";
import { canonical, type EnvelopeHeader } from "./canonical";
import { sign, verify } from "./ed25519";
import * as hpke from "./hpke";

/**
 * griip-envelope-v1 (docs/SECURITY.md §3), byte-compatible with android crypto/EnvelopeCrypto.kt and the Node reference
 * client: a random AES-256-GCM content key per message, wrapped to every recipient device with HPKE, ciphertext signed
 * with the sender device's Ed25519 key.
 */
const KEY_INFO = utf8("griip-envelope-v1/key");

export class EnvelopeError extends Error {}

export interface RecipientDevice {
  deviceId: string;
  /** X25519 public key, base64. */
  encryptionKey: string;
}

export interface KeyWrap {
  deviceId: string;
  enc: string;
  wrappedKey: string;
}

export interface SealedEnvelope {
  header: EnvelopeHeader;
  nonce: string;
  ciphertext: string;
  signature: string;
  recipients: KeyWrap[];
}

export interface ReceivedEnvelope {
  header: EnvelopeHeader;
  nonce: string;
  ciphertext: string;
  signature: string;
  enc: string;
  wrappedKey: string;
}

const wrapAad = (messageId: string, deviceId: string): Bytes => utf8(`${messageId}\n${deviceId}`);

export async function sealEnvelope(header: EnvelopeHeader, plaintext: string, recipients: RecipientDevice[], signingKey: CryptoKey): Promise<SealedEnvelope> {
  const headerStr = canonical.header(header);
  const contentKey = randomBytes(32);
  const nonce = randomBytes(12);
  try {
    const ciphertext = toB64(await aesGcmEncrypt(contentKey, nonce, utf8(plaintext), utf8(headerStr)));
    const nonceB64 = toB64(nonce);
    const signature = await sign(signingKey, `${headerStr}\n${nonceB64}\n${ciphertext}`);
    const wraps = await Promise.all(
      recipients.map(async (r) => {
        const s = await hpke.seal(r.encryptionKey, KEY_INFO, wrapAad(header.messageId, r.deviceId), contentKey);
        return { deviceId: r.deviceId, enc: s.enc, wrappedKey: s.ct };
      }),
    );
    return { header, nonce: nonceB64, ciphertext, signature, recipients: wraps };
  } finally {
    contentKey.fill(0);
  }
}

/** Verifies the sender's signature, unwraps this device's content key and decrypts. Throws [EnvelopeError] otherwise. */
export async function openEnvelope(env: ReceivedEnvelope, senderSigningKey: string, myDeviceId: string, myEncryption: CryptoKeyPair): Promise<string> {
  const headerStr = canonical.header(env.header);
  if (!(await verify(senderSigningKey, `${headerStr}\n${env.nonce}\n${env.ciphertext}`, env.signature))) {
    throw new EnvelopeError("signature verification failed");
  }
  let contentKey: Bytes;
  try {
    contentKey = await hpke.open(myEncryption, env.enc, KEY_INFO, wrapAad(env.header.messageId, myDeviceId), env.wrappedKey);
  } catch {
    throw new EnvelopeError("key unwrap failed");
  }
  try {
    return fromUtf8(await aesGcmDecrypt(contentKey, fromB64(env.nonce), fromB64(env.ciphertext), utf8(headerStr)));
  } catch {
    throw new EnvelopeError("content decryption failed");
  } finally {
    contentKey.fill(0);
  }
}
