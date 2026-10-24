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
    onError: handleFailure,
    onResult: (result, capturePhoto, detectedFaceCount) => {
      focusStatus.textContent =
        detectedFaceCount > 0 ? `FOCUS · ${detectedFaceCount}` : "FINDING FACE";
      captureFlow.update(result, capturePhoto);
    },
  });

  const setStatus = (label: string, isError = false) => {
    const dotClass = isError ? "status-dot status-dot-error" : "status-dot";
    status.innerHTML = `<span class="${dotClass}"></span>${label}`;
  };

  let stopCamera = () => {};
  let disposed = false;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "再試行";
  retry.hidden = true;
  retry.addEventListener("click", () => window.location.reload());
  status.parentElement!.append(retry);

  function handleFailure(error: unknown) {
    console.error("Face Scan の処理に失敗しました:", error);
    stopCamera();
    detector.stop();
    captureFlow.dispose();
    expression.dispose();
    setStatus("ERROR", true);
    focusStatus.textContent = "STOPPED";
    expression.showError(
      error instanceof Error ? error.message : "カメラとモデルの読み込みを確認してください。",
    );
    retry.hidden = false;
  }

  window.addEventListener(
    "beforeunload",
    () => {
      disposed = true;
      stopCamera();
      detector.stop();
      expression.dispose();
      captureFlow.dispose();
    },
    { once: true },
  );

  try {
    setStatus("CONNECTING");
    stopCamera = await startCamera({
      video,
      canvas,
      frame: getElement<HTMLDivElement>("#camera-frame"),
      placeholder: getElement<HTMLDivElement>("#camera-placeholder"),
      onEnded: () =>
        handleFailure(new Error("カメラの接続が切れました。接続を確認して再試行してください。")),
    });
    if (disposed || !retry.hidden) {
      stopCamera();
      return;
    }
    setStatus("LOADING MODEL");
    await detector.start();
    if (!disposed && retry.hidden) setStatus("SCANNING");
  } catch (error) {
    if (!disposed) handleFailure(error);
  }
}

void main();
