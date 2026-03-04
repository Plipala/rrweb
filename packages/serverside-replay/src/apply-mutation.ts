import {
  type incrementalData,
  type mutationData,
  type addedNodeMutation,
  type textMutation,
  type scrollData,
  type inputData,
  type mediaInteractionData,
  type selectionData,
  type viewportResizeData,
  type styleSheetRuleData,
  type styleDeclarationData,
  type styleValueWithPriority,
  type styleOMValue,
  type serializedNodeWithId,
  type serializedElementNodeWithId,
  IncrementalSource,
  NodeType,
  NodeType as RRNodeType,
} from '@rrweb/types';
import type { RRDocument, RRElement, RRStyleElement } from 'rrdom-nodejs';
import type { IRRNode } from 'rrdom';
import { type Mirror } from 'rrdom';
import { buildNodeWithSN } from './rebuild';
import type { DOMState } from './types';

interface ResolveTree {
  value: addedNodeMutation;
  parent: ResolveTree | null;
  children: ResolveTree[];
}

function queueToResolveTrees(queue: addedNodeMutation[]): ResolveTree[] {
  const queueNodeMap: Record<number, ResolveTree> = {};
  const putIntoMap = (
    m: addedNodeMutation,
    parent: ResolveTree | null,
  ): ResolveTree => {
    const nodeInTree: ResolveTree = { value: m, parent, children: [] };
    queueNodeMap[m.node.id] = nodeInTree;
    return nodeInTree;
  };

  const queueNodeTrees: ResolveTree[] = [];
  for (const mutation of queue) {
    const { nextId, parentId } = mutation;
    if (nextId && nextId in queueNodeMap) {
      const nextInTree = queueNodeMap[nextId];
      if (nextInTree.parent) {
        const idx = nextInTree.parent.children.indexOf(nextInTree);
        nextInTree.parent.children.splice(
          idx,
          0,
          putIntoMap(mutation, nextInTree.parent),
        );
      } else {
        const idx = queueNodeTrees.indexOf(nextInTree);
        queueNodeTrees.splice(idx, 0, putIntoMap(mutation, null));
      }
      continue;
    }
    if (parentId in queueNodeMap) {
      const parentInTree = queueNodeMap[parentId];
      parentInTree.children.push(putIntoMap(mutation, parentInTree));
      continue;
    }
    queueNodeTrees.push(putIntoMap(mutation, null));
  }
  return queueNodeTrees;
}

function iterateResolveTree(
  tree: ResolveTree,
  cb: (mutation: addedNodeMutation) => unknown,
) {
  cb(tree.value);
  for (let i = tree.children.length - 1; i >= 0; i--) {
    iterateResolveTree(tree.children[i], cb);
  }
}

function uniqueTextMutations(mutations: textMutation[]): textMutation[] {
  const idSet = new Set<number>();
  const result: textMutation[] = [];
  for (let i = mutations.length; i--; ) {
    const m = mutations[i];
    if (!idSet.has(m.id)) {
      result.push(m);
      idSet.add(m.id);
    }
  }
  return result;
}

function hasShadowRoot(n: IRRNode): boolean {
  return Boolean((n as RRElement).shadowRoot);
}

