/**
 * Echo — memory types.
 *
 * Kept dependency-free so they can be shared with the dashboard later.
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

export interface MemoryProvenance {
  createdAt: string;
  updatedAt: string;
  source?: string;
  sessionId?: string;
}

export interface Memory {
  id: string;
  title: string;
  body: string;
  category: MemoryCategory;
  tags: string[];
  provenance: MemoryProvenance;
  relatedIds: string[];
}

export interface MemorySummary {
  id: string;
  title: string;
  category: MemoryCategory;
  tags: string[];
  updatedAt: string;
  /** 0-1 freshness score, ~30 day half-life. */
  freshness: number;
}

export interface SearchResult extends MemorySummary {
  score: number;
  snippet?: string;
}
