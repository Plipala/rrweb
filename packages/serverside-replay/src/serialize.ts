import { NodeType as RRNodeType } from '@rrweb/types';
import type { RRDocument, RRElement } from 'rrdom-nodejs';
import type { IRRNode, IRRElement } from 'rrdom';
import { type Mirror } from 'rrdom';
import type {
  DOMState,
  SnapshotMetadata,
  ScrollPositionEntry,
  InputValueEntry,
  MediaStateEntry,
} from './types';
import { MediaInteractions } from '@rrweb/types';

const VOID_ELEMENTS = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);

const RRWEB_INTERNAL_ATTRS = new Set([
  'rr_width',
  'rr_height',
  'rr_mediaCurrentTime',
  'rr_mediaState',
  'rr_mediaPlaybackRate',
  'rr_mediaMuted',
  'rr_mediaLoop',
  'rr_mediaVolume',
  'rr_open_mode',
  'rr_scrollLeft',
  'rr_scrollTop',
  'rr_dataURL',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeNode(node: IRRNode): string {
  switch (node.RRNodeType) {
    case RRNodeType.Document: {
      let html = '';
      for (const child of node.childNodes) {
        html += serializeNode(child);
      }
      return html;
    }

    case RRNodeType.DocumentType: {
      const dt = node as unknown as {
        name: string;
        publicId: string;
        systemId: string;
      };
      let doctype = `<!DOCTYPE ${dt.name || 'html'}`;
      if (dt.publicId) {
        doctype += ` PUBLIC "${escapeAttr(dt.publicId)}"`;
      }
      if (dt.systemId) {
        doctype += dt.publicId
          ? ` "${escapeAttr(dt.systemId)}"`
          : ` SYSTEM "${escapeAttr(dt.systemId)}"`;
      }
      doctype += '>';
      return doctype;
    }

    case RRNodeType.Element: {
      const el = node as IRRElement;
      const tagName = el.tagName.toLowerCase();
      let html = `<${tagName}`;

      const attrs = (el as RRElement).attributes;
      if (attrs) {
        for (const name in attrs) {
          if (!Object.prototype.hasOwnProperty.call(attrs, name)) continue;
          if (RRWEB_INTERNAL_ATTRS.has(name)) continue;
          if (name === '_cssText') continue;

          const value = attrs[name];
          if (value === undefined || value === null) continue;
          html += ` ${name}="${escapeAttr(String(value))}"`;
        }

        // rrdom-nodejs defines `style` via Object.defineProperty (non-enumerable),
        // so it won't appear in `for...in`. Serialize it explicitly.
        const styleText: string | undefined = attrs.style as unknown as string | undefined;
        if (styleText) {
          html += ` style="${escapeAttr(styleText)}"`;
        }
      }

      html += '>';

      if (VOID_ELEMENTS.has(el.tagName)) {
        return html;
      }

      // Shadow root content
      if (el.shadowRoot) {
        html += '<template shadowrootmode="open">';
        for (const child of el.shadowRoot.childNodes) {
          html += serializeNode(child);
        }
        html += '</template>';
      }

      for (const child of el.childNodes) {
        html += serializeNode(child);
      }

      html += `</${tagName}>`;
      return html;
    }

    case RRNodeType.Text: {
      const parentName = node.parentNode?.nodeName;
      const text = node.textContent ?? '';
      // Don't escape content inside <script>, <style>
      if (parentName === 'STYLE' || parentName === 'NOSCRIPT') {
        return text;
      }
      return escapeHtml(text);
    }

    case RRNodeType.Comment:
      return `<!--${node.textContent ?? ''}-->`;

    case RRNodeType.CDATA:
      return `<![CDATA[${node.textContent ?? ''}]]>`;

    default:
      return '';
  }
}

/**
 * Serialize an RRDocument tree to an HTML string.
 */
export function serializeToHtml(doc: RRDocument): string {
  return serializeNode(doc);
}

/**
 * Build a CSS selector path for a node identified by its mirror id.
 * Returns an empty string if the node is not found.
 */
function selectorForNode(
  nodeId: number,
  mirror: Mirror,
): string {
  const node = mirror.getNode(nodeId) as RRElement | null;
  if (!node || node.RRNodeType !== RRNodeType.Element) return '';

  const meta = mirror.getMeta(node);
  if (!meta || meta.type !== RRNodeType.Element) return '';

  const el = node;
  if (el.id) return `#${el.id}`;
  if (el.className) {
    const cls = el.className.split(/\s+/).filter(Boolean)[0];
    if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Serialize the non-HTML-representable DOM state into a metadata object.
 */
export function serializeMetadata(
  state: DOMState,
  mirror: Mirror,
  timestamp: number,
): SnapshotMetadata {
  const scrollPositions: ScrollPositionEntry[] = [];
  for (const [nodeId, pos] of state.scrollPositions) {
    scrollPositions.push({
      nodeId,
      selector: selectorForNode(nodeId, mirror),
      top: pos.y,
      left: pos.x,
    });
  }

  const inputValues: InputValueEntry[] = [];
  for (const [nodeId, val] of state.inputValues) {
    inputValues.push({
      nodeId,
      selector: selectorForNode(nodeId, mirror),
      value: val.text,
      isChecked: val.isChecked || undefined,
    });
  }

  const mediaStates: MediaStateEntry[] = [];
  for (const [nodeId, ms] of state.mediaStates) {
    mediaStates.push({
      nodeId,
      selector: selectorForNode(nodeId, mirror),
      currentTime: ms.currentTime,
      paused:
        ms.type === MediaInteractions.Pause ||
        ms.type === MediaInteractions.Seeked,
      volume: ms.volume,
      muted: ms.muted,
      loop: ms.loop,
      playbackRate: ms.playbackRate,
    });
  }

  return {
    timestamp,
    viewport: { ...state.viewport },
    scrollPositions,
    inputValues,
    selections: [...state.selections],
    mediaStates,
  };
}
