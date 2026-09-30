// The mnemonic IS the account and there is no reset. Any change to derivation (a
// @scure/bip39 or @noble/ed25519 bump included) would lock every returning user out,
// so identity.test.js pins this with known-answer vectors.

export const toHex = (arr) => Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');

// The crypto primitives are injected because useAuth lazy-loads them to keep them
// out of the main bundle. Returns the 32-byte seed and the hex Ed25519 public key.
export async function deriveIdentity(mnemonic, { mnemonicToSeedSync, getPublicKeyAsync }) {
  const seed = mnemonicToSeedSync(mnemonic).slice(0, 32);
  const publicKey = toHex(await getPublicKeyAsync(seed));
  return { seed, publicKey };
}
