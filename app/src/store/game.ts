import { create } from 'zustand';
import type { Card } from '../types';

type Scores = [number, number];

export type Settings = {
  secondsPerRound: number; // e.g., 90
  totalRounds: number;     // e.g., 8
};

type GameState = {
  // settings & round tracking
  settings: Settings;
  currentRound: number; // 1-based

  // teams / scores
  teamIndex: 0 | 1;
  scores: Scores;

  // card queue
  currentCard?: Card;
  nextCards: Card[];

  // actions
  setSettings: (partial: Partial<Settings>) => void;
  startGame: () => void; // resets scores + round
  nextRound: () => void;

  setCards: (cards: Card[]) => void;
  correct: () => void;
  skip: () => void; // opponent +1
  passPhone: () => void; // switch team (cover screen)
  resetAll: () => void;
};

export const useGame = create<GameState>((set, get) => ({
  settings: { secondsPerRound: 90, totalRounds: 8 },
  currentRound: 1,

  teamIndex: 0,
  scores: [0, 0],
  nextCards: [],

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

  nextRound: () =>
    set((state) => ({ currentRound: state.currentRound + 1 })),

  setCards: (cards) => set({ nextCards: cards, currentCard: cards[0] }),

  correct: () => {
    const { teamIndex, scores, nextCards } = get();
    const s: Scores = [...scores] as Scores;
    s[teamIndex] += 1;
    const [, ...rest] = nextCards;
    set({ scores: s, nextCards: rest, currentCard: rest[0] });
  },

  skip: () => {
    const { teamIndex, scores, nextCards } = get();
    const s: Scores = [...scores] as Scores;
    const opp = ((teamIndex + 1) % 2) as 0 | 1;
    s[opp] += 1; // rule: skip → opponent +1
    const [, ...rest] = nextCards;
    set({ scores: s, nextCards: rest, currentCard: rest[0] });
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
