import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

type CaptureFlowOptions = {
  countdown: HTMLDivElement;
  photo: HTMLImageElement;
  message: HTMLParagraphElement;
  onFaceResult: (result: FaceLandmarkerResult) => void;
  getEmotion: () => string;
  secondsToCount: number;
  resultDurationMs: number;
};

export function createCaptureFlow(options: CaptureFlowOptions) {
  const { countdown, photo, message, onFaceResult, getEmotion, secondsToCount, resultDurationMs } = options;
  let resultTimer = 0;
  let faceFirstSeenAt: number | undefined;
  let isShowingResult = false;

  function clearCountdown() {
    faceFirstSeenAt = undefined;
    countdown.textContent = "";
  }

  function showLiveView() {
    isShowingResult = false;
    photo.classList.remove("is-visible");
    photo.removeAttribute("src");
    message.textContent = "";
  }

  function showCapturedResult(capturePhoto: () => string) {
    photo.src = capturePhoto();
    photo.classList.add("is-visible");
    countdown.textContent = "";
    message.textContent = `判定結果 · ${getEmotion()}`;
    isShowingResult = true;
    resultTimer = window.setTimeout(showLiveView, resultDurationMs);
  }

  function update(result: FaceLandmarkerResult, capturePhoto: () => string) {
    const hasFace = result.faceLandmarks.length > 0;
    if (!hasFace) {
      clearCountdown();
      if (!isShowingResult) onFaceResult(result);
      return;
    }

    if (isShowingResult) return;
    onFaceResult(result);
    if (faceFirstSeenAt === undefined) {
      faceFirstSeenAt = performance.now();
    }

    const elapsedSeconds = (performance.now() - faceFirstSeenAt) / 1000;
    const remainingSeconds = secondsToCount - Math.floor(elapsedSeconds);
    if (remainingSeconds > 0) {
      countdown.textContent = String(remainingSeconds);
      return;
    }

    clearCountdown();
    showCapturedResult(capturePhoto);
  }

  return {
    update,
    dispose() {
      window.clearTimeout(resultTimer);
      clearCountdown();
      showLiveView();
    },
  };
}
