const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  const [executable, ...extraArgs] = process.argv.slice(2);
  if (!executable) throw new Error("Pass the Electron application executable");
  // Deny HTTP and HTTPS from process startup, before camera/model initialization.
  // Reloading a renderer during WASM initialization can block the CDP response.
  const probes = { http: 0, https: 0 };
  const blackhole = process.env.SMOKE_NETWORK_MODE === "blackhole";
  const proxySockets = new Set();
  const proxy = http.createServer((request) => {
    if (request.url.startsWith("http://facescan-smoke.invalid/")) probes.http++;
    if (!blackhole) request.destroy();
  });
  proxy.on("connect", (request, socket) => {
    if (request.url === "facescan-smoke.invalid:443") probes.https++;
    if (!blackhole) socket.destroy();
  });
  proxy.on("connection", (socket) => {
    proxySockets.add(socket);
    socket.once("close", () => proxySockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", resolve);
  });
  const temporary = mkdtempSync(path.join(os.tmpdir(), "facescan-smoke-"));
  const child = spawn(
    executable,
    [
      "--enable-logging=stderr",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      "--use-fake-device-for-media-stream",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      `--proxy-server=http://127.0.0.1:${proxy.address().port}`,
      "--proxy-bypass-list=<-loopback>",
      ...extraArgs,
    ],
    {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(temporary, "config"),
        XDG_CACHE_HOME: path.join(temporary, "cache"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  const record = (data) => {
    log = (log + data).slice(-60_000);
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  let processError;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const pending = new Map();
  const rejectPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };
  child.once("error", (error) => {
    processError = error;
    rejectPending(error);
  });
  child.once("exit", (code, signal) =>
    rejectPending(new Error(`Application exited: code=${code}, signal=${signal}`)),
  );
  const deadline = Date.now() + 120_000;
  let socket;
  let lastState;
  const timeout = setTimeout(() => child.kill("SIGKILL"), 125_000);
  try {
    let page;
    while (Date.now() < deadline) {
      if (processError) throw processError;
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error("Application exited before attaching CDP");
      const endpoint = log.match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)\//);
      if (endpoint) {
        const response = await fetch(`http://${endpoint[1]}/json/list`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`CDP discovery failed: HTTP ${response.status}`);
        const pages = await response.json();
        page = pages.find((entry) => entry.url === "facescan://app/index.html");
        if (page) break;
      }
      await delay(200);
    }
    if (!page) throw new Error("No application page before deadline");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP connection timed out")), 10_000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("CDP connection failed"));
      };
    });
    let sequence = 0;
    const errors = [];
    socket.onclose = () => rejectPending(new Error("CDP socket closed"));
    socket.onerror = () => rejectPending(new Error("CDP socket failed"));
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        errors.push(details.exception?.description || details.text);
      }
      const request = pending.get(message.id);
      if (request) {
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    };
    const call = (method, params = {}) =>
      new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
          reject(new Error("CDP socket is not open"));
          return;
        }
        const id = ++sequence;
        const timer = setTimeout(
          () => {
            pending.delete(id);
            reject(new Error(`CDP timeout: ${method}`));
          },
          Math.max(1, Math.min(30_000, deadline - Date.now())),
        );
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    await call("Runtime.enable");
    let consecutive = 0;
    while (Date.now() < deadline) {
      const result = await call("Runtime.evaluate", {
        expression:
          'JSON.stringify({status:document.querySelector("#camera-status")?.textContent,error:document.querySelector("#expression-description")?.textContent,width:document.querySelector("video")?.videoWidth,focus:document.querySelector("#focus-status")?.textContent})',
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      lastState = JSON.parse(result.result.value || "{}");
      if (lastState.status === "ERROR" || errors.length)
        throw new Error(JSON.stringify({ state: lastState, errors }));
      consecutive =
        lastState.status === "SCANNING" &&
        lastState.width > 0 &&
        (lastState.focus === "FINDING FACE" || lastState.focus?.startsWith("FOCUS"))
          ? consecutive + 1
          : 0;
      if (consecutive >= 3) {
        const fonts = await call("Runtime.evaluate", {
          expression: `Promise.all([document.fonts.load('400 16px "Noto Sans JP Variable"', "表情判定再試行"), document.fonts.load('500 16px "DM Mono"', "SCANNING")]).then(groups => groups.every(fonts => fonts.length > 0 && fonts.every(font => font.status === "loaded")))`,
          awaitPromise: true,
          returnByValue: true,
        });
        if (fonts.exceptionDetails || fonts.result.value !== true)
          throw new Error("Bundled fonts did not load offline");
        // Requests may be denied by the desktop app itself or by the startup proxy.
        const offline = await call("Runtime.evaluate", {
          expression:
            'Promise.all(["http://facescan-smoke.invalid/", "https://facescan-smoke.invalid/"].map(url => fetch(url, {signal: AbortSignal.timeout(5000)}).then(() => false, () => true)))',
          awaitPromise: true,
          returnByValue: true,
        });
        if (
          offline.exceptionDetails ||
          offline.result.value?.length !== 2 ||
          !offline.result.value.every(Boolean)
        ) {
          throw new Error(`Offline check failed: ${JSON.stringify({ offline, probes })}`);
        }
        console.log(
          "Offline packaged camera and face detector: PASS (model, WASM and fonts; HTTP/HTTPS unavailable from startup)",
        );
        return;
      }
      await delay(1000);
    }
    throw new Error("Camera/model initialization timed out");
  } catch (error) {
    console.error(
      `Smoke diagnostics: ${JSON.stringify({ lastState, exitCode: child.exitCode, signalCode: child.signalCode })}\n${log}`,
    );
    throw error;
  } finally {
    clearTimeout(timeout);
    rejectPending(new Error("Smoke check finished"));
    socket?.close();
    if (child.pid) {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await Promise.race([exited, delay(3000)]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    }
    for (const connection of proxySockets) connection.destroy();
    proxy.closeAllConnections();
    await new Promise((resolve) => proxy.close(resolve));
    if (process.env.SMOKE_LOG_PATH) writeFileSync(process.env.SMOKE_LOG_PATH, log);
    rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
