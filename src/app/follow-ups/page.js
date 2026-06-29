'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  PhoneCall, 
  Send, 
  Clock, 
  XCircle, 
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Loader,
  CalendarDays
} from 'lucide-react';

export default function FollowUps() {
  const { stats, addToast, fetchStats } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Modal reschedule states
  const [activeLead, setActiveLead] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('18:00');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // Demo Sent Modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoLink, setDemoLink] = useState('');
  const [demoSentVia, setDemoSentVia] = useState('Email');

  const [removingIds, setRemovingIds] = useState([]);

  // Fetch follow up leads
  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads?status=follow_up');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching follow ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, []);

  // Copy phone number to clipboard
  const handleCopyPhone = (leadId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(leadId);
    addToast('📋 Phone number copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Update lead status (Optimistic update - CRITICAL rule #7)
  const handleUpdateStatus = async (leadId, nextStatus) => {
    setRemovingIds(prev => [...prev, leadId]);

    setTimeout(async () => {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setRemovingIds(prev => prev.filter(id => id !== leadId));

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus, follow_up_datetime: null })
        });

        if (!res.ok) throw new Error('Status update failed');
        addToast(`✅ Lead status changed to ${nextStatus.replace('_', ' ')}!`, 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error updating status. Reloading.', 'error');
        fetchFollowUps();
      }
    }, 150);
  };

  // Open Reschedule Modal
  const openRescheduleModal = (lead) => {
    setActiveLead(lead);
    
    // Parse existing date/time if exists
    let defaultDate = new Date().toISOString().split('T')[0];
    let defaultTime = '18:00';
    if (lead.follow_up_datetime) {
      const dt = new Date(lead.follow_up_datetime);
      defaultDate = dt.toISOString().split('T')[0];
      defaultTime = dt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }

    setRescheduleDate(defaultDate);
    setRescheduleTime(defaultTime);
    setRescheduleNote(lead.follow_up_note || '');
    setShowRescheduleModal(true);
  };

  // Save Rescheduled Follow-up
  const handleSaveReschedule = async () => {
    if (!activeLead) return;

    const combinedDatetime = `${rescheduleDate}T${rescheduleTime}:00`;
    setShowRescheduleModal(false);

    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_datetime: new Date(combinedDatetime).toISOString(),
          follow_up_note: rescheduleNote
        })
      });

      if (!res.ok) throw new Error('Failed to reschedule');
      addToast('📅 Follow-up rescheduled successfully!', 'success');
      fetchFollowUps(); // Reload to re-categorize
    } catch (err) {
      console.error(err);
      addToast('❌ Error rescheduling.', 'error');
    }
  };

  // Open Demo Modal
  const openDemoModal = (lead) => {
    setActiveLead(lead);
    setDemoLink('');
    setDemoSentVia('Email');
    setShowDemoModal(true);
  };

  // Save Demo details
  const handleSaveDemo = async () => {
    if (!activeLead) return;

    const leadId = activeLead.id;
    setRemovingIds(prev => [...prev, leadId]);
    setShowDemoModal(false);

    setTimeout(async () => {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setRemovingIds(prev => prev.filter(id => id !== leadId));

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'demo_sent',
            demo_link: demoLink,
            notes: `Demo sent via ${demoSentVia}.`,
            follow_up_datetime: null
          })
        });

        if (!res.ok) throw new Error('Failed to save demo details');
        addToast('📧 Lead moved to Demo Sent!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error saving demo details.', 'error');
        fetchFollowUps();
      }
    }, 150);
  };

  // Auto-save email on blur (CRITICAL rule #6)
  const handleEmailBlur = async (leadId, originalEmail, currentEmail) => {
    const trimmedEmail = currentEmail.trim();
    if (originalEmail === trimmedEmail) return;

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail || null,
          email_source: trimmedEmail ? 'manual' : null
        })
      });

      if (!res.ok) throw new Error('Failed to update email');
      const data = await res.json();

      if (data.emailSent) {
        addToast('📧 Cold email sent automatically to doctor!', 'success');
        // Slide out row as status is now demo_sent
        setRemovingIds(prev => [...prev, leadId]);
        setTimeout(() => {
          setLeads(prev => prev.filter(l => l.id !== leadId));
          setRemovingIds(prev => prev.filter(id => id !== leadId));
        }, 150);
      } else {
        if (data.emailError) {
          addToast(`⚠️ Email saved, but mailer failed: ${data.emailError}`, 'warning');
        } else {
          addToast('📝 Email address saved!', 'success');
        }
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, email: trimmedEmail } : l));
      }
      fetchStats();
    } catch (err) {
      console.error(err);
      addToast('❌ Error saving email address.', 'error');
    }
  };

  // Auto-save notes on blur (CRITICAL rule #6)
  const handleNotesBlur = async (leadId, originalNotes, currentNotes) => {
    const trimmedNotes = currentNotes.trim();
    if (originalNotes === trimmedNotes) return;

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: trimmedNotes })
      });

      if (!res.ok) throw new Error('Failed to save notes');
      addToast('📝 Notes auto-saved successfully!', 'success');
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: trimmedNotes } : l));
      fetchStats();
    } catch (err) {
      console.error(err);
      addToast('❌ Error saving notes.', 'error');
    }
  };

  // Helper to format scheduled time
  const formatScheduledTime = (timestamp, isOverdue) => {
    if (!timestamp) return 'No time scheduled';
    
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Check if scheduled date is today
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + istOffset);
    const dateIST = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + istOffset);

    const isToday = nowIST.toDateString() === dateIST.toDateString();

    if (isToday) {
      return `Today at ${timeStr}`;
    }
    
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  // Categorize leads into sections: Today/Overdue and Upcoming
  const now = new Date();
  
  // Calculate timezone date boundary for today
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayISTStart = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + istOffset);
  todayISTStart.setHours(0, 0, 0, 0);
  
  const todayISTEnd = new Date(todayISTStart);
  todayISTEnd.setHours(23, 59, 59, 999);

  // Filter leads
  const overdueLeads = leads.filter(l => l.follow_up_datetime && new Date(l.follow_up_datetime) < now);
  
  const todayLeads = leads.filter(l => {
    if (!l.follow_up_datetime) return false;
    const fDate = new Date(l.follow_up_datetime);
    // Is not overdue (is in future relative to right now) but scheduled for today
    return fDate >= now && fDate <= todayISTEnd;
  });

  const upcomingLeads = leads.filter(l => l.follow_up_datetime && new Date(l.follow_up_datetime) > todayISTEnd);

  // Group Overdue and Today's Follow-ups together for Section 1 (as requested, with overdue sorted at the very top)
  const activeTodaySectionLeads = [...overdueLeads, ...todayLeads];

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

  const renderFollowUpsTable = (sectionLeads, title, emptyMsg, highlightBorder = false) => {
    return (
      <div className="section-card" style={{ borderColor: highlightBorder ? 'var(--warning-color)' : 'var(--border-color)', marginBottom: '32px' }}>
        <h3 className="section-title">
          <CalendarDays size={18} style={{ color: highlightBorder ? 'var(--warning-color)' : 'var(--primary-color)' }} />
          {title}
          <span className="nav-badge" style={{ marginLeft: '8px', backgroundColor: highlightBorder ? 'var(--warning-light)' : 'var(--bg-app)', color: highlightBorder ? 'var(--warning-color)' : 'var(--text-secondary)' }}>
            {sectionLeads.length} scheduled
          </span>
        </h3>

        {sectionLeads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
            {emptyMsg}
          </p>
        ) : (
          <div className="table-container" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
            <table className="lead-table">
              <thead>
                <tr>
                  <th>Practice Name</th>
                  <th>Specialty</th>
                  <th>Location</th>
                  <th>Phone</th>
                  <th>Scheduled Time</th>
                  <th>Follow-up Reason</th>
                  <th>Email</th>
                  <th>Outreach Notes</th>
                  <th style={{ textAlign: 'right', minWidth: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sectionLeads.map((lead) => {
                  const zone = lookupRegion(lead.state);
                  const zoneClass = zone === 'Appalachia' ? 'region-appalachia' : zone === 'Deep South' ? 'region-deep-south' : 'region-midwest';
                  const isOverdue = lead.follow_up_datetime && new Date(lead.follow_up_datetime) < now;
                  const isRemoving = removingIds.includes(lead.id);

                  return (
                    <tr 
                      key={lead.id} 
                      className={`${isOverdue ? 'row-overdue' : ''} ${isRemoving ? 'row-removing' : ''}`}
                    >
                      <td>
                        <div className="td-practice">
                          <span className="practice-title">{lead.practice_name}</span>
                          {lead.owner_name && (
                            <span className="practice-owner">{lead.owner_name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge-specialty ${getBadgeClass(lead.specialty)}`}>
                          {lead.specialty || 'Dentist'}
                        </span>
                      </td>
                      <td>
                        <div className="td-practice">
                          <span style={{ fontWeight: 500 }}>{lead.city}, {lead.state}</span>
                          <span className={`region-tag ${zoneClass}`} style={{ alignSelf: 'flex-start' }}>{zone}</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: isOverdue ? '700' : '600', color: isOverdue ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                            {formatScheduledTime(lead.follow_up_datetime)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({lead.timezone} Time Reference)
                          </span>
                          {isOverdue && (
                            <span className="badge-overdue" style={{ alignSelf: 'flex-start' }}>
                              <AlertTriangle size={10} /> Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '180px' }}>
                        {lead.follow_up_note || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No reason added</span>}
                      </td>
                      <td>
                        <input 
                          type="email" 
                          defaultValue={lead.email || ''} 
                          placeholder="Click to add email..." 
                          className={`inline-input ${!lead.email ? 'empty-input' : ''}`}
                          onBlur={(e) => handleEmailBlur(lead.id, lead.email || '', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                        />
                      </td>
                      <td>
                        <textarea 
                          defaultValue={lead.notes || ''} 
                          placeholder="Click to type notes..." 
                          className="inline-textarea"
                          onBlur={(e) => handleNotesBlur(lead.id, lead.notes || '', e.target.value)}
                        />
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
                            onClick={() => openRescheduleModal(lead)}
                            className="btn-standard btn-secondary" 
                            style={{ height: '32px', padding: '0 8px', fontSize: '11px' }}
                            title="Reschedule Follow-up"
                          >
                            <span>Reschedule</span>
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
    );
  };

  return (
    <div>
      {loading ? (
        <div className="table-container" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
          <p>Loading follow-up schedules...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Today's and Overdue Follow-Ups */}
          {renderFollowUpsTable(
            activeTodaySectionLeads, 
            "Today's & Overdue Follow-Ups", 
            "Great job! You have no calls scheduled for today.",
            activeTodaySectionLeads.some(l => new Date(l.follow_up_datetime) < now) // highlight orange border if overdue items exist
          )}

          {/* Section 2: Upcoming Follow-Ups */}
          {renderFollowUpsTable(
            upcomingLeads, 
            "Upcoming Follow-Ups", 
            "No upcoming follow-up calls scheduled.",
            false
          )}
        </>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Reschedule Follow-Up</h3>
              <button onClick={() => setShowRescheduleModal(false)} className="btn-icon">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
                Practice: <strong>{activeLead?.practice_name}</strong>
              </p>
              
              <div className="form-group">
                <label className="form-label">New Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={rescheduleDate} 
                  onChange={(e) => setRescheduleDate(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Time ({activeLead?.timezone} Time Reference)</label>
                <input 
                  type="time" 
                  className="form-input" 
                  value={rescheduleTime} 
                  onChange={(e) => setRescheduleTime(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Update Call Notes</label>
                <textarea 
                  className="form-input" 
                  style={{ height: '80px', paddingTop: '8px', paddingBottom: '8px', resize: 'none' }}
                  placeholder="Reason for reschedule..."
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRescheduleModal(false)} className="btn-standard btn-secondary">Cancel</button>
              <button onClick={handleSaveReschedule} className="btn-standard btn-primary">Update Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Demo sent modal */}
      {showDemoModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Mark Demo as Sent</h3>
              <button onClick={() => setShowDemoModal(false)} className="btn-icon">&times;</button>
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
              <button onClick={() => setShowDemoModal(false)} className="btn-standard btn-secondary">Cancel</button>
              <button onClick={handleSaveDemo} className="btn-standard btn-primary">Save Demo Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
