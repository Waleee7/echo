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
}

export interface MemorySummary {
  id: string;
  title: string;
  category: MemoryCategory;
  tags: string[];
  updatedAt: string;
  freshness: number;
}

export function computeFreshness(updatedAt: string): number {
  const ageDays =
    (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 43.3)));
}

/**
 * Brain region anchors on a unit sphere.
 * Each MemoryCategory gets a label, 3D position, and amber hue (0-360).
 */
export const BRAIN_REGIONS: Record<
  MemoryCategory,
  { label: string; anchor: [number, number, number]; hue: number }
> = {
  user:       { label: "Self",     anchor: [ 0.0,  0.9,  0.0],  hue: 38 },
  persona:    { label: "Voice",    anchor: [ 0.7,  0.5,  0.3],  hue: 28 },
  feedback:   { label: "Habits",   anchor: [-0.7,  0.5,  0.3],  hue: 48 },
  project:    { label: "Missions", anchor: [ 0.0, -0.1,  0.95], hue: 18 },
  preference: { label: "Tastes",   anchor: [ 0.0, -0.1, -0.95], hue: 56 },
  incident:   { label: "Events",   anchor: [ 0.6, -0.7,  0.2],  hue: 8  },
  reference:  { label: "Pointers", anchor: [-0.6, -0.7,  0.2],  hue: 62 },
};
