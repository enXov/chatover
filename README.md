# ChatOver - YouTube Live Chat Overlay

<p align="center">
  <img src="icons/icon128.png" alt="ChatOver Logo" width="128" />
</p>

A cross-browser extension that overlays YouTube live stream chat directly on top of the video player. Watch your favorite streams with chat visible in any viewing mode!

## Features

- 🎬 **Transparent Chat Overlay** - See chat messages on top of your video
- 🖱️ **Draggable & Resizable** - Position the overlay anywhere you want
- 🎨 **Modern Design** - Sleek glassmorphism UI that looks great
- ⚙️ **Customizable** - Adjust fonts, transparency, and more (coming soon)
- 🌐 **Cross-Browser** - Works on Chrome and Firefox

## Installation

### Development Build

1. Clone the repository:
   ```bash
   git clone https://github.com/enXov/chatover.git
   cd chatover
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select any file in the `dist` folder (e.g., `manifest.json`)

## Usage

1. Go to any YouTube live stream
2. Look for the "ChatOver" button near the chat controls
3. Click to toggle the overlay
4. Drag the header to reposition
5. Click ⚙️ for settings (coming soon)

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
chatover/
├── manifest.json         # Extension manifest (V3)
├── src/
│   ├── background/       # Service worker
│   ├── content/          # YouTube content script
│   └── styles/           # Overlay CSS
├── icons/                # Extension icons
└── dist/                 # Build output
```

## License

MIT License

## Contributing

Contributions are welcome!
