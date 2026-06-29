'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  Users, 
  Phone, 
  PhoneCall, 
  Send, 
  Calendar,
  AlertTriangle,
  Play,
  Clock,
  ExternalLink,
  Copy,
  Check,
  CalendarCheck,
  XCircle,
  FileText
} from 'lucide-react';

export default function Dashboard() {
  const { stats, todayRun, countdown, addToast, fetchStats } = useApp();
  const [todayLeads, setTodayLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Modal states for lead actions
  const [activeLead, setActiveLead] = useState(null);
  const [modalType, setModalType] = useState(null); // 'follow_up' or 'demo_sent'
  
  // Modal form states
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('18:00');
  const [followUpNote, setFollowUpNote] = useState('');
  
  const [demoLink, setDemoLink] = useState('');
  const [demoSentVia, setDemoSentVia] = useState('Email');

  // Fetch today's leads from the API
  const fetchTodayLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads?date=today');
      if (res.ok) {
        const data = await res.json();
        setTodayLeads(data);
      }
    } catch (err) {
      console.error('Error fetching today\'s leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayLeads();
  }, [stats.todayCount]); // re-fetch when stats.todayCount changes (e.g. from realtime)

  // Copy phone number to clipboard helper
  const handleCopyPhone = (leadId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(leadId);
    addToast('📋 Phone number copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Immediate status change helper (Optimistic UI Update - CRITICAL rule #7)
  const handleUpdateStatus = async (leadId, nextStatus) => {
    // 1. Optimistic Update
    const originalLeads = [...todayLeads];
    setTodayLeads(prev => prev.filter(l => l.id !== leadId));
    
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      
      if (!res.ok) throw new Error('Failed to update lead status');
      
      addToast(`✅ Lead status updated to ${nextStatus.replace('_', ' ')}!`, 'success');
      fetchStats(); // update counters
    } catch (err) {
      console.error(err);
      addToast('❌ Failed to update lead. Rolling back.', 'error');
      setTodayLeads(originalLeads); // rollback
    }
  };

  // Trigger Follow-up Save
  const handleSaveFollowUp = async () => {
    if (!activeLead) return;
    
    const combinedDatetime = `${followUpDate}T${followUpTime}:00`;
    
    // Save original array for rollback
    const originalLeads = [...todayLeads];
    setTodayLeads(prev => prev.filter(l => l.id !== activeLead.id));
    setModalType(null);

    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'follow_up',
          follow_up_datetime: new Date(combinedDatetime).toISOString(),
          follow_up_note: followUpNote
        })
      });

      if (!res.ok) throw new Error('Failed to schedule follow-up');

      addToast('⏰ Follow-up scheduled successfully!', 'success');
      fetchStats();
    } catch (err) {
      console.error(err);
      addToast('❌ Failed to schedule follow-up.', 'error');
      setTodayLeads(originalLeads);
    }
  };

  // Trigger Demo Sent Save
  const handleSaveDemo = async () => {
    if (!activeLead) return;

    // Save original array for rollback
    const originalLeads = [...todayLeads];
    setTodayLeads(prev => prev.filter(l => l.id !== activeLead.id));
    setModalType(null);

    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'demo_sent',
          demo_link: demoLink,
          notes: `Demo sent via ${demoSentVia}.`
        })
      });

      if (!res.ok) throw new Error('Failed to mark demo as sent');

      addToast('📧 Demo marked as sent!', 'success');
      fetchStats();
    } catch (err) {
      console.error(err);
      addToast('❌ Failed to save demo status.', 'error');
      setTodayLeads(originalLeads);
    }
  };

  // Open scheduling modal
  const openFollowUpModal = (lead) => {
    setActiveLead(lead);
    const today = new Date().toISOString().split('T')[0];
    setFollowUpDate(today); // default to today (CRITICAL rule #8)
    setFollowUpTime('18:00'); // default to 6:00 PM (CRITICAL rule #8)
    setFollowUpNote('');
    setModalType('follow_up');
  };

  // Open demo sending modal
  const openDemoModal = (lead) => {
    setActiveLead(lead);
    setDemoLink('');
    setDemoSentVia('Email');
    setModalType('demo_sent');
  };

  // Formatting timestamp for last run display
  const formatLastRunTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Special pastel badges selector helper
  const getBadgeClass = (specialty) => {
    if (!specialty) return 'badge-default';
    const specLower = specialty.toLowerCase();
    if (specLower.includes('emergency')) return 'badge-emergency';
    if (specLower.includes('cosmetic')) return 'badge-cosmetic';
    if (specLower.includes('pediatric')) return 'badge-pediatric';
    if (specLower.includes('ortho')) return 'badge-ortho';
    if (specLower.includes('family')) return 'badge-family';
    if (specLower.includes('general') || specLower.includes('dentistry')) return 'badge-general';
    if (specLower.includes('clinic')) return 'badge-clinic';
    return 'badge-dentist';
  };

  return (
    <div>
      {/* 5 Stats Cards Row */}
      <div className="stats-grid">
        <div className="stat-card blue-card">
          <div className="stat-icon-wrapper">
            <Users size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.todayCount}</span>
            <span className="stat-label">Today's New Leads</span>
          </div>
        </div>

        <div className="stat-card blue-card">
          <div className="stat-icon-wrapper">
            <Phone size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.toCall}</span>
            <span className="stat-label">To Call</span>
          </div>
        </div>

        <div className="stat-card green-card">
          <div className="stat-icon-wrapper">
            <PhoneCall size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.called}</span>
            <span className="stat-label">Called</span>
          </div>
        </div>

        <div className="stat-card purple-card">
          <div className="stat-icon-wrapper">
            <Send size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.demoSent}</span>
            <span className="stat-label">Demo Sent</span>
          </div>
        </div>

        <div className="stat-card orange-card">
          <div className="stat-icon-wrapper">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.followUp}</span>
            <span className="stat-label">Follow-Ups Total</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Today's Leads Table */}
        <div className="section-card" style={{ marginBottom: 0 }}>
          <h2 className="section-title">
            <Users size={18} />
            Today's Scraped Leads
            <span className="nav-badge" style={{ marginLeft: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
              {todayLeads.length} leads
            </span>
          </h2>
          
          {loading ? (
            <p style={{ padding: '24px 0', textClassName: 'center', color: 'var(--text-secondary)' }}>Loading today's leads...</p>
          ) : todayLeads.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>No new leads have been added today yet.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Automatic search runs at 7:00 AM IST daily.</p>
            </div>
          ) : (
            <div className="table-container" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Practice Name</th>
                    <th>Specialty</th>
                    <th>Zone</th>
                    <th>Phone</th>
                    <th>Rating</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todayLeads.map((lead) => {
                    const zone = lookupRegion(lead.state);
                    const zoneClass = zone === 'Appalachia' 
                      ? 'region-appalachia' 
                      : zone === 'Deep South' 
                        ? 'region-deep-south' 
                        : 'region-midwest';

                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="td-practice">
                            <span className="practice-title">{lead.practice_name}</span>
                            <span className="practice-owner">{lead.city}, {lead.state}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-specialty ${getBadgeClass(lead.specialty)}`}>
                            {lead.specialty || 'Dentist'}
                          </span>
                        </td>
                        <td>
                          <span className={`region-tag ${zoneClass}`}>{zone}</span>
                          <div className="timezone-tag" style={{ fontSize: '9px', marginTop: '2px', color: 'var(--text-muted)' }}>
                            {lead.timezone} Time
                          </div>
                        </td>
                        <td className="font-mono-data">
                          {lead.phone ? (
                            <button 
                              onClick={() => handleCopyPhone(lead.id, lead.phone)}
                              className="copy-phone-btn"
                              title="Click to copy phone number"
                            >
                              {copiedId === lead.id ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                              <span>{lead.phone}</span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {lead.rating ? (
                            <div className="rating-stars">
                              <span>⭐</span>
                              <span>{lead.rating}</span>
                              <span className="reviews-count">({lead.total_reviews})</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => handleUpdateStatus(lead.id, 'called')}
                              className="btn-icon btn-success" 
                              title="Mark as Called"
                            >
                              <PhoneCall size={14} />
                            </button>
                            <button 
                              onClick={() => openDemoModal(lead)}
                              className="btn-icon btn-purple" 
                              title="Mark Demo Sent"
                            >
                              <Send size={14} />
                            </button>
                            <button 
                              onClick={() => openFollowUpModal(lead)}
                              className="btn-icon btn-warning" 
                              title="Schedule Follow-up"
                            >
                              <Clock size={14} />
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(lead.id, 'rejected')}
                              className="btn-icon btn-danger" 
                              title="Reject Lead"
                            >
                              <XCircle size={14} />
                            </button>
                            <a 
                              href={lead.google_maps_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn-icon" 
                              title="Open in Maps"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Scraper Status Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Last Run Info Card */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <h3 className="section-title">
              <Play size={18} style={{ color: 'var(--primary-color)' }} />
              Scraper Status
            </h3>
            
            {todayRun ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Today's Run Status</span>
                  <span style={{ 
                    fontWeight: 700, 
                    color: todayRun.status === 'success' 
                      ? 'var(--success-color)' 
                      : todayRun.status === 'api_limit_hit'
                        ? 'var(--warning-color)'
                        : 'var(--danger-color)'
                  }}>
                    {todayRun.status.toUpperCase()}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Execution Time</span>
                  <span className="font-mono-data">{formatLastRunTime(todayRun.started_at)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Leads Discovered</span>
                  <span style={{ fontWeight: 600 }}>{todayRun.leads_found} new leads</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>API Resource Cost</span>
                  <span className="font-mono-data">{todayRun.api_calls_made} API calls</span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                  <strong>Log:</strong> {todayRun.message}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)' }}>
                <Clock size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <p style={{ fontSize: '13px' }}>No scrape run has executed today yet.</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Scheduled to run automatically at 7:00 AM IST.</p>
              </div>
            )}
          </div>
          
          {/* Schedule Countdown Info Card */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <h3 className="section-title">
              <Clock size={18} style={{ color: 'var(--warning-color)' }} />
              Outreach Timing Guide
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Your leads are located in <strong>Eastern</strong> and <strong>Central</strong> time zones.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>BEST COLD-CALL WINDOW (IST)</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  7:30 PM &ndash; 3:30 AM IST
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Maps directly to 9 AM - 5 PM business hours.
                </div>
              </div>
              
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>AUTO EMAIL TRIGGER</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px', lineHeight: '1.3' }}>
                  Emails fire instantly when a doctor's email is entered in To Call page.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      {modalType === 'follow_up' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Schedule Follow-up Call</h3>
              <button onClick={() => setModalType(null)} className="btn-icon">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
                Practice: <strong>{activeLead?.practice_name}</strong> ({activeLead?.city}, {activeLead?.state})
              </p>
              
              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={followUpDate} 
                  onChange={(e) => setFollowUpDate(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time ({activeLead?.timezone} Time Reference)</label>
                <input 
                  type="time" 
                  className="form-input" 
                  value={followUpTime} 
                  onChange={(e) => setFollowUpTime(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Follow-up Notes / Reason</label>
                <textarea 
                  className="form-input" 
                  style={{ height: '80px', paddingTop: '8px', paddingBottom: '8px', resize: 'none' }}
                  placeholder="Said call back after 6 PM or requested callback with manager..."
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalType(null)} className="btn-standard btn-secondary">Cancel</button>
              <button onClick={handleSaveFollowUp} className="btn-standard btn-primary">Schedule Call</button>
            </div>
          </div>
        </div>
      )}

      {/* Demo sent modal */}
      {modalType === 'demo_sent' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Mark Demo as Sent</h3>
              <button onClick={() => setModalType(null)} className="btn-icon">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
                Practice: <strong>{activeLead?.practice_name}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Demo Site Link</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://preview.makemysites.in/dr-smith" 
                  value={demoLink} 
                  onChange={(e) => setDemoLink(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sent Via</label>
                <select 
                  className="select-filter" 
                  style={{ width: '100%', backgroundColor: '#FFFFFF' }}
                  value={demoSentVia}
                  onChange={(e) => setDemoSentVia(e.target.value)}
                >
                  <option value="Email">Email</option>
                  <option value="Call">Phone Call</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalType(null)} className="btn-standard btn-secondary">Cancel</button>
              <button onClick={handleSaveDemo} className="btn-standard btn-primary">Save Demo Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
