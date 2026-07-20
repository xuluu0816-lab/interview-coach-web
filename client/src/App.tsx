import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import FilesPage from '@/pages/FilesPage';
import InterviewPage from '@/pages/InterviewPage';
import ApplicationsPage from '@/pages/ApplicationsPage';
import JobSearchPage from '@/pages/JobSearchPage';
import LoginPage from '@/pages/LoginPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // MVP: 自动登录或游客模式
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/jobs" element={<JobSearchPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
