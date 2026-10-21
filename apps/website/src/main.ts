import "./style.css";
import { startCamera } from "./camera";
import { createCaptureFlow } from "./captureFlow";
import { createFaceDetector } from "./faceDetector";
import { createExpression } from "./expression";
import { getElement, getElements } from "./dom";
import { renderApp } from "./view";

async function main() {
  renderApp(getElement<HTMLDivElement>("#app"));

  const video = getElement<HTMLVideoElement>("#camera-video");
  const canvas = getElement<HTMLCanvasElement>("#overlay");
  const status = getElement<HTMLSpanElement>("#camera-status");
  const focusStatus = getElement<HTMLSpanElement>("#focus-status");
  const expression = createExpression({
    faceHint: getElement<HTMLDivElement>("#face-hint"),
    name: getElement<HTMLParagraphElement>("#expression-name"),
    icon: getElement<HTMLDivElement>("#expression-icon"),
    description: getElement<HTMLParagraphElement>("#expression-description"),
    confidenceValue: getElement<HTMLSpanElement>("#confidence-value"),
    confidenceFill: getElement<HTMLDivElement>("#confidence-fill"),
    emotionRows: getElements<HTMLDivElement>(".emotion-row"),
    emotionInputs: getElements<HTMLInputElement>("[data-emotion]"),
  });
  const captureFlow = createCaptureFlow({
    countdown: getElement<HTMLDivElement>("#countdown-overlay"),
    photo: getElement<HTMLImageElement>("#captured-photo"),
    message: getElement<HTMLParagraphElement>("#capture-message"),
    retakeButton: getElement<HTMLButtonElement>("#retake-button"),
    onFaceResult: expression.show,
    getResultMessage: () => expression.getResultMessage(),
    secondsToCount: 3,
  });
  const detector = createFaceDetector({
    video,
    canvas,
    onResult: (result, capturePhoto, detectedFaceCount) => {
      focusStatus.textContent = detectedFaceCount > 0
        ? `FOCUS · ${detectedFaceCount}`
        : "FINDING FACE";
      captureFlow.update(result, capturePhoto);
    },
  });

  const setStatus = (label: string, isError = false) => {
    const dotClass = isError ? "status-dot status-dot-error" : "status-dot";
    status.innerHTML = `<span class="${dotClass}"></span>${label}`;
  };

  let stopCamera = () => {};
  try {
    setStatus("CONNECTING");
    stopCamera = await startCamera({
      video,
      canvas,
      frame: getElement<HTMLDivElement>("#camera-frame"),
      placeholder: getElement<HTMLDivElement>("#camera-placeholder"),
    });
    setStatus("CAMERA ON");
    await detector.start();
    setStatus("SCANNING");
  } catch (error) {
    console.error("Face Scan の起動に失敗しました:", error);
    stopCamera();
    detector.stop();
    setStatus("ERROR", true);
    expression.showError(error instanceof Error ? error.message : "カメラとモデルの読み込みを確認してください。");
  }

  window.addEventListener("beforeunload", () => {
    stopCamera();
    detector.stop();
    expression.dispose();
    captureFlow.dispose();
  }, { once: true });
}

void main();
