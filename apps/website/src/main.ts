import "./style.css";

// 1. TS側でHTML構造（videoタグ）を流し込む 📹
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <section>
    <h1>カメラ画面</h1>
    <video id="my-video" autoplay playsinline width="400"></video>
  </section>
`;

// 2. 作成した <video> 要素を取得してカメラをセット 🎥
const video = document.querySelector<HTMLVideoElement>("#my-video")!;

navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => {
    console.error("カメラの起動に失敗しました:", err);
  });
