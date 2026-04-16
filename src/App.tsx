import { Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Honeymoon from './pages/Honeymoon'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/honeymoon" element={<Honeymoon />} />
    </Routes>
  )
}

export default App