export function applyMutation(
  d: mutationData,
  doc: RRDocument,
  mirror: Mirror,
): void {
  d.removes = d.removes.filter((mutation) => {
    if (!mirror.getNode(mutation.id)) return false;
    return true;
  });

  d.removes.forEach((mutation) => {
    const target = mirror.getNode(mutation.id);
    if (!target) return;

    let parent: IRRNode | null = mirror.getNode(mutation.parentId);
    if (!parent) return;

    if (mutation.isShadow && hasShadowRoot(parent)) {
      parent = (parent as RRElement).shadowRoot;
    }

    mirror.removeNodeFromMap(target);
    if (parent) {
      try {
        parent.removeChild(target);
      } catch (_e) {
        // parent may not contain child
      }
    }
  });

  const queue: addedNodeMutation[] = [];

  const nextNotInDOM = (mutation: addedNodeMutation): boolean => {
    if (
      mutation.nextId !== null &&
      mutation.nextId !== undefined &&
      mutation.nextId !== -1 &&
      !mirror.getNode(mutation.nextId)
    ) {
      return true;
    }
    return false;
  };

  const appendNode = (mutation: addedNodeMutation) => {
    let parent: IRRNode | null = mirror.getNode(mutation.parentId);
    if (!parent) {
      if (mutation.node.type === NodeType.Document) return;
      return queue.push(mutation);
    }

    // Only element-like nodes (Element, Document, DocumentFragment) can have children.
    // Text, Comment, and CDATA nodes cannot — skip silently.
    if (
      parent.RRNodeType !== NodeType.Element &&
      parent.RRNodeType !== NodeType.Document
    ) {
      return;
    }

    if (mutation.node.isShadow) {
      if (!hasShadowRoot(parent)) {
        (parent as RRElement).attachShadow({ mode: 'open' });
        parent = (parent as RRElement).shadowRoot!;
      } else {
        parent = (parent as RRElement).shadowRoot!;
      }
    }

    let previous: IRRNode | null = null;
    let next: IRRNode | null = null;
    if (mutation.previousId) {
      previous = mirror.getNode(mutation.previousId);
    }
    if (mutation.nextId) {
      next = mirror.getNode(mutation.nextId);
    }
    if (nextNotInDOM(mutation)) {
      return queue.push(mutation);
    }

    if (mutation.node.rootId && !mirror.getNode(mutation.node.rootId)) {
      return;
    }

    const targetDoc = mutation.node.rootId
      ? (mirror.getNode(mutation.node.rootId) as unknown as RRDocument)
      : doc;

    const target = buildNodeWithSN(
      mutation.node,
      targetDoc,
      mirror,
      false, // build children too
    );
    if (!target) return;

    // Handle special parent cases
    const parentSn = mirror.getMeta(parent) as serializedNodeWithId | null;
    if (
      parentSn &&
      parentSn.type === NodeType.Element &&
      mutation.node.type === NodeType.Text
    ) {
      const elSn = parentSn as serializedElementNodeWithId;
      if (elSn.tagName === 'textarea') {
        for (const c of [...parent.childNodes]) {
          if (c.nodeType === parent.TEXT_NODE) {
            parent.removeChild(c);
          }
        }
      }
    } else if (parentSn?.type === NodeType.Document) {
      if (
        mutation.node.type === NodeType.DocumentType &&
        parent.childNodes[0]?.nodeType === 10 /* DOCUMENT_TYPE_NODE */
      ) {
        parent.removeChild(parent.childNodes[0]);
      }
      if (
        target.nodeName === 'HTML' &&
        (parent as RRDocument).documentElement
      ) {
        parent.removeChild((parent as RRDocument).documentElement!);
      }
    }

    if (previous && previous.nextSibling && previous.nextSibling.parentNode) {
      parent.insertBefore(target, previous.nextSibling);
    } else if (next && next.parentNode) {
      parent.contains(next)
        ? parent.insertBefore(target, next)
        : parent.insertBefore(target, null);
    } else {
      parent.appendChild(target);
    }
  };

  d.adds.forEach((mutation) => appendNode(mutation));

  const startTime = Date.now();
  while (queue.length) {
    const resolveTrees = queueToResolveTrees(queue);
    queue.length = 0;
    if (Date.now() - startTime > 500) break;
    for (const tree of resolveTrees) {
      const parent = mirror.getNode(tree.value.parentId);
      if (parent) {
        iterateResolveTree(tree, (m) => appendNode(m));
      }
    }
  }

  uniqueTextMutations(d.texts).forEach((mutation) => {
    const target = mirror.getNode(mutation.id);
    if (!target) return;
    target.textContent = mutation.value;
  });

  d.attributes.forEach((mutation) => {
    const node = mirror.getNode(mutation.id);
    if (!node) return;
    // Only element nodes have setAttribute/removeAttribute
    if (node.RRNodeType !== RRNodeType.Element) return;
    const target = node as RRElement;
    for (const attributeName in mutation.attributes) {
      if (typeof attributeName === 'string') {
        const value = mutation.attributes[attributeName];
        if (value === null) {
          target.removeAttribute(attributeName);
        } else if (typeof value === 'string') {
          try {
            if (
              attributeName === '_cssText' &&
              (target.nodeName === 'LINK' || target.nodeName === 'STYLE')
            ) {
              const newSn = mirror.getMeta(target) as serializedElementNodeWithId | null;
              if (newSn) {
                // Replace style content
                for (const c of [...target.childNodes]) {
                  target.removeChild(c);
                }
                target.appendChild(doc.createTextNode(value));
              }
            } else if (
              attributeName === 'value' &&
              target.nodeName === 'TEXTAREA'
            ) {
              for (const c of [...target.childNodes]) {
                target.removeChild(c);
              }
              target.appendChild(doc.createTextNode(value));
            } else {
              target.setAttribute(attributeName, value);
            }
          } catch (_error) {
            // skip invalid attribute
          }
        } else if (attributeName === 'style') {
          const styleValues = value as unknown as styleOMValue;
          for (const s in styleValues) {
            if (styleValues[s] === false) {
              target.style.removeProperty(s);
            } else if (styleValues[s] instanceof Array) {
              const svp = styleValues[s] as styleValueWithPriority;
              target.style.setProperty(s, svp[0], svp[1]);
            } else {
              const svs = styleValues[s] as string;
              target.style.setProperty(s, svs);
            }
          }
        }
      }
    }
  });
}

