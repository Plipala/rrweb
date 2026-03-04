import {
  NodeType,
  type serializedNodeWithId,
  type elementNode,
} from '@rrweb/types';
import type { RRDocument, RRElement } from 'rrdom-nodejs';
import type { IRRNode } from 'rrdom';
import { type Mirror } from 'rrdom';

const TAG_NAME_MAP: Record<string, string> = {
  script: 'noscript',
  altglyph: 'altGlyph',
  altglyphdef: 'altGlyphDef',
  altglyphitem: 'altGlyphItem',
  animatecolor: 'animateColor',
  animatemotion: 'animateMotion',
  animatetransform: 'animateTransform',
  clippath: 'clipPath',
  feblend: 'feBlend',
  fecolormatrix: 'feColorMatrix',
  fecomponenttransfer: 'feComponentTransfer',
  fecomposite: 'feComposite',
  feconvolvematrix: 'feConvolveMatrix',
  fediffuselighting: 'feDiffuseLighting',
  fedisplacementmap: 'feDisplacementMap',
  fedistantlight: 'feDistantLight',
  fedropshadow: 'feDropShadow',
  feflood: 'feFlood',
  fefunca: 'feFuncA',
  fefuncb: 'feFuncB',
  fefuncg: 'feFuncG',
  fefuncr: 'feFuncR',
  fegaussianblur: 'feGaussianBlur',
  feimage: 'feImage',
  femerge: 'feMerge',
  femergenode: 'feMergeNode',
  femorphology: 'feMorphology',
  feoffset: 'feOffset',
  fepointlight: 'fePointLight',
  fespecularlighting: 'feSpecularLighting',
  fespotlight: 'feSpotLight',
  fetile: 'feTile',
  feturbulence: 'feTurbulence',
  foreignobject: 'foreignObject',
  glyphref: 'glyphRef',
  lineargradient: 'linearGradient',
  radialgradient: 'radialGradient',
};

function getTagName(n: elementNode): string {
  let tagName = TAG_NAME_MAP[n.tagName] ?? n.tagName;
  if (tagName === 'link' && n.attributes._cssText) {
    tagName = 'style';
  }
  return tagName;
}

function buildNode(
  n: serializedNodeWithId,
  doc: RRDocument,
): IRRNode | null {
  switch (n.type) {
    case NodeType.Document:
      return doc.createDocument(null, '', null);
    case NodeType.DocumentType:
      return doc.createDocumentType(
        n.name || 'html',
        n.publicId,
        n.systemId,
      );
    case NodeType.Element: {
      const tagName = getTagName(n);
      const node = n.isSVG
        ? doc.createElementNS('http://www.w3.org/2000/svg', tagName)
        : doc.createElement(tagName);

      const specialAttributes: Record<string, string | number> = {};

      for (const name in n.attributes) {
        if (!Object.prototype.hasOwnProperty.call(n.attributes, name)) {
          continue;
        }
        let value = n.attributes[name];

        if (
          tagName === 'option' &&
          name === 'selected' &&
          (value as unknown) === false
        ) {
          continue;
        }
        if (value === null) continue;
        if (value === true) value = '';

        if (name.startsWith('rr_')) {
          specialAttributes[name] = value;
          continue;
        }

        if (typeof value !== 'string') {
          // pass non-string through
        } else if (tagName === 'style' && name === '_cssText') {
          buildStyleNodeContent(n, node as RRElement, value, doc);
          continue;
        } else if (tagName === 'textarea' && name === 'value') {
          node.appendChild(doc.createTextNode(value));
          n.childNodes = [];
          continue;
        }

        try {
          if (n.isSVG && name === 'xlink:href') {
            (node as RRElement).setAttributeNS(
              'http://www.w3.org/1999/xlink',
              name,
              value.toString(),
            );
          } else if (
            name === 'onload' ||
            name === 'onclick' ||
            name.substring(0, 7) === 'onmouse'
          ) {
            (node as RRElement).setAttribute('_' + name, value.toString());
          } else if (
            tagName === 'meta' &&
            n.attributes['http-equiv'] === 'Content-Security-Policy' &&
            name === 'content'
          ) {
            (node as RRElement).setAttribute('csp-content', value.toString());
          } else if (
            tagName === 'link' &&
            ((n.attributes.rel === 'preload' && n.attributes.as === 'script') ||
              n.attributes.rel === 'modulepreload')
          ) {
            // skip script preloads
          } else if (
            tagName === 'link' &&
            n.attributes.rel === 'prefetch' &&
            typeof n.attributes.href === 'string' &&
            extractFileExtension(n.attributes.href) === 'js'
          ) {
            // skip js prefetch
          } else {
            (node as RRElement).setAttribute(name, value.toString());
          }
        } catch (_error) {
          // skip invalid attributes
        }
      }

      for (const name in specialAttributes) {
        const value = specialAttributes[name];
        if (name === 'rr_width') {
          (node as RRElement).style.setProperty('width', value.toString());
        } else if (name === 'rr_height') {
          (node as RRElement).style.setProperty('height', value.toString());
        }
        // rr_mediaCurrentTime, rr_mediaState, etc. are skipped for server-side;
        // they'll be captured in metadata via the event stream.
      }

      if (n.isShadowHost) {
        (node as RRElement).attachShadow({ mode: 'open' });
      }

      return node;
    }
    case NodeType.Text:
      return doc.createTextNode(n.textContent);
    case NodeType.CDATA:
      return doc.createCDATASection(n.textContent);
    case NodeType.Comment:
      return doc.createComment(n.textContent);
    default:
      return null;
  }
}

