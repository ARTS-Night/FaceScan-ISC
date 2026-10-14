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
type EmotionInfo = { icon: string; detail: string };
type EmotionScores = { smile: number; sad: number; surprise: number; sleepy: number; angry: number };
type EmotionScoreKey = keyof EmotionScores;

const SMOOTHING = 0.65;
const SLEEPY_DETECTION_WEIGHT = 0.5;

const emotionInfo: Record<Emotion, EmotionInfo> = {
  "笑顔": { icon: "☺", detail: "口角が上がっています。いい笑顔ですね。" },
  "悲しい": { icon: "☹", detail: "眉や口元が下がっているようです。" },
  "驚き": { icon: "◉", detail: "目や口が大きく開いているようです。" },
  "眠そう": { icon: "◡", detail: "まぶたが下がり、目が細くなっています。" },
  "怒り": { icon: "≋", detail: "眉が寄り、口元に力が入っているようです。" },
};
const scoreRows: { key: EmotionScoreKey; label: Emotion }[] = [
  { key: "smile", label: "笑顔" },
  { key: "sad", label: "悲しい" },
  { key: "surprise", label: "驚き" },
  { key: "sleepy", label: "眠そう" },
  { key: "angry", label: "怒り" },
];

export function createExpression(view: ExpressionView) {
  let smoothedScores: EmotionScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 };

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
      view.description.textContent = "カメラの中央に顔を映してください。";
      view.confidenceValue.textContent = "—";
      view.confidenceFill.style.width = "0%";
      smoothedScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 };
      setEmotionScores(smoothedScores, false);
      return;
    }

    const scores = smoothScores(getEmotionScores(result));
    renderEmotion(scores, true);
  }

  function renderEmotion(scores: EmotionScores, hasFace: boolean) {
    const [emotion, confidence] = detectEmotion(scores);
    view.name.textContent = emotion;
    view.icon.textContent = emotionInfo[emotion].icon;
    view.description.textContent = emotionInfo[emotion].detail;
    const percent = Math.round(Math.min(confidence, 0.99) * 100);
    view.confidenceValue.textContent = `${percent}%`;
    view.confidenceFill.style.width = `${percent}%`;
    setEmotionScores(scores, hasFace);
  }

  function setEmotionScores(scores: EmotionScores, hasFace: boolean) {
    scoreRows.forEach(({ key }, index) => {
      const score = scores[key];
      const row = view.emotionRows[index];
      if (!row) return;
      row.querySelector("i")!.style.width = `${Math.round(Math.min(score, 1) * 100)}%`;
      row.querySelector(".emotion-score")!.textContent = hasFace ? `${Math.round(score * 100)}%` : "—";
    });
  }

  return {
    show,
    getCurrentEmotion() {
      return detectEmotion(smoothedScores)[0];
    },
    showError(message: string) {
      view.name.textContent = "起動できませんでした";
      view.description.textContent = message;
    },
    dispose() { smoothedScores = { smile: 0, sad: 0, surprise: 0, sleepy: 0, angry: 0 }; },
  };
}
