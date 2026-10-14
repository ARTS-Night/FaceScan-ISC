import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

type DetectorOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onResult: (result: FaceLandmarkerResult, captureFrame: () => string) => void;
};

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MAX_FACES = 6;
const FRAME_CENTER = { x: 0.5, y: 0.5 };

export function createFaceDetector({ video, canvas, onResult }: DetectorOptions) {
  const context = canvas.getContext("2d")!;
  let landmarker: FaceLandmarker | undefined;
  let frameRequest = 0;
  let lastVideoTime = -1;

  async function loadLandmarker() {
    const wasm = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      runningMode: "VIDEO" as const,
      numFaces: MAX_FACES,
      outputFaceBlendshapes: true,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
    };

    try {
      return await FaceLandmarker.createFromOptions(wasm, options);
    } catch {
      return FaceLandmarker.createFromOptions(wasm, {
        ...options,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      });
    }
  }

  function detectFrame() {
    if (landmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const selectedFaceIndex = findClosestFaceToFrameCenter(result);
      drawFaceBounds(result, selectedFaceIndex);
      onResult(selectFace(result, selectedFaceIndex), captureFrame);
    }
    frameRequest = requestAnimationFrame(detectFrame);
  }

  function captureFrame() {
    const photo = document.createElement("canvas");
    photo.width = video.videoWidth;
    photo.height = video.videoHeight;
    const photoContext = photo.getContext("2d")!;
    photoContext.translate(photo.width, 0);
    photoContext.scale(-1, 1);
    photoContext.drawImage(video, 0, 0, photo.width, photo.height);
    return photo.toDataURL("image/jpeg", 0.88);
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
    context.clearRect(0, 0, canvas.width, canvas.height);
    result.faceLandmarks.forEach((landmarks, index) => {
      if (!landmarks.length) return;
      const xs = landmarks.map(point => point.x);
      const ys = landmarks.map(point => point.y);
      const left = Math.min(...xs) * canvas.width;
      const top = Math.min(...ys) * canvas.height;
      const width = (Math.max(...xs) - Math.min(...xs)) * canvas.width;
      const height = (Math.max(...ys) - Math.min(...ys)) * canvas.height;
      const isSelected = index === selectedIndex;

      context.strokeStyle = isSelected ? "#c3f264" : "#ffffff88";
      context.lineWidth = isSelected ? 3 : 1.5;
      context.strokeRect(left, top, width, height);
      if (isSelected) {
        context.fillStyle = "#c3f264";
        context.font = "12px sans-serif";
        context.fillText("中央の人", left, Math.max(16, top - 7));
      }
    });
  }

  return {
    async start() {
      landmarker = await loadLandmarker();
      frameRequest = requestAnimationFrame(detectFrame);
    },
    stop() {
      cancelAnimationFrame(frameRequest);
      landmarker?.close();
    },
  };
}
