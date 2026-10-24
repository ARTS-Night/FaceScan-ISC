const path = require("node:path");

function resolveAsset(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== "facescan:" || url.host !== "app") return undefined;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("\0") || pathname.includes("\\")) return undefined;
  const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  const relative = path.relative(root, filename);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return filename;
}

function canUseCamera(webContents, origin, appUrl) {
  return (
    !webContents?.isDestroyed() && webContents?.getURL() === appUrl && origin === "facescan://app"
  );
}

module.exports = { resolveAsset, canUseCamera };
