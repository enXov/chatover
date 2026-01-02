# ChatOver - YouTube Live Chat Overlay

<p align="center">
  <img src="icons/icon128.png" alt="ChatOver Logo" width="128" />
</p>

<p align="center">
  <img src="assets/showcase.gif" alt="ChatOver Showcase" width="100%" />
</p>

<p align="center">
  A cross-browser extension that overlays YouTube live stream chat directly on top of the video player.<br/>
  Watch your favorite streams with chat visible in any viewing mode!
</p>

## Download

<p align="center">
  <a href="#">
    <img src="https://img.shields.io/badge/Chrome-Download-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
  </a>
  &nbsp;&nbsp;
  <a href="#">
    <img src="https://img.shields.io/badge/Firefox-Download-FF7139?style=for-the-badge&logo=firefox&logoColor=white" alt="Firefox Add-ons" />
  </a>
</p>

## Features

- 🎬 **Chat Overlay** - See chat messages on top of your video
- 🖱️ **Draggable & Resizable** - Position the overlay anywhere you want
- 🎨 **Modern Design** - Sleek UI that looks great
- ⚙️ **Customizable** - Adjust fonts, transparency, and much more
- 🌐 **Cross-Browser** - Works on Chrome and Firefox

## Installation (Development)

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

## Developer FAQ

### Why do you use a third-party library like [youtube.js](https://github.com/LuanRT/YouTube.js)?

YouTube's live chat can only be accessed through the DOM when the chat panel is open. If a user closes or minimizes the live chat panel, there is no reliable way to fetch chat messages directly from the page. By using [youtube.js](https://github.com/LuanRT/YouTube.js), we can connect to YouTube's InnerTube API and receive chat messages independently—regardless of whether the user has the chat panel open or closed.

### Why are there no specific error messages or detailed error handling?

The [youtube.js](https://github.com/LuanRT/YouTube.js) library is an unofficial client for YouTube's private API, so it doesn't cover all edge cases or provide comprehensive error types. We've done our best to handle common scenarios gracefully. If this extension gains popularity, we'd love to contribute improvements back to youtube.js. Thanks to the youtube.js team for making this project possible! ❤️

## License

MIT License

## Contributing

Contributions are welcome!
