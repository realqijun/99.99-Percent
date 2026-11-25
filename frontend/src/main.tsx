import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import './index.css'
import App from './App.tsx'

/**
 * Dev only, stripped from builds: `?screen=<fixture>` shows a hand-made run, `?gallery` the art gallery,
 * `?cover` and `?banner` the itch.io key art, and `window.debug` holds console helpers for jumping ahead in a real run.
 */
async function devRoot(): Promise<ReactNode | null> {
  const [{ installDebug }, { gameStore }] = await Promise.all([import('./dev/debug'), import('./game/store')])
  installDebug(gameStore)
  const params = new URLSearchParams(window.location.search)
  if (params.has('gallery')) {
    const { ArtGallery } = await import('./ui/art')
    return <ArtGallery />
  }
  const storeArt = (['cover', 'banner'] as const).find((kind) => params.has(kind))
  if (storeArt) {
    const { StoreArt } = await import('./dev/StoreArt')
    return <StoreArt kind={storeArt} />
  }
  const name = params.get('screen')
  if (name === null) return null
  const { FIXTURES } = await import('./ui/__fixtures__')
  const fixture = FIXTURES[name]
  if (fixture) gameStore.getState().loadFixture(structuredClone(fixture.run))
  else if (name !== 'title') console.warn(`No fixture "${name}". Try: ${Object.keys(FIXTURES).join(', ')}`)
  return null
}

async function start() {
  const root = (import.meta.env.DEV && (await devRoot())) || <App />
  createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)
}

void start()
