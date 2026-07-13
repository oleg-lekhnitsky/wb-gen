# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Local renderer on macOS

The deployed website can send exact Playwright screenshots and FFmpeg video renders to this computer. Double-click `Start Resizer Renderer.command` in Finder and keep its Terminal window open while rendering. The launcher also works when shared by itself: it downloads the public `oleg-lekhnitsky/wb-gen` `main` branch into `~/Library/Application Support/Resizer Renderer/source` and refreshes that cached copy on later launches.

On its first run, the launcher:

- activates the Node version in `.nvmrc` when nvm is available;
- otherwise installs Node 22 through an existing Homebrew installation;
- installs project packages and Playwright Chromium when missing;
- installs FFmpeg through Homebrew when missing;
- starts the renderer at `http://127.0.0.1:3000` and opens the website.

If Homebrew is not installed and Node 22 or FFmpeg is missing, the launcher stops with instructions instead of modifying the system without a package manager.
