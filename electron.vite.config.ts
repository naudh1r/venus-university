import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { webpAssets } from './scripts/webpAssets'

// The version the menu prints. Read rather than imported: package.json is
// not in any tsconfig's program, and npm_package_version is unset outside npm.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

// The mod kit (`packages/modkit`) resolves to its source: one copy of each module, whichever path imports it.
const modkit = {
  '@vx/modkit/host': resolve('packages/modkit/src/host'),
  '@vx/modkit/shared': resolve('packages/modkit/src/shared'),
  '@vx/modkit/renderer': resolve('packages/modkit/src/renderer'),
  '@vx/modkit/main': resolve('packages/modkit/src/main')
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Two bundles: the app, and the update helper the app runs in Node mode after it quits.
        input: {
          index: resolve('src/main/index.ts'),
          updateHelper: resolve('src/main/updateHelper.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        ...modkit
      }
    }
  },
  preload: {
    build:{rollupOptions:{input:{index:resolve("src/preload/index.ts"),modSurface:resolve("src/preload/modSurface.ts")}}},
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        ...modkit
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          screenCompanion: resolve('src/renderer/screenCompanion.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        ...modkit
      }
    },
    // Shipped PNG art is emitted as WebP, which is what keeps the packaged renderer small.
    plugins: [webpAssets('desktop'), react()]
  }
})
