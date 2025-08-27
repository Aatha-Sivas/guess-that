import { downloadCards } from '../api';
import { getCount, insertCards, drawLocal } from '../db';
import type { Card, Difficulty } from '../types';
import seed from '../../assets/seed/de-CH_family_medium.json';
import { useGame } from '../store/game';

const SEED: Card[] = seed as unknown as Card[];

type Bucket = { lang: string; category: string; difficulty: Difficulty };
const DEFAULT_BUCKET: Bucket = { lang: 'de-CH', category: 'family', difficulty: 'medium' };

// Local cache policy
const THRESHOLD = 30;      // if local stock < THRESHOLD, top-up
const TOPUP_SIZE = 50;     // how many to request per top-up

// Auto top-up policy (session-aware)
const RESERVE = 40;        // if (localCount - usedTargets.size) <= RESERVE → auto top-up

let autoUnsub: (() => void) | null = null;
let inflight = false;

export async function ensureSeed(bucket: Bucket = DEFAULT_BUCKET) {
  const c = await getCount(bucket.lang, bucket.category, bucket.difficulty);
  if (c === 0) {
    const toInsert = SEED.filter(
      s => s.language === bucket.lang && s.category === bucket.category && s.difficulty === bucket.difficulty
    );
    await insertCards(toInsert);
  }
}

/**
 * Top up local cache if it's low.
 * Now uses the server's "download" operation to GENERATE new cards,
 * instead of drawing existing ones.
 */
export async function topUpIfLow(bucket: Bucket = DEFAULT_BUCKET) {
  const c = await getCount(bucket.lang, bucket.category, bucket.difficulty);
  if (c >= THRESHOLD) return;

  try {
    const remote = await downloadCards({ ...bucket, count: TOPUP_SIZE });
    await insertCards(remote);
  } catch (e) {
    console.log('Top-up (download) failed (continuing offline):', String(e));
  }
}

/**
 * For a turn: ensure stock, then draw locally.
 */
export async function drawForTurn(count: number, bucket: Bucket = DEFAULT_BUCKET): Promise<Card[]> {
  await topUpIfLow(bucket);
  return drawLocal(bucket.lang, bucket.category, bucket.difficulty, count);
}

/**
 * Start a background watcher that auto "downloads" (generates) more cards
 * when the session's used targets approach the local DB stock.
 * Call this once at app startup. It returns an unsubscribe function.
 */
export function startAutoTopUp(bucket: Bucket = DEFAULT_BUCKET, reserve = RESERVE) {
  if (autoUnsub) return autoUnsub; // already running

  const checkAndTopUp = async () => {
    try {
      const localCount = await getCount(bucket.lang, bucket.category, bucket.difficulty);
      const usedSize = useGame.getState().usedTargets.size;
      const remaining = localCount - usedSize;

      if (remaining <= reserve && !inflight) {
        inflight = true;
        try {
          const remote = await downloadCards({ ...bucket, count: TOPUP_SIZE });
          await insertCards(remote);
        } finally {
          inflight = false;
        }
      }
    } catch (e) {
      console.log('Auto top-up check failed:', String(e));
    }
  };

  // Subscribe to usedTargets size; re-check whenever it grows.
  const unsub = useGame.subscribe(
    (s) => s.usedTargets.size,
    () => { void checkAndTopUp(); }
  );

  // Also run once on start
  void checkAndTopUp();

  autoUnsub = () => {
    unsub();
    autoUnsub = null;
  };
  return autoUnsub;
}

export function stopAutoTopUp() {
  if (autoUnsub) {
    autoUnsub();
    autoUnsub = null;
  }
}
