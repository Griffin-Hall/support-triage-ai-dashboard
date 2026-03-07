import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { AISettingsProvider } from './context/AISettingsContext';
import StatsPage from './pages/StatsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import TicketListPage from './pages/TicketListPage';

const GITHUB_PAGES_BASE_PATH = '/support-triage-ai-dashboard';

function resolveRouterBasePath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname.startsWith(GITHUB_PAGES_BASE_PATH) ? GITHUB_PAGES_BASE_PATH : '/';
}

function App() {
  const basePath = resolveRouterBasePath();

  return (
    <BrowserRouter basename={basePath}>
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
