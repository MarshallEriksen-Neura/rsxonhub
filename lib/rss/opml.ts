export type OpmlSubscription = {
  title: string | null;
  sourceUri: string;
  folder: string | null;
};

type OutlineNode = {
  title: string | null;
  sourceUri: string | null;
  children: OutlineNode[];
};

const OUTLINE_TAG_RE = /<\/?outline\b[^>]*\/?>/gi;
const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

export function parseOpmlSubscriptions(
  opml: string,
  fallbackFolder?: string | null,
): OpmlSubscription[] {
  const roots = parseOutlineTree(opml);
  const fallback = cleanText(fallbackFolder);
  const subscriptions: OpmlSubscription[] = [];
  const seen = new Set<string>();

  for (const node of roots) {
    collectSubscriptions(node, fallback, subscriptions, seen);
  }

  return subscriptions;
}

function parseOutlineTree(opml: string): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const match of opml.matchAll(OUTLINE_TAG_RE)) {
    const raw = match[0];
    const closing = raw.startsWith("</");
    if (closing) {
      stack.pop();
      continue;
    }

    const attrs = parseAttributes(raw);
    const node: OutlineNode = {
      title: cleanText(attrs.title) ?? cleanText(attrs.text),
      sourceUri: cleanText(attrs.xmlurl),
      children: [],
    };

    const parent = stack.at(-1);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    if (!raw.endsWith("/>")) {
      stack.push(node);
    }
  }

  return roots;
}

function collectSubscriptions(
  node: OutlineNode,
  inheritedFolder: string | null,
  subscriptions: OpmlSubscription[],
  seen: Set<string>,
) {
  const folder = node.sourceUri ? inheritedFolder : node.title ?? inheritedFolder;

  if (node.sourceUri) {
    const sourceUri = node.sourceUri;
    const key = sourceUri.toLowerCase();
    if (!seen.has(key)) {
      subscriptions.push({
        title: node.title,
        sourceUri,
        folder,
      });
      seen.add(key);
    }
  }

  for (const child of node.children) {
    collectSubscriptions(child, folder, subscriptions, seen);
  }
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(ATTR_RE)) {
    attrs[match[1].toLowerCase()] = decodeXmlEntities(match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
