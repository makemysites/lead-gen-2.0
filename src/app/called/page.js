'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  PhoneCall, 
  RotateCcw, 
  Send, 
  ExternalLink,
  Copy,
  Check,
  CheckCircle,
  Loader
} from 'lucide-react';

export default function Called() {
  const { stats, addToast, fetchStats } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Modal states
  const [activeLead, setActiveLead] = useState(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoLink, setDemoLink] = useState('');
  const [demoSentVia, setDemoSentVia] = useState('Email');

  // Row animation state
  const [removingIds, setRemovingIds] = useState([]);

  // Fetch called leads
  const fetchCalledLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads?status=called');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching called leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalledLeads();
  }, []);

  // Copy phone number to clipboard
  const handleCopyPhone = (leadId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(leadId);
    addToast('📋 Phone number copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Revert status back to 'to_call'
  const handleMoveBack = async (leadId) => {
    setRemovingIds(prev => [...prev, leadId]);
    
    setTimeout(async () => {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setRemovingIds(prev => prev.filter(id => id !== leadId));

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'to_call', called_at: null })
        });
        
        if (!res.ok) throw new Error('Failed to revert lead');
        addToast('✅ Lead restored back to To Call!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error moving lead. Reloading.', 'error');
        fetchCalledLeads();
      }
    }, 150);
  };

  // Open demo sent modal
  const openDemoModal = (lead) => {
    setActiveLead(lead);
    setDemoLink('');
    setDemoSentVia('Email');
    setShowDemoModal(true);
  };

  // Save Demo Sent details
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
            notes: `Demo sent via ${demoSentVia}.`
          })
        });

        if (!res.ok) throw new Error('Failed to save demo details');
        addToast('📧 Lead moved to Demo Sent!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error saving demo details.', 'error');
        fetchCalledLeads();
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
        // Status is automatically 'demo_sent', slide out lead row
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

  // Format called at timestamp
  const formatCalledAt = (timestamp) => {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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

  return (
    <div>
      {/* Header Counter Message */}
      <div className="section-card" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <PhoneCall size={20} style={{ color: 'var(--success-color)' }} />
        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-secondary)' }}>
          You've called <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>{stats.called}</strong> dentists total. Keep pitching!
        </span>
      </div>

      {/* Called Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading called list...</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '15px' }}>No dentists marked as Called yet.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Move leads here by clicking Called on the To Call or Dashboard view.</p>
          </div>
        ) : (
          <table className="lead-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Practice Name</th>
                <th>Specialty</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Called At</th>
                <th>Email Address</th>
                <th>Outreach Notes</th>
                <th style={{ textAlign: 'right', minWidth: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, index) => {
                const zone = lookupRegion(lead.state);
                const zoneClass = zone === 'Appalachia' 
                  ? 'region-appalachia' 
                  : zone === 'Deep South' 
                    ? 'region-deep-south' 
                    : 'region-midwest';
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
                    <td className="font-mono-data" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {formatCalledAt(lead.called_at)}
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
                        placeholder="Click to type outreach notes..." 
                        className="inline-textarea"
                        onBlur={(e) => handleNotesBlur(lead.id, lead.notes || '', e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openDemoModal(lead)}
                          className="btn-standard btn-primary"
                          style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                          title="Move to Demo Sent"
                        >
                          <Send size={12} />
                          <span>Send Demo</span>
                        </button>
                        <button 
                          onClick={() => handleMoveBack(lead.id)}
                          className="btn-icon" 
                          title="Move Back to To Call"
                        >
                          <RotateCcw size={14} />
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
        )}
      </div>

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
