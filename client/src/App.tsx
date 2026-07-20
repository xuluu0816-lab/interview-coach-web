import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import PrepPage from '@/pages/PrepPage';
import ReviewPage from '@/pages/ReviewPage';
import TrackingPage from '@/pages/TrackingPage';
import JobBoardPage from '@/pages/JobBoardPage';
import LoginPage from '@/pages/LoginPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/prep" element={<PrepPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/track" element={<TrackingPage />} />
          <Route path="/jobs" element={<JobBoardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
