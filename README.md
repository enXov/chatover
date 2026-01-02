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

## What This Extension Solves

YouTube's live streaming experience has several frustrating limitations that ChatOver addresses:

### 🎯 **No Customization for Viewers**
Many popular streamers embed chat overlays directly into their stream video (using OBS or similar tools), but this means **you** can't customize it. You're stuck with:
- The streamer's chosen position and size
- Their selected transparency and font settings
- No ability to move it out of your way
- No control over which messages you want to see

**ChatOver gives YOU control** - position, resize, and customize the chat exactly how you want it, regardless of what the streamer does.

### 💥 **YouTube Chat Performance Issues**
YouTube's native chat has serious performance problems, especially during long live streams:
- **Freezing & Lag**: In streams with active chat, the chat tab becomes increasingly sluggish over time
- **Browser Crashes**: Very long streams with thousands of messages can cause the entire tab to crash
- **Memory Leaks**: The native chat implementation doesn't efficiently clean up old messages, consuming more RAM as the stream continues
- **Stuttering**: Scrolling through chat history often results in janky, stuttering performance

**ChatOver is lightweight and efficient** - it only keeps a configurable number of recent messages in memory, preventing performance degradation even during marathon streams.

### 📺 **Terrible Fullscreen Experience**
YouTube's fullscreen mode with chat is not actually fullscreen:
- The video stays on the left side
- A huge empty/chat area takes up the right side
- You can't use the full screen for video
- It's a "split-screen" mode, not true fullscreen

**ChatOver lets you have true fullscreen** - the video takes up your entire screen, and chat floats transparently on top wherever you want it.

### 👁️ **Can't Watch Video AND See Chat**
With YouTube's default layout, you have to choose:
- Fullscreen mode = no chat visible
- Chat visible = smaller video in theater or normal mode
- No way to have both at the same time

**ChatOver solves this** - you get both! Watch in fullscreen (or any mode) with chat visible as a transparent overlay.

### 🎭 **Limited Viewing Options**
YouTube's chat is stuck in a fixed sidebar position. You can't:
- Move it to the top, bottom, or corners of the video
- Resize it to be larger or smaller
- Make it semi-transparent to see video content behind it
- Minimize it when you want to focus

**ChatOver is fully draggable, resizable, and customizable** - make it work for YOUR viewing style.

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
