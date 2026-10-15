export function renderApp(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="booth">
      <header class="status-bar">
        <span class="status-label"><span class="live-dot"></span> FACE SCAN</span>
          <span class="camera-status" id="camera-status"><span class="status-dot"></span>READY</span>
      </header>

      <section class="scanner" aria-label="表情スキャン">
        <div class="camera-frame" id="camera-frame">
          <video id="camera-video" autoplay playsinline muted></video>
          <canvas id="overlay"></canvas>
          <img id="captured-photo" class="captured-photo" alt="撮影した顔写真">
          <div class="scan-grid" aria-hidden="true"></div>
          <div class="countdown-overlay" id="countdown-overlay" aria-live="assertive"></div>
          <div class="camera-placeholder" id="camera-placeholder">
            <span class="camera-icon">◎</span>
            <span>STARTING CAMERA</span>
          </div>
          <div class="face-hint" id="face-hint">LOOK AT CAMERA</div>
          <div class="camera-tag"><span class="live-dot"></span><span id="focus-status">注目する人を確認中</span></div>
        </div>

        <section class="result-panel" aria-live="polite">
          <p class="capture-message" id="capture-message"></p>
          <div class="expression-icon" id="expression-icon">◎</div>
          <p class="expression-name" id="expression-name">判定中</p>
          <p class="expression-description" id="expression-description">カメラに顔を向けてください</p>
          <div class="confidence">
            <div class="confidence-heading"><span>SCORE</span><span id="confidence-value">—</span></div>
            <div class="meter"><div class="meter-fill" id="confidence-fill"></div></div>
          </div>
          <div class="emotion-list">
            <div class="emotion-row"><span>笑顔</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div>
            <div class="emotion-row"><span>悲しい</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div>
            <div class="emotion-row"><span>驚き</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div>
            <div class="emotion-row"><span>眠そう</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div>
            <div class="emotion-row"><span>怒り</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div>
          </div>
          <p class="privacy-note">ON DEVICE · NOT SAVED</p>
        </section>
      </section>
    </main>
  `;
}
