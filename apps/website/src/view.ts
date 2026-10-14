export function renderApp(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="page">
      <header class="topbar"><a class="brand" href="#" aria-label="Face Scan home"><span class="brand-mark">F</span> FACE<span class="brand-light">SCAN</span></a><span class="topbar-note"><span class="live-dot"></span> REAL-TIME ANALYSIS</span></header>
      <section class="intro"><p class="eyebrow">COMPUTER VISION · MEDIAPIPE</p><h1>表情を、<span>読み取る。</span></h1><p class="subhead">複数人の中から画面中央に近い人の表情をリアルタイムで検出します。<br>映像の解析はブラウザ内で行われます。</p></section>
      <section class="workspace" aria-label="表情検出">
        <div class="camera-card"><div class="camera-heading"><div><span class="section-index">01</span><h2>カメラビュー</h2></div><span class="camera-status" id="camera-status"><span class="status-dot"></span>準備中</span></div>
          <div class="camera-frame" id="camera-frame"><video id="camera-video" autoplay playsinline muted></video><canvas id="overlay"></canvas><img id="captured-photo" class="captured-photo" alt="撮影した写真"><div class="countdown-overlay" id="countdown-overlay" aria-live="assertive"></div><div class="frame-corners" aria-hidden="true"></div><div class="camera-placeholder" id="camera-placeholder"><span class="camera-icon">◎</span><span>カメラを起動しています</span></div><div class="face-hint" id="face-hint">カメラに映ると、中央に近い人を選びます</div></div>
          <p class="camera-footnote"><span class="privacy-icon">◈</span> 映像は保存・送信されません</p>
        </div>
        <aside class="result-card"><div class="camera-heading"><div><span class="section-index">02</span><h2>表情の解析</h2></div><span class="model-label">FACE LANDMARKER</span></div>
          <div class="expression-display"><p class="capture-message" id="capture-message" aria-live="polite"></p><div class="expression-icon" id="expression-icon">—</div><p class="expression-caption">現在の表情</p><p class="expression-name" id="expression-name">解析を開始しています</p><p class="expression-description" id="expression-description">カメラを起動しています。少しお待ちください。</p></div>
          <div class="confidence"><div class="confidence-heading"><span>表情スコア</span><span id="confidence-value">—</span></div><div class="meter"><div class="meter-fill" id="confidence-fill"></div></div><p class="confidence-note">顔の動きから推定した目安です</p></div>
          <div class="emotion-list" aria-live="polite"><div class="emotion-row"><span>笑顔</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div><div class="emotion-row"><span>悲しい</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div><div class="emotion-row"><span>驚き</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div><div class="emotion-row"><span>眠そう</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div><div class="emotion-row"><span>怒り</span><div class="mini-meter"><i></i></div><span class="emotion-score">—</span></div></div>
        </aside>
      </section>
      <footer class="footer"><span>FACE SCAN <span class="footer-separator">/</span> IN-BROWSER DEMO</span><span>Powered by MediaPipe</span></footer>
    </main>
  `;
}
