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

The package is written to `dist/deb/FaceScan-0.1.0-amd64.deb`. Install it with
`sudo apt install ./dist/deb/FaceScan-0.1.0-amd64.deb` from the repository root.

GitHub Actions also builds the package on pushes to `main` and
`ubuntu-gui-check`, on pull requests to `main`, and when started manually.
Download `FaceScan-ubuntu-x64-deb` from the run's **Artifacts** section on the
Actions page. Workflow artifacts are retained for 30 days.

The `.deb` targets Ubuntu 22.04 and 24.04 on x86-64. Run it as a regular
user in a graphical session with a connected camera. Install through `apt` as
shown above so runtime libraries and the Electron sandbox profile are installed.
ARM64 builds are not currently provided.

The desktop package includes Electron, the face model, matching MediaPipe WASM
files, and Japanese/Latin fonts. No runtime downloads are needed. Building the
package downloads the model over HTTPS and verifies its SHA-256 checksum.
The packaged assets are checked against an embedded SHA-256 manifest. The
desktop app blocks external network requests. The browser build still loads
the model and WASM from the network.

Software graphics (including SwiftShader and llvmpipe) start with CPU inference.
Hardware GPU initialization or detection failures fall back to CPU processing.
If camera access fails or the device disconnects, the app releases resources
and offers **再試行**. Permission requests and camera startup time out after
30 seconds.

Actions checks HTTP/HTTPS rejection, unresponsive networking, and cold startup
in a network namespace with only the loopback interface. It checks installation
and offline initialization using a virtual camera and software graphics on
Ubuntu 22.04 and 24.04. Physical cameras, vendor GPU drivers, and Wayland
sessions still need checks on the target machines.

Version 0.1.0 replaces the earlier 0.0.0 packages. Close all running FaceScan
windows before installing the new `.deb`; the window title shows the version.
Runtime assets are included for offline use. Ubuntu system libraries listed in
the package dependencies must already be installed, or be installed via `apt`
while network access is available.
