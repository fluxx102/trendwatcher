/** Query-param routes so the app also works as a static export (GitHub Pages). */
export const researchHref = (id: string) => `/research?id=${encodeURIComponent(id)}`;
export const trendHref = (id: string, trendId: string, hash = "") =>
  `/research/trend?id=${encodeURIComponent(id)}&trend=${encodeURIComponent(trendId)}${hash}`;
