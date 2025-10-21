export type Difficulty = 'easy' | 'medium' | 'hard';

export type Card = {
    id: string;
    language: string;         // 'de-CH'
    category: string;         // 'family'
    difficulty: Difficulty;
    target: string;
    forbidden: string[];
};

export type TrashCard = Card & {
    deletedAt: number;        // unix timestamp (seconds)
};