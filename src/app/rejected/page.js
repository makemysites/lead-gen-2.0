'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { lookupRegion } from '@/lib/scraper';
import { 
  XOctagon, 
  RotateCcw, 
  ExternalLink,
  Copy,
  Check,
  Loader
} from 'lucide-react';

export default function Rejected() {
  const { stats, addToast, fetchStats } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [removingIds, setRemovingIds] = useState([]);

  // Fetch rejected leads
  const fetchRejectedLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads?status=rejected');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching rejected leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRejectedLeads();
  }, []);

  // Copy phone number to clipboard
  const handleCopyPhone = (leadId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(leadId);
    addToast('📋 Phone number copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Restore lead status to 'to_call'
  const handleRestore = async (leadId) => {
    setRemovingIds(prev => [...prev, leadId]);

    setTimeout(async () => {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setRemovingIds(prev => prev.filter(id => id !== leadId));

      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'to_call' })
        });

        if (!res.ok) throw new Error('Restore failed');
        addToast('✅ Lead restored back to To Call list!', 'success');
        fetchStats();
      } catch (err) {
        console.error(err);
        addToast('❌ Error restoring lead.', 'error');
        fetchRejectedLeads();
      }
    }, 150);
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
      {/* Top Banner Msg */}
      <div className="section-card" style={{ marginBottom: '24px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <XOctagon size={20} style={{ color: 'var(--danger-color)' }} />
        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-secondary)' }}>
          These dentists have been skipped. You can restore any lead back to the To Call dashboard at any time.
        </span>
      </div>

      {/* Rejected Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading skipped leads list...</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontWeight: 600, fontSize: '15px' }}>Your skipped leads archive is empty.</p>
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
                <th>Email Address</th>
                <th>Outreach Notes</th>
                <th style={{ textAlign: 'right', minWidth: '130px' }}>Actions</th>
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
                        <span className="practice-title" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                          {lead.practice_name}
                        </span>
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
                    <td className="font-mono-data" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {lead.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                      {lead.notes || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes</span>}
                    </td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleRestore(lead.id)}
                          className="btn-standard btn-secondary"
                          style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                          title="Restore lead back to To Call"
                        >
                          <RotateCcw size={12} />
                          <span>Restore</span>
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
    </div>
  );
}
