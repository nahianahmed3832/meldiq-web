import { type Bytes, fromB64, sha256, toB64, utf8 } from "./bytes";
import { generateSigningKeys, rawPublicKey } from "./ed25519";
import { generateEncryptionKeys, open, rawX25519Public } from "./hpke";
import { generateSealedX25519, type SealedPrivateKey, x25519KeysPersist } from "./keyStorage";

/**
 * This browser's own device keys: non-extractable WebCrypto key pairs, kept in IndexedDB (structured clone). Where the
 * browser can't keep X25519 keys that way (WebKit), [sealedEncryption] holds the stored form of the encryption key and
 * [encryption] is rebuilt from it on load (crypto/keyStorage.ts).
 */
export interface DeviceKeys {
  signing: CryptoKeyPair;
  encryption: CryptoKeyPair;
  /** Ed25519 public key, base64. */
  signingPublic: string;
  /** X25519 public key, base64. */
  encryptionPublic: string;
  sealedEncryption?: SealedPrivateKey;
}

/** [sealEncryptionKey]: force the sealed form (tests); by default it's used only where the browser needs it. */
export async function generateDeviceKeys(opts: { sealEncryptionKey?: boolean } = {}): Promise<DeviceKeys> {
  const signing = await generateSigningKeys();
  const sealed = opts.sealEncryptionKey ?? !(await x25519KeysPersist());
  const { pair: encryption, sealed: sealedEncryption } = sealed ? await generateSealedX25519() : { pair: await generateEncryptionKeys(), sealed: undefined };
  return {
    signing,
    encryption,
    signingPublic: toB64(await rawPublicKey(signing.publicKey)),
    encryptionPublic: toB64(await rawX25519Public(encryption.publicKey)),
    ...(sealedEncryption ? { sealedEncryption } : {}),
  };
}

/** A one-time X25519 key pair the phone seals the account identity seed to while linking (android SessionRepository). */
export interface TransferKeys {
  pair: CryptoKeyPair;
  publicKey: string;
}

export async function generateTransferKeys(): Promise<TransferKeys> {
  const pair = await generateEncryptionKeys();
  return { pair, publicKey: toB64(await rawX25519Public(pair.publicKey)) };
}

const PAIRING_INFO = utf8("griip-pairing-v1");

/** Opens the identity seed the phone sealed to [transfer], bound to this browser's signing key. */
export async function openSealedSeed(transfer: CryptoKeyPair, sealedEnc: string, sealedIdentity: string, deviceSigningPublic: string): Promise<Bytes> {
  return open(transfer, sealedEnc, PAIRING_INFO, fromB64(deviceSigningPublic), sealedIdentity);
}

/**
 * "12345 67890 …": SHA-256 of a public key in six 5-byte groups, each mod 100000 (docs/SECURITY.md §5). The phone shows this
 * for an identity key (safety numbers) and for a new device's signing key when approving a link.
 */
export async function fingerprint(publicKeyB64: string): Promise<string> {
  const h = await sha256(fromB64(publicKeyB64));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    let n = 0;
    for (let j = 0; j < 5; j++) n = n * 256 + h[i * 5 + j];
    groups.push(String(n % 100000).padStart(5, "0"));
  }
  return groups.join(" ");
}

/** The safety number two people compare: both fingerprints, sorted, one per line. */
export async function safetyNumber(identityKeyA: string, identityKeyB: string): Promise<string> {
  const pair = [await fingerprint(identityKeyA), await fingerprint(identityKeyB)].sort();
  return pair.join("\n");
}
