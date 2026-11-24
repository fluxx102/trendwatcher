/** Query-param routes so the app also works as a static export (GitHub Pages). */
export const researchHref = (id: string) => `/research?id=${encodeURIComponent(id)}`;
export const trendHref = (id: string, trendId: string, hash = "") =>
  `/research/trend?id=${encodeURIComponent(id)}&trend=${encodeURIComponent(trendId)}${hash}`;
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
