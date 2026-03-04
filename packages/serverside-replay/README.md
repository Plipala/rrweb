# @rrweb/serverside-replay

`@rrweb/serverside-replay` generates static DOM snapshots from [rrweb](https://github.com/rrweb-io/rrweb) recordings at specified timestamps, entirely in Node.js — no browser required.

It rebuilds the recorded DOM using [`rrdom-nodejs`](../rrdom-nodejs/), applies incremental mutations up to each requested timestamp, and serializes the result as an HTML string with a companion JSON metadata file for non-HTML-representable state (scroll positions, input values, selections, media state).

See the [guide](../../guide.md) for more info on rrweb.

## Install

```shell
npm install @rrweb/serverside-replay
```

Or with yarn:

```shell
yarn add @rrweb/serverside-replay
```

## CLI Usage

### Generate a DOM snapshot at one or more timestamps

```shell
serverside-replay --input recording.json --timestamps 1000,5000,10000
```

This writes `dom-at-1000ms.html` and `dom-at-1000ms.meta.json` (etc.) to the current directory.

### Specify an output directory

```shell
serverside-replay --input recording.json --timestamps 5000 --output ./snapshots/
```

### Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--input` | `-i` | Path to a JSON file containing an array of rrweb `eventWithTime` objects |
| `--timestamps` | `-t` | Comma-separated list of absolute timestamps in ms |
| `--output` | `-o` | Output directory (defaults to `.`) |
| `--help` | `-h` | Show help |

## Programmatic API

```typescript
import { generateDom } from '@rrweb/serverside-replay';
import type { eventWithTime } from '@rrweb/types';

const events: eventWithTime[] = loadEvents(); // your rrweb events

const results = generateDom({
  events,
  timestamps: [1000, 5000, 10000],
});

for (const result of results) {
  console.log(result.timestamp);     // the requested timestamp
  console.log(result.html);          // full HTML document string
  console.log(result.metadata);      // scroll positions, input values, etc.
  console.log(result.document);      // live RRDocument for further inspection
}
```

### `generateDom(options): SnapshotResult[]`

Accepts:

```typescript
interface GenerateDomOptions {
  events: eventWithTime[];
  timestamps: number[];   // absolute ms, matching event timestamps
}
```

Returns an array of `SnapshotResult`:

```typescript
interface SnapshotResult {
  timestamp: number;
  html: string;
  metadata: SnapshotMetadata;
  document: RRDocument;
}
```

### Metadata

State that cannot be represented in static HTML is captured in `SnapshotMetadata`:

```typescript
interface SnapshotMetadata {
  timestamp: number;
  viewport: { width: number; height: number };
  scrollPositions: ScrollPositionEntry[];
  inputValues: InputValueEntry[];
  selections: SelectionRange[];
  mediaStates: MediaStateEntry[];
}
```

### Additional exports

| Export | Description |
|--------|-------------|
| `generateDomSnapshots` | Alias for `generateDom` |
| `serializeToHtml(doc)` | Serialize an `RRDocument` to an HTML string |
| `serializeMetadata(state, mirror, timestamp)` | Build a `SnapshotMetadata` from accumulated DOM state |
| `rebuildSnapshot(node, doc, mirror)` | Build an `RRDocument` from a serialized snapshot node |

## Output format

For each requested timestamp, two files are produced:

- **`dom-at-<timestamp>ms.html`** — A complete HTML document with all DOM structure, attributes, inline styles, and `<style>` blocks.
- **`dom-at-<timestamp>ms.meta.json`** — A JSON file containing viewport dimensions, scroll positions, input/textarea values, text selections, and media element state.

## How it works

1. Events are sorted by timestamp.
2. The last `FullSnapshot` before the earliest requested timestamp is found.
3. The DOM is rebuilt from that snapshot using `rrdom-nodejs`.
4. Incremental mutations are applied in order. Non-DOM state (scrolls, inputs, selections, media, viewport) is accumulated in a sidecar.
5. At each requested timestamp, the DOM is serialized to HTML and the metadata is captured.
6. If a new `FullSnapshot` is encountered between timestamps, the DOM is rebuilt from it.

Multiple timestamps in a single call are processed efficiently — the DOM is built incrementally rather than rebuilt from scratch for each timestamp.
