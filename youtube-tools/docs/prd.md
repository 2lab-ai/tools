# YouTube Tools — Product Requirements Document

Chrome extension for YouTube video viewing customization.

## Overview

| Item | Value |
|------|-------|
| Name | YouTube Tools |
| Version | 0.1.0 |
| Platform | Chrome Extension (Manifest V3) |
| Target site | youtube.com |
| Publisher | [2lab.ai](https://2lab.ai) |

## Architecture

```
popup.html/js/css   — Extension popup UI (settings panel)
background.js       — Service worker (keyboard shortcuts, install defaults)
content/resize.js   — Content script injected into YouTube pages
```

Settings are persisted via `chrome.storage.local` and shared across all components via storage change listeners. The content script applies transforms through an injected `<style>` element (not inline styles) to prevent YouTube's own JS from resetting the values.

---

## Tab: VidFit

Video display customization — scale, fit, and offset controls.

### Mode

Segmented control with three options:

| Mode | Behavior | CSS Transform |
|------|----------|---------------|
| **Off** | No modification. Hides Scale/Offset controls. | (none) |
| **Zoom** | Uniform scale from center. Content outside the player is cropped. | `scale(S)` |
| **Stretch** | Horizontal-only scale. Stretches the video wider without changing height. | `scaleX(S)` |

Default: **Zoom**

### Scale

- Slider range: **1.00x — 8.00x** (step 0.01)
- Displayed as `{value}x` label next to the slider

**Aspect ratio presets** (static scale values):

| Button | Scale | Use case |
|--------|-------|----------|
| 16:9 | 1.00 | Default YouTube aspect ratio |
| 18:9 | 1.13 | Tall smartphone display ratio |
| 21:9 | 1.31 | Ultrawide cinematic |
| 24:9 | 1.50 | Super-ultrawide |
| 32:9 | 2.00 | Dual-monitor / Samsung Odyssey |

**Auto-fit presets** (dynamically calculated):

| Button | Calculation | Effect |
|--------|-------------|--------|
| **WideFit** | `window.innerWidth / video.clientWidth` | Scales video width to fill the window horizontally. Top/bottom may be cropped. |
| **TallFit** | `window.innerHeight / video.clientHeight` | Scales video height to fill the window vertically. Left/right may be cropped. |

- Both auto-fit buttons force mode to **Zoom** and reset offset to (0, 0).
- Scale is clamped to `[1.0, 8.0]`.
- On a standard 16:9 screen with a 16:9 video, both calculate 1.00 (already fits).

### Offset

2D drag pad for panning the zoomed video viewport.

- **UI**: 16:9 aspect ratio pad with crosshair grid dividing 4 quadrants. White dot indicates current position.
- **Interaction**: Click or click-and-drag within the pad. Dot follows the pointer.
- **Range**: -50% to +50% on each axis (center = no offset).
- **Direction**: Dragging the dot right shows more of the right side of the video (intuitive viewport panning).
- **Reset button**: Returns offset to (0, 0).
- **Transform**: `translate(-ox%, -oy%)` applied before the scale transform. Sign inversion maps pad position to viewport direction.
- Hidden when mode is Off.

### Fullscreen Only

Toggle checkbox. When enabled (default), transforms are only applied during fullscreen playback. When disabled, transforms apply in the normal player as well.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Up` (Mac) / `Ctrl+Shift+Up` | Zoom in (+0.01) |
| `Cmd+Shift+Down` (Mac) / `Ctrl+Shift+Down` | Zoom out (-0.01) |

Handled by the background service worker. Scale is clamped to `[1.0, 8.0]`.

---

## Fullscreen Overlay

Floating controls injected into `#movie_player` for use during fullscreen when the popup is inaccessible.

- **Position**: Top-right corner (`absolute`, `top: 10px`, `right: 12px`)
- **Visibility**: Pure CSS — shown only when YouTube's player has `ytp-fullscreen` class and hidden when `ytp-autohide` is present. Appears and disappears in sync with YouTube's native controls.
- **Buttons**: WideFit, TallFit (same behavior as popup counterparts)
- **Style**: Semi-transparent glass effect (`backdrop-filter: blur(10px)`, `rgba` backgrounds). Minimal and flat.
- **Interaction safety**: `pointer-events: none` on container when hidden to avoid blocking video clicks.

---

## Tab: Shorts

Placeholder. Coming soon.

---

## Tab: About

Minimal page with a link to [2lab.ai](https://2lab.ai) (opens in new tab).

---

## Technical Details

### Storage Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ytResize_behavior` | `"off" \| "zoom" \| "stretch"` | `"zoom"` | Active mode |
| `ytResize_scale` | `number` | `1.0` | Scale multiplier |
| `ytResize_fullscreenOnly` | `boolean` | `true` | Apply only in fullscreen |
| `ytResize_offsetX` | `number` | `0` | Horizontal offset (-50 to 50) |
| `ytResize_offsetY` | `number` | `0` | Vertical offset (-50 to 50) |

### Transform Application

Transforms are applied via an injected `<style>` element targeting `#movie_player video` with `!important`. This approach is immune to YouTube's periodic inline style resets on the video element.

Final CSS transform (Zoom mode with offset):
```css
#movie_player video {
  transform: translate(-ox%, -oy%) scale(S) !important;
  transform-origin: center center !important;
}
```

### SPA Navigation Handling

YouTube is a single-page application. A `MutationObserver` on `document.body` detects URL changes and re-applies settings + re-attaches the fullscreen overlay after navigation.

### Permissions

- `storage` — persist user settings
