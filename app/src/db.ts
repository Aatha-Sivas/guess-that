import * as SQLite from 'expo-sqlite';
import type { Card, Difficulty, TrashCard } from './types';

const TRASH_TTL_SECONDS = 60 * 60; // 60 minutes

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
        
      CREATE TABLE IF NOT EXISTS trash_cards(
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        target TEXT NOT NULL,
        deleted_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trash_card_forbidden(
        card_id TEXT NOT NULL,
        word TEXT NOT NULL
      );
    `);
    
    await purgeExpiredTrashInternal(db);
  })();
  return initPromise;
}

function requireDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialized: call initDb() first');
  return db;
}

async function purgeExpiredTrashInternal(database: SQLite.SQLiteDatabase): Promise<void> {
  const threshold = Math.floor(Date.now() / 1000) - TRASH_TTL_SECONDS;
  if (threshold <= 0) {
    return;
  }

  await database.runAsync(
    'DELETE FROM trash_card_forbidden WHERE card_id IN (SELECT id FROM trash_cards WHERE deleted_at <= ?)',
    [threshold]
  );
  await database.runAsync('DELETE FROM trash_cards WHERE deleted_at <= ?', [threshold]);
}

export async function purgeExpiredTrash(): Promise<void> {
  await initDb();
  const _db = requireDb();
  await purgeExpiredTrashInternal(_db);
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
export async function getAllCards(): Promise<Card[]> {
  await initDb();
  const _db = requireDb();

  await purgeExpiredTrashInternal(_db);

  const rows = await _db.getAllAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
  }>(
    `SELECT id, language, category, difficulty, target
       FROM cards
      ORDER BY target COLLATE NOCASE`
  );

  if (!rows.length) {
    return [];
  }

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const forb = await _db.getAllAsync<{ card_id: string; word: string }>(
    `SELECT card_id, word FROM card_forbidden WHERE card_id IN (${placeholders})`,
    ids
  );

  const byId = new Map<string, string[]>();
  for (const row of forb) {
    const current = byId.get(row.card_id) ?? [];
    current.push(row.word);
    byId.set(row.card_id, current);
  }

  return rows.map((row) => ({
    id: row.id,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty as Difficulty,
    target: row.target,
    forbidden: byId.get(row.id) ?? [],
  }));
}

export async function deleteCard(id: string): Promise<void> {
  await initDb();
  const _db = requireDb();

  await purgeExpiredTrashInternal(_db);

  const card = await _db.getFirstAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
  }>('SELECT id, language, category, difficulty, target FROM cards WHERE id=?', [id]);

  if (!card) {
    return;
  }

  const forbiddenRows = await _db.getAllAsync<{ word: string }>(
    'SELECT word FROM card_forbidden WHERE card_id=? ORDER BY rowid',
    [id]
  );

  const insertTrashCard = await _db.prepareAsync(
    'INSERT OR REPLACE INTO trash_cards(id, language, category, difficulty, target, deleted_at) VALUES(?,?,?,?,?,?)'
  );
  const insertTrashForbidden = await _db.prepareAsync(
    'INSERT INTO trash_card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    const deletedAt = Math.floor(Date.now() / 1000);
    await insertTrashCard.executeAsync([
      card.id,
      card.language,
      card.category,
      card.difficulty,
      card.target,
      deletedAt,
    ]);

    await _db.runAsync('DELETE FROM trash_card_forbidden WHERE card_id=?', [id]);

    for (const entry of forbiddenRows) {
      const trimmed = entry.word.trim();
      if (!trimmed) continue;
      await insertTrashForbidden.executeAsync([id, trimmed]);
    }

    await _db.runAsync('DELETE FROM card_forbidden WHERE card_id=?', [id]);
    await _db.runAsync('DELETE FROM cards WHERE id=?', [id]);

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await insertTrashCard.finalizeAsync();
    await insertTrashForbidden.finalizeAsync();
  }
}

export async function restoreCard(id: string): Promise<void> {
  await initDb();
  const _db = requireDb();

  await purgeExpiredTrashInternal(_db);

  const card = await _db.getFirstAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
  }>('SELECT id, language, category, difficulty, target FROM trash_cards WHERE id=?', [id]);

  if (!card) {
    return;
  }

  const forbiddenRows = await _db.getAllAsync<{ word: string }>(
    'SELECT word FROM trash_card_forbidden WHERE card_id=? ORDER BY rowid',
    [id]
  );

  const insertCard = await _db.prepareAsync(
    'INSERT OR REPLACE INTO cards(id, language, category, difficulty, target) VALUES(?,?,?,?,?)'
  );
  const insertForbidden = await _db.prepareAsync(
    'INSERT INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    await insertCard.executeAsync([
      card.id,
      card.language,
      card.category,
      card.difficulty,
      card.target,
    ]);

    await _db.runAsync('DELETE FROM card_forbidden WHERE card_id=?', [id]);

    for (const entry of forbiddenRows) {
      const trimmed = entry.word.trim();
      if (!trimmed) continue;
      await insertForbidden.executeAsync([id, trimmed]);
    }

    await _db.runAsync('DELETE FROM trash_card_forbidden WHERE card_id=?', [id]);
    await _db.runAsync('DELETE FROM trash_cards WHERE id=?', [id]);

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await insertCard.finalizeAsync();
    await insertForbidden.finalizeAsync();
  }
}

export async function getTrashCards(): Promise<TrashCard[]> {
  await initDb();
  const _db = requireDb();

  await purgeExpiredTrashInternal(_db);

  const rows = await _db.getAllAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
    deleted_at: number;
  }>('SELECT id, language, category, difficulty, target, deleted_at FROM trash_cards ORDER BY deleted_at DESC');

  if (!rows.length) {
    return [];
  }

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const forbRows = await _db.getAllAsync<{ card_id: string; word: string }>(
    `SELECT card_id, word FROM trash_card_forbidden WHERE card_id IN (${placeholders})`,
    ids
  );

  const byId = new Map<string, string[]>();
  for (const row of forbRows) {
    const list = byId.get(row.card_id) ?? [];
    list.push(row.word);
    byId.set(row.card_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty as Difficulty,
    target: row.target,
    forbidden: byId.get(row.id) ?? [],
    deletedAt: row.deleted_at,
  }));
}

export async function getCardById(id: string): Promise<Card | null> {
  await initDb();
  const _db = requireDb();

  const row = await _db.getFirstAsync<{
    id: string;
    language: string;
    category: string;
    difficulty: string;
    target: string;
  }>(
    'SELECT id, language, category, difficulty, target FROM cards WHERE id=?',
    [id]
  );

  if (!row) {
    return null;
  }

  const forbidden = await _db.getAllAsync<{ word: string }>(
    'SELECT word FROM card_forbidden WHERE card_id=? ORDER BY rowid',
    [id]
  );

  return {
    id: row.id,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty as Difficulty,
    target: row.target,
    forbidden: forbidden.map((f) => f.word),
  };
}

export async function updateCard(card: Card): Promise<void> {
  await initDb();
  const _db = requireDb();

  const updateStmt = await _db.prepareAsync(
    'UPDATE cards SET language=?, category=?, difficulty=?, target=? WHERE id=?'
  );
  const insertForbidden = await _db.prepareAsync(
    'INSERT INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    await updateStmt.executeAsync([
      card.language,
      card.category,
      card.difficulty,
      card.target,
      card.id,
    ]);

    await _db.runAsync('DELETE FROM card_forbidden WHERE card_id=?', [card.id]);

    for (const word of card.forbidden) {
      const trimmed = word.trim();
      if (!trimmed) continue;
      await insertForbidden.executeAsync([card.id, trimmed]);
    }

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await updateStmt.finalizeAsync();
    await insertForbidden.finalizeAsync();
  }
}
