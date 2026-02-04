import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Security from './pages/Security';
import Settings from './pages/Settings';

import Login from './pages/Login';

import { Servers } from './pages/Servers';
import { CpuPage } from './pages/Cpu';
import { MemoryPage } from './pages/Memory';
import { Storage } from './pages/Storage';
import { NetworkPage } from './pages/Network';
import { Alerts } from './pages/Alerts';

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
              path="services"
              element={
                <PrivateRoute>
                  <Services />
                </PrivateRoute>
              }
            />
            <Route
              path="services/:serviceName"
              element={
                <PrivateRoute>
                  <ServiceDetail />
                </PrivateRoute>
              }
            />

            {/* Infrastructure Routes */}
            <Route path="infrastructure">
              <Route
                index
                element={
                  <PrivateRoute>
                    <Servers />
                  </PrivateRoute>
                }
              />
              <Route
                path="cpu"
                element={
                  <PrivateRoute>
                    <CpuPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="memory"
                element={
                  <PrivateRoute>
                    <MemoryPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="storage"
                element={
                  <PrivateRoute>
                    <Storage />
                  </PrivateRoute>
                }
              />
              <Route
                path="network"
                element={
                  <PrivateRoute>
                    <NetworkPage />
                  </PrivateRoute>
                }
              />
            </Route>

            <Route
              path="security"
              element={
                <PrivateRoute>
                  <Security />
                </PrivateRoute>
              }
            />
            <Route
              path="alerts"
              element={
                <PrivateRoute>
                  <Alerts />
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
