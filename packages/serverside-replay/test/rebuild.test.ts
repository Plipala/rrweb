/**
 * @vitest-environment node
 */
import 'rrdom-nodejs';
import { describe, it, expect } from 'vitest';
import { RRDocument } from 'rrdom-nodejs';
import { createMirror } from 'rrdom';
import { NodeType, type serializedNodeWithId } from '@rrweb/types';
import { rebuildSnapshot, buildNodeWithSN } from '../src/rebuild';

describe('rebuildSnapshot', () => {
  it('should build a basic document from serialized snapshot', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    const snapshot: serializedNodeWithId = {
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
    };

    rebuildSnapshot(snapshot, doc, mirror);

    expect(doc.documentElement).not.toBeNull();
    expect(doc.documentElement!.tagName).toBe('HTML');
    expect(doc.body).not.toBeNull();
    expect(doc.body!.childNodes.length).toBe(1);
    expect(doc.body!.childNodes[0].textContent).toBe('Hello');
  });

  it('should register nodes in the mirror', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    const snapshot: serializedNodeWithId = {
      type: NodeType.Document,
      childNodes: [
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
              id: 3,
            },
            {
              type: NodeType.Element,
              tagName: 'body',
              attributes: { id: 'test-body' },
              childNodes: [],
              id: 4,
            },
          ],
          id: 2,
        },
      ],
      id: 1,
    };

    rebuildSnapshot(snapshot, doc, mirror);

    expect(mirror.getNode(1)).toBe(doc);
    expect(mirror.getNode(2)).not.toBeNull();
    expect(mirror.getNode(3)).not.toBeNull();
    expect(mirror.getNode(4)).not.toBeNull();
    expect(mirror.getNode(4)!.nodeName).toBe('BODY');
  });

  it('should handle element attributes', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    const snapshot: serializedNodeWithId = {
      type: NodeType.Document,
      childNodes: [
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
              id: 3,
            },
            {
              type: NodeType.Element,
              tagName: 'body',
              attributes: {},
              childNodes: [
                {
                  type: NodeType.Element,
                  tagName: 'div',
                  attributes: { id: 'test', class: 'foo bar', 'data-value': '42' },
                  childNodes: [],
                  id: 5,
                },
              ],
              id: 4,
            },
          ],
          id: 2,
        },
      ],
      id: 1,
    };

    rebuildSnapshot(snapshot, doc, mirror);

    const div = mirror.getNode(5) as any;
    expect(div).not.toBeNull();
    expect(div.getAttribute('id')).toBe('test');
    expect(div.getAttribute('class')).toBe('foo bar');
    expect(div.getAttribute('data-value')).toBe('42');
  });

  it('should handle comment nodes', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    const snapshot: serializedNodeWithId = {
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
                  type: NodeType.Comment,
                  textContent: ' a comment ',
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
    };

    rebuildSnapshot(snapshot, doc, mirror);

    const comment = mirror.getNode(4);
    expect(comment).not.toBeNull();
    expect(comment!.textContent).toBe(' a comment ');
  });

  it('should handle shadow DOM hosts', () => {
    const doc = new RRDocument();
    const mirror = createMirror();

    const snapshot: serializedNodeWithId = {
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
                  attributes: {},
                  childNodes: [
                    {
                      type: NodeType.Element,
                      tagName: 'span',
                      attributes: {},
                      childNodes: [
                        {
                          type: NodeType.Text,
                          textContent: 'shadow text',
                          id: 7,
                        },
                      ],
                      id: 6,
                      isShadow: true,
                    },
                  ],
                  id: 5,
                  isShadowHost: true,
                },
              ],
              id: 4,
            },
          ],
          id: 3,
        },
      ],
      id: 2,
    };

    rebuildSnapshot(snapshot, doc, mirror);

    const host = mirror.getNode(5) as any;
    expect(host).not.toBeNull();
    expect(host.shadowRoot).not.toBeNull();
  });
});
