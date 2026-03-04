import {
  EventType,
  IncrementalSource,
  NodeType,
  type eventWithTime,
} from '@rrweb/types';

/**
 * Creates a minimal set of rrweb events for testing.
 * Simulates: Meta -> FullSnapshot -> Mutation (add element) -> Input -> Scroll
 */
export function createMinimalEvents(): eventWithTime[] {
  const baseTime = 1000000;

  return [
    // 1. Meta event
    {
      type: EventType.Meta,
      data: {
        href: 'http://localhost:3000/',
        width: 1920,
        height: 1080,
      },
      timestamp: baseTime,
    },
    // 2. Full Snapshot — a simple HTML doc with head, body, div, input
    {
      type: EventType.FullSnapshot,
      data: {
        node: {
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
              attributes: { lang: 'en' },
              childNodes: [
                {
                  type: NodeType.Element,
                  tagName: 'head',
                  attributes: {},
                  childNodes: [
                    {
                      type: NodeType.Element,
                      tagName: 'title',
                      attributes: {},
                      childNodes: [
                        {
                          type: NodeType.Text,
                          textContent: 'Test Page',
                          id: 6,
                        },
                      ],
                      id: 5,
                    },
                  ],
                  id: 4,
                },
                {
                  type: NodeType.Element,
                  tagName: 'body',
                  attributes: {},
                  childNodes: [
                    {
                      type: NodeType.Element,
                      tagName: 'div',
                      attributes: { id: 'container', class: 'main' },
                      childNodes: [
                        {
                          type: NodeType.Element,
                          tagName: 'h1',
                          attributes: {},
                          childNodes: [
                            {
                              type: NodeType.Text,
                              textContent: 'Hello World',
                              id: 10,
                            },
                          ],
                          id: 9,
                        },
                        {
                          type: NodeType.Element,
                          tagName: 'input',
                          attributes: {
                            type: 'text',
                            id: 'name-input',
                            value: '',
                          },
                          childNodes: [],
                          id: 11,
                        },
                      ],
                      id: 8,
                    },
                  ],
                  id: 7,
                },
              ],
              id: 3,
            },
          ],
          id: 1,
        },
        initialOffset: { top: 0, left: 0 },
      },
      timestamp: baseTime + 100,
    },
    // 3. Incremental: Mutation — add a <p> element to #container
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Mutation,
        texts: [],
        attributes: [],
        removes: [],
        adds: [
          {
            parentId: 8, // #container
            nextId: null,
            node: {
              type: NodeType.Element,
              tagName: 'p',
              attributes: { class: 'greeting' },
              childNodes: [
                {
                  type: NodeType.Text,
                  textContent: 'Welcome to the test page!',
                  id: 13,
                },
              ],
              id: 12,
            },
          },
        ],
      },
      timestamp: baseTime + 500,
    },
    // 4. Incremental: Text mutation — change h1 text
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Mutation,
        texts: [{ id: 10, value: 'Updated Heading' }],
        attributes: [],
        removes: [],
        adds: [],
      },
      timestamp: baseTime + 1000,
    },
    // 5. Incremental: Attribute mutation — add a class to h1
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Mutation,
        texts: [],
        attributes: [{ id: 9, attributes: { class: 'highlighted' } }],
        removes: [],
        adds: [],
      },
      timestamp: baseTime + 1500,
    },
    // 6. Incremental: Input event on #name-input
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Input,
        id: 11,
        text: 'John Doe',
        isChecked: false,
      },
      timestamp: baseTime + 2000,
    },
    // 7. Incremental: Scroll event
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Scroll,
        id: 7, // body
        x: 0,
        y: 200,
      },
      timestamp: baseTime + 2500,
    },
    // 8. Incremental: ViewportResize
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.ViewportResize,
        width: 1024,
        height: 768,
      },
      timestamp: baseTime + 3000,
    },
  ];
}

