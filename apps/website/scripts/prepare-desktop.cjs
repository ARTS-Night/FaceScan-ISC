const { cp, mkdir, writeFile, readdir, readFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
const path = require("node:path");

const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const modelHash = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";

async function main() {
  const target = path.join(__dirname, "../dist/desktop/mediapipe");
  await mkdir(target, { recursive: true });
  const wasm = path.join(path.dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
  await cp(wasm, path.join(target, "wasm"), { recursive: true });
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(data).digest("hex") !== modelHash) {
    throw new Error("Face model checksum mismatch");
  }
  await writeFile(path.join(target, "face_landmarker.task"), data);
  const root = path.dirname(target);
  const licenses = path.join(root, "licenses");
  await mkdir(licenses, { recursive: true });
  for (const [font, filename] of [
    ["@fontsource-variable/noto-sans-jp", "Noto-Sans-JP.txt"],
    ["@fontsource/dm-mono", "DM-Mono.txt"],
  ]) {
    await cp(
      path.join(path.dirname(require.resolve(font)), "LICENSE"),
      path.join(licenses, filename),
    );
  }
  const files = {};
  async function collect(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(filename, `${relative}/`);
      else if (relative !== "asset-manifest.json")
        files[relative] = createHash("sha256")
          .update(await readFile(filename))
          .digest("hex");
    }
  }
  await collect(root);
  const { version } = require("../package.json");
  await writeFile(
    path.join(root, "asset-manifest.json"),
    JSON.stringify({ version, files }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
