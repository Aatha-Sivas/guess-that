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
        target TEXT NOT NULL,
        norm_target TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS card_forbidden(
        card_id TEXT NOT NULL,
        word TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cards_lcd
        ON cards(language, category, difficulty);

      CREATE INDEX IF NOT EXISTS idx_cards_lcd_norm
        ON cards(language, category, difficulty, norm_target);
        
      CREATE TABLE IF NOT EXISTS trash_cards(
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        target TEXT NOT NULL,
        norm_target TEXT NOT NULL,
        deleted_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trash_card_forbidden(
        card_id TEXT NOT NULL,
        word TEXT NOT NULL
      );
    `);

    await ensureCardsNormTargetColumn(db);
    await ensureTrashCardsNormTargetColumn(db);
    
    await purgeExpiredTrashInternal(db);
  })();
  return initPromise;
}

function requireDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialized: call initDb() first');
  return db;
}

function generateCustomCardId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `custom-${timestamp}-${randomPart}`;
}

const DIACRITIC_PATTERN = /\p{M}+/gu;

function normalizeTarget(text: string): string {
  if (!text) {
    return '';
  }
  const normalized = text.normalize('NFKC');
  const withoutMarks = normalized.replace(DIACRITIC_PATTERN, '');
  return withoutMarks.toLowerCase().trim();
}

async function ensureCardsNormTargetColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(cards)');
  const hasNorm = columns.some((column) => column.name === 'norm_target');
  if (!hasNorm) {
    await database.execAsync('ALTER TABLE cards ADD COLUMN norm_target TEXT');
  }

  const rowsNeedingUpdate = await database.getAllAsync<{
    id: string;
    target: string;
  }>('SELECT id, target FROM cards WHERE norm_target IS NULL');

  if (!rowsNeedingUpdate.length) {
    return;
  }

  const updateStmt = await database.prepareAsync('UPDATE cards SET norm_target=? WHERE id=?');
  try {
    for (const row of rowsNeedingUpdate) {
      await updateStmt.executeAsync([normalizeTarget(row.target), row.id]);
    }
  } finally {
    await updateStmt.finalizeAsync();
  }
}

async function ensureTrashCardsNormTargetColumn(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(trash_cards)');
  const hasNorm = columns.some((column) => column.name === 'norm_target');
  if (!hasNorm) {
    await database.execAsync('ALTER TABLE trash_cards ADD COLUMN norm_target TEXT');
  }

  const rowsNeedingUpdate = await database.getAllAsync<{
    id: string;
    target: string;
  }>('SELECT id, target FROM trash_cards WHERE norm_target IS NULL');

  if (!rowsNeedingUpdate.length) {
    return;
  }

  const updateStmt = await database.prepareAsync('UPDATE trash_cards SET norm_target=? WHERE id=?');
  try {
    for (const row of rowsNeedingUpdate) {
      await updateStmt.executeAsync([normalizeTarget(row.target), row.id]);
    }
  } finally {
    await updateStmt.finalizeAsync();
  }
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
 * Insert cards from server. Cards are deduplicated by normalized target within
 * the same language/category/difficulty bucket. Existing rows are updated and
 * their forbidden words replaced to mirror the server payload.
 */
export async function insertCards(cards: Card[]): Promise<void> {
  if (!cards.length) return;
  await initDb();
  const _db = requireDb();

  // prepared statements
  const insertCard = await _db.prepareAsync(
     'INSERT OR IGNORE INTO cards(id, language, category, difficulty, target, norm_target) VALUES(?,?,?,?,?,?)'
  );
  const updateCard = await _db.prepareAsync(
    'UPDATE cards SET language=?, category=?, difficulty=?, target=?, norm_target=? WHERE id=?'
  );
  // OR IGNORE prevents dupes if the same word appears twice in the payload
  const insertForbidden = await _db.prepareAsync(
    'INSERT OR IGNORE INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    for (const c of cards) {
      const normTarget = normalizeTarget(c.target);

      const existingByNorm = await _db.getFirstAsync<{ id: string }>(
        'SELECT id FROM cards WHERE language=? AND category=? AND difficulty=? AND norm_target=?',
        [c.language, c.category, c.difficulty, normTarget]
      );

      let cardId: string;

      if (existingByNorm) {
        cardId = existingByNorm.id;
        await updateCard.executeAsync([
          c.language,
          c.category,
          c.difficulty,
          c.target,
          normTarget,
          cardId,
        ]);
      } else {
        const existingById = await _db.getFirstAsync<{ id: string }>('SELECT id FROM cards WHERE id=?', [c.id]);
        if (existingById) {
          cardId = existingById.id;
          await updateCard.executeAsync([
            c.language,
            c.category,
            c.difficulty,
            c.target,
            normTarget,
            cardId,
          ]);
        } else {
          cardId = c.id;
          await insertCard.executeAsync([
            cardId,
            c.language,
            c.category,
            c.difficulty,
            c.target,
            normTarget,
          ]);
        }
      }

      await _db.runAsync('DELETE FROM card_forbidden WHERE card_id=?', [c.id]);

      for (const w of c.forbidden) {
        await insertForbidden.executeAsync([cardId, w]);
      }
    }

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await insertCard.finalizeAsync();
    await updateCard.finalizeAsync();
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
    'INSERT OR REPLACE INTO trash_cards(id, language, category, difficulty, target, norm_target, deleted_at) VALUES(?,?,?,?,?,?,?)'
  );
  const insertTrashForbidden = await _db.prepareAsync(
    'INSERT INTO trash_card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    const deletedAt = Math.floor(Date.now() / 1000);
    const normTarget = normalizeTarget(card.target);
    await insertTrashCard.executeAsync([
      card.id,
      card.language,
      card.category,
      card.difficulty,
      card.target,
      normTarget,
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
    'INSERT OR REPLACE INTO cards(id, language, category, difficulty, target, norm_target) VALUES(?,?,?,?,?,?)'
  );
  const insertForbidden = await _db.prepareAsync(
    'INSERT INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    const normTarget = normalizeTarget(card.target);
    await insertCard.executeAsync([
      card.id,
      card.language,
      card.category,
      card.difficulty,
      card.target,
      normTarget,
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

export async function createCustomCard(input: {
  target: string;
  language: string;
  category: string;
  difficulty: Difficulty;
  forbidden: string[];
}): Promise<Card> {
  await initDb();
  const _db = requireDb();

  const id = generateCustomCardId();
  const normTarget = normalizeTarget(input.target);
  
  const existing = await _db.getFirstAsync<{ id: string }>(
    'SELECT id FROM cards WHERE language=? AND category=? AND difficulty=? AND norm_target=?',
    [input.language, input.category, input.difficulty, normTarget]
  );

  if (existing) {
    throw new Error('Eine Karte mit diesem Zielwort existiert bereits.');
  }

  const insertCard = await _db.prepareAsync(
    'INSERT INTO cards(id, language, category, difficulty, target, norm_target) VALUES(?,?,?,?,?,?)'
  );
  const insertForbidden = await _db.prepareAsync(
    'INSERT INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  const normalizedForbidden: string[] = [];

  try {
    await _db.execAsync('BEGIN');

    await insertCard.executeAsync([
      id,
      input.language,
      input.category,
      input.difficulty,
      input.target,
      normTarget,
    ]);

    for (const word of input.forbidden) {
      const trimmed = word.trim();
      if (!trimmed) continue;
      normalizedForbidden.push(trimmed);
      await insertForbidden.executeAsync([id, trimmed]);
    }

    await _db.execAsync('COMMIT');
  } catch (e) {
    await _db.execAsync('ROLLBACK');
    throw e;
  } finally {
    await insertCard.finalizeAsync();
    await insertForbidden.finalizeAsync();
  }

  return {
    id,
    language: input.language,
    category: input.category,
    difficulty: input.difficulty,
    target: input.target,
    forbidden: normalizedForbidden,
  };
}

export async function updateCard(card: Card): Promise<void> {
  await initDb();
  const _db = requireDb();

  const updateStmt = await _db.prepareAsync(
    'UPDATE cards SET language=?, category=?, difficulty=?, target=?, norm_target=? WHERE id=?'
  );
  const insertForbidden = await _db.prepareAsync(
    'INSERT INTO card_forbidden(card_id, word) VALUES(?, ?)'
  );

  try {
    await _db.execAsync('BEGIN');

    const normTarget = normalizeTarget(card.target);
    await updateStmt.executeAsync([
      card.language,
      card.category,
      card.difficulty,
      card.target,
      normTarget,
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
