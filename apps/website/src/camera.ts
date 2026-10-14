type CameraOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  frame: HTMLDivElement;
  placeholder: HTMLDivElement;
};

const cameraConstraints: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

export async function startCamera({ video, canvas, frame, placeholder }: CameraOptions) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザではカメラを利用できません。HTTPS または localhost で開いてください。");
  }

  const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
  video.srcObject = stream;

  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("カメラ映像を読み込めませんでした。"));
      });
    }
    await video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    frame.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    placeholder.classList.add("is-hidden");
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    throw error;
  }

  return () => {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  };
}
