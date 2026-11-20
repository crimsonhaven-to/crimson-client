import { describe, expect, it, vi } from 'vitest';

vi.mock('./player', () => ({ setDucked: vi.fn() }));

const clips = [];
vi.stubGlobal('Audio', class extends EventTarget {
  constructor(src) {
    super();
    this.src = src;
    clips.push(this);
  }

  play() { return Promise.resolve(); }

  pause() {}
});
URL.createObjectURL = vi.fn(() => 'blob:lumi');
URL.revokeObjectURL = vi.fn();

const player = await import('./player');
const { hush, speak, wavBlob } = await import('./djVoice');

describe('wavBlob', () => {
  it('decodes the base64 the backend sends into WAV bytes', async () => {
    const blob = wavBlob(btoa('RIFF\u0000ÿ'));
    expect(blob.type).toBe('audio/wav');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([82, 73, 70, 70, 0, 255]);
  });
});

describe('speak', () => {
  it('plays from a blob: URL, since the CSP blocks data: media', () => {
    speak(btoa('RIFF'));
    expect(clips.at(-1).src).toBe('blob:lumi');
    expect(player.setDucked).toHaveBeenLastCalledWith(true);
  });

  it('restores the music and frees the clip when she finishes', () => {
    speak(btoa('RIFF'));
    clips.at(-1).dispatchEvent(new Event('ended'));
    expect(player.setDucked).toHaveBeenLastCalledWith(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lumi');
    hush();
  });
});
