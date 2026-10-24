import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { startCamera } from "../src/camera";
import { createFaceDetector } from "../src/faceDetector";

const mocks = vi.hoisted(() => ({ create: vi.fn(), resolve: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: { createFromOptions: mocks.create },
  FilesetResolver: { forVisionTasks: mocks.resolve },
}));
let nextFrame: () => Promise<void>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback) => {
      nextFrame = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  mocks.create.mockReset();
  mocks.resolve.mockResolvedValue({});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function camera(play = vi.fn().mockResolvedValue(undefined)) {
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: "live" });
  const stream = { getTracks: () => [track] };
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const video = Object.assign(new EventTarget(), {
    play,
    srcObject: null,
    videoWidth: 640,
    videoHeight: 480,
  });
  const options = {
    video,
    canvas: {},
    frame: { style: {} },
    placeholder: { classList: { add: vi.fn(), remove: vi.fn() } },
    onEnded: vi.fn(),
  };
  return { track, stream, options };
}

test("camera playback failure releases the device and clears the video", async () => {
  const { track, options } = camera(vi.fn().mockRejectedValue(new Error("playback failed")));
  await expect(startCamera(options as never)).rejects.toThrow("playback failed");
  expect(track.stop).toHaveBeenCalledOnce();
  expect(options.video.srcObject).toBeNull();
});

test("a device acquired after timeout is immediately released", async () => {
  const { track, stream, options } = camera();
  let complete!: (stream: unknown) => void;
  navigator.mediaDevices.getUserMedia = vi.fn(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  ) as never;
  const pending = expect(startCamera(options as never)).rejects.toThrow("タイムアウト");
  await vi.advanceTimersByTimeAsync(30_000);
  await pending;
  complete(stream);
  await Promise.resolve();
  expect(track.stop).toHaveBeenCalledOnce();
});

test("camera stop removes disconnect listeners and releases tracks", async () => {
  const { track, options } = camera();
  const stop = await startCamera(options as never);
  track.dispatchEvent(new Event("ended"));
  expect(options.onEnded).toHaveBeenCalledOnce();
  stop();
  track.dispatchEvent(new Event("ended"));
  expect(options.onEnded).toHaveBeenCalledOnce();
  expect(track.stop).toHaveBeenCalledOnce();
});

function detector(renderer: string | null = "ANGLE (Intel GPU)") {
  const options = {
    video: { videoWidth: 640, readyState: 2, currentTime: 1 },
    canvas: { getContext: () => ({ clearRect: vi.fn() }) },
    onError: vi.fn(),
    onResult: vi.fn(),
  };
  const gl =
    renderer === null
      ? null
      : {
          RENDERER: 1,
          getParameter: () => renderer,
          getExtension: (name: string) =>
            name === "WEBGL_debug_renderer_info"
              ? { UNMASKED_RENDERER_WEBGL: 2 }
              : { loseContext: vi.fn() },
        };
  vi.stubGlobal("document", { hidden: false, createElement: () => ({ getContext: () => gl }) });
  return { instance: createFaceDetector(options as never), options };
}

test("stopping while the model loads closes the late model without scheduling frames", async () => {
  const model = { close: vi.fn() };
  let complete!: (model: unknown) => void;
  mocks.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { instance } = detector();
  const pending = instance.start();
  await Promise.resolve();
  instance.stop();
  complete(model);
  await pending;
  expect(model.close).toHaveBeenCalledOnce();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

test("a GPU runtime failure switches to CPU, and CPU errors stop with a visible error callback", async () => {
  const gpu = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => {
      throw new Error("GPU lost");
    }),
  };
  const cpu = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => {
      throw new Error("CPU failed");
    }),
  };
  mocks.create.mockResolvedValueOnce(gpu).mockResolvedValueOnce(cpu);
  const { instance, options } = detector();
  await instance.start();
  await nextFrame();
  expect(gpu.close).toHaveBeenCalledOnce();
  expect(mocks.create.mock.calls[1][1].baseOptions.delegate).toBe("CPU");
  await nextFrame();
  expect(cpu.close).toHaveBeenCalledOnce();
  expect(options.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "CPU failed" }));
  instance.stop();
  expect(cpu.close).toHaveBeenCalledOnce();
});

test.each(["ANGLE (Google, Vulkan SwiftShader Device)", "llvmpipe (LLVM 15.0)", null])(
  "software or missing WebGL starts directly on CPU: %s",
  async (renderer) => {
    const model = { close: vi.fn() };
    mocks.create.mockResolvedValue(model);
    const { instance } = detector(renderer);
    await instance.start();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][1].baseOptions.delegate).toBe("CPU");
    instance.stop();
  },
);
