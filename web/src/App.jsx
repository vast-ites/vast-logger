import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Infrastructure from './pages/Infrastructure';
import Network from './pages/Network';
import Security from './pages/Security';
import Settings from './pages/Settings';

import Login from './pages/Login';

import { HostProvider } from './contexts/HostContext';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <HostProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<Layout />}>
            <Route
              index
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="logs"
              element={
                <PrivateRoute>
                  <Logs />
                </PrivateRoute>
              }
            />
            <Route
              path="infrastructure"
              element={
                <PrivateRoute>
                  <Infrastructure />
                </PrivateRoute>
              }
            />
            <Route
              path="network"
              element={
                <PrivateRoute>
                  <Network />
                </PrivateRoute>
              }
            />
            <Route
              path="security"
              element={
                <PrivateRoute>
                  <Security />
                </PrivateRoute>
              }
            />
            <Route
              path="settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </HostProvider>
  );
}

export default App;
