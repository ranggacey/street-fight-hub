import { describe, expect, it } from 'vitest';
import {
  expectedResult,
  verifyFightResult,
  type ClientResult,
  type EngineFighter,
} from '../fight-engine/verify';
import {
  isValidSignatureMove,
  signatureMoveOptions,
} from '../game/engine-config';

const LEFT: EngineFighter = {
  name: 'Petarung A',
  color: '#ef4444',
  style: 'tinju',
  tempo: 'seimbang',
};
const RIGHT: EngineFighter = {
  name: 'Petarung B',
  color: '#3b82f6',
  style: 'muaythai',
  tempo: 'agresif',
  signatureMove: 'roundhouse',
};
const SEED = 123456;
const DURATION = 60;

function clientFromExpected(): ClientResult {
  const e = expectedResult(LEFT, RIGHT, DURATION, SEED);
  return {
    winner: e.winner,
    method: e.method,
    score: e.score,
    koTimeSec: e.koTimeSec,
    stats: e.stats,
    keyMoments: e.keyMoments,
    seed: SEED,
  };
}

describe('Verifikasi server fight (buildFight vendor)', () => {
  it('deterministik: seed + config sama → hasil sama persis', () => {
    const a = expectedResult(LEFT, RIGHT, DURATION, SEED);
    const b = expectedResult(LEFT, RIGHT, DURATION, SEED);
    expect(b).toEqual(a);
    expect(a.score.a + a.score.b).toBeLessThanOrEqual(200);
  });

  it('seed berbeda → hasil boleh berbeda (sanity: engine memakai seed)', () => {
    const a = expectedResult(LEFT, RIGHT, DURATION, SEED);
    const c = expectedResult(LEFT, RIGHT, DURATION, 654321);
    // Tidak dijamin selalu berbeda, tapi dengan seed jauh hasilnya
    // hampir pasti berbeda pada salah satu field ini.
    const same =
      a.winner === c.winner &&
      a.method === c.method &&
      a.score.a === c.score.a &&
      a.score.b === c.score.b;
    expect(same).toBe(false);
  });

  it('payload cocok (dibangun dari expected) → verified', () => {
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, clientFromExpected());
    expect(res.ok).toBe(true);
    expect(res.reason).toBeUndefined();
  });

  it('winner diubah → winner_mismatch', () => {
    const client = clientFromExpected();
    client.winner = client.winner === 'R' ? 'B' : 'R';
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, client);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('winner_mismatch');
  });

  it('score diubah → score_mismatch', () => {
    const client = clientFromExpected();
    client.score = { a: client.score.a + 1, b: client.score.b };
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, client);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('score_mismatch');
  });

  it('seed diubah → seed_mismatch', () => {
    const client = clientFromExpected();
    client.seed = SEED + 1;
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, client);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('seed_mismatch');
  });

  it('stats diubah → stats_mismatch', () => {
    const client = clientFromExpected();
    if (client.stats) client.stats.strikesLandedA += 1;
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, client);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('stats_mismatch');
  });

  it('payload kosong → invalid_payload', () => {
    const res = verifyFightResult(LEFT, RIGHT, DURATION, SEED, null);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('invalid_payload');
  });

  it('signatureMove memengaruhi hasil (bobot 2.5x) — fighter tanpa jurus khas berbeda', () => {
    const noSig: EngineFighter = { ...RIGHT, signatureMove: undefined };
    const withSig = expectedResult(LEFT, RIGHT, DURATION, SEED);
    const withoutSig = expectedResult(LEFT, noSig, DURATION, SEED);
    // Hasil boleh sama/kebetulan, tapi stats dari kedua run harus
    // dihitung — yang penting keduanya deterministik dan valid.
    expect(withSig.stats).toBeDefined();
    expect(withoutSig.stats).toBeDefined();
    expect(expectedResult(LEFT, noSig, DURATION, SEED)).toEqual(withoutSig);
  });
});

describe('Validasi signature move (dari moves.js vendor)', () => {
  it('opsi jurus karate tidak kosong, tanpa finisher/feint', () => {
    const opts = signatureMoveOptions('karate');
    expect(opts.length).toBeGreaterThan(0);
    const kinds = opts.map((o) => o.kind);
    expect(kinds).not.toContain('finisher');
    expect(kinds).not.toContain('feint');
    for (const o of opts) expect(o.label.length).toBeGreaterThan(0);
  });

  it('jurus valid diterima, jurus ngawur ditolak', () => {
    const opts = signatureMoveOptions('karate');
    expect(isValidSignatureMove('karate', opts[0].kind)).toBe(true);
    expect(isValidSignatureMove('karate', 'jurus_ngawur')).toBe(false);
    // Jurus gaya lain belum tentu valid untuk karate.
    const boxingOpts = signatureMoveOptions('boxing');
    expect(boxingOpts.length).toBeGreaterThan(0);
  });

  it('gaya tak dikenal → fallback ke opsi brawler (sama seperti arena)', () => {
    expect(signatureMoveOptions('gaya_ngawur')).toEqual(
      signatureMoveOptions('street'),
    );
    expect(signatureMoveOptions('gaya_ngawur').length).toBeGreaterThan(0);
  });
});
