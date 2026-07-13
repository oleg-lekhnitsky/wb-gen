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

## Railway renderer

Railway uses the root `Dockerfile` to build the same Nuxt application with Playwright Chromium and FFmpeg. Configure `/api/local-renderer-health` as the service healthcheck and generate a public Railway domain.

Set the following variable on the Vercel deployment and redeploy it:

```text
NUXT_PUBLIC_RENDERER_ORIGIN=https://your-renderer.up.railway.app
```

The deployed editor tries the local renderer first when explicitly enabled, then the configured Railway renderer. Railway responses send periodic heartbeat frames so long renders stay connected through its public proxy. If Railway is configured but unavailable, the editor reports the connection error instead of retrying a large render through Vercel. The same-origin API remains the fallback only when no remote renderer is configured.
