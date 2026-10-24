const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  const [executable, ...extraArgs] = process.argv.slice(2);
  if (!executable) throw new Error("Pass the Electron application executable");
  const temporary = mkdtempSync(path.join(os.tmpdir(), "facescan-smoke-"));
  const child = spawn(
    executable,
    [
      "--remote-debugging-port=0",
      "--use-fake-device-for-media-stream",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      ...extraArgs,
    ],
    {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(temporary, "config"),
        XDG_CACHE_HOME: path.join(temporary, "cache"),
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let log = "";
  child.stderr.on("data", (data) => {
    log = (log + data).slice(-30_000);
  });
  child.on("error", (error) => {
    log += error.message;
  });
  const deadline = Date.now() + 90_000;
  let socket;
  const timeout = setTimeout(() => child.kill("SIGKILL"), 95_000);
  try {
    let page;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Application exited: ${log}`);
      const endpoint = log.match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)\//);
      if (endpoint) {
        const pages = await (await fetch(`http://${endpoint[1]}/json/list`)).json();
        page = pages.find((entry) => entry.url === "facescan://app/index.html");
        if (page) break;
      }
      await delay(200);
    }
    if (!page) throw new Error(`No application page: ${log}`);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown")
        errors.push(message.params.exceptionDetails.text);
      const callback = pending.get(message.id);
      if (callback) {
        pending.delete(message.id);
        callback(message);
      }
    };
    const call = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 10_000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          if (message.error) reject(new Error(JSON.stringify(message.error)));
          else resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    await call("Runtime.enable");
    await call("Network.enable");
    await call("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    await call("Page.reload", { ignoreCache: true });
    let consecutive = 0;
    while (Date.now() < deadline) {
      const result = await call("Runtime.evaluate", {
        expression:
          'JSON.stringify({status:document.querySelector("#camera-status")?.textContent,error:document.querySelector("#expression-description")?.textContent,width:document.querySelector("video")?.videoWidth,focus:document.querySelector("#focus-status")?.textContent})',
        returnByValue: true,
      });
      const state = JSON.parse(result.result.value);
      if (state.status === "ERROR" || errors.length)
        throw new Error(JSON.stringify({ state, errors }));
      consecutive =
        state.status === "SCANNING" &&
        state.width > 0 &&
        (state.focus === "FINDING FACE" || state.focus?.startsWith("FOCUS"))
          ? consecutive + 1
          : 0;
      if (consecutive >= 3) {
        console.log("Offline packaged camera and face detector: PASS");
        return;
      }
      await delay(1000);
    }
    throw new Error(`Camera/model initialization timed out: ${log}`);
  } finally {
    clearTimeout(timeout);
    socket?.close();
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
