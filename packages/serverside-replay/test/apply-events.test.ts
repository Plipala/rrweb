/**
 * @vitest-environment node
 */
import 'rrdom-nodejs';
import { describe, it, expect } from 'vitest';
import { generateDomAtTimestamps } from '../src/apply-events';
import {
  createMinimalEvents,
  createEventsWithRemoval,
} from './fixtures';

describe('generateDomAtTimestamps', () => {
  it('should return empty results for empty events', () => {
    const results = generateDomAtTimestamps({
      events: [],
      timestamps: [1000],
    });
    expect(results).toEqual([]);
  });

  it('should return empty results for empty timestamps', () => {
    const results = generateDomAtTimestamps({
      events: createMinimalEvents(),
      timestamps: [],
    });
    expect(results).toEqual([]);
  });

  it('should generate a snapshot at a timestamp after the full snapshot', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });

    expect(results.length).toBe(1);
    expect(results[0].timestamp).toBe(baseTime + 200);
    expect(results[0].html).toContain('Hello World');
    expect(results[0].html).toContain('<title>Test Page</title>');
    expect(results[0].html).toContain('id="container"');
  });

  it('should apply mutations before the requested timestamp', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After the <p> add mutation at baseTime + 500
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 600],
    });

    expect(results.length).toBe(1);
    expect(results[0].html).toContain('Welcome to the test page!');
    expect(results[0].html).toContain('<p');
  });

  it('should apply text mutations', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After text mutation at baseTime + 1000
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 1100],
    });

    expect(results.length).toBe(1);
    expect(results[0].html).toContain('Updated Heading');
    expect(results[0].html).not.toContain('Hello World');
  });

  it('should apply attribute mutations', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After attribute mutation at baseTime + 1500
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 1600],
    });

    expect(results.length).toBe(1);
    expect(results[0].html).toContain('class="highlighted"');
  });

  it('should capture input values in metadata', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After input event at baseTime + 2000
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 2100],
    });

    expect(results.length).toBe(1);
    expect(results[0].metadata.inputValues.length).toBe(1);
    expect(results[0].metadata.inputValues[0].value).toBe('John Doe');
    expect(results[0].metadata.inputValues[0].nodeId).toBe(11);
  });

  it('should capture scroll positions in metadata', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After scroll event at baseTime + 2500
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 2600],
    });

    expect(results.length).toBe(1);
    const scrollEntry = results[0].metadata.scrollPositions.find(
      (s) => s.nodeId === 7,
    );
    expect(scrollEntry).toBeDefined();
    expect(scrollEntry!.top).toBe(200);
    expect(scrollEntry!.left).toBe(0);
  });

  it('should capture viewport resize in metadata', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    // After viewport resize at baseTime + 3000
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 3100],
    });

    expect(results.length).toBe(1);
    expect(results[0].metadata.viewport).toEqual({
      width: 1024,
      height: 768,
    });
  });

  it('should handle batch timestamps efficiently', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    const results = generateDomAtTimestamps({
      events,
      timestamps: [
        baseTime + 200,  // after snapshot, before mutations
        baseTime + 600,  // after <p> add
        baseTime + 1100, // after text change
        baseTime + 3100, // after all events
      ],
    });

    expect(results.length).toBe(4);

    // First snapshot: original state
    expect(results[0].html).toContain('Hello World');
    expect(results[0].html).not.toContain('Welcome to the test page!');

    // Second: with <p> element
    expect(results[1].html).toContain('Welcome to the test page!');

    // Third: with updated heading
    expect(results[2].html).toContain('Updated Heading');

    // Fourth: with all changes
    expect(results[3].html).toContain('Updated Heading');
    expect(results[3].metadata.viewport.width).toBe(1024);
  });

  it('should handle node removal', () => {
    const events = createEventsWithRemoval();
    const baseTime = events[0].timestamp;

    // Before removal
    const before = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });
    expect(before[0].html).toContain('id="to-remove"');
    expect(before[0].html).toContain('I will be removed');

    // After removal
    const after = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 600],
    });
    expect(after[0].html).not.toContain('id="to-remove"');
    expect(after[0].html).not.toContain('I will be removed');
    expect(after[0].html).toContain('I stay');
  });

  it('should set initial viewport from Meta event', () => {
    const events = createMinimalEvents();
    const baseTime = events[0].timestamp;

    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });

    expect(results[0].metadata.viewport).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});
