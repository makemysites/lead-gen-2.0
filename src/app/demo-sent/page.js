'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  Send, 
  Clock, 
  XCircle, 
  ExternalLink,
  Loader,
  Trophy,
  MailOpen
} from 'lucide-react';

export default function DemoSent() {
  const { stats, addToast, fetchStats } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal reschedule states
  const [activeLead, setActiveLead] = useState(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('18:00');
  const [followUpNote, setFollowUpNote] = useState('');

  const [removingIds, setRemovingIds] = useState([]);

  // Fetch demo sent leads
  const fetchDemoLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads?status=demo_sent');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching demo leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoLeads();
  }, []);

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
          body: JSON.stringify({ status: nextStatus })
        });

        if (!res.ok) throw new Error('Status update failed');
        addToast(`✅ Lead status changed to ${nextStatus.replace('_', ' ')}!`, 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error updating status. Reloading.', 'error');
        fetchDemoLeads();
      }
    }, 150);
  };

  // Mark as Won (saves to notes as requested, doesn't remove row)
  const handleMarkAsWon = async (leadId, practiceName, currentNotes) => {
    const updatedNotes = `🏆 WON CLIENT! Setup agreement. ${currentNotes ? '\n' + currentNotes : ''}`;
    
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes })
      });

      if (!res.ok) throw new Error('Failed to mark as won');
      
      addToast(`🎉 Awesome! ${practiceName} marked as WON!`, 'success');
      
      // Update local state notes
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: updatedNotes } : l));
      fetchStats();
    } catch (err) {
      console.error(err);
      addToast('❌ Error saving client win.', 'error');
    }
  };

  // Open reschedule follow up modal
  const openFollowUpModal = (lead) => {
    setActiveLead(lead);
    const today = new Date().toISOString().split('T')[0];
    setFollowUpDate(today);
    setFollowUpTime('18:00');
    setFollowUpNote('Check back on demo site preview feedback');
    setShowFollowUpModal(true);
  };

  // Save rescheduled follow up
  const handleSaveFollowUp = async () => {
    if (!activeLead) return;

    const leadId = activeLead.id;
    const combinedDatetime = `${followUpDate}T${followUpTime}:00`;

    setRemovingIds(prev => [...prev, leadId]);
    setShowFollowUpModal(false);

    setTimeout(async () => {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setRemovingIds(prev => prev.filter(id => id !== leadId));

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'follow_up',
            follow_up_datetime: new Date(combinedDatetime).toISOString(),
            follow_up_note: followUpNote
          })
        });

        if (!res.ok) throw new Error('Failed to move to follow-ups');
        addToast('⏰ Lead moved to Follow-ups!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error moving to follow-ups.', 'error');
        fetchDemoLeads();
      }
    }, 150);
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

  const formatSentAt = (timestamp) => {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div>
      {/* Header Info Panel */}
      <div className="section-card" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <MailOpen size={20} style={{ color: 'var(--purple-color)' }} />
        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-secondary)' }}>
          Demos you've sent &mdash; waiting to hear back. Follow up frequently to close deals!
        </span>
      </div>

      {/* Demo Sent Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading sent demos list...</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '15px' }}>No dentists in Demo Sent yet.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Move leads here by entering emails or sending custom website links.</p>
          </div>
        ) : (
          <table className="lead-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Practice Name</th>
                <th>Specialty</th>
                <th>Email Address</th>
                <th>Demo Link</th>
                <th>Sent At</th>
                <th>Outreach Notes</th>
                <th style={{ textAlign: 'right', minWidth: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, index) => {
                const zone = lookupRegion(lead.state);
                const zoneClass = zone === 'Appalachia' ? 'region-appalachia' : zone === 'Deep South' ? 'region-deep-south' : 'region-midwest';
                const isRemoving = removingIds.includes(lead.id);

                return (
                  <tr key={lead.id} className={isRemoving ? 'row-removing' : ''}>
                    <td className="font-mono-data" style={{ color: 'var(--text-muted)' }}>
                      {index + 1}
                    </td>
                    <td>
                      <div className="td-practice">
                        <span className="practice-title">{lead.practice_name}</span>
                        {lead.owner_name && (
                          <span className="practice-owner">{lead.owner_name} ({lead.city}, {lead.state})</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge-specialty ${getBadgeClass(lead.specialty)}`}>
                        {lead.specialty || 'Dentist'}
                      </span>
                    </td>
                    <td className="font-mono-data" style={{ fontSize: '13px', fontWeight: 500 }}>
                      {lead.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {lead.demo_link ? (
                        <a 
                          href={lead.demo_link} 
                          target="_blank" 
                          rel="noreferrer"
                          className="copy-phone-btn"
                          style={{ color: 'var(--purple-color)', borderColor: 'var(--border-color)', backgroundColor: 'var(--purple-light)' }}
                        >
                          <ExternalLink size={12} />
                          <span>View Demo</span>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Offer Sent (No Link)</span>
                      )}
                    </td>
                    <td className="font-mono-data" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatSentAt(lead.demo_sent_at)}
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
                          onClick={() => handleMarkAsWon(lead.id, lead.practice_name, lead.notes)}
                          className="btn-standard btn-primary"
                          style={{ height: '32px', padding: '0 8px', fontSize: '11px', backgroundColor: 'var(--success-color)' }}
                          title="Mark Lead as Won"
                        >
                          <Trophy size={12} />
                          <span>Won Client</span>
                        </button>
                        <button 
                          onClick={() => openFollowUpModal(lead)}
                          className="btn-standard btn-secondary" 
                          style={{ height: '32px', padding: '0 8px', fontSize: '11px' }}
                          title="Move to Follow-up"
                        >
                          <Clock size={12} />
                          <span>Follow-up</span>
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(lead.id, 'rejected')}
                          className="btn-icon btn-danger" 
                          title="Move to Rejected"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reschedule/Follow-Up Modal */}
      {showFollowUpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Schedule Follow-up</h3>
              <button onClick={() => setShowFollowUpModal(false)} className="btn-icon">&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
                Practice: <strong>{activeLead?.practice_name}</strong>
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
                  placeholder="Ask for design changes feedback..."
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowFollowUpModal(false)} className="btn-standard btn-secondary">Cancel</button>
              <button onClick={handleSaveFollowUp} className="btn-standard btn-primary">Schedule Call</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
