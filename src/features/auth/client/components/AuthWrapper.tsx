/**
 * @fileoverview Authentication wrapper component
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import React, { useEffect, PropsWithChildren } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthWrapperProps extends PropsWithChildren {
  requireAuth?: boolean;
}

export function AuthWrapper({ children, requireAuth = false }: AuthWrapperProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();

  useEffect(() => {
    // Check session on mount
    checkSession();
  }, []);

  useEffect(() => {
    // Redirect to login if auth is required but user is not authenticated
    if (!isLoading && requireAuth && !isAuthenticated) {
      // Save the attempted location
      const returnUrl = location.pathname + location.search;
      navigate(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [isAuthenticated, isLoading, requireAuth, navigate, location]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (requireAuth && !isAuthenticated) {
    return <></>;
  }

  return <>{children}</>;
}

/**
 * Hook to require authentication for a component
 */
export function useRequireAuth(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [isAuthenticated, isLoading, navigate, location]);
}