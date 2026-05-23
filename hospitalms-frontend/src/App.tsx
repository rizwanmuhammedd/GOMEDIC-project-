import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProfilePage from './pages/ProfilePage';
import DoctorSchedulePage from './pages/DoctorSchedulePage';
import DoctorDashboard from './components/dashboard/DoctorDashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import {
  PatientDashboard,
  PharmacistDashboard,
  ReceptionistDashboard,
  LabTechDashboard,
} from './components/dashboard/OtherDashboards';
import { LoadingSpinner } from './components/ui';
import type { Role } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { EnquiryChat } from './components/chat/EnquiryChat';

const GOOGLE_CLIENT_ID = "104772244409-p0oo36ksq9fv90q2msniar58sieafigq.apps.googleusercontent.com";

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading GOMEDIC…" />
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  
  const dashboards: Record<Role, React.ReactNode> = {
    Patient: <PatientDashboard />,
    Doctor: <DoctorDashboard />,
    Admin: <AdminDashboard />,
    Pharmacist: <PharmacistDashboard />,
    LabTechnician: <Navigate to="/" replace />,
    Receptionist: <ReceptionistDashboard />,
  };
  
  return <>{dashboards[user.role]}</>;
};

import { Outlet } from 'react-router-dom';

const AuthenticatedLayout: React.FC = () => {
  return (
    <PrivateRoute>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </PrivateRoute>
  );
};

const AppContent = () => {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes sharing the same Layout instance */}
      <Route element={<AuthenticatedLayout />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/appointments" element={<DashboardRouter />} />
        <Route path="/bills" element={<DashboardRouter />} />
        <Route path="/billing" element={<DashboardRouter />} />
        <Route path="/admissions" element={<DashboardRouter />} />
        <Route path="/prescriptions" element={<DashboardRouter />} />
        <Route path="/medicines" element={<DashboardRouter />} />
        <Route path="/staff" element={<DashboardRouter />} />
        <Route path="/pharmacy" element={<DashboardRouter />} />
        <Route path="/beds" element={<DashboardRouter />} />
        <Route path="/analytics" element={<DashboardRouter />} />
        <Route 
          path="/schedule" 
          element={user?.role === 'Receptionist' ? <DashboardRouter /> : <DoctorSchedulePage />} 
        />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <NotificationProvider>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AppContent />
          </GoogleOAuthProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
