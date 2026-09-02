#!/usr/bin/env node
/**
 * netcheck-cli
 * A small, dependency-free internet speed test for Node.js.
 * Uses Cloudflare's public network-test endpoints, same as the browser version.
 *
 * Requires Node 18+ (needs the built-in `fetch` and `crypto` APIs).
 * Run with: node speedtest.js
 */

const { performance } = require('node:perf_hooks');
const crypto = require('node:crypto');

const CF_DOWN = (bytes) => `https://speed.cloudflare.com/__down?bytes=${bytes}&cb=${Math.random()}`;
const CF_UP = 'https://speed.cloudflare.com/__up';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mbps(bytes, ms) {
  return (bytes * 8) / (ms / 1000) / 1e6;
}

// ---- ping ----
async function measurePing(n = 8) {
  const times = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    await fetch(CF_DOWN(0), { cache: 'no-store' });
    times.push(performance.now() - start);
    process.stdout.write('.');
    await sleep(60);
  }
  process.stdout.write('\n');

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  let jitterSum = 0;
  for (let i = 1; i < times.length; i++) jitterSum += Math.abs(times[i] - times[i - 1]);
  const jitter = jitterSum / (times.length - 1);
  return { latency: median, jitter };
}

// ---- download ----
async function measureDownload(sizes, onProgress) {
  let totalBytes = 0;
  let totalTime = 0;

  for (const size of sizes) {
    const start = performance.now();
    const res = await fetch(CF_DOWN(size), { cache: 'no-store' });
    const reader = res.body.getReader();

    let lastT = start;
    let windowBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      windowBytes += value.length;
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 200) {
        onProgress(mbps(windowBytes, dt));
        lastT = now;
        windowBytes = 0;
      }
    }

    const elapsed = performance.now() - start;
    totalBytes += size;
    totalTime += elapsed;
  }

  return mbps(totalBytes, totalTime);
}

// ---- upload ----
async function measureUpload(sizes, onProgress) {
  let totalBytes = 0;
  let totalTime = 0;

  for (const size of sizes) {
    const data = crypto.randomBytes(size);
    const start = performance.now();
    await fetch(CF_UP, { method: 'POST', body: data });
    const elapsed = performance.now() - start;
    totalBytes += size;
    totalTime += elapsed;
    onProgress(mbps(size, elapsed));
  }

  return mbps(totalBytes, totalTime);
}

// ---- runner ----
function fmt(n) {
  return n.toFixed(1);
}

async function main() {
  console.log('netcheck-cli — a plain speed test\n');

  try {
    process.stdout.write('Pinging       ');
    const { latency, jitter } = await measurePing();
    console.log(`Ping:      ${latency.toFixed(0)} ms   (jitter ${jitter.toFixed(0)} ms)\n`);

    process.stdout.write('Downloading... ');
    const down = await measureDownload([5_000_000, 25_000_000], (live) => {
      process.stdout.write(`\rDownloading... ${fmt(live)} Mbps   `);
    });
    console.log(`\rDownload:  ${fmt(down)} Mbps          \n`);

    process.stdout.write('Uploading...   ');
    const up = await measureUpload([2_000_000, 8_000_000], (live) => {
      process.stdout.write(`\rUploading...   ${fmt(live)} Mbps   `);
    });
    console.log(`\rUpload:    ${fmt(up)} Mbps          \n`);

    console.log('Done. These are estimates — actual speed varies with server load,');
    console.log('distance to Cloudflare, and anything else sharing your connection.');
  } catch (err) {
    console.error('\nCould not complete the test:', err.message);
    process.exitCode = 1;
  }
}

main();