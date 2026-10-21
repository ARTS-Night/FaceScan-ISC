import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

type CaptureFlowOptions = {
  countdown: HTMLDivElement;
  photo: HTMLImageElement;
  message: HTMLParagraphElement;
  retakeButton: HTMLButtonElement;
  onFaceResult: (result: FaceLandmarkerResult) => void;
  getResultMessage: () => string;
  secondsToCount: number;
};

export function createCaptureFlow(options: CaptureFlowOptions) {
  const { countdown, photo, message, retakeButton, onFaceResult, getResultMessage, secondsToCount } = options;
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
    retakeButton.hidden = true;
  }

  function showCapturedResult(capturePhoto: () => string) {
    photo.src = capturePhoto();
    photo.classList.add("is-visible");
    countdown.textContent = "";
    message.textContent = `判定結果 · ${getResultMessage()}`;
    retakeButton.hidden = false;
    isShowingResult = true;
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

  retakeButton.addEventListener("click", showLiveView);

  return {
    update,
    dispose() {
      clearCountdown();
      showLiveView();
    },
  };
}