/**
 * Events with a style element for testing CSS serialization.
 */
export function createEventsWithStyle(): eventWithTime[] {
  const baseTime = 2000000;

  return [
    {
      type: EventType.Meta,
      data: { href: 'http://localhost:3000/', width: 800, height: 600 },
      timestamp: baseTime,
    },
    {
      type: EventType.FullSnapshot,
      data: {
        node: {
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
                  childNodes: [
                    {
                      type: NodeType.Element,
                      tagName: 'style',
                      attributes: { _cssText: 'body { margin: 0; } .red { color: red; }' },
                      childNodes: [],
                      id: 5,
                    },
                  ],
                  id: 4,
                },
                {
                  type: NodeType.Element,
                  tagName: 'body',
                  attributes: {},
                  childNodes: [
                    {
                      type: NodeType.Element,
                      tagName: 'div',
                      attributes: { class: 'red' },
                      childNodes: [
                        {
                          type: NodeType.Text,
                          textContent: 'Styled content',
                          id: 8,
                        },
                      ],
                      id: 7,
                    },
                  ],
                  id: 6,
                },
              ],
              id: 3,
            },
          ],
          id: 1,
        },
        initialOffset: { top: 0, left: 0 },
      },
      timestamp: baseTime + 100,
    },
  ];
}

/**
 * Events with a comment and shadow DOM for testing serialization edge cases.
 */
export function createEventsWithShadowDom(): eventWithTime[] {
  const baseTime = 3000000;

  return [
    {
      type: EventType.Meta,
      data: { href: 'http://localhost:3000/', width: 800, height: 600 },
      timestamp: baseTime,
    },
    {
      type: EventType.FullSnapshot,
      data: {
        node: {
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
                      type: NodeType.Comment,
                      textContent: ' This is a comment ',
                      id: 5,
                    },
                    {
                      type: NodeType.Element,
                      tagName: 'div',
                      attributes: { id: 'host' },
                      childNodes: [
                        {
                          type: NodeType.Element,
                          tagName: 'span',
                          attributes: {},
                          childNodes: [
                            {
                              type: NodeType.Text,
                              textContent: 'Shadow content',
                              id: 8,
                            },
                          ],
                          id: 7,
                          isShadow: true,
                        },
                      ],
                      id: 6,
                      isShadowHost: true,
                    },
                  ],
                  id: 4,
                },
              ],
              id: 2,
            },
          ],
          id: 1,
        },
        initialOffset: { top: 0, left: 0 },
      },
      timestamp: baseTime + 100,
    },
  ];
}

/**
 * Events with a remove mutation for testing node removal.
 */
export function createEventsWithRemoval(): eventWithTime[] {
  const baseTime = 4000000;

  return [
    {
      type: EventType.Meta,
      data: { href: 'http://localhost:3000/', width: 800, height: 600 },
      timestamp: baseTime,
    },
    {
      type: EventType.FullSnapshot,
      data: {
        node: {
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
                      attributes: { id: 'to-remove' },
                      childNodes: [
                        {
                          type: NodeType.Text,
                          textContent: 'I will be removed',
                          id: 6,
                        },
                      ],
                      id: 5,
                    },
                    {
                      type: NodeType.Element,
                      tagName: 'div',
                      attributes: { id: 'stays' },
                      childNodes: [
                        {
                          type: NodeType.Text,
                          textContent: 'I stay',
                          id: 8,
                        },
                      ],
                      id: 7,
                    },
                  ],
                  id: 4,
                },
              ],
              id: 2,
            },
          ],
          id: 1,
        },
        initialOffset: { top: 0, left: 0 },
      },
      timestamp: baseTime + 100,
    },
    // Remove #to-remove
    {
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Mutation,
        texts: [],
        attributes: [],
        removes: [{ parentId: 4, id: 5 }],
        adds: [],
      },
      timestamp: baseTime + 500,
    },
  ];
}
