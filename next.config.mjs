/**
 * STATIC_EXPORT=1 builds a static demo (GitHub Pages): no API routes, demo mode only.
 * BASE_PATH sets the sub-path, e.g. "/trendwatcher" for https://<user>.github.io/trendwatcher/.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? { output: "export", trailingSlash: true, images: { unoptimized: true }, basePath, assetPrefix: basePath || undefined }
    : { output: "standalone" }), // self-contained server for Docker / own server
  env: { NEXT_PUBLIC_STATIC_DEMO: isStatic ? "1" : "0" },
};
export default nextConfig;
