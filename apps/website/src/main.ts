import "./style.css";
import { startCamera } from "./camera";
import { createFaceDetector } from "./faceDetector";
import { createExpression } from "./expression";
import { createCaptureFlow } from "./captureFlow";
import { renderApp } from "./view";

renderApp(document.querySelector<HTMLDivElement>("#app")!);

const video = document.querySelector<HTMLVideoElement>("#camera-video")!;
const canvas = document.querySelector<HTMLCanvasElement>("#overlay")!;
const view = {
  status: document.querySelector<HTMLSpanElement>("#camera-status")!,
  faceHint: document.querySelector<HTMLDivElement>("#face-hint")!,
  name: document.querySelector<HTMLParagraphElement>("#expression-name")!,
  icon: document.querySelector<HTMLDivElement>("#expression-icon")!,
  description: document.querySelector<HTMLParagraphElement>("#expression-description")!,
  confidenceValue: document.querySelector<HTMLSpanElement>("#confidence-value")!,
  confidenceFill: document.querySelector<HTMLDivElement>("#confidence-fill")!,
  emotionRows: [...document.querySelectorAll<HTMLDivElement>(".emotion-row")],
};

const expression = createExpression(view);
const captureFlow = createCaptureFlow({
  countdown: document.querySelector<HTMLDivElement>("#countdown-overlay")!,
  photo: document.querySelector<HTMLImageElement>("#captured-photo")!,
  message: document.querySelector<HTMLParagraphElement>("#capture-message")!,
  onFaceResult: expression.show,
  secondsToCount: 3,
  resultDurationMs: 4000,
});
const detector = createFaceDetector({ video, canvas, onResult: captureFlow.update });
const stopCamera = startCamera({
  video,
  canvas,
  onStatus: message => { view.status.innerHTML = `<span class="status-dot"></span>${message}`; },
  onReady: () => {
    void detector.start().then(() => {
      view.status.innerHTML = '<span class="status-dot"></span>解析中';
    }).catch(error => {
      console.error("MediaPipe の起動に失敗しました:", error);
      view.status.innerHTML = '<span class="status-dot status-dot-error"></span>起動できません';
      expression.showError("顔検出モデルを読み込めませんでした。ネットワーク接続を確認してください。");
    });
  },
  onError: error => {
    console.error("カメラの起動に失敗しました:", error);
    view.status.innerHTML = '<span class="status-dot status-dot-error"></span>起動できません';
    expression.showError(error instanceof Error ? error.message : "カメラの起動を確認してください。");
  },
});

window.addEventListener("beforeunload", () => {
  stopCamera();
  detector.stop();
  expression.dispose();
  captureFlow.dispose();
});
