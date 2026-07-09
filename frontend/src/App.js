import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import DiaryPage from './pages/DiaryPage';
import ChatPage from './pages/ChatPage';
import CalendarPage from './pages/CalendarPage';
import ConsultPage from './pages/ConsultPage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import PaymentPage from './pages/PaymentPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      {}
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/diary"    element={<DiaryPage />} />
            <Route path="/chat"     element={<ChatPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/consult"  element={<ConsultPage />} />
            <Route path="/profile"    element={<ProfilePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/payment"    element={<PaymentPage />} />
            <Route path="/admin"      element={<AdminPage />} />
            <Route path="*"         element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
