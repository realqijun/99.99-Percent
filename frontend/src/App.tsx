import { CONTENT } from './content'
import type { Content } from './engine/types'
import { useGame } from './game/store'
import { ContentContext } from './ui/content'
import { Toast } from './ui/controls'
import { Game } from './ui/Game'
import { Title } from './ui/screens/Title'
import { StageScaler } from './ui/StageScaler'
import './ui/ui.css'

export default function App({ content = CONTENT }: { content?: Content }) {
  const view = useGame((s) => s.view)
  const run = useGame((s) => s.run)
  return (
    <ContentContext.Provider value={content}>
      <StageScaler>
        {view === 'game' && run ? <Game run={run} /> : <Title />}
        <Toast />
      </StageScaler>
    </ContentContext.Provider>
  )
}
