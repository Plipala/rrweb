/**
 * @vitest-environment node
 */
import 'rrdom-nodejs';
import { describe, it, expect } from 'vitest';
import { RRDocument } from 'rrdom-nodejs';
import { createMirror } from 'rrdom';
import { NodeType } from '@rrweb/types';
import { rebuildSnapshot } from '../src/rebuild';
import { serializeToHtml, serializeMetadata } from '../src/serialize';
import { createDOMState } from '../src/types';
import {
  createEventsWithStyle,
  createEventsWithShadowDom,
} from './fixtures';
import { generateDomAtTimestamps } from '../src/apply-events';

describe('serializeToHtml', () => {
  it('should serialize a basic document', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    rebuildSnapshot(
      {
        type: NodeType.Document,
        childNodes: [
          {
            type: NodeType.DocumentType,
            name: 'html',
            publicId: '',
            systemId: '',
            id: 2,
          },
          {
            type: NodeType.Element,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'head',
                attributes: {},
                childNodes: [],
                id: 4,
              },
              {
                type: NodeType.Element,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    type: NodeType.Text,
                    textContent: 'Hello',
                    id: 6,
                  },
                ],
                id: 5,
              },
            ],
            id: 3,
          },
        ],
        id: 1,
      },
      doc,
      mirror,
    );

    const html = serializeToHtml(doc);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('<head></head>');
    expect(html).toContain('<body>Hello</body>');
    expect(html).toContain('</html>');
  });

  it('should handle void elements', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    rebuildSnapshot(
      {
        type: NodeType.Document,
        childNodes: [
          {
            type: NodeType.Element,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    type: NodeType.Element,
                    tagName: 'img',
                    attributes: { src: 'test.png', alt: 'test' },
                    childNodes: [],
                    id: 4,
                  },
                  {
                    type: NodeType.Element,
                    tagName: 'br',
                    attributes: {},
                    childNodes: [],
                    id: 5,
                  },
                  {
                    type: NodeType.Element,
                    tagName: 'input',
                    attributes: { type: 'text', value: 'hello' },
                    childNodes: [],
                    id: 6,
                  },
                ],
                id: 3,
              },
            ],
            id: 2,
          },
        ],
        id: 1,
      },
      doc,
      mirror,
    );

    const html = serializeToHtml(doc);
    expect(html).toContain('<img src="test.png" alt="test">');
    expect(html).toContain('<br>');
    expect(html).toContain('<input type="text" value="hello">');
    // Void elements should not have closing tags
    expect(html).not.toContain('</img>');
    expect(html).not.toContain('</br>');
    expect(html).not.toContain('</input>');
  });

  it('should escape HTML entities in text', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    rebuildSnapshot(
      {
        type: NodeType.Document,
        childNodes: [
          {
            type: NodeType.Element,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    type: NodeType.Text,
                    textContent: '<script>alert("xss")</script>',
                    id: 4,
                  },
                ],
                id: 3,
              },
            ],
            id: 2,
          },
        ],
        id: 1,
      },
      doc,
      mirror,
    );

    const html = serializeToHtml(doc);
    // In HTML text content, quotes don't need escaping; only <, >, & do
    expect(html).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('should serialize comments', () => {
    const events = createEventsWithShadowDom();
    const baseTime = events[0].timestamp;
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });

    expect(results[0].html).toContain('<!-- This is a comment -->');
  });

  it('should serialize style element content without escaping', () => {
    const events = createEventsWithStyle();
    const baseTime = events[0].timestamp;
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });

    expect(results[0].html).toContain('body { margin: 0; }');
    expect(results[0].html).toContain('.red { color: red; }');
  });

  it('should filter rrweb internal attributes', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    rebuildSnapshot(
      {
        type: NodeType.Document,
        childNodes: [
          {
            type: NodeType.Element,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    type: NodeType.Element,
                    tagName: 'div',
                    attributes: {
                      id: 'test',
                      rr_scrollTop: 100,
                      rr_scrollLeft: 50,
                    },
                    childNodes: [],
                    id: 4,
                  },
                ],
                id: 3,
              },
            ],
            id: 2,
          },
        ],
        id: 1,
      },
      doc,
      mirror,
    );

    const html = serializeToHtml(doc);
    expect(html).toContain('id="test"');
    expect(html).not.toContain('rr_scrollTop');
    expect(html).not.toContain('rr_scrollLeft');
  });

  it('should serialize shadow DOM as template', () => {
    const events = createEventsWithShadowDom();
    const baseTime = events[0].timestamp;
    const results = generateDomAtTimestamps({
      events,
      timestamps: [baseTime + 200],
    });

    expect(results[0].html).toContain('<template shadowrootmode="open">');
    expect(results[0].html).toContain('Shadow content');
    expect(results[0].html).toContain('</template>');
  });
});

describe('serializeMetadata', () => {
  it('should serialize empty state', () => {
    const mirror = createMirror();
    const state = createDOMState();
    const metadata = serializeMetadata(state, mirror, 1000);

    expect(metadata.timestamp).toBe(1000);
    expect(metadata.scrollPositions).toEqual([]);
    expect(metadata.inputValues).toEqual([]);
    expect(metadata.selections).toEqual([]);
    expect(metadata.mediaStates).toEqual([]);
    expect(metadata.viewport).toEqual({ width: 0, height: 0 });
  });

  it('should serialize scroll positions', () => {
    const mirror = createMirror();
    const state = createDOMState();
    state.scrollPositions.set(5, { x: 100, y: 200 });

    const metadata = serializeMetadata(state, mirror, 1000);
    expect(metadata.scrollPositions.length).toBe(1);
    expect(metadata.scrollPositions[0].nodeId).toBe(5);
    expect(metadata.scrollPositions[0].top).toBe(200);
    expect(metadata.scrollPositions[0].left).toBe(100);
  });

  it('should serialize input values', () => {
    const mirror = createMirror();
    const state = createDOMState();
    state.inputValues.set(10, { text: 'Hello', isChecked: false });

    const metadata = serializeMetadata(state, mirror, 1000);
    expect(metadata.inputValues.length).toBe(1);
    expect(metadata.inputValues[0].value).toBe('Hello');
    expect(metadata.inputValues[0].nodeId).toBe(10);
  });
});
