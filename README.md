# Spotify Widget

Spotify Widget is an open-source desktop widget for Windows that shows your currently playing Spotify track in a clean, always-accessible floating card.

## Features

- Real-time now playing track info (title, artist, album art)
- Multiple widget styles and size presets
- Progress bar and remaining time display
- Drag-and-drop widget placement with position memory
- Optional auto-start with Windows
- Tray menu controls
- In-app version page with update check/download flow

## Tech Stack

- Electron
- React
- TypeScript
- Vite

## Open Source Setup (Development)

### Requirements

- Node.js 18+ (LTS recommended)
- npm
- Windows (for full Electron widget behavior)

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Run Electron app locally

```bash
npm run start
```

### Build renderer + Electron

```bash
npm run build
npm run build:electron
```

## Application Installation (End Users)

1. Go to the GitHub Releases page:
   - `https://github.com/kroxlycode/spotify-widget/releases`
2. Download the latest installer:
   - `Spotify-Widget-Setup-x.x.x.exe`
3. Run the installer and complete setup.
4. Launch the app and connect your Spotify account from the **Connect** page.

## First Release Workflow

1. Ensure installer exists:
   - `dist/Spotify-Widget-Setup-1.0.2.exe`
2. Commit and tag:
   - `git add .`
   - `git commit -m "chore: initial public release v1.0.2"`
   - `git tag v1.0.2`
3. Push:
   - `git push origin main`
   - `git push origin v1.0.2`
4. Create a GitHub Release with tag `v1.0.2`.
5. Upload installer asset:
   - `dist/Spotify-Widget-Setup-1.0.2.exe`

## License

This project is licensed under the MIT License. See `LICENSE`.

## Sponsor

If this project helps you, you can support development via GitHub Sponsors:

- `https://github.com/sponsors/kroxlycode`
