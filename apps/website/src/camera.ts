type CameraOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onStatus: (message: string) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
};

const cameraConstraints: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

export function startCamera(options: CameraOptions) {
  const { video, canvas, onStatus, onReady, onError } = options;
  let stream: MediaStream | undefined;

  async function open() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("このブラウザではカメラを利用できません。HTTPS または localhost で開いてください。");
      }

      onStatus("カメラに接続中");
      stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
      video.srcObject = stream;
      await new Promise<void>(resolve => { video.onloadedmetadata = () => resolve(); });
      await video.play();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      document.querySelector<HTMLDivElement>("#camera-frame")!.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      document.querySelector<HTMLDivElement>("#camera-placeholder")!.classList.add("is-hidden");
      onStatus("カメラ起動中");
      onReady();
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      onError(error);
    }
  }

  void open();
  return () => stream?.getTracks().forEach(track => track.stop());
}
