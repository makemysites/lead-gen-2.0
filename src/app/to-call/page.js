'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  Phone, 
  PhoneCall, 
  Send, 
  Clock, 
  XCircle, 
  MapPin, 
  Search, 
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Mail,
  Loader
} from 'lucide-react';

export default function ToCall() {
  const { stats, addToast, fetchStats } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Filters state
  const [stateFilter, setStateFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [emailFilter, setEmailFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Row animation state
  const [removingIds, setRemovingIds] = useState([]);

  // Modal states
  const [activeLead, setActiveLead] = useState(null);
  const [modalType, setModalType] = useState(null); // 'follow_up' or 'demo_sent'
  
  // Follow-up modal form state
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('18:00');
  const [followUpNote, setFollowUpNote] = useState('');
  
  // Demo sent modal form state
  const [demoLink, setDemoLink] = useState('');
  const [demoSentVia, setDemoSentVia] = useState('Email');

  // Load leads with filters from API
  const fetchLeads = async () => {
    try {
      setLoading(true);
      let url = '/api/leads?status=to_call';
      
      if (stateFilter !== 'all') url += `&state=${stateFilter}`;
      if (specialtyFilter !== 'all') url += `&specialty=${specialtyFilter}`;
      if (dateFilter !== 'all') url += `&date=${dateFilter}`;
      if (emailFilter !== 'all') url += `&hasEmail=${emailFilter}`;
      if (searchQuery.trim() !== '') url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [stateFilter, specialtyFilter, dateFilter, emailFilter]);

  // Handle Search Input on form submission or Enter key
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLeads();
  };

  // Copy phone number to clipboard
  const handleCopyPhone = (leadId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(leadId);
    addToast('📋 Phone number copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Immediate status change helper (Optimistic UI - CRITICAL rule #7)
  const handleUpdateStatus = async (leadId, nextStatus) => {
    // Start removing animation
    setRemovingIds(prev => [...prev, leadId]);
    
    // Wait for animation transition (150ms)
    setTimeout(async () => {
      // Optimistic state remove
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
        addToast('❌ Failed to update status. Reloading.', 'error');
        fetchLeads(); // roll back by reloading
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
        // Because status has automatically changed to 'demo_sent', slide out lead row
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
        // Update local state value
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

  // Open scheduling modal
  const openFollowUpModal = (lead) => {
    setActiveLead(lead);
    const today = new Date().toISOString().split('T')[0];
    setFollowUpDate(today); // default today
    setFollowUpTime('18:00'); // default 6 PM
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

  // Save Scheduled Follow-up
  const handleSaveFollowUp = async () => {
    if (!activeLead) return;
    
    const combinedDatetime = `${followUpDate}T${followUpTime}:00`;
    const leadId = activeLead.id;
    
    setRemovingIds(prev => [...prev, leadId]);
    setModalType(null);

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

        if (!res.ok) throw new Error('Failed to schedule follow-up');
        addToast('⏰ Lead moved to Follow-ups!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error scheduling follow-up.', 'error');
        fetchLeads();
      }
    }, 150);
  };

  // Save Demo Sent details
  const handleSaveDemo = async () => {
    if (!activeLead) return;
    
    const leadId = activeLead.id;
    setRemovingIds(prev => [...prev, leadId]);
    setModalType(null);

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
        fetchLeads();
      }
    }, 150);
  };

  // Pastel badge colors selector
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

  // Extract unique state names for filters
  const uniqueStates = ['WV', 'KY', 'VA', 'MS', 'AL', 'AR', 'KS', 'NE', 'IA'];

  // Extract unique specialties for filters
  const uniqueSpecialties = [
    "Dentist", "Family Dentist", "General Dentistry", "Cosmetic Dentist",
    "Pediatric Dentist", "Orthodontist", "Dental Clinic", "Emergency Dentist"
  ];

  return (
    <div>
      {/* Search and Filters Bar */}
      <form onSubmit={handleSearchSubmit} className="filter-bar">
        <div className="search-input-wrapper">
          <Search className="search-input-icon" />
          <input 
            type="text" 
            placeholder="Search practices..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select 
          className="select-filter" 
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="all">All States</option>
          {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
        </select>

        <select 
          className="select-filter" 
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="all">All Specialties</option>
          {uniqueSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
        </select>

        <select 
          className="select-filter" 
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="today">Scraped Today</option>
          <option value="week">Scraped This Week</option>
        </select>

        <select 
          className="select-filter" 
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        >
          <option value="all">All Emails</option>
          <option value="yes">Has Email</option>
          <option value="no">No Email</option>
        </select>

        <button type="submit" className="btn-standard btn-primary">
          Filter
        </button>
      </form>

      {/* Main Leads Table Container */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading dentists to call...</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '15px' }}>No dentists match your filters.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Clear search terms or select "All Time" to view database leads.</p>
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
                <th style={{ width: '100px' }}>Rating</th>
                <th>Email Address</th>
                <th>Outreach Notes</th>
                <th style={{ textAlign: 'right', minWidth: '180px' }}>Actions</th>
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
                        {lead.owner_name ? (
                          <span className="practice-owner">{lead.owner_name}</span>
                        ) : (
                          <input 
                            type="text" 
                            placeholder="Add Owner name..." 
                            className="inline-input empty-input"
                            style={{ fontSize: '12px', padding: 0 }}
                            defaultValue=""
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (!val) return;
                              try {
                                await fetch(`/api/leads/${lead.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ owner_name: val })
                                });
                                addToast('👤 Owner name saved!', 'success');
                                fetchStats();
                              } catch (err) { console.error(err); }
                            }}
                          />
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
                        <span className="timezone-tag" style={{ fontSize: '10px', marginTop: '2px' }}>
                          {lead.timezone} Time
                        </span>
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
        )}
      </div>

      {/* Follow-up call scheduling Modal */}
      {modalType === 'follow_up' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Schedule Follow-up</h3>
              <button onClick={() => setModalType(null)} className="btn-icon">&times;</button>
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
