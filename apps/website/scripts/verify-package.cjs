const { extractFile } = require("@electron/asar");
const { createHash } = require("node:crypto");

const archive = process.argv[2];
if (!archive) throw new Error("Pass the packaged app.asar path");
const root = "dist/desktop/";
const manifest = JSON.parse(extractFile(archive, `${root}asset-manifest.json`).toString());
const metadata = JSON.parse(extractFile(archive, "package.json").toString());
if (metadata.version !== manifest.version) throw new Error("Packaged asset version mismatch");
for (const name of [
  "index.html",
  "mediapipe/face_landmarker.task",
  "licenses/Noto-Sans-JP.txt",
  "licenses/DM-Mono.txt",
  ...["vision_wasm_internal", "vision_wasm_nosimd_internal", "vision_wasm_module_internal"].flatMap(
    (name) => [`mediapipe/wasm/${name}.js`, `mediapipe/wasm/${name}.wasm`],
  ),
]) {
  if (!manifest.files[name]) throw new Error(`Missing required asset: ${name}`);
}
if (
  manifest.files["mediapipe/face_landmarker.task"] !==
  "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
) {
  throw new Error("Unexpected face model checksum");
}
for (const font of ["noto-sans-jp", "dm-mono"]) {
  if (!Object.keys(manifest.files).some((name) => name.includes(font) && name.endsWith(".woff2"))) {
    throw new Error(`Missing bundled font: ${font}`);
  }
}
for (const [name, expected] of Object.entries(manifest.files)) {
  if (name.startsWith("/") || name.split("/").includes(".."))
    throw new Error(`Invalid asset path: ${name}`);
  const data = extractFile(archive, `${root}${name}`);
  if (createHash("sha256").update(data).digest("hex") !== expected)
    throw new Error(`Asset checksum mismatch: ${name}`);
  if (
    name.endsWith(".css") &&
    /(?:@import\s*(?:url\()?\s*["']?|url\(\s*["']?)(?:https?:)?\/\//i.test(data.toString())
  ) {
    throw new Error(`External stylesheet or font in desktop package: ${name}`);
  }
  if (
    name.endsWith(".js") &&
    /https:\/\/(?:cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision|storage\.googleapis\.com\/mediapipe-models)/.test(
      data.toString(),
    )
  ) {
    throw new Error(`External MediaPipe URL in desktop package: ${name}`);
  }
}
console.log(
  `Packaged offline assets verified: FaceScan ${manifest.version}, ${Object.keys(manifest.files).length} files`,
);
