import type { Card, Difficulty } from "./types";

const BASE = process.env.EXPO_PUBLIC_API_BASE || "http://10.0.2.2:8080";

export async function drawCards(params: {
  lang: string;
  category: string;
  difficulty: Difficulty;
  count?: number;
}): Promise<Card[]> {
  const q = new URLSearchParams(params as any).toString();
  const res = await fetch(`${BASE}/api/cards/draw?${q}`);
  if (!res.ok) throw new Error(`draw failed: ${res.status}`);
  return res.json();
}

// Optional: use when you want to actively top-up the server stock.
export async function downloadCards(params: {
  lang: string;
  category: string;
  difficulty: Difficulty;
  count: number;
}): Promise<Card[]> {
  const q = new URLSearchParams(params as any).toString();
  const res = await fetch(`${BASE}/api/cards/download?${q}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return res.json();
}
