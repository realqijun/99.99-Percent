import { StrictMode, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import './index.css'
import App from './App.tsx'

/** Dev only, stripped from builds: `?screen=<fixture>` shows a hand-made run, `?gallery` the art gallery. */
async function devRoot(): Promise<ReactNode | null> {
  const params = new URLSearchParams(window.location.search)
  if (params.has('gallery')) {
    const art = (await import('./ui/art')) as Record<string, unknown>
    const Gallery = art.ArtGallery as ComponentType | undefined
    return Gallery ? <Gallery /> : <p>The art module has no ArtGallery yet.</p>
  }
  const name = params.get('screen')
  if (name === null) return null
  const [{ FIXTURES, FIXTURE_CONTENT }, { gameStore }] = await Promise.all([import('./ui/__fixtures__'), import('./game/store')])
  const fixture = FIXTURES[name]
  if (fixture) gameStore.getState().loadFixture(structuredClone(fixture.run), fixture.trail)
  else if (name && name !== 'title') console.warn(`No fixture "${name}". Try: ${Object.keys(FIXTURES).join(', ')}`)
  return <App content={FIXTURE_CONTENT} />
}

async function start() {
  const root = (import.meta.env.DEV && (await devRoot())) || <App />
  createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)
}

void start()
