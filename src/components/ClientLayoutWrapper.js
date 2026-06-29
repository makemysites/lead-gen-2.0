'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { 
  LayoutDashboard, 
  Phone, 
  PhoneCall, 
  CalendarClock, 
  Send, 
  XOctagon, 
  Settings, 
  AlertTriangle,
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname();
  const { stats, toasts, countdown } = useApp();

  // Navigation menu configurations
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, badgeKey: 'todayCount' },
    { path: '/to-call', label: 'To Call', icon: Phone, badgeKey: 'toCall' },
    { path: '/called', label: 'Called', icon: PhoneCall, badgeKey: 'called' },
    { path: '/follow-ups', label: 'Follow-Ups', icon: CalendarClock, badgeKey: 'followUp' },
    { path: '/demo-sent', label: 'Demo Sent', icon: Send, badgeKey: 'demoSent' },
    { path: '/rejected', label: 'Rejected', icon: XOctagon, badgeKey: 'rejected' },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  // Helper to resolve title on topbar
  const getPageTitle = () => {
    const matched = navItems.find(item => item.path === pathname);
    return matched ? matched.label : 'Outreach CRM';
  };

  // Helper to format today's local date
  const formatTodayDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate API progress percentage
  const apiCalls = stats.apiUsageToday || 0;
  const apiLimit = stats.apiLimitToday || 60;
  const apiPercentage = Math.min(Math.round((apiCalls / apiLimit) * 100), 100);

  // API progress bar color coding
  const getProgressColorClass = (pct) => {
    if (pct < 60) return 'api-green';
    if (pct < 80) return 'api-yellow';
    if (pct < 90) return 'api-orange';
    return 'api-red';
  };

  return (
    <div className="layout-container">
      {/* Sidebar Navigation (Desktop only) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="M12 6v12M6 12h12"/>
          </svg>
          <span className="logo-text">Dental Outreach</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const badgeValue = item.badgeKey ? stats[item.badgeKey] : 0;

            return (
              <Link href={item.path} key={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-item-left">
                  <item.icon className="nav-item-icon" />
                  <span>{item.label}</span>
                </div>
                {item.badgeKey && badgeValue > 0 && (
                  <span className={`nav-badge ${isActive ? 'active-badge' : ''}`}>
                    {badgeValue}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Navigation bar */}
      <nav className="mobile-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const badgeValue = item.badgeKey ? stats[item.badgeKey] : 0;

          return (
            <Link href={item.path} key={item.path} className={`mobile-nav-item ${isActive ? 'active' : ''}`}>
              <item.icon className="nav-item-icon" />
              <span>{item.label.split(' ')[0]}</span>
              {item.badgeKey && badgeValue > 0 && (
                <span className="mobile-badge">{badgeValue}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Main Container */}
      <div className="main-area">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{getPageTitle()}</h1>
            <p className="topbar-subtitle">Next automatic scrape in {countdown}</p>
          </div>
          <div className="topbar-right">
            {/* Realtime API Usage Progress Meter */}
            <div className="api-progress-container">
              <div className="api-progress-label">
                <span>API Usage</span>
                <span className="font-mono-data">{apiCalls}/{apiLimit}</span>
              </div>
              <div className="api-progress-track">
                <div 
                  className={`api-progress-fill ${getProgressColorClass(apiPercentage)}`} 
                  style={{ width: `${apiPercentage}%` }}
                />
              </div>
            </div>

            <div className="topbar-date">
              <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {formatTodayDate()}
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <main className="content-viewport">
          {/* Strict API limit banner protection (CRITICAL rule #3) */}
          {stats.apiLimitReached && (
            <div className="danger-banner">
              <AlertTriangle size={20} />
              <div>
                <strong>⚠️ Google API daily limit reached ({stats.apiUsageToday}/{stats.apiLimitToday} calls used).</strong>{' '}
                No more automated searches will run today. The scraper will resume tomorrow morning at 7:00 AM IST.
              </div>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Floating Toast Notification Containers */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.type === 'success' && <CheckCircle size={16} style={{ color: '#16A34A' }} />}
            {toast.type === 'warning' && <AlertTriangle size={16} style={{ color: '#D97706' }} />}
            {toast.type === 'error' && <AlertCircle size={16} style={{ color: '#DC2626' }} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
