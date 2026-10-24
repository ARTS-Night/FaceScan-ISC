const { app, BrowserWindow, dialog, net, protocol, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { resolveAsset, canUseCamera } = require("./assets.cjs");

const assetRoot = path.join(__dirname, "../dist/desktop");
const appPageUrl = "facescan://app/index.html";
// A secure, standard origin allows camera access, fetch and WASM from bundled assets.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "facescan",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(async () => {
      protocol.handle("facescan", async (request) => {
        try {
          const filename = resolveAsset(assetRoot, request.url);
          if (!filename) return new Response("Forbidden", { status: 403 });
          const response = await net.fetch(pathToFileURL(filename).href);
          // Explicit MIME type permits WebAssembly streaming compilation.
          const headers = new Headers(response.headers);
          if (filename.endsWith(".wasm")) headers.set("Content-Type", "application/wasm");
          return new Response(response.body, { status: response.status, headers });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => {
        return (
          permission === "media" &&
          details.mediaType === "video" &&
          canUseCamera(contents, origin, appPageUrl)
        );
      });
      session.defaultSession.setPermissionRequestHandler(
        (contents, permission, callback, details) => {
          callback(
            permission === "media" &&
              details.isMainFrame &&
              details.requestingUrl === appPageUrl &&
              contents?.getURL() === appPageUrl &&
              details.mediaTypes?.length === 1 &&
              details.mediaTypes[0] === "video",
          );
        },
      );

      const window = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 800,
        minHeight: 640,
        backgroundColor: "#10110f",
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event) => event.preventDefault());
      window.webContents.on("render-process-gone", async (_event, details) => {
        if (details.reason === "clean-exit" || window.isDestroyed()) return;
        const { response } = await dialog.showMessageBox(window, {
          type: "error",
          message: "画面の処理が停止しました。",
          buttons: ["再読み込み", "終了"],
        });
        if (response === 0 && !window.isDestroyed()) window.reload();
        else app.quit();
      });
      await window.loadURL(appPageUrl);
    })
    .catch((error) => {
      console.error(error);
      dialog.showErrorBox("FaceScan を起動できませんでした", String(error.message || error));
      app.quit();
    });

  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
}
