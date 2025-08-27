import { drawCards } from '../api';
import { getCount, insertCards, drawLocal } from '../db';
import type { Card, Difficulty } from '../types';
import seed from '../../assets/seed/de-CH_family_medium.json';

const SEED: Card[] = seed as unknown as Card[];

type Bucket = { lang: string; category: string; difficulty: Difficulty };
const DEFAULT_BUCKET: Bucket = { lang: 'de-CH', category: 'family', difficulty: 'medium' };

// minimum local cards to keep on hand
const THRESHOLD = 40;
const TOPUP_SIZE = 50;

export async function ensureSeed(bucket: Bucket = DEFAULT_BUCKET) {
  const c = await getCount(bucket.lang, bucket.category, bucket.difficulty);
  if (c === 0) {
    // seed only matching bucket items
    const toInsert = SEED.filter(s =>
      s.language === bucket.lang && s.category === bucket.category && s.difficulty === bucket.difficulty
    );
    await insertCards(toInsert);
  }
}

export async function topUpIfLow(bucket: Bucket = DEFAULT_BUCKET) {
  const c = await getCount(bucket.lang, bucket.category, bucket.difficulty);
  if (c >= THRESHOLD) return;

  try {
    const remote = await drawCards({ ...bucket, count: TOPUP_SIZE });
    await insertCards(remote);
  } catch (e) {
    console.log('Top-up failed (continuing offline):', String(e));
  }
}

export async function drawForTurn(count: number, bucket: Bucket = DEFAULT_BUCKET): Promise<Card[]> {
  // Make sure there is stock locally
  await topUpIfLow(bucket);
  return drawLocal(bucket.lang, bucket.category, bucket.difficulty, count);
}
