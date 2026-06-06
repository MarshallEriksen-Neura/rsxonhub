export type OpmlExportFeed = {
  title: string | null;
  url: string;
  folder: string | null;
};

export function buildOpmlExport(feeds: OpmlExportFeed[], exportedAt = new Date()) {
  const groups = groupExportFeeds(feeds);
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<opml version="2.0">`,
    `  <head>`,
    `    <title>rsxonhub subscriptions</title>`,
    `    <dateCreated>${escapeXml(exportedAt.toISOString())}</dateCreated>`,
    `  </head>`,
    `  <body>`,
  ];

  for (const group of groups) {
    lines.push(`    <outline text="${escapeXml(group.folder)}" title="${escapeXml(group.folder)}">`);
    for (const feed of group.items) {
      const title = feed.title ?? feed.url;
      lines.push(
        `      <outline type="rss" text="${escapeXml(title)}" title="${escapeXml(title)}" xmlUrl="${escapeXml(feed.url)}" />`,
      );
    }
    lines.push(`    </outline>`);
  }

  lines.push(`  </body>`, `</opml>`, "");
  return lines.join("\n");
}

function groupExportFeeds(feeds: OpmlExportFeed[]) {
  const map = new Map<string, OpmlExportFeed[]>();
  for (const feed of feeds) {
    const key = feed.folder ?? "未分组";
    const list = map.get(key) ?? [];
    list.push(feed);
    map.set(key, list);
  }
  return [...map.entries()].map(([folder, items]) => ({ folder, items }));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
