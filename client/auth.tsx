/**
 * @fileoverview Authentication entry point for Atomic Guide
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from '../src/features/auth/client/components/LoginForm';
import { SignupForm } from '../src/features/auth/client/components/SignupForm';
import '../src/features/auth/client/styles/auth.css';

function AuthApp(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<LoginForm />} />
        <Route path="/auth/signup" element={<SignupForm />} />
        <Route path="/embed" element={<Navigate to="/auth/login" replace />} />
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Mount the auth app
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AuthApp />
  </React.StrictMode>
);