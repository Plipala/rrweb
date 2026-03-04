import 'rrdom-nodejs';
import { generateDomAtTimestamps } from './apply-events';
import type { GenerateDomOptions, SnapshotResult } from './types';

export { generateDomAtTimestamps as generateDom };

export type {
  GenerateDomOptions,
  SnapshotResult,
  SnapshotMetadata,
  ScrollPositionEntry,
  InputValueEntry,
  MediaStateEntry,
  DOMState,
} from './types';

export { serializeToHtml, serializeMetadata } from './serialize';
export { rebuildSnapshot } from './rebuild';

/**
 * Convenience wrapper matching the plan's API.
 *
 * @example
 * ```ts
 * import { generateDom } from '@rrweb/serverside-replay';
 *
 * const results = generateDom({
 *   events: recordedEvents,
 *   timestamps: [1000, 5000, 10000],
 * });
 *
 * results[0].html       // full HTML string
 * results[0].metadata   // scroll, input, selection, media state
 * results[0].document   // live RRDocument for inspection
 * ```
 */
export function generateDomSnapshots(
  options: GenerateDomOptions,
): SnapshotResult[] {
  return generateDomAtTimestamps(options);
}
