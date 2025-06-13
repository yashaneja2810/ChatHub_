import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthForm } from './components/auth/AuthForm';
import { ChatLayout } from './components/chat/ChatLayout';
import { ProfileSetup } from './components/profile/ProfileSetup';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
            <Routes>
      <Route
        path="/"
        element={
          user ? (
            profile?.username ? (
              <ChatLayout />
            ) : (
              <ProfileSetup />
            )
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route
        path="/auth"
        element={
          user ? (
            profile?.username ? (
              <Navigate to="/" replace />
            ) : (
              <ProfileSetup />
            )
          ) : (
            <AuthForm />
          )
        }
      />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
    </Router>
  );
};

export default App;