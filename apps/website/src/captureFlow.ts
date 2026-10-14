import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

type CaptureFlowOptions = {
  countdown: HTMLDivElement;
  photo: HTMLImageElement;
  message: HTMLParagraphElement;
  onFaceResult: (result: FaceLandmarkerResult) => void;
  secondsToCount: number;
  resultDurationMs: number;
};

export function createCaptureFlow(options: CaptureFlowOptions) {
  const { countdown, photo, message, onFaceResult, secondsToCount, resultDurationMs } = options;
  let countdownTimer = 0;
  let resultTimer = 0;
  let faceFirstSeenAt: number | undefined;
  let isShowingResult = false;

  function showLiveView() {
    isShowingResult = false;
    photo.classList.remove("is-visible");
    photo.removeAttribute("src");
    message.textContent = "";
    countdown.textContent = "";
  }

  function capture(result: FaceLandmarkerResult, captureFrame: () => string) {
    onFaceResult(result);
    photo.src = captureFrame();
    photo.classList.add("is-visible");
    countdown.textContent = "";
    message.textContent = `あなたは「${document.querySelector("#expression-name")?.textContent ?? "通常"}」の表情でした！`;
    isShowingResult = true;
    resultTimer = window.setTimeout(showLiveView, resultDurationMs);
  }

  function update(result: FaceLandmarkerResult, captureFrame: () => string) {
    const hasFace = result.faceLandmarks.length > 0;
    if (!hasFace) {
      faceFirstSeenAt = undefined;
      countdown.textContent = "";
      if (isShowingResult) return;
      onFaceResult(result);
      return;
    }

    if (isShowingResult) return;
    if (faceFirstSeenAt === undefined) {
      faceFirstSeenAt = performance.now();
      countdown.textContent = String(secondsToCount);
      return;
    }

    const elapsedSeconds = (performance.now() - faceFirstSeenAt) / 1000;
    const remaining = secondsToCount - Math.floor(elapsedSeconds);
    if (remaining > 0) {
      countdown.textContent = String(remaining);
      return;
    }

    faceFirstSeenAt = undefined;
    onFaceResult(result);
    capture(result, captureFrame);
  }

  return {
    update,
    dispose() {
      window.clearTimeout(countdownTimer);
      window.clearTimeout(resultTimer);
      showLiveView();
    },
  };
}
