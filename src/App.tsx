import { Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Honeymoon from './pages/Honeymoon'
import Cleaning from './pages/Cleaning'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/honeymoon" element={<Honeymoon />} />
      <Route path="/cleaning" element={<Cleaning />} />
    </Routes>
  )
}

export default App
