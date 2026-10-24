type CameraOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  frame: HTMLDivElement;
  placeholder: HTMLDivElement;
  onEnded: () => void;
};

const cameraConstraints: MediaStreamConstraints = {
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};
const CONNECTION_TIMEOUT = 30_000;

async function acquireStream() {
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const pending = navigator.mediaDevices.getUserMedia(cameraConstraints).then((stream) => {
    if (expired) stream.getTracks().forEach((track) => track.stop());
    return stream;
  });
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            new Error(
              "カメラの接続がタイムアウトしました。権限と接続を確認して再試行してください。",
            ),
          );
        }, CONNECTION_TIMEOUT);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function startCamera({ video, canvas, frame, placeholder, onEnded }: CameraOptions) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "カメラを利用できません。ブラウザ版は HTTPS または localhost で開いてください。",
    );
  }
  let stream: MediaStream;
  try {
    stream = await acquireStream();
  } catch (error) {
    if (error instanceof DOMException) {
      const messages: Record<string, string> = {
        NotAllowedError: "カメラの使用を許可して再試行してください。",
        NotFoundError: "カメラが見つかりません。接続を確認してください。",
        NotReadableError: "カメラを開けません。他のアプリで使用中でないか確認してください。",
      };
      if (messages[error.name]) throw new Error(messages[error.name]);
    }
    throw error;
  }
  const tracks = stream.getTracks();
  const stop = () => {
    tracks.forEach((track) => {
      track.removeEventListener("ended", onEnded);
      track.stop();
    });
    if (video.srcObject === stream) video.srcObject = null;
    placeholder.classList.remove("is-hidden");
  };
  tracks.forEach((track) => track.addEventListener("ended", onEnded, { once: true }));
  video.srcObject = stream;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => finish(new Error("カメラ映像の読み込みがタイムアウトしました。")),
        CONNECTION_TIMEOUT,
      );
      function finish(error?: unknown) {
        clearTimeout(timer);
        video.removeEventListener("error", failed);
        if (error) reject(error);
        else resolve();
      }
      function failed() {
        finish(new Error("カメラ映像を読み込めませんでした。"));
      }
      video.addEventListener("error", failed, { once: true });
      video.play().then(() => finish(), finish);
    });
    if (
      !video.videoWidth ||
      !video.videoHeight ||
      tracks.some((track) => track.readyState === "ended")
    ) {
      throw new Error("カメラから有効な映像を取得できませんでした。");
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    frame.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    placeholder.classList.add("is-hidden");
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
