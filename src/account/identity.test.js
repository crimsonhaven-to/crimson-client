import { describe, it, expect } from 'vitest';

import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ed from '@noble/ed25519';

import { toHex, deriveIdentity } from './identity';

// Known-answer vectors run through the real crypto libraries: a dependency bump
// that changes derivation would silently lock out every mnemonic account.
// Regenerate only after deliberately rotating the derivation, which orphans every
// existing account.
const VECTOR_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VECTOR_SEED_HEX = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1';
const VECTOR_PUBKEY = 'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a';

const OTHER_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

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

  it('is deterministic: the same mnemonic always yields the same public key', async () => {
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

  it('produces a keypair whose signatures verify (the actual login handshake)', async () => {
    // Mirrors useAuth.challengeAndSign.
    const { seed, publicKey } = await deriveIdentity(VECTOR_MNEMONIC, realCrypto);
    const challenge = new TextEncoder().encode('crimson-challenge-abc123');
    const signature = await ed.signAsync(challenge, seed);
    const pubKeyBytes = Uint8Array.from(
      publicKey.match(/.{2}/g).map((h) => parseInt(h, 16)),
    );
    expect(await ed.verifyAsync(signature, challenge, pubKeyBytes)).toBe(true);
  });
});
