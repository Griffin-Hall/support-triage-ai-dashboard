import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { AISettingsProvider } from './context/AISettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import StatsPage from './pages/StatsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import TicketListPage from './pages/TicketListPage';

const routerBasePath = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL.slice(0, -1)
  : import.meta.env.BASE_URL;

function App() {
  return (
    <BrowserRouter basename={routerBasePath}>
      <ThemeProvider>
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
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
