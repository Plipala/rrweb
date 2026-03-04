import type { RRDocument } from 'rrdom-nodejs';
import type {
  eventWithTime,
  SelectionRange,
  MediaInteractions,
} from '@rrweb/types';

export interface GenerateDomOptions {
  events: eventWithTime[];
  /** Timestamps in ms (absolute, matching event timestamps) */
  timestamps: number[];
}

export interface SnapshotResult {
  /** The absolute timestamp this snapshot was taken at */
  timestamp: number;
  /** Full HTML document string */
  html: string;
  /** Metadata about non-HTML-representable state */
  metadata: SnapshotMetadata;
  /** Live RRDocument for programmatic inspection */
  document: RRDocument;
}

export interface SnapshotMetadata {
  timestamp: number;
  viewport: { width: number; height: number };
  scrollPositions: ScrollPositionEntry[];
  inputValues: InputValueEntry[];
  selections: SelectionRange[];
  mediaStates: MediaStateEntry[];
}

export interface ScrollPositionEntry {
  nodeId: number;
  selector: string;
  top: number;
  left: number;
}

export interface InputValueEntry {
  nodeId: number;
  selector: string;
  value: string;
  isChecked?: boolean;
}

export interface MediaStateEntry {
  nodeId: number;
  selector: string;
  currentTime?: number;
  paused: boolean;
  volume?: number;
  muted?: boolean;
  loop?: boolean;
  playbackRate?: number;
}

/**
 * Mutable accumulator tracking DOM state that can't be
 * represented in a static HTML string.
 */
export interface DOMState {
  viewport: { width: number; height: number };
  scrollPositions: Map<number, { x: number; y: number }>;
  inputValues: Map<number, { text: string; isChecked: boolean }>;
  selections: SelectionRange[];
  mediaStates: Map<
    number,
    {
      type: MediaInteractions;
      currentTime?: number;
      volume?: number;
      muted?: boolean;
      loop?: boolean;
      playbackRate?: number;
    }
  >;
}

export function createDOMState(): DOMState {
  return {
    viewport: { width: 0, height: 0 },
    scrollPositions: new Map(),
    inputValues: new Map(),
    selections: [],
    mediaStates: new Map(),
  };
}
