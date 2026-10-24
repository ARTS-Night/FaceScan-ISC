const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveAsset, canUseCamera } = require("./assets.cjs");

void test("local assets resolve and encoded paths cannot escape the bundle", () => {
  assert.equal(resolveAsset("/app", "facescan://app/"), "/app/index.html");
  assert.equal(
    resolveAsset("/app", "facescan://app/mediapipe/model.task"),
    "/app/mediapipe/model.task",
  );
  for (const url of [
    "https://app/index.html",
    "facescan://other/index.html",
    "facescan://app/..%2fsecret",
    "facescan://app/a%5cb",
    "facescan://app/%00",
  ]) {
    assert.equal(resolveAsset("/app", url), undefined);
  }
});

void test("only the application page and origin can use the camera", () => {
  const page = "facescan://app/index.html";
  const contents = { isDestroyed: () => false, getURL: () => page };
  assert.equal(canUseCamera(contents, "facescan://app", page), true);
  assert.equal(canUseCamera(contents, "https://example.com", page), false);
  assert.equal(
    canUseCamera(
      { ...contents, getURL: () => "facescan://app/other.html" },
      "facescan://app",
      page,
    ),
    false,
  );
  assert.equal(canUseCamera(null, "facescan://app", page), false);
});
