# netcheck

A small, self-contained internet speed test you can host yourself. No backend,
no build step, no dependencies — one HTML file with plain JavaScript.

## What it measures

- **Ping** — median round-trip time across 8 requests, plus jitter
- **Download** — streams a 5MB then 25MB payload and reports throughput in Mbps
- **Upload** — POSTs 2MB then 8MB of random data and times the round trip

The live number and the animated trace update in real time while a test is
running, not just at the end.

## How it works

It uses Cloudflare's public network-test endpoints (`speed.cloudflare.com/__down`
and `__up`) as the source/destination for traffic — the same ones behind tools
like the `@cloudflare/speedtest` npm package. Your browser does all the timing
and math (`bytes ÷ time × 8 = Mbps`) with `fetch`, `performance.now()`, and
`ReadableStream`. There's no server component to run or maintain.

## Running it locally

Just open `index.html` in a browser. That's it.

## Hosting it on GitHub Pages

1. Push this repo to GitHub (make sure the speed test file is named `index.html`).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment," set **Source** to "Deploy from a branch,"
   choose your branch (usually `main`) and the root folder, then save.
4. GitHub will publish it at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

If you want it at the root of your GitHub profile site instead of a subpath,
name the repo exactly `<your-username>.github.io`.

## Notes on accuracy

These numbers are estimates. Real-world throughput depends on server load,
distance to Cloudflare's nearest edge, and anything else sharing your network
at the time. Treat results as a reasonable ballpark, not a lab measurement.

## License

Use it, modify it, host it — no restrictions.