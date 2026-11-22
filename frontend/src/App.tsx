import { useGame } from './game/store'
import { Toast } from './ui/controls'
import { Game } from './ui/Game'
import { Title } from './ui/screens/Title'
import { StageScaler } from './ui/StageScaler'
import './ui/ui.css'

export default function App() {
  const view = useGame((s) => s.view)
  const run = useGame((s) => s.run)
  return (
    <StageScaler>
      {view === 'game' && run ? <Game run={run} /> : <Title />}
      <Toast />
    </StageScaler>
  )
}
