# Filament

A quiet canvas for brainstorming. Place ideas as boxes or circles and link them point to point.
Everything is stored locally on your device.

## Features

- Free, Boxes and Circles board templates
- Drag, link and pan tools with undo / redo
- Multiple boards, saved automatically in local storage
- Android app built from the same code

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` / `L` / `H` | Select / Link / Pan tool |
| `N` or `A` | New idea |
| `F` | Fit board to screen |
| `1` `2` `3` | Free / Boxes / Circles template |
| `Space` (hold) | Temporary pan |
| `Delete` | Delete selection |
| `Ctrl/Cmd + Z`, `Shift + Z` / `Y` | Undo / redo |

## Develop

Requires Node.js 22+.

```bash
npm install
npm run dev
```

## Android APK

Every push to `main` runs `.github/workflows/build-release.yml`, which builds the web app,
wraps it with [Capacitor](https://capacitorjs.com), builds a signed release APK and publishes it
to the repository's **Releases** page as `v1.0.<run number>`.

### Stable signing (recommended)

Without signing secrets the workflow signs with a throwaway key, so each build can only be
installed fresh (not as an update). To keep one identity, create a keystore once:

```bash
keytool -genkeypair -v -keystore release.keystore -alias filament \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore   # macOS: base64 -i release.keystore
```

Then add these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `KEYSTORE_BASE64` | the base64 output above |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `filament` (or your alias) |
| `KEY_PASSWORD` | key password (defaults to keystore password) |

Keep `release.keystore` out of the repo (it is git-ignored) and back it up somewhere safe.

### Build locally

```bash
npm install
npm run build
npx cap add android   # first time only
npx cap sync android
cd android && ./gradlew assembleRelease
```
