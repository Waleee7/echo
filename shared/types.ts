/**
 * Echo — shared type definitions
 *
 * These types are used by both the MCP server and the dashboard.
 * Keep this file dependency-free so it can be imported from anywhere.
 */

export type MemoryCategory =
  | "user"        // facts about who the user is
  | "feedback"    // how the user wants Sage to behave
  | "project"     // ongoing work, goals, deadlines
  | "reference"   // pointers to external systems
  | "persona"     // Sage's voice / style / address preferences
  | "incident"    // notable events the AI should remember
  | "preference"; // small choices and tastes

export interface MemoryProvenance {
  /** ISO timestamp when this memory was created. */
  createdAt: string;
  /** ISO timestamp of the most recent edit (same as createdAt if unedited). */
  updatedAt: string;
  /** Free-text source — e.g. "conversation 2026-05-20 about desktop cleanup". */
  source?: string;
  /** Optional conversation/session ID the memory originated from. */
  sessionId?: string;
}

export interface Memory {
  /** Stable kebab-case slug, unique across the store. */
  id: string;
  /** Short human-readable title. */
  title: string;
  /** Full memory body in markdown. */
  body: string;
  /** One of the supported categories. */
  category: MemoryCategory;
  /** Optional free-form tags for filtering. */
  tags: string[];
  /** Provenance metadata — when, where, how this came to be. */
  provenance: MemoryProvenance;
  /** Slugs of other memories this one references. */
  relatedIds: string[];
}

export interface MemorySummary {
  id: string;
  title: string;
  category: MemoryCategory;
  tags: string[];
  updatedAt: string;
  /** 0-1 freshness score: 1 = brand new, decays with age. */
  freshness: number;
}

export interface SearchResult extends MemorySummary {
  /** Match score (0-1). For text search this is a rank, not a probability. */
  score: number;
  /** Snippet of the body around the match, if applicable. */
  snippet?: string;
}
