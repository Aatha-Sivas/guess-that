-- Use utf8mb4 and an accent-insensitive, case-insensitive collation.
-- We'll ALSO normalize in Java to be deterministic across locales.
CREATE TABLE IF NOT EXISTS cards (
    id          CHAR(36)      NOT NULL,              -- UUID string from Java
    language    VARCHAR(16)   NOT NULL,              -- e.g., 'de-CH'
    category    VARCHAR(32)   NOT NULL,              -- 'family'
    difficulty  VARCHAR(16)   NOT NULL,              -- 'easy'|'medium'|'hard'
    target      VARCHAR(255)  NOT NULL,              -- original target
    norm_target VARCHAR(255)  NOT NULL,              -- normalized (folded + lower)
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cards_lang_norm (language, norm_target)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS card_forbidden (
    card_id     CHAR(36)     NOT NULL,
    word        VARCHAR(255) NOT NULL,
    CONSTRAINT fk_card_forbidden FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    INDEX idx_card_forbidden_card_id (card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
