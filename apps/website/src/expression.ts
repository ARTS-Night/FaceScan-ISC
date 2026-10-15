import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

type ExpressionView = {
  faceHint: HTMLDivElement;
  name: HTMLParagraphElement;
  icon: HTMLDivElement;
  description: HTMLParagraphElement;
  confidenceValue: HTMLSpanElement;
  confidenceFill: HTMLDivElement;
  emotionRows: HTMLDivElement[];
};

type Emotion = "笑顔" | "悲しい" | "驚き" | "眠そう" | "怒り";
type EmotionInfo = { icon: string; label: string; detail: string };
type EmotionScores = { smile: number; sad: number; surprise: number; sleepy: number; angry: number };
type EmotionScoreKey = keyof EmotionScores;

const SMOOTHING = 0.65;
const SLEEPY_DETECTION_WEIGHT = 0.5;

const emotionInfo: Record<Emotion, EmotionInfo> = {
  "笑顔": { icon: "☺", label: "笑顔", detail: "笑顔を検出しました" },
  "悲しい": { icon: "☹", label: "悲しい", detail: "悲しい表情を検出しました" },
  "驚き": { icon: "◉", label: "驚き", detail: "驚いた表情を検出しました" },
  "眠そう": { icon: "◡", label: "眠そう", detail: "眠そうな表情を検出しました" },
  "怒り": { icon: "≋", label: "怒り", detail: "怒った表情を検出しました" },
};
const scoreRows: EmotionScoreKey[] = ["smile", "sad", "surprise", "sleepy", "angry"];

