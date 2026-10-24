import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

type DetectorOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onError: (error: unknown) => void;
  onResult: (
    result: FaceLandmarkerResult,
    capturePhoto: () => string,
    detectedFaceCount: number,
  ) => void;
};

const WASM_URL =
  import.meta.env.MODE === "desktop"
    ? new URL("./mediapipe/wasm", document.baseURI).href
    : "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL =
  import.meta.env.MODE === "desktop"
    ? new URL("./mediapipe/face_landmarker.task", document.baseURI).href
    : "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MAX_FACES = 6;
const FRAME_CENTER = { x: 0.5, y: 0.5 };

// Software OpenGL can accept GPU tasks but stall while compiling inference shaders.
// Keep GPU inference for hardware renderers and use CPU on virtual/software graphics.
function preferredDelegate(): "GPU" | "CPU" {
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2");
  if (!gl) return "CPU";
  try {
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software/i.test(renderer) ? "CPU" : "GPU";
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

export function createFaceDetector({ video, canvas, onResult, onError }: DetectorOptions) {
  const context = canvas.getContext("2d");
  let landmarker: FaceLandmarker | undefined;
  let frameRequest = 0;
  let lastVideoTime = -1;

  let stopped = false;
  let delegate: "GPU" | "CPU" = "GPU";

  async function loadLandmarker() {
    const wasm = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      runningMode: "VIDEO" as const,
      numFaces: MAX_FACES,
      outputFaceBlendshapes: true,
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
    };

    try {
      return await FaceLandmarker.createFromOptions(wasm, options);
    } catch (error) {
      if (delegate === "CPU") throw error;
      delegate = "CPU";
      return FaceLandmarker.createFromOptions(wasm, {
        ...options,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      });
    }
  }

  async function detectFrame() {
    if (stopped) return;
    if (document.hidden) {
      frameRequest = requestAnimationFrame(detectFrame);
      return;
    }
    try {
      if (
        landmarker &&
        video.videoWidth > 0 &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.currentTime !== lastVideoTime
      ) {
        lastVideoTime = video.currentTime;
        let result: FaceLandmarkerResult;
        try {
          result = landmarker.detectForVideo(video, performance.now());
        } catch (error) {
          if (delegate === "CPU") throw error;
          delegate = "CPU";
          landmarker.close();
          landmarker = undefined;
          const replacement = await loadLandmarker();
          if (stopped) {
            replacement.close();
            return;
          }
          landmarker = replacement;
          lastVideoTime = -1;
          frameRequest = requestAnimationFrame(detectFrame);
          return;
        }
        const selectedFaceIndex = findClosestFaceToFrameCenter(result);
        drawFaceBounds(result, selectedFaceIndex);
        onResult(
          selectFace(result, selectedFaceIndex),
          () => captureFace(result, selectedFaceIndex),
          result.faceLandmarks.length,
        );
      }
      frameRequest = requestAnimationFrame(detectFrame);
    } catch (error) {
      stop();
      onError(error);
    }
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(frameRequest);
    const current = landmarker;
    landmarker = undefined;
    current?.close();
  }

  // 顔の輪郭に余白を加えて切り出す。左右反転はカメラ表示に合わせる。
  function captureFace(result: FaceLandmarkerResult, faceIndex: number) {
    const landmarks = result.faceLandmarks[faceIndex];
    if (!landmarks) return "";

    const xs = landmarks.map((point) => point.x * video.videoWidth);
    const ys = landmarks.map((point) => point.y * video.videoHeight);
    const faceLeft = Math.min(...xs);
    const faceTop = Math.min(...ys);
    const faceWidth = Math.max(...xs) - faceLeft;
    const faceHeight = Math.max(...ys) - faceTop;
    const padding = Math.max(faceWidth, faceHeight) * 0.4;
    const cropSize = Math.min(
      Math.max(faceWidth, faceHeight) + padding * 2,
      video.videoWidth,
      video.videoHeight,
    );
    const centerX = faceLeft + faceWidth / 2;
    const centerY = faceTop + faceHeight / 2;
    const sourceX = Math.max(0, Math.min(video.videoWidth - cropSize, centerX - cropSize / 2));
    const sourceY = Math.max(0, Math.min(video.videoHeight - cropSize, centerY - cropSize / 2));
    const sourceWidth = Math.min(cropSize, video.videoWidth);
    const sourceHeight = Math.min(cropSize, video.videoHeight);

    const photo = document.createElement("canvas");
    photo.width = 640;
    photo.height = 640;
    const photoContext = photo.getContext("2d")!;
    photoContext.fillStyle = "#181916";
    photoContext.fillRect(0, 0, photo.width, photo.height);
    photoContext.translate(photo.width, 0);
    photoContext.scale(-1, 1);
    photoContext.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      photo.width,
      photo.height,
    );
    return photo.toDataURL("image/jpeg", 0.9);
  }

  // 顔ランドマークの平均座標を顔の中心とし、画面中央との距離が最短の顔を選ぶ。
  function findClosestFaceToFrameCenter(result: FaceLandmarkerResult) {
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;

    result.faceLandmarks.forEach((landmarks, index) => {
      if (!landmarks.length) return;
      const faceCenterX = landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length;
      const faceCenterY = landmarks.reduce((sum, point) => sum + point.y, 0) / landmarks.length;
      const distance = Math.hypot(faceCenterX - FRAME_CENTER.x, faceCenterY - FRAME_CENTER.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  function selectFace(result: FaceLandmarkerResult, faceIndex: number): FaceLandmarkerResult {
    if (faceIndex < 0) return { ...result, faceLandmarks: [], faceBlendshapes: [] };
    return {
      ...result,
      faceLandmarks: [result.faceLandmarks[faceIndex]],
      faceBlendshapes: result.faceBlendshapes[faceIndex] ? [result.faceBlendshapes[faceIndex]] : [],
    };
  }

  function drawFaceBounds(result: FaceLandmarkerResult, selectedIndex: number) {
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    result.faceLandmarks.forEach((landmarks, index) => {
      if (!landmarks.length) return;
      const xs = landmarks.map((point) => point.x);
      const ys = landmarks.map((point) => point.y);
      const left = Math.min(...xs) * canvas.width;
      const top = Math.min(...ys) * canvas.height;
      const width = (Math.max(...xs) - Math.min(...xs)) * canvas.width;
      const height = (Math.max(...ys) - Math.min(...ys)) * canvas.height;
      const isSelected = index === selectedIndex;

      context.strokeStyle = isSelected ? "#65f5e3" : "#ffffff70";
      context.lineWidth = isSelected ? 3 : 1.5;
      context.strokeRect(left, top, width, height);
      if (isSelected) {
        context.fillStyle = "#65f5e3";
        context.font = "12px sans-serif";
        context.fillText("FOCUS", left, Math.max(16, top - 7));
      }
    });
  }

  return {
    async start() {
      if (!context) throw new Error("描画機能を利用できません。");
      stopped = false;
      delegate = preferredDelegate();
      console.info("Face detector backend:", delegate);
      const loaded = await loadLandmarker();
      if (stopped) {
        loaded.close();
        return;
      }
      landmarker = loaded;
      frameRequest = requestAnimationFrame(detectFrame);
    },
    stop,
  };
}
