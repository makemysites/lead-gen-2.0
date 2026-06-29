'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [stats, setStats] = useState({
    total: 0,
    toCall: 0,
    called: 0,
    followUp: 0,
    demoSent: 0,
    rejected: 0,
    todayCount: 0,
    apiUsageToday: 0,
    apiLimitToday: 60,
    apiLimitReached: false
  });
  
  const [todayRun, setTodayRun] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [countdown, setCountdown] = useState('...');

  // Adds a toast notification
  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper to fetch statistics & today's status from the backend APIs
  const fetchStats = async () => {
    try {
      const resStats = await fetch('/api/stats');
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }
      
      const resScrape = await fetch('/api/scrape/status');
      if (resScrape.ok) {
        const data = await resScrape.json();
        setTodayRun(data.todayRun);
      }
    } catch (error) {
      console.error('Error fetching statistics in context:', error);
    }
  };

  // Setup live countdown to 7:00 AM IST
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      // UTC timezone offset + 5.5 hours for IST
      const istOffset = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + istOffset);
      
      let targetIST = new Date(nowIST);
      targetIST.setHours(7, 0, 0, 0);
      
      // If 7 AM IST has already passed today, target tomorrow
      if (nowIST >= targetIST) {
        targetIST.setDate(targetIST.getDate() + 1);
      }
      
      const diffMs = targetIST - nowIST;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      setCountdown(`${diffHrs}h ${diffMins}m`);
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Setup Supabase Realtime subscriptions
  useEffect(() => {
    fetchStats();

    // Subscribe to changes on leads table
    const leadsChannel = supabase
      .channel('realtime-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        fetchStats();
        
        // Notify if a new lead is inserted by the scraper
        if (payload.eventType === 'INSERT') {
          addToast(`🆕 New lead added: ${payload.new.practice_name}`, 'success');
        }
      })
      .subscribe();

    // Subscribe to changes on scrape_runs table
    const runsChannel = supabase
      .channel('realtime-scrape-runs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_runs' }, (payload) => {
        fetchStats();
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const run = payload.new;
          if (run.status === 'success') {
            addToast(`🚀 Scrape completed! Found ${run.leads_found} new website-less dentists.`, 'success');
          } else if (run.status === 'api_limit_hit') {
            addToast(`⚠️ Scrape stopped: Google API daily limit of ${run.api_calls_made} calls hit!`, 'warning');
          } else if (run.status === 'failed') {
            addToast(`❌ Scrape run failed: ${run.message || 'Unknown error'}`, 'error');
          }
        }
      })
      .subscribe();

    // Subscribe to changes on api_usage table
    const usageChannel = supabase
      .channel('realtime-api-usage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_usage' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(runsChannel);
      supabase.removeChannel(runsChannel);
    };
  }, []);

  return (
    <AppContext.Provider value={{ stats, todayRun, toasts, countdown, addToast, fetchStats }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
