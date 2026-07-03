// Pure Ed25519 mnemonic-identity derivation, extracted verbatim from useAuth so it
// can be pinned by known-answer vectors (identity.test.js).
//
// This is the highest-consequence code in the client: the mnemonic IS the account,
// there is no password reset, and the derived public key is the account's only
// handle. A silent change here — a @scure/bip39 or @noble/ed25519 bump that alters
// seed derivation or key generation — would remint every returning user's public
// key and lock them out of an account they can never recover. The vector test is
// the tripwire that turns that from a silent prod outage into a red CI run.

// Hex-encode a byte array. Replaces the `buffer` polyfill we previously pulled in
// just for this one call — the crypto libs already hand back plain Uint8Arrays.
export const toHex = (arr) => Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Derive the `{ seed, publicKey }` identity from a BIP39 mnemonic.
 *
 * The crypto primitives are INJECTED rather than imported here on purpose: useAuth
 * lazy-loads @scure/bip39 + @noble/ed25519 on demand (keeping ~tens of KB of
 * key-derivation code out of the eager main bundle), so this module stays free of
 * those heavy imports. Tests pass the real primitives directly for a genuine
 * end-to-end vector.
 *
 * @param {string} mnemonic - the 12-word BIP39 phrase.
 * @param {{ mnemonicToSeedSync: (m: string) => Uint8Array,
 *           getPublicKeyAsync: (seed: Uint8Array) => Promise<Uint8Array> }} crypto
 * @returns {Promise<{ seed: Uint8Array, publicKey: string }>} the 32-byte seed and
 *          the hex-encoded Ed25519 public key.
 */
export async function deriveIdentity(mnemonic, { mnemonicToSeedSync, getPublicKeyAsync }) {
  const seed = mnemonicToSeedSync(mnemonic).slice(0, 32);
  const publicKey = toHex(await getPublicKeyAsync(seed));
  return { seed, publicKey };
}
