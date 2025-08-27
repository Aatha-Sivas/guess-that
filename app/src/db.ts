// src/db.ts
import * as SQLite from 'expo-sqlite';
import type { Card, Difficulty } from './types';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

/** Open (or create) the DB and ensure schema exists. Call once at app start. */
export function initDb(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = await SQLite.openDatabaseAsync('guess-that.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS cards(
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        target TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS card_forbidden(
        card_id TEXT NOT NULL,
        word TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cards_lcd
        ON cards(language, category, difficulty);
    `);
  })();
  return initPromise;
}

function requireDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialized: call initDb() first');
  return db;
}

/** Count local cards for a given bucket. */
export async function getCount(
  lang: string,
  category: string,
  difficulty: Difficulty
): Promise<number> {
  await initDb();
  const row = await requireDb().getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM cards WHERE language=? AND category=? AND difficulty=?',
    [lang, category, difficulty]
  );
  return row?.c ?? 0;
}

/**
 * Insert cards from server. If a card already exists:
 *  - keep the card row (INSERT OR IGNORE)
 *  - REPLACE its forbidden words with the server list (delete then insert)
 * This keeps local data in sync with the backend and prevents duplicates.
 */
export async function insertCards(cards: Card[]): Promise<void> {
  if (!cards.length) return;
  await initDb();
  const _db = requireDb();

  // prepared statements
  const insertCard = await _db.prepareAsync(
    'INSERT OR IGNORE INTO cards(id, language, category, difficulty, target) VALUES(?,?,?,?,?)'
  );
  // OR IGNORE prevents dupes if the same word appears twice in the payload
  const insertForbidden = await _db.prepareAsync(
    'INSERT OR IGNORE INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    for (const c of cards) {
      // did this card already exist?
      const exists = await _db.getFirstAsync<{ x: number }>(
        'SELECT 1 as x FROM cards WHERE id=?',
        [c.id]
      );

      // insert the card row if new (ignored if already present)
      await insertCard.executeAsync([c.id, c.language, c.category, c.difficulty, c.target]);

      // if it existed, wipe its forbidden list to mirror the server exactly
      if (exists) {
        await _db.runAsync('DELETE FROM card_forbidden WHERE card_id=?', [c.id]);
      }

      // insert the current forbidden set
      for (const w of c.forbidden) {
        await insertForbidden.executeAsync([c.id, w]);
      }
    }

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await insertCard.finalizeAsync();
    await insertForbidden.finalizeAsync();
  }
}

/** Draw COUNT random cards from the local cache for a given bucket. */
export async function drawLocal(
  lang: string,
  category: string,
  difficulty: Difficulty,
  count: number
): Promise<Card[]> {
  await initDb();
  const _db = requireDb();

  const rows = await _db.getAllAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
  }>(
    `SELECT id, language, category, difficulty, target
       FROM cards
      WHERE language=? AND category=? AND difficulty=?
      ORDER BY RANDOM() LIMIT ?`,
    [lang, category, difficulty, count]
  );

  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(',');
  const forb = await _db.getAllAsync<{ card_id: string; word: string }>(
    `SELECT card_id, word FROM card_forbidden WHERE card_id IN (${placeholders})`,
    ids
  );

  const byId = new Map<string, string[]>();
  for (const r of forb) {
    const list = byId.get(r.card_id) ?? [];
    list.push(r.word);
    byId.set(r.card_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    language: r.language,
    category: r.category,
    difficulty: r.difficulty as Difficulty,
    target: r.target,
    forbidden: byId.get(r.id) ?? [],
  }));
}
