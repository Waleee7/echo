/**
 * Client-safe memory types and constants.
 * NO Node imports here — must be safe to bundle in the browser.
 */

export const MEMORY_CATEGORIES = [
  "user",
  "feedback",
  "project",
  "reference",
  "persona",
  "incident",
  "preference",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
  ts?: string;
}

export interface MemoryChat {
  /** Short snippet shown in the preview overlay (2-4 lines max). */
  preview: string;
  /** Optional structured transcript of the conversation that produced this memory. */
  turns?: ChatTurn[];
  /** Optional free-form fallback when no structured turns exist. */
  full?: string;
  sessionId?: string;
}

export interface Memory {
  id: string;
  title: string;
  body: string;
  category: MemoryCategory;
  tags: string[];
  provenance: {
    createdAt: string;
    updatedAt: string;
    source?: string;
    sessionId?: string;
  };
  relatedIds: string[];
  chat?: MemoryChat;
}

export interface MemorySummary {
  id: string;
  title: string;
  category: MemoryCategory;
  tags: string[];
  updatedAt: string;
  freshness: number;
  relatedIds: string[];
  hasChat: boolean;
}

export function computeFreshness(updatedAt: string): number {
  const ageDays =
    (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 43.3)));
}

/**
 * Brain region anchors on a unit sphere.
 * Each MemoryCategory gets a label, 3D position, and HSL hue (0-360)
 * in the cool-spectrum to match the Iron Man HUD blue base palette.
 */
export const BRAIN_REGIONS: Record<
  MemoryCategory,
  { label: string; anchor: [number, number, number]; hue: number }
> = {
  user:       { label: "Self",     anchor: [ 0.0,  0.9,  0.0],  hue: 200 },
  persona:    { label: "Voice",    anchor: [ 0.7,  0.5,  0.3],  hue: 280 },
  feedback:   { label: "Habits",   anchor: [-0.7,  0.5,  0.3],  hue: 165 },
  project:    { label: "Missions", anchor: [ 0.0, -0.1,  0.95], hue: 220 },
  preference: { label: "Tastes",   anchor: [ 0.0, -0.1, -0.95], hue: 320 },
  incident:   { label: "Events",   anchor: [ 0.6, -0.7,  0.2],  hue:   0 },
  reference:  { label: "Pointers", anchor: [-0.6, -0.7,  0.2],  hue: 250 },
};