function buildStyleNodeContent(
  n: serializedNodeWithId & { type: NodeType.Element },
  styleEl: RRElement,
  cssText: string,
  doc: RRDocument,
): void {
  const elNode = n as serializedNodeWithId & elementNode;
  if (elNode.childNodes.length) {
    const childTextNodes: Array<
      serializedNodeWithId & { type: NodeType.Text }
    > = [];
    for (const child of elNode.childNodes) {
      if (child.type === NodeType.Text) {
        childTextNodes.push(
          child as serializedNodeWithId & { type: NodeType.Text },
        );
      }
    }
    const splits = cssText.split('/* rr_split */');
    while (splits.length > 1 && splits.length > childTextNodes.length) {
      splits.splice(-2, 2, splits.slice(-2).join(''));
    }
    for (let i = 0; i < childTextNodes.length; i++) {
      if (i < splits.length) {
        childTextNodes[i].textContent = splits[i];
      }
    }
  } else {
    styleEl.appendChild(doc.createTextNode(cssText));
  }
}

/**
 * Recursively build an RRDocument tree from a serialized rrweb snapshot.
 *
 * @param isRoot - When true (default during full rebuild), Document-type nodes
 *   replace the main `doc`. When false (mutation adds), Document-type nodes are
 *   returned as standalone sub-documents (e.g. iframe documents) without wiping
 *   the main document.
 */
export function buildNodeWithSN(
  n: serializedNodeWithId,
  doc: RRDocument,
  mirror: Mirror,
  skipChild?: boolean,
  isRoot?: boolean,
): IRRNode | null {
  let node = buildNode(n, doc);

  if (!node) return null;

  if (n.type === NodeType.Document && isRoot) {
    doc.open();
    node = doc;
  }

  mirror.add(node, n);

  if (
    (n.type === NodeType.Document || n.type === NodeType.Element) &&
    !skipChild
  ) {
    const elNode = n as serializedNodeWithId & { childNodes: serializedNodeWithId[] };
    if (elNode.childNodes) {
      for (const childN of elNode.childNodes) {
        const childNode = buildNodeWithSN(childN, doc, mirror);
        if (childNode) {
          if (childN.isShadow && n.type === NodeType.Element) {
            const shadow = (node as RRElement).shadowRoot;
            if (shadow) {
              shadow.appendChild(childNode);
            }
          } else {
            node.appendChild(childNode);
          }
        }
      }
    }
  }

  return node;
}

/**
 * Rebuild a full snapshot into an RRDocument.
 * Resets the document and mirror, then populates from the serialized tree.
 */
export function rebuildSnapshot(
  rootNode: serializedNodeWithId,
  doc: RRDocument,
  mirror: Mirror,
): void {
  mirror.reset();
  doc.open();
  buildNodeWithSN(rootNode, doc, mirror, false, true);
  doc.close();
}

function extractFileExtension(url: string): string | null {
  try {
    const pathname = new URL(url, 'https://placeholder.invalid').pathname;
    const dot = pathname.lastIndexOf('.');
    if (dot === -1) return null;
    return pathname.substring(dot + 1).toLowerCase();
  } catch {
    return null;
  }
}
