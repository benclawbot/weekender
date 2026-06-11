import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import SetupPage from './pages/SetupPage'
import SwipePage from './pages/SwipePage'
import BasketPage from './pages/BasketPage'
import BasketDetailPage from './pages/BasketDetailPage'

export default function App() {
  const { dateFrom, deck } = useStore()

  return (
    <BrowserRouter>
      <div className="funky-shell min-h-screen bg-bg flex flex-col text-text">
        <div className="funky-blob funky-blob-one" />
        <div className="funky-blob funky-blob-two" />
        <Routes>
          <Route
            path="/"
            element={dateFrom && deck.length > 0 ? <Navigate to="/swipe" replace /> : <SetupPage />}
          />
          <Route path="/swipe" element={<SwipePage />} />
          <Route path="/basket" element={<BasketPage />} />
          <Route path="/basket/:id" element={<BasketDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
