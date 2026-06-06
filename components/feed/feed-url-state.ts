export function setFeedArticleUrlParam(articleId: number | null) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (articleId) {
    url.searchParams.set("article", String(articleId));
  } else {
    url.searchParams.delete("article");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}