export function createExpression(view: ExpressionView) {
  let smoothedScores: EmotionScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 };
  const displayedScores = scoreRows.map(() => 0);
  const targetScores = scoreRows.map(() => 0);
  let displayedConfidence = 0;
  let targetConfidence = 0;
  let hasFace = false;
  let animationFrame = 0;
  let previousFrameTime = 0;

  function getScore(result: FaceLandmarkerResult, categoryName: string) {
    return result.faceBlendshapes[0]?.categories.find(category => category.categoryName === categoryName)?.score ?? 0;
  }

  function getEmotionScores(result: FaceLandmarkerResult): EmotionScores {
    const smile = Math.max(getScore(result, "mouthSmileLeft"), getScore(result, "mouthSmileRight"));
    const surprise = Math.max(getScore(result, "browInnerUp"), getScore(result, "eyeWideLeft"), getScore(result, "eyeWideRight"));
    const sleepy = Math.max(
      getScore(result, "eyeBlinkLeft"), getScore(result, "eyeBlinkRight"),
      getScore(result, "eyeSquintLeft"), getScore(result, "eyeSquintRight"),
    );
    const browDown = Math.max(getScore(result, "browDownLeft"), getScore(result, "browDownRight"));
    const frown = Math.max(getScore(result, "mouthFrownLeft"), getScore(result, "mouthFrownRight"));
    const noseSneer = Math.max(getScore(result, "noseSneerLeft"), getScore(result, "noseSneerRight"));
    const browInnerUp = getScore(result, "browInnerUp");
    const sad = Math.min(1, browInnerUp * 0.45 + frown * 0.4 + browDown * 0.15);
    const angry = Math.min(1, browDown * 0.5 + frown * 0.3 + noseSneer * 0.2);

    return { smile, sad, surprise, sleepy, angry };
  }

  function smoothScores(current: EmotionScores) {
    smoothedScores = {
      smile: smoothedScores.smile * SMOOTHING + current.smile * (1 - SMOOTHING),
      sad: smoothedScores.sad * SMOOTHING + current.sad * (1 - SMOOTHING),
      surprise: smoothedScores.surprise * SMOOTHING + current.surprise * (1 - SMOOTHING),
      sleepy: smoothedScores.sleepy * SMOOTHING + current.sleepy * (1 - SMOOTHING),
      angry: smoothedScores.angry * SMOOTHING + current.angry * (1 - SMOOTHING),
    };
    return smoothedScores;
  }

  function detectEmotion(scores: EmotionScores): [Emotion, number] {
    const candidates: [Emotion, number][] = [
      ["笑顔", scores.smile], ["悲しい", scores.sad], ["驚き", scores.surprise],
      ["眠そう", scores.sleepy * SLEEPY_DETECTION_WEIGHT], ["怒り", scores.angry],
    ];
    return candidates.reduce((best, candidate) => candidate[1] > best[1] ? candidate : best);
  }

  function show(result: FaceLandmarkerResult) {
    const hasFace = result.faceLandmarks.length > 0;
    view.faceHint.classList.toggle("is-hidden", hasFace);

    if (!hasFace) {
      view.name.textContent = "顔が見つかりません";
      view.icon.textContent = "⌕";
      view.description.textContent = "カメラに顔を向けてください";
      smoothedScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 };
      setScoreTargets(smoothedScores, 0, false);
      return;
    }

    const scores = smoothScores(getEmotionScores(result));
    renderEmotion(scores, true);
  }

  function renderEmotion(scores: EmotionScores, hasFace: boolean) {
    const [emotion, confidence] = detectEmotion(scores);
    view.name.textContent = emotionInfo[emotion].label;
    view.icon.textContent = emotionInfo[emotion].icon;
    view.description.textContent = emotionInfo[emotion].detail;
    setScoreTargets(scores, confidence, hasFace);
  }

  function setScoreTargets(scores: EmotionScores, confidence: number, faceDetected: boolean) {
    hasFace = faceDetected;
    targetConfidence = faceDetected ? Math.min(confidence, 0.99) : 0;
    scoreRows.forEach((key, index) => { targetScores[index] = faceDetected ? scores[key] : 0; });
    if (!faceDetected) {
      view.confidenceValue.textContent = "—";
      view.emotionRows.forEach(row => { row.querySelector(".emotion-score")!.textContent = "—"; });
    }
    if (!animationFrame) animationFrame = requestAnimationFrame(animateScores);
  }

  function animateScores(time: number) {
    const elapsed = previousFrameTime ? time - previousFrameTime : 16;
    const step = 1 - Math.exp(-elapsed / 120);
    previousFrameTime = time;

    displayedScores.forEach((value, index) => {
      displayedScores[index] = approach(value, targetScores[index], step);
      const percent = Math.round(displayedScores[index] * 100);
      const row = view.emotionRows[index];
      if (!row) return;
      row.querySelector("i")!.style.width = `${percent}%`;
      if (hasFace) row.querySelector(".emotion-score")!.textContent = `${percent}%`;
    });

    displayedConfidence = approach(displayedConfidence, targetConfidence, step);
    view.confidenceFill.style.width = `${Math.round(displayedConfidence * 100)}%`;
    if (hasFace) view.confidenceValue.textContent = `${Math.round(displayedConfidence * 100)}%`;

    const isSettled = displayedScores.every((value, index) => Math.abs(value - targetScores[index]) < 0.005)
      && Math.abs(displayedConfidence - targetConfidence) < 0.005;
    if (isSettled) {
      displayedScores.forEach((_, index) => { displayedScores[index] = targetScores[index]; });
      displayedConfidence = targetConfidence;
      animationFrame = 0;
      previousFrameTime = 0;
    } else {
      animationFrame = requestAnimationFrame(animateScores);
    }
  }

  function approach(current: number, target: number, step: number) {
    const next = current + (target - current) * step;
    return Math.abs(target - next) < 0.005 ? target : next;
  }

  return {
    show,
    getCurrentEmotion() {
      return emotionInfo[detectEmotion(smoothedScores)[0]].label;
    },
    showError(message: string) {
      view.name.textContent = "ERROR";
      view.description.textContent = message;
    },
    dispose() {
      cancelAnimationFrame(animationFrame);
      smoothedScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 };
    },
  };
}
