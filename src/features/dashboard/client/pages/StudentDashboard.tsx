import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import ChatHistory from '../../components/dashboard/ChatHistory';
import LearningInsights from '../../components/dashboard/LearningInsights';
import PrivacySettings from '../../components/dashboard/PrivacySettings';
import styles from '../../styles/components/dashboard.module.css';

interface StudentDashboardProps {
  userId: string;
  tenantId: string;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ userId, tenantId }) => {
  const navigate = useNavigate();
  const _dispatch = useAppDispatch();
  const [_activeTab, setActiveTab] = useState<'history' | 'insights' | 'privacy'>('history');
  
  // Get user info from Redux store
  const settings = useAppSelector((state) => state.settings);
  const jwt = useAppSelector((state) => state.jwt);
  
  useEffect(() => {
    // Verify user is authenticated
    if (!jwt) {
      navigate('/');
    }
  }, [jwt, navigate]);

  const handleTabChange = (tab: 'history' | 'insights' | 'privacy') => {
    setActiveTab(tab);
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Learning Dashboard</h1>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{settings.user_name || 'Student'}</span>
          <span className={styles.courseName}>{settings.context_title || 'Course'}</span>
        </div>
      </header>

      <nav className={styles.dashboardNav}>
        <NavLink
          to="/dashboard/history"
          className={({ isActive }) =>
            `${styles.navTab} ${isActive ? styles.navTabActive : ''}`
          }
          onClick={() => handleTabChange('history')}
        >
          <span className={styles.navIcon}>💬</span>
          Chat History
        </NavLink>
        <NavLink
          to="/dashboard/insights"
          className={({ isActive }) =>
            `${styles.navTab} ${isActive ? styles.navTabActive : ''}`
          }
          onClick={() => handleTabChange('insights')}
        >
          <span className={styles.navIcon}>📊</span>
          Learning Insights
        </NavLink>
        <NavLink
          to="/dashboard/privacy"
          className={({ isActive }) =>
            `${styles.navTab} ${isActive ? styles.navTabActive : ''}`
          }
          onClick={() => handleTabChange('privacy')}
        >
          <span className={styles.navIcon}>🔒</span>
          Privacy Settings
        </NavLink>
      </nav>

      <main className={styles.dashboardContent}>
        <Routes>
          <Route
            path="history"
            element={
              <ChatHistory
                userId={userId}
                tenantId={tenantId}
              />
            }
          />
          <Route
            path="insights"
            element={
              <LearningInsights
                userId={userId}
                tenantId={tenantId}
              />
            }
          />
          <Route
            path="privacy"
            element={
              <PrivacySettings
                userId={userId}
                tenantId={tenantId}
              />
            }
          />
          <Route
            path="/"
            element={
              <ChatHistory
                userId={userId}
                tenantId={tenantId}
              />
            }
          />
        </Routes>
      </main>

      <footer className={styles.dashboardFooter}>
        <p className={styles.footerText}>
          Your learning data is private and secure. 
          <a href="/help" className={styles.footerLink}>Learn more</a>
        </p>
      </footer>
    </div>
  );
};

export default StudentDashboard;