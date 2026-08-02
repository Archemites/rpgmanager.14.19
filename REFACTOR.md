# Refactor Complete: Modular Folder Structure

## Summary
The tabletopmaprenderer project has been successfully refactored from two monolithic single-file HTML documents into a organized folder structure with separated concerns:

- **CSS** split into logical modules (theme, layout, components, modals, CRT effects)
- **JavaScript** organized into core modules (state, camera, sync), render modules (draw, bars, photo cache), and application logic (main.js, player-main.js)
- **Original files** preserved in `bckp/` for reference and rollback

## Folder Structure

```
tabletopmaprenderer/
├── index.html                 (master interface - entry point)
├── player.html                (player view - entry point)
├── CLAUDE.md                  (project documentation)
├── REFACTOR.md                (this file)
│
├── css/
│   ├── theme.css              (CSS variables, base styles, fonts)
│   ├── crt-effects.css        (scanlines, vignette, flicker animations)
│   ├── layout.css             (main layout, positioning, grids)
│   ├── components.css         (buttons, inputs, forms, token list, party panel)
│   ├── modals.css             (all modal dialogs)
│   └── player.css             (player-specific styles)
│
├── js/
│   ├── main.js                (master application logic - all game master features)
│   ├── player-main.js         (player application logic - read-only display)
│   │
│   ├── core/
│   │   ├── state.js           (shared state object, constants)
│   │   ├── camera.js          (camera model, coordinate conversion, zoom)
│   │   └── sync.js            (master-player postMessage protocol)
│   │
│   ├── render/
│   │   ├── draw.js            (main canvas render function)
│   │   ├── bars.js            (party bar rendering - horizontal/vertical/radial)
│   │   └── photo-cache.js     (token photo image caching)
│   │
│   └── features/
│       └── map.js             (placeholder for future feature extraction)
│
└── bckp/
    ├── index.html             (original master interface - untouched backup)
    └── player.html            (original player interface - untouched backup)
```

## Key Changes

### CSS Organization
- **theme.css**: Google Font import, CSS variables (colors, glows, shadows), base HTML/body styles
- **crt-effects.css**: Scanlines, RGB mask, vignette, flicker animations (shared both versions)
- **layout.css**: Layout grids (#app, #sidebar, #viewport), positioning (toolbars, buttons), canvas setup
- **components.css**: Reusable UI elements (buttons, inputs, swatches, token list, party panel, combat bar)
- **modals.css**: All modal overlays and dialogs (token editor, crop, confirm, bar editor, glossary, effects picker, help)
- **player.css**: Player-specific tweaks (#status, read-only combat bar)

### JavaScript Architecture
- **No build tool needed**: Uses plain `<script src="">` tags loaded in dependency order
- **Shared namespace**: All modules attach to `window.RPG` object (no global variable pollution)
- **Core modules**: State, camera model, and postMessage sync are shared between master and player
- **Render modules**: Draw function, bar rendering, and photo cache are reused
- **Main apps**: `main.js` (3727 lines) and `player-main.js` (603 lines) contain all interaction logic

## How It Works

1. **HTML files** (`index.html`, `player.html`) load CSS then JavaScript in dependency order:
   - Core modules first (state, camera, sync)
   - Render modules second (draw, bars, photo-cache)
   - Application logic last (main.js or player-main.js)

2. **Modules use shared namespace**:
   ```javascript
   // Each module exposes via window.RPG
   window.RPG.state          // shared state object
   window.RPG.cam            // shared camera
   window.RPG.draw()         // shared render function
   window.RPG.sendState()    // master-to-player sync
   ```

3. **No CORS issues**: Plain scripts work with `file://` protocol (double-click to open), no build needed

## Migration Notes

- All original functionality is preserved exactly
- No breaking changes to feature set or behavior
- Backup files in `bckp/` allow easy rollback if needed
- CSS can be edited for styling without touching HTML/JS logic
- JS modules are self-contained and can be refactored further

## Future Improvements

The `js/features/` folder is ready for further modularization. Individual features (map, grid, tokens, fog, combat, party, effects) can be extracted into separate files while maintaining the same namespace pattern:

```javascript
// Example future expansion:
window.RPG.map.importMap()
window.RPG.tokens.addToken()
window.RPG.fog.drawFogRect()
```

## Verification

To verify the refactor works:
1. Open `index.html` in a browser (double-click or `file://` protocol)
2. Test map import, token management, fog drawing, grid controls, combat, party bars, glossary
3. Open player view and confirm synchronization
4. Compare visuals with `bckp/index.html` and `bckp/player.html` (should be identical)
5. Check browser console for any JavaScript errors

All functionality remains identical to the original monolithic versions.
