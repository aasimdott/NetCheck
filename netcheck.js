(function()
 {
  const CF_DOWN = (bytes) => `https://speed.cloudflare.com/__down?bytes=${bytes}&cb=${Math.random()}`;
  const CF_UP = 'https://speed.cloudflare.com/__up';

  const startBtn = document.getElementById('startBtn');
  const statusEl = document.getElementById('status');
  const bigNumber = document.getElementById('bigNumber');
  const bigUnit = document.getElementById('bigUnit');
  const pingVal = document.getElementById('pingVal');
  const downVal = document.getElementById('downVal');
  const upVal = document.getElementById('upVal');
  const errorNote = document.getElementById('errorNote');
  const canvas = document.getElementById('trace');
  const ctx = canvas.getContext('2d');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let running = false;
  let level = 0.05; // 0..1, current trace amplitude target
  const SAMPLE_COUNT = 140;
  let samples = new Array(SAMPLE_COUNT).fill(0.05);

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function setStatus(text){ statusEl.textContent = text; }
  function setBig(value, unit){
    bigNumber.textContent = value;
    bigUnit.textContent = unit;
  }
  function resetStats(){
    pingVal.textContent = '--';
    downVal.textContent = '--';
    upVal.textContent = '--';
    errorNote.style.display = 'none';
    setBig('--', 'Mbps down');
  }

  // ---- trace animation ----
  function drawTrace(){
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(232,237,236,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#FF8A3D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = w / (SAMPLE_COUNT - 1);
    samples.forEach((s, i) => {
      const x = i * step;
      const y = h / 2 - s * (h / 2 - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function tick(){
    const noise = reduceMotion ? 0 : (Math.random() - 0.5) * 0.05;
    const next = clamp(level + noise, 0, 1);
    samples.push(next);
    samples.shift();
    drawTrace();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- measurements ----
  async function measurePing(n = 8){
    const times = [];
    for (let i = 0; i < n; i++){
      const start = performance.now();
      await fetch(CF_DOWN(0), { cache: 'no-store', mode: 'cors' });
      times.push(performance.now() - start);
      level = 0.15;
      await sleep(60);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    let jitterSum = 0;
    for (let i = 1; i < times.length; i++) jitterSum += Math.abs(times[i] - times[i - 1]);
    const jitter = jitterSum / (times.length - 1);
    return { latency: median, jitter };
  }

  async function measureDownload(sizes, onProgress){
    let totalBytes = 0, totalTime = 0;
    for (const size of sizes){
      const start = performance.now();
      const res = await fetch(CF_DOWN(size), { cache: 'no-store', mode: 'cors' });
      const reader = res.body.getReader();
      let lastT = start;
      let windowBytes = 0;
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        windowBytes += value.length;
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 80){
          const instMbps = (windowBytes * 8) / (dt / 1000) / 1e6;
          onProgress(instMbps);
          lastT = now;
          windowBytes = 0;
        }
      }
      const elapsed = performance.now() - start;
      totalBytes += size;
      totalTime += elapsed;
    }
    return (totalBytes * 8) / (totalTime / 1000) / 1e6;
  }

  async function measureUpload(sizes, onProgress){
    let totalBytes = 0, totalTime = 0;
    for (const size of sizes){
      const data = new Uint8Array(size);
      for (let offset = 0; offset < size; offset += 65536){
        const end = Math.min(offset + 65536, size);
        crypto.getRandomValues(data.subarray(offset, end));
      }
      const start = performance.now();
      await fetch(CF_UP, { method: 'POST', body: data, mode: 'cors' });
      const elapsed = performance.now() - start;
      totalBytes += size;
      totalTime += elapsed;
      onProgress((size * 8) / (elapsed / 1000) / 1e6);
    }
    return (totalBytes * 8) / (totalTime / 1000) / 1e6;
  }

  async function runTest(){
    if (running) return;
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Testing…';
    resetStats();

    try {
      setStatus('Checking latency…');
      const { latency, jitter } = await measurePing();
      pingVal.textContent = `${latency.toFixed(0)} ms`;
      setBig(latency.toFixed(0), `ms ping · jitter ${jitter.toFixed(0)}ms`);

      setStatus('Measuring download…');
      const down = await measureDownload([5_000_000, 25_000_000], (mbps) => {
        level = clamp(mbps / 300, 0.05, 1);
        setBig(mbps.toFixed(0), 'Mbps down');
      });
      downVal.textContent = `${down.toFixed(1)} Mbps`;
      setBig(down.toFixed(1), 'Mbps down');

      setStatus('Measuring upload…');
      const up = await measureUpload([2_000_000, 8_000_000], (mbps) => {
        level = clamp(mbps / 300, 0.05, 1);
        setBig(mbps.toFixed(0), 'Mbps up');
      });
      upVal.textContent = `${up.toFixed(1)} Mbps`;
      setBig(up.toFixed(1), 'Mbps up');

      setStatus('Done — numbers above are your estimate.');
    } catch (err){
      console.error(err);
      setStatus("Couldn't finish the test.");
      errorNote.style.display = 'block';
    } finally {
      running = false;
      level = 0.05;
      startBtn.disabled = false;
      startBtn.textContent = 'Test again';
    }
  }

  startBtn.addEventListener('click', runTest);
 }
)();