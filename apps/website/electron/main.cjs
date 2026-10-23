const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const appPagePath = path.join(__dirname, "../dist/desktop/index.html");
const appPageUrl = pathToFileURL(appPagePath).href;

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    const defaultSession = session.defaultSession;

    defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return permission === "media" && webContents?.getURL() === appPageUrl;
    });
    defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestsCamera = permission === "media"
        && webContents?.getURL() === appPageUrl
        && details.mediaTypes?.includes("video");
      callback(Boolean(requestsCamera));
    });

    const window = new BrowserWindow({
      width: 1280,
      height: 900,
      minWidth: 800,
      minHeight: 640,
      backgroundColor: "#10110f",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", event => event.preventDefault());
    await window.loadFile(appPagePath);
  });

  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