/**
 * Apply an incremental event to the RRDocument. DOM mutations are applied
 * directly; scroll, input, selection, media, and viewport data are accumulated
 * in the DOMState metadata object.
 */
export function applyIncremental(
  data: incrementalData,
  doc: RRDocument,
  mirror: Mirror,
  state: DOMState,
): void {
  switch (data.source) {
    case IncrementalSource.Mutation:
      applyMutation(data, doc, mirror);
      break;

    case IncrementalSource.Scroll:
      applyScroll(data as scrollData, state);
      break;

    case IncrementalSource.ViewportResize:
      applyViewportResize(data as viewportResizeData, state);
      break;

    case IncrementalSource.Input:
      applyInput(data as inputData, doc, mirror, state);
      break;

    case IncrementalSource.MediaInteraction:
      applyMediaInteraction(data as mediaInteractionData, state);
      break;

    case IncrementalSource.StyleSheetRule:
    case IncrementalSource.StyleDeclaration:
      applyStyleSheetMutation(
        data as styleSheetRuleData | styleDeclarationData,
        mirror,
      );
      break;

    case IncrementalSource.Selection:
      applySelection(data as selectionData, state);
      break;

    case IncrementalSource.Font:
      // Font loading is browser-only; skip for serverside
      break;

    case IncrementalSource.AdoptedStyleSheet:
      // AdoptedStyleSheets require browser APIs; skip
      break;

    // Skip mouse/touch/drag/canvas events — not relevant to DOM structure
    case IncrementalSource.MouseMove:
    case IncrementalSource.MouseInteraction:
    case IncrementalSource.TouchMove:
    case IncrementalSource.Drag:
    case IncrementalSource.CanvasMutation:
    case IncrementalSource.CustomElement:
      break;
  }
}

function applyScroll(d: scrollData, state: DOMState): void {
  if (d.id === -1) return;
  state.scrollPositions.set(d.id, { x: d.x, y: d.y });
}

function applyViewportResize(d: viewportResizeData, state: DOMState): void {
  state.viewport = { width: d.width, height: d.height };
}

function applyInput(
  d: inputData,
  _doc: RRDocument,
  mirror: Mirror,
  state: DOMState,
): void {
  if (d.id === -1) return;
  state.inputValues.set(d.id, { text: d.text, isChecked: d.isChecked });

  const target = mirror.getNode(d.id) as RRElement | null;
  if (!target) return;

  if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') {
    target.setAttribute('value', d.text);
    if (d.isChecked) {
      target.setAttribute('checked', '');
    } else {
      target.removeAttribute('checked');
    }
  } else if (target.nodeName === 'SELECT') {
    target.setAttribute('value', d.text);
    for (const child of target.childNodes) {
      if (child.nodeName === 'OPTION') {
        const option = child as RRElement;
        if (option.getAttribute('value') === d.text) {
          option.setAttribute('selected', '');
        } else {
          option.removeAttribute('selected');
        }
      }
    }
  }
}

function applyMediaInteraction(
  d: mediaInteractionData,
  state: DOMState,
): void {
  if (d.id === -1) return;
  const existing = state.mediaStates.get(d.id) ?? {
    type: d.type,
    paused: true,
  };
  state.mediaStates.set(d.id, {
    ...existing,
    type: d.type,
    ...(d.currentTime !== undefined && { currentTime: d.currentTime }),
    ...(d.volume !== undefined && { volume: d.volume }),
    ...(d.muted !== undefined && { muted: d.muted }),
    ...(d.loop !== undefined && { loop: d.loop }),
    ...(d.playbackRate !== undefined && { playbackRate: d.playbackRate }),
  });
}

function applyStyleSheetMutation(
  d: styleSheetRuleData | styleDeclarationData,
  mirror: Mirror,
): void {
  if (!d.id) return;
  const target = mirror.getNode(d.id) as (RRStyleElement & { rules?: (styleSheetRuleData | styleDeclarationData)[] }) | null;
  if (!target) return;

  if (target.nodeName === 'STYLE' && 'rules' in target) {
    if (!target.rules) target.rules = [];
    target.rules.push(d);
  }
}

function applySelection(d: selectionData, state: DOMState): void {
  state.selections = d.ranges;
}
