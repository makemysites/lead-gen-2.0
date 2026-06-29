'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Play, 
  Pause, 
  Mail, 
  Loader, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  AlertTriangle,
  RefreshCw,
  Info,
  XCircle
} from 'lucide-react';

export default function BulkCampaign() {
  const { addToast, fetchStats } = useApp();
  
  // Form states
  const [leadCount, setLeadCount] = useState(100);
  const [targetEmail, setTargetEmail] = useState('abhinay@makemysites.in');
  
  // Execution states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    current: 0,
    successCount: 0,
    failCount: 0
  });
  
  // Campaign leads and logs
  const [campaignLeads, setCampaignLeads] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Refs for managing execution loop
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const currentIdxRef = useRef(0);
  const logsEndRef = useRef(null);

  // Keep paused state in sync with ref
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Generate leads helper
  const handleGenerateCampaign = async (e) => {
    e.preventDefault();
    if (isGenerating || isSending) return;

    setIsGenerating(true);
    setCampaignLeads([]);
    setLogs([{ type: 'info', text: `Initiating generation of ${leadCount} dental clinic leads...` }]);
    setProgress({ total: leadCount, current: 0, successCount: 0, failCount: 0 });
    isCancelledRef.current = false;
    currentIdxRef.current = 0;
    setIsPaused(false);

    try {
      const res = await fetch('/api/leads/bulk-campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: leadCount, targetEmail })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate mock leads');
      }

      const data = await res.json();
      setCampaignLeads(data.leads || []);
      setLogs(prev => [
        ...prev,
        { type: 'success', text: `Successfully generated ${data.count} dentists and saved to database.` },
        { type: 'info', text: 'Ready to send campaign emails. Click "Start Dispatch" to begin.' }
      ]);
      setProgress(prev => ({ ...prev, total: data.count }));
      addToast(`🎉 Generated ${data.count} test leads!`, 'success');
      fetchStats(); // Update sidebar counts
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, { type: 'error', text: `Generation Failed: ${err.message}` }]);
      addToast('❌ Generation failed. Try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Dispatch campaign helper
  const handleStartDispatch = async () => {
    if (campaignLeads.length === 0 || isSending) return;

    setIsSending(true);
    setIsPaused(false);
    isCancelledRef.current = false;
    setLogs(prev => [...prev, { type: 'info', text: 'Starting cold outreach email dispatch...' }]);

    // Execute sequential email dispatch loop
    sendNextEmail();
  };

  const sendNextEmail = async () => {
    if (isCancelledRef.current) {
      setLogs(prev => [...prev, { type: 'error', text: 'Campaign cancelled by user.' }]);
      setIsSending(false);
      return;
    }

    if (isPausedRef.current) {
      setLogs(prev => [...prev, { type: 'warning', text: 'Campaign outreach paused.' }]);
      return;
    }

    const idx = currentIdxRef.current;
    if (idx >= campaignLeads.length) {
      setLogs(prev => [
        ...prev, 
        { type: 'success', text: `Campaign finished! Sent successfully: ${progress.successCount}, Failed: ${progress.failCount}` }
      ]);
      setIsSending(false);
      addToast('🚀 Bulk campaign dispatch finished!', 'success');
      fetchStats();
      return;
    }

    const lead = campaignLeads[idx];
    setLogs(prev => [...prev, { type: 'pending', text: `Sending to ${lead.owner_name} (${lead.practice_name}) -> ${lead.email}...` }]);

    try {
      const res = await fetch('/api/leads/bulk-campaign/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'SMTP Dispatch failed');
      }

      const data = await res.json();
      
      // Update counts
      setProgress(prev => {
        const nextCurrent = prev.current + 1;
        const nextSuccess = prev.successCount + 1;
        return { ...prev, current: nextCurrent, successCount: nextSuccess };
      });

      setLogs(prev => {
        // Remove the pending log and add success log
        const filtered = prev.filter(l => l.text !== `Sending to ${lead.owner_name} (${lead.practice_name}) -> ${lead.email}...`);
        return [
          ...filtered,
          { type: 'success', text: `[SUCCESS] Sent to ${lead.owner_name} (${lead.practice_name}) via ${lead.email}` }
        ];
      });

    } catch (err) {
      console.error(err);
      
      setProgress(prev => {
        const nextCurrent = prev.current + 1;
        const nextFail = prev.failCount + 1;
        return { ...prev, current: nextCurrent, failCount: nextFail };
      });

      setLogs(prev => {
        const filtered = prev.filter(l => l.text !== `Sending to ${lead.owner_name} (${lead.practice_name}) -> ${lead.email}...`);
        return [
          ...filtered,
          { type: 'error', text: `[FAILED] ${lead.owner_name} (${lead.practice_name}): ${err.message}` }
        ];
      });
    }

    // Increment index ref and schedule next call
    currentIdxRef.current = idx + 1;
    
    // Slight delay of 250ms to prevent spamming and rate limits
    setTimeout(sendNextEmail, 250);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    setLogs(prev => [...prev, { type: 'info', text: 'Resuming campaign dispatch...' }]);
    sendNextEmail();
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsSending(false);
    setIsPaused(false);
  };

  const percentComplete = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Informative Header */}
      <div className="section-card">
        <h3 className="section-title">
          <Zap size={18} style={{ color: 'var(--warning-color)' }} />
          Bulk Outreach Campaign Simulator
        </h3>
        <p className="text-para" style={{ marginBottom: '12px' }}>
          This tool generates bulk dental clinic leads and triggers a high-volume cold outreach campaign. 
          To allow safe testing, all generated emails are sent to your verified outreach domain using <strong>sub-addressing</strong> (aliases).
        </p>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '10px', 
          backgroundColor: 'rgba(29, 78, 216, 0.08)', 
          padding: '12px', 
          borderRadius: 'var(--radius-md)', 
          borderLeft: '4px solid var(--primary-color)',
          fontSize: '13px',
          lineHeight: '1.4',
          color: 'var(--text-secondary)'
        }}>
          <Info size={18} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>How Sub-addressing works:</strong> If your target test email is `abhinay@makemysites.in`, the system generates recipient emails like `abhinay+dr_james_smith_431@makemysites.in`. 
            Resend sends them as unique recipient addresses, but your mail server delivers them all to your single main inbox!
          </div>
        </div>

        {/* Resend limit warning */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '10px', 
          backgroundColor: 'rgba(217, 119, 6, 0.08)', 
          padding: '12px', 
          borderRadius: 'var(--radius-md)', 
          borderLeft: '4px solid var(--warning-color)',
          fontSize: '13px',
          lineHeight: '1.4',
          marginTop: '10px',
          color: 'var(--text-secondary)'
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning-color)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Resend Free Tier Limit:</strong> Resend limits free accounts to 100 emails/day. Running a campaign of 200 emails will exhaust your quota and cause the remaining dispatches to fail. For larger tests, keep it to 50 or 100 emails per day.
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="section-card">
        <h3 className="section-title">
          <Mail size={18} style={{ color: 'var(--primary-color)' }} />
          Campaign Setup
        </h3>
        
        <form onSubmit={handleGenerateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Recipient Test Email Address</label>
            <input 
              type="email" 
              className="form-input"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="e.g. abhinay@makemysites.in"
              required
              disabled={isGenerating || isSending}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Must be your verified email/domain in Resend so emails send successfully.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Leads to Generate</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              {[50, 100, 200].map((num) => (
                <label 
                  key={num} 
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    border: leadCount === num ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: leadCount === num ? 'rgba(29, 78, 216, 0.04)' : '#FFFFFF',
                    cursor: (isGenerating || isSending) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 600
                  }}
                >
                  <input 
                    type="radio" 
                    name="leadCount" 
                    value={num} 
                    checked={leadCount === num}
                    onChange={() => setLeadCount(num)}
                    style={{ display: 'none' }}
                    disabled={isGenerating || isSending}
                  />
                  <span style={{ fontSize: '18px', color: leadCount === num ? 'var(--primary-color)' : 'var(--text-primary)' }}>{num}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 400 }}>Dentists</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-standard btn-primary"
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={isGenerating || isSending}
          >
            {isGenerating ? (
              <>
                <Loader className="logo-icon" size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Generating leads...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Generate Campaign Leads</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Progress & Log Output */}
      {(campaignLeads.length > 0 || isGenerating || isSending || logs.length > 0) && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Campaign Controller
            </h3>
            
            {/* Control buttons */}
            {campaignLeads.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isSending ? (
                  <button 
                    onClick={handleStartDispatch}
                    className="btn-standard btn-success"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Play size={14} />
                    <span>Start Dispatch</span>
                  </button>
                ) : isPaused ? (
                  <button 
                    onClick={handleResume}
                    className="btn-standard btn-success"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Play size={14} />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button 
                    onClick={handlePause}
                    className="btn-standard btn-warning"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Pause size={14} />
                    <span>Pause</span>
                  </button>
                )}
                
                {isSending && (
                  <button 
                    onClick={handleCancel}
                    className="btn-standard btn-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <XCircle size={14} />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar and stats grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Campaign Progress</span>
                <span className="font-mono-data">{percentComplete}% ({progress.current}/{progress.total})</span>
              </div>
              <div className="api-progress-track" style={{ height: '8px' }}>
                <div 
                  className="api-progress-fill api-green"
                  style={{ width: `${percentComplete}%`, height: '100%', borderRadius: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL LEADS</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>{progress.total}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>SENT SUCCESS</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: 'var(--success-color)' }}>{progress.successCount}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DISPATCH FAIL</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: 'var(--danger-color)' }}>{progress.failCount}</div>
              </div>
            </div>
          </div>

          {/* Console Output Log */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Campaign Dispatch Console Output Log:
            </span>
            <div style={{ 
              height: '240px', 
              backgroundColor: '#1E293B', 
              borderRadius: 'var(--radius-md)', 
              padding: '12px', 
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, Lucida Console, Courier New, monospace',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {logs.map((log, idx) => {
                let color = '#E2E8F0';
                let prefix = '[INFO]';
                if (log.type === 'success') {
                  color = '#4ADE80';
                  prefix = '[SUCCESS]';
                } else if (log.type === 'error') {
                  color = '#F87171';
                  prefix = '[FAILED]';
                } else if (log.type === 'warning') {
                  color = '#FBBF24';
                  prefix = '[WARNING]';
                } else if (log.type === 'pending') {
                  color = '#60A5FA';
                  prefix = '[SENDING]';
                }

                return (
                  <div key={idx} style={{ color, lineHeight: '1.4', wordBreak: 'break-all' }}>
                    <span style={{ opacity: 0.6, marginRight: '6px' }}>{prefix}</span>
                    {log.text}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
