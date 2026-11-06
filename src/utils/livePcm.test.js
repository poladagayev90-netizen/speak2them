import { downsampleToInt16, int16ToBase64, base64ToFloat32, rms } from './livePcm';

test('48 kHz → 16 kHz keeps one sample in three, averaged', () => {
  const input = new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]);
  const out = downsampleToInt16(input, 48000);
  expect(out.length).toBe(2);
  expect(out[0]).toBe(Math.round(0.3 * 0x7fff));
  expect(out[1]).toBe(Math.round(-0.6 * 0x8000));
});

test('44.1 kHz gives the right length and clips at full scale', () => {
  const input = new Float32Array(4410).fill(2);
  const out = downsampleToInt16(input, 44100);
  expect(out.length).toBe(1600);
  expect(out[0]).toBe(0x7fff);
  expect(downsampleToInt16(new Float32Array(0), 48000).length).toBe(0);
});

test('PCM16 round-trips through base64', () => {
  const pcm = new Int16Array([0, 16384, -16384, 32767, -32768]);
  const back = base64ToFloat32(int16ToBase64(pcm));
  expect(Array.from(back)).toEqual([0, 0.5, -0.5, 32767 / 32768, -1]);
});

test('rms of silence is 0, of a full square wave is 1', () => {
  expect(rms(new Float32Array(10))).toBe(0);
  expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
  expect(rms(null)).toBe(0);
});
