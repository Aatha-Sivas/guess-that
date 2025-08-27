import { create } from 'zustand';
import type { Card } from '../types';

type Scores = [number, number];

export type Settings = {
  secondsPerRound: number;
  totalRounds: number;
};

const fold = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type GameState = {
  settings: Settings;
  currentRound: number;

  teamIndex: 0 | 1;
  scores: Scores;

  currentCard?: Card;
  nextCards: Card[];

  usedTargets: Set<string>; 
  markUsed: (target: string | undefined) => void;
  clearUsedTargets: () => void;

  // actions
  setSettings: (partial: Partial<Settings>) => void;
  startGame: () => void;
  nextRound: () => void;

  setCards: (cards: Card[]) => void;
  correct: () => void;
  skip: () => void;
  passPhone: () => void;
  resetAll: () => void;
};

export const useGame = create<GameState>((set, get) => ({
  settings: { secondsPerRound: 90, totalRounds: 8 },
  currentRound: 1,

  teamIndex: 0,
  scores: [0, 0],
  nextCards: [],

  usedTargets: new Set<string>(),
  markUsed: (target) => {
    if (!target) return;
    const f = fold(target);
    const s = new Set(get().usedTargets);
    s.add(f);
    set({ usedTargets: s });
  },
  clearUsedTargets: () => set({ usedTargets: new Set<string>() }),

  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  startGame: () =>
    set({
      scores: [0, 0],
      teamIndex: 0,
      currentRound: 1,
      currentCard: undefined,
      nextCards: [],
    }),

  nextRound: () => set((s) => ({ currentRound: s.currentRound + 1 })),

  setCards: (cards) => {
    const used = get().usedTargets;
    const filtered = cards.filter((c) => !used.has(fold(c.target)));
    const seen = new Set<string>();
    const unique = filtered.filter((c) => {
      const f = fold(c.target);
      if (seen.has(f)) return false;
      seen.add(f);
      return true;
    });
    set({ nextCards: unique, currentCard: unique[0] });
  },

  correct: () => {
    const { teamIndex, scores, nextCards, currentCard, markUsed } = get();
    const s: Scores = [...scores] as Scores;
    s[teamIndex] += 1;
    markUsed(currentCard?.target);
    const rest = nextCards.slice(1);
    const used = get().usedTargets;
    const remaining = rest.filter((c) => !used.has(fold(c.target)));
    set({ scores: s, nextCards: remaining, currentCard: remaining[0] });
  },

  skip: () => {
    const { teamIndex, scores, nextCards, currentCard, markUsed } = get();
    // skip → opponent +1
    const s: Scores = [...scores] as Scores;
    const opp = ((teamIndex + 1) % 2) as 0 | 1;
    s[opp] += 1;
    markUsed(currentCard?.target);
    const rest = nextCards.slice(1);
    const used = get().usedTargets;
    const remaining = rest.filter((c) => !used.has(fold(c.target)));
    set({ scores: s, nextCards: remaining, currentCard: remaining[0] });
  },

  passPhone: () =>
    set((state) => ({ teamIndex: ((state.teamIndex + 1) % 2) as 0 | 1 })),

  resetAll: () =>
    set({
      settings: { secondsPerRound: 90, totalRounds: 8 },
      currentRound: 1,
      teamIndex: 0,
      scores: [0, 0],
      currentCard: undefined,
      nextCards: [],
    }),
}));
