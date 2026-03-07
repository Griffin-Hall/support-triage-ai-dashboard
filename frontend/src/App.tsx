import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { AISettingsProvider } from './context/AISettingsContext';
import StatsPage from './pages/StatsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import TicketListPage from './pages/TicketListPage';

function App() {
  return (
    <BrowserRouter>
      <AISettingsProvider>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<TicketListPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="tickets/:id" element={<TicketDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AISettingsProvider>
    </BrowserRouter>
  );
}

export default App;
