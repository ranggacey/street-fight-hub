import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FighterProgress } from '@/models/FighterProgress';
import { FighterStats } from '@/models/FighterStats';
import { buildFightSetup, loadFighterStats } from '@/lib/game/fight-setup';

/**
 * Integration test buildFightSetup (mongodb-memory-server).
 * Pola setup sama dengan training-deck.test.ts (skip bila binary
 * MongoDB tidak bisa diunduh di VM ini).
 */

let mongod: MongoMemoryServer | null = null;
let dbReady = false;

beforeAll(async () => {
  try {
    mongod = await Promise.race([
      MongoMemoryServer.create(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout download binary mongodb-memory-server')), 120000),
      ),
    ]);
    await mongoose.connect(mongod.getUri());
    dbReady = true;
  } catch (err) {
    console.warn(
      'SKIP integration test fight-setup: mongodb-memory-server tidak bisa jalan di VM ini:',
      (err as Error).message,
    );
  }
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn('SKIP: integration test fight-setup dilewati (tidak ada MongoDB in-memory).');
    return true;
  }
  return false;
}

const oid = () => new mongoose.Types.ObjectId();

describe('loadFighterStats: cedera diterapkan ke stat efektif', () => {
  it('tanpa dokumen → stat 10 semua', async () => {
    if (skipIfNoDb()) return;
    const s = await loadFighterStats(oid().toString());
    expect(s).toEqual({ power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 });
  });

  it('stat latihan terbaca; cedera power -15% menurunkan power efektif', async () => {
    if (skipIfNoDb()) return;
    const id = oid();
    await FighterStats.create({
      fighterId: id,
      stats: { power: 30, speed: 10, stamina: 10, defense: 10, accuracy: 10 },
    });
    const before = await loadFighterStats(id.toString());
    expect(before.power).toBe(30);

    await FighterProgress.create({
      fighterId: id,
      injury: { stat: 'power', pct: 15, fightsRemaining: 3 },
    });
    const injured = await loadFighterStats(id.toString());
    expect(injured.power).toBe(25.5); // 30 * 0,85
    expect(injured.speed).toBe(10);
  });

  it('cedera dengan fightsRemaining 0 dianggap sembuh (diabaikan)', async () => {
    if (skipIfNoDb()) return;
    const id = oid();
    await FighterStats.create({
      fighterId: id,
      stats: { power: 30, speed: 10, stamina: 10, defense: 10, accuracy: 10 },
    });
    await FighterProgress.create({
      fighterId: id,
      injury: { stat: 'power', pct: 15, fightsRemaining: 0 },
    });
    const s = await loadFighterStats(id.toString());
    expect(s.power).toBe(30);
  });
});

describe('buildFightSetup: matchup gaya + stat efektif', () => {
  it('muay-thai vs tinju → R 1,05 / B 0,97; mirror → 1,00', async () => {
    if (skipIfNoDb()) return;
    const a = { _id: oid(), style: 'muay-thai' };
    const b = { _id: oid(), style: 'boxing' };
    const setup = await buildFightSetup(a, b, null, null);
    expect(setup.fightOpts.matchupMul).toEqual({ R: 1.05, B: 0.97 });

    const mirror = await buildFightSetup(
      { _id: oid(), style: 'boxing' },
      { _id: oid(), style: 'boxing' },
      null,
      null,
    );
    expect(mirror.fightOpts.matchupMul).toEqual({ R: 1, B: 1 });
  });

  it('gaya tak dikenal / tanpa gaya → 1,00', async () => {
    if (skipIfNoDb()) return;
    const setup = await buildFightSetup({ _id: oid() }, { _id: oid() }, null, null);
    expect(setup.fightOpts.matchupMul).toEqual({ R: 1, B: 1 });
  });

  it('statMods memakai stat EFEKTIF (cedera), bukan stat mentah', async () => {
    if (skipIfNoDb()) return;
    const a = oid();
    const b = oid();
    await FighterStats.create({
      fighterId: a,
      stats: { power: 30, speed: 10, stamina: 10, defense: 10, accuracy: 10 },
    });
    await FighterProgress.create({
      fighterId: a,
      injury: { stat: 'power', pct: 15, fightsRemaining: 2 },
    });
    const setup = await buildFightSetup(
      { _id: a, style: 'boxing' },
      { _id: b, style: 'boxing' },
      null,
      null,
    );
    // Power efektif 25,5 → effectiveStat membulatkan ke 26 → dmgMul
    // 1 + (26-10)*0,01 = 1,16.
    expect(setup.stats.left.power).toBe(25.5);
    expect(setup.fightOpts.statMods.R.dmgMul).toBeCloseTo(1.16, 6);
    expect(setup.fightOpts.statMods.B.dmgMul).toBe(1);
  });
});
