# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

```Shell
bunx --package vite-plus vp run
```

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```

## Ubuntu desktop package

The desktop build wraps the website in Electron. From the website workspace, run:

```bash
cd apps/website
bun run desktop
```

To create an Ubuntu x64 `.deb` package:

```bash
cd apps/website
bun run package:deb
```

The package is written to `dist/deb/FaceScan-0.0.0-amd64.deb`. Install it with
`sudo apt install ./dist/deb/FaceScan-0.0.0-amd64.deb` from the repository root.

GitHub Actions also builds the package on pushes to `main` and
`ubuntu-gui-check`, on pull requests to `main`, and when started manually.
Download `FaceScan-ubuntu-x64-deb` from the run's **Artifacts** section on the
Actions page. Workflow artifacts are retained for 30 days.

The app needs an Ubuntu graphical session and camera permission. MediaPipe's
WASM and face model are fetched from the network when the app starts.
