import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { RoleSelection } from './pages/RoleSelection';
import { HouseholdHome } from './pages/HouseholdHome';
import { KabadiwalaHome } from './pages/KabadiwalaHome';
import { Toaster } from './components/ui/Toaster';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!userProfile) {
    return <Navigate to="/role-selection" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { currentUser, userProfile } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
      <Route path="/role-selection" element={
        currentUser && !userProfile ? <RoleSelection /> : <Navigate to="/" />
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          {userProfile?.role === 'household' ? <HouseholdHome /> : <KabadiwalaHome />}
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
