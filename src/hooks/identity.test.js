import { describe, it, expect } from 'vitest';

import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ed from '@noble/ed25519';

import { toHex, deriveIdentity } from './identity';

// The mnemonic IS the account (no password reset, no email fallback for a pure
// mnemonic identity) and the derived Ed25519 public key is its only server-side
// handle. If a @scure/bip39 or @noble/ed25519 upgrade ever changes how the seed or
// key is derived, every returning user's public key silently changes and they lose
// access to an unrecoverable account. These are KNOWN-ANSWER vectors: they run the
// REAL crypto libraries through the REAL derivation (via useAuth's injection shape),
// so a derivation-breaking bump turns a silent prod lockout into a failing test.
//
// Vectors computed from the canonical all-"abandon" BIP39 test phrase; regenerate
// only if you have *deliberately* rotated the derivation (and understand that doing
// so orphans every existing mnemonic account).
const VECTOR_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VECTOR_SEED_HEX = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1';
const VECTOR_PUBKEY = 'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a';

// A second, distinct valid phrase (standard BIP39 test vector) for the
// distinct-mnemonic / signature checks.
const OTHER_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

// Exactly the shape useAuth injects (loadCrypto()'s bip39 + ed25519), so the test
// exercises the same code path production does.
const realCrypto = {
  mnemonicToSeedSync: bip39.mnemonicToSeedSync,
  getPublicKeyAsync: (seed) => ed.getPublicKeyAsync(seed),
};

describe('toHex', () => {
  it('lower-cases and zero-pads every byte to two hex digits', () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });

  it('returns an empty string for an empty array', () => {
    expect(toHex(new Uint8Array([]))).toBe('');
  });
});

describe('deriveIdentity (mnemonic-account key derivation)', () => {
  it('matches the pinned known-answer vector (anti-lockout tripwire)', async () => {
    const { seed, publicKey } = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    expect(toHex(seed)).toBe(VECTOR_SEED_HEX);
    expect(publicKey).toBe(VECTOR_PUBKEY);
  });

  it('derives a 32-byte seed (the first half of the BIP39 seed)', async () => {
    const { seed } = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(32);
  });

  it('is deterministic — the same mnemonic always yields the same public key', async () => {
    const a = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    const b = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    expect(a.publicKey).toBe(b.publicKey);
    expect(toHex(a.seed)).toBe(toHex(b.seed));
  });

  it('maps distinct mnemonics to distinct public keys', async () => {
    expect(bip39.validateMnemonic(OTHER_MNEMONIC, wordlist)).toBe(true);
    const a = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    const b = await deriveIdentity(OTHER_MNEMONIC, realCrypto);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it('produces a keypair whose signatures verify — the actual login handshake', async () => {
    // Mirrors useAuth.challengeAndSign: sign the server challenge with the derived
    // seed, and the derived public key must verify it. A mismatch here would mean a
    // user can log in on one build and be rejected on the next.
    const { seed, publicKey } = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    const challenge = new TextEncoder().encode('crimson-challenge-abc123');
    const signature = await ed.signAsync(challenge, seed);
    const pubKeyBytes = Uint8Array.from(
      publicKey.match(/.{2}/g).map((h) => parseInt(h, 16)),
    );
    expect(await ed.verifyAsync(signature, challenge, pubKeyBytes)).toBe(true);
  });
});
