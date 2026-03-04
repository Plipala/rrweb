import {
  EventType,
  type eventWithTime,
  type fullSnapshotEvent,
  type metaEvent,
} from '@rrweb/types';
import { RRDocument } from 'rrdom-nodejs';
import { createMirror, type Mirror } from 'rrdom';
import { rebuildSnapshot } from './rebuild';
import { applyIncremental } from './apply-mutation';
import { serializeToHtml, serializeMetadata } from './serialize';
import {
  type GenerateDomOptions,
  type SnapshotResult,
  type DOMState,
  createDOMState,
} from './types';

/**
 * Find the index of the last FullSnapshot event whose timestamp
 * is <= the given timestamp.
 */
function findLastSnapshotIndex(
  events: eventWithTime[],
  timestamp: number,
): number {
  let lastIdx = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i].timestamp > timestamp) break;
    if (events[i].type === EventType.FullSnapshot) {
      lastIdx = i;
    }
  }
  return lastIdx;
}

/**
 * Clone the RRDocument by serializing and rebuilding.
 * This is used when we need a snapshot at a point in time while
 * continuing to mutate the document for later timestamps.
 */
function cloneDoc(
  sourceDoc: RRDocument,
  sourceMirror: Mirror,
): { doc: RRDocument; mirror: Mirror } {
  // We re-serialize by walking the mirror's metadata and
  // performing a fresh rebuild. This is a simple approach;
  // for efficiency we just return the serialized HTML + the mirror's
  // metadata, but the caller wants a live doc, so we clone it.
  //
  // For now, the approach is: we don't clone. Instead, the caller
  // serializes HTML at each timestamp. This avoids the need for
  // deep-cloning the document.
  void sourceDoc;
  void sourceMirror;
  throw new Error('Not used — snapshots are serialized inline');
}

/**
 * Generate DOM snapshots for multiple timestamps from an rrweb event stream.
 *
 * Strategy:
 *  - Sort requested timestamps ascending
 *  - Rebuild the DOM from the last FullSnapshot before the earliest timestamp
 *  - Apply incremental mutations in order
 *  - Serialize at each requested timestamp
 *  - If a new FullSnapshot is encountered between timestamps, rebuild from it
 */
export function generateDomAtTimestamps(
  options: GenerateDomOptions,
): SnapshotResult[] {
  const { events } = options;
  const timestamps = [...options.timestamps].sort((a, b) => a - b);

  if (events.length === 0 || timestamps.length === 0) {
    return [];
  }

  // Sort events by timestamp (should already be sorted, but ensure)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const results: SnapshotResult[] = [];
  let doc = new RRDocument();
  let mirror: Mirror = createMirror();
  let state: DOMState = createDOMState();
  let initialized = false;
  let timestampIdx = 0;

  // Find the first FullSnapshot before or at the earliest requested timestamp
  const firstSnapshotIdx = findLastSnapshotIndex(
    sortedEvents,
    timestamps[0],
  );

  if (firstSnapshotIdx === -1) {
    // No snapshot before the earliest timestamp.
    // Try to find the first snapshot at all and start from there.
    const anySnapshotIdx = sortedEvents.findIndex(
      (e) => e.type === EventType.FullSnapshot,
    );
    if (anySnapshotIdx === -1) {
      // No full snapshots at all — can't generate DOMs
      return [];
    }
    // Start from this snapshot; only timestamps after it will get results
  }

  const startEventIdx = firstSnapshotIdx >= 0 ? firstSnapshotIdx : 0;

  // Pre-scan for Meta events before the start index to capture initial viewport
  for (let i = 0; i < startEventIdx; i++) {
    if (sortedEvents[i].type === EventType.Meta) {
      const metaData = (sortedEvents[i] as metaEvent).data;
      state.viewport = { width: metaData.width, height: metaData.height };
    }
  }

  for (let i = startEventIdx; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];

    // Check if we've passed all requested timestamps
    if (timestampIdx >= timestamps.length) break;

    // Before processing this event, check if we need to serialize
    // for any timestamps that occur before this event
    while (
      timestampIdx < timestamps.length &&
      event.timestamp > timestamps[timestampIdx]
    ) {
      if (initialized) {
        results.push(createSnapshot(doc, mirror, state, timestamps[timestampIdx]));
      }
      timestampIdx++;
    }

    if (timestampIdx >= timestamps.length) break;

    // Process the event
    switch (event.type) {
      case EventType.Meta: {
        const metaData = (event as metaEvent).data;
        state.viewport = {
          width: metaData.width,
          height: metaData.height,
        };
        break;
      }

      case EventType.FullSnapshot: {
        const snapshotData = (event as eventWithTime & fullSnapshotEvent).data;
        const prevViewport = state.viewport;
        doc = new RRDocument();
        mirror = createMirror();
        state = createDOMState();
        state.viewport = prevViewport;
        rebuildSnapshot(snapshotData.node, doc, mirror);
        if (snapshotData.initialOffset) {
          state.scrollPositions.set(
            snapshotData.node.id,
            {
              x: snapshotData.initialOffset.left,
              y: snapshotData.initialOffset.top,
            },
          );
        }
        initialized = true;
        break;
      }

      case EventType.IncrementalSnapshot: {
        if (!initialized) break;
        applyIncremental(event.data, doc, mirror, state);
        break;
      }

      // DomContentLoaded, Load, Custom, Plugin — no DOM effect
      default:
        break;
    }
  }

  // Handle any remaining timestamps after all events are processed
  while (timestampIdx < timestamps.length) {
    if (initialized) {
      results.push(createSnapshot(doc, mirror, state, timestamps[timestampIdx]));
    }
    timestampIdx++;
  }

  return results;
}

function createSnapshot(
  doc: RRDocument,
  mirror: Mirror,
  state: DOMState,
  timestamp: number,
): SnapshotResult {
  return {
    timestamp,
    html: serializeToHtml(doc),
    metadata: serializeMetadata(state, mirror, timestamp),
    document: doc,
  };
}

// Re-export for convenience
export { cloneDoc as _cloneDoc };
