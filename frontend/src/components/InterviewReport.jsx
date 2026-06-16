import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const CircularProgress = ({ value, label, status }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  
  if (value === null || status === "Not Evaluated") {
    return (
      <div style={{ background: '#1e2330', padding: '1.5rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1rem' }}>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r={radius} fill="none" stroke="#2a303c" strokeWidth="6" />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#6b7280' }}>
            N/A
          </div>
        </div>
        <div style={{ color: '#6b7280', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem', textAlign: 'center', minHeight: '34px' }}>{label}</div>
        <div style={{ background: '#2a303c', color: '#6b7280', fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Not Evaluated</div>
      </div>
    );
  }

  const strokeDashoffset = circumference - (value / 100) * circumference;

  let color = '#3b82f6';
  let subLabel = 'AVERAGE';
  if (value >= 80) { color = '#10b981'; subLabel = 'STRONG'; }
  else if (value <= 60) { color = '#ef4444'; subLabel = 'WEAK'; }

  return (
    <div style={{ background: '#1e2330', padding: '1.5rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1rem' }}>
        <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#2a303c" strokeWidth="6" />
          <circle 
            cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
          {value}%
        </div>
      </div>
      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem', textAlign: 'center', minHeight: '34px' }}>{label}</div>
      <div style={{ background: '#2a303c', color: '#9ca3af', fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{subLabel}</div>
    </div>
  );
};

const TrendVisualization = ({ breakdown }) => {
  const bars = [1, 2, 3, 4, 5].map((val, i) => {
    let height = '30%';
    let color = '#374151'; // default dark
    
    if (breakdown && breakdown[i]) {
      const correctness = breakdown[i].correctness?.toLowerCase() || '';
      if (correctness.includes('correct')) { height = '85%'; color = '#93c5fd'; }
      else if (correctness.includes('partial')) { height = '60%'; color = '#6b7280'; }
      else { height = '40%'; color = '#4b5563'; }
    }
    
    return <div key={i} style={{ width: '12%', height, background: color, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} />;
  });

  return (
    <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px', gridColumn: 'span 2' }}>
      <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem' }}>Trend Visualization</div>
      <div style={{ background: '#111827', height: '120px', borderRadius: '8px', padding: '1rem 2rem 0 2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {bars}
      </div>
      <div style={{ color: '#9ca3af', fontSize: '0.7rem', textAlign: 'center', marginTop: '1rem' }}>Progress tracked across {breakdown?.length || 5} rounds of engagement</div>
    </div>
  );
};

const QuestionAccordion = ({ data, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  let badgeColor = '#ef4444';
  let badgeText = 'WRONG';
  if (data.correctness?.toLowerCase().includes('correct')) { badgeColor = '#10b981'; badgeText = 'CORRECT'; }
  else if (data.correctness?.toLowerCase().includes('partial')) { badgeColor = '#f59e0b'; badgeText = 'PARTIAL'; }

  return (
    <div style={{ background: '#1e2330', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #2a303c' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '1.2rem', display: 'flex', alignItems: 'flex-start', cursor: 'pointer', gap: '1rem' }}
      >
        <div style={{ background: '#374151', color: '#fff', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>TECHNICAL ROUND {index + 1}</span>
              {data.category && (
                <span style={{ background: '#1e3a8a', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{data.category}</span>
              )}
            </div>
            <span style={{ background: `${badgeColor}20`, color: badgeColor, fontSize: '0.65rem', fontWeight: 'bold', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>{badgeText}</span>
          </div>
          <div style={{ color: '#fff', fontSize: '0.9rem', lineHeight: '1.5', ...(!isOpen && { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
            {data.question}
          </div>
        </div>
        <div style={{ marginTop: '0.2rem' }}>
          {isOpen ? <ChevronUp size={20} color="#9ca3af" /> : <ChevronDown size={20} color="#9ca3af" />}
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ padding: '0 1.2rem 1.2rem 1.2rem' }}
          >
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #2a303c' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase' }}>Your Answer:</strong>
                <p style={{ color: '#d1d5db', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.6' }}>{data.candidateAnswer}</p>
              </div>
              {data.feedback && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase' }}>Feedback:</strong>
                  <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.6', background: '#451a1a', padding: '1rem', borderRadius: '8px', border: '1px solid #7f1d1d' }}>
                    <ReactMarkdown>{(data.feedback || '').replace(/\\n/g, '\n').replace(/<\/?code>/g, '`')}</ReactMarkdown>
                  </div>
                </div>
              )}
              <div>
                <strong style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase' }}>Optimal Solution:</strong>
                <div style={{ color: '#d1d5db', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.6', background: '#111827', padding: '1rem', borderRadius: '8px' }}>
                  <ReactMarkdown>{(data.detailedExplanation || '').replace(/\\n/g, '\n').replace(/<\/?code>/g, '`')}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InterviewReport = ({ reportData, onRestart, messages }) => {
  const score = reportData.overallScore || reportData.score || 0;
  const verdict = reportData.finalVerdict || "Candidate showed strong technical depth but was penalized for external resource dependency.";
  const metrics = reportData.metrics || {};
  const breakdown = reportData.questionBreakdown || [];
  const commFeedback = reportData.communicationFeedback || null;
  
  const parseMetric = (metric, fallbackStatusKey) => {
    if (!metric) return { score: null, status: metrics[fallbackStatusKey] || "Not Evaluated" };
    if (typeof metric === 'object' && 'score' in metric) {
      return { score: metric.score, status: metric.status || (metric.score === null ? "Not Evaluated" : "Evaluated") };
    }
    return { score: typeof metric === 'number' ? metric : null, status: metrics[fallbackStatusKey] || (metric === null ? "Not Evaluated" : "Evaluated") };
  };

  const pm = parseMetric(metrics.projectMastery, 'projectMasteryStatus');
  const mPM = pm.score;
  const mPMStatus = pm.status;
  
  const td = parseMetric(metrics.technicalDepth, 'technicalDepthStatus');
  const mTD = td.score;
  const mTDStatus = td.status;
  
  const comm = parseMetric(metrics.communication, 'communicationStatus');
  const mComm = comm.score;
  const mCommStatus = comm.status;
  
  const ps = parseMetric(metrics.problemSolving, 'problemSolvingStatus');
  const mPS = ps.score;
  const mPSStatus = ps.status;

  const counters = reportData.counters || {};
  const tabSwitches = counters.tab_switches || 0;
  const hintsUsed = counters.hints_used || 0;

  const handleDownload = () => {
    let content = `# Interview Bot - Full Performance Report\n\n`;
    content += `**Date:** ${new Date().toLocaleDateString()}\n`;
    content += `**Final Score:** ${score}/100\n`;
    content += `**Verdict:** ${verdict}\n\n`;
    
    if (breakdown.length > 0) {
      content += `## Session Deep Dive\n\n`;
      breakdown.forEach((q, i) => {
        content += `### Round ${i + 1}\n`;
        content += `**Grade:** ${q.correctness}\n\n`;
        content += `**Question:**\n${q.question}\n\n`;
        content += `**Your Answer:**\n${q.candidateAnswer}\n\n`;
        if (q.feedback) {
          content += `**Feedback:**\n${q.feedback}\n\n`;
        }
        content += `**Optimal Answer:**\n${q.detailedExplanation}\n\n`;
        content += `---\n\n`;
      });
    }

    content += `## Full Conversation Transcript\n\n`;
    messages.forEach(msg => {
      content += `**${msg.role === 'user' ? 'Candidate' : 'Interviewer'}:**\n${msg.content}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Performance_Report_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Performance Analysis</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: '#2563eb', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>JD</div>
            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Senior Fullstack Engineer Role</span>
          </div>
        </div>
        <button 
          onClick={handleDownload}
          style={{ background: '#1e3a8a', color: '#60a5fa', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          <Download size={16} /> Download PDF Report
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Score Box */}
          <div style={{ background: '#1e2330', borderRadius: '12px', display: 'flex', overflow: 'hidden' }}>
            {/* Score */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #2a303c', minWidth: '160px' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px' }}>Overall Score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '1rem' }}>
                <span style={{ color: '#fff', fontSize: '3.5rem', fontWeight: '900', lineHeight: '1' }}>{score}</span>
                <span style={{ color: '#9ca3af', fontSize: '1.2rem', fontWeight: 'bold' }}>/100</span>
              </div>
              <div style={{ background: '#064e3b', color: '#34d399', fontSize: '0.7rem', padding: '0.4rem 0.8rem', borderRadius: '16px', fontWeight: 'bold', display: 'inline-block', alignSelf: 'flex-start' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#34d399', borderRadius: '50%', marginRight: '6px' }}></span>
                LEAN HIRE
              </div>
            </div>

            {/* Integrity & AI Verdict */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a303c' }}>
                <div style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px' }}>Integrity & Assistance</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#374151', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ color: '#ef4444' }}>⎋</div>
                      <div>
                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>Tab Switching</div>
                        <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Detected {tabSwitches} instances during coding</div>
                      </div>
                    </div>
                    <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>-{tabSwitches * 5} pts</div>
                  </div>
                  <div style={{ background: '#2a303c', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ color: '#9ca3af' }}>💡</div>
                      <div>
                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>AI Hints Requested</div>
                        <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Used {hintsUsed} optimal path suggestions</div>
                      </div>
                    </div>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.9rem' }}>-{hintsUsed * 5} pts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Verdict text */}
            <div style={{ width: '280px', background: '#111827', padding: '1.5rem', borderLeft: '1px solid #2a303c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px' }}>
                <span>✨</span> AI VERDICT
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.6' }}>
                {verdict}
              </div>
            </div>

          </div>

          {/* 2x2 Grid + Bar Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <CircularProgress value={mPM} label="Project Mastery" status={mPMStatus} />
            <CircularProgress value={mTD} label="Technical Depth" status={mTDStatus} />
            <CircularProgress value={mComm} label="Communication" status={mCommStatus} />
            <CircularProgress value={mPS} label="Problem Solving" status={mPSStatus} />
            
            <TrendVisualization breakdown={breakdown} />
          </div>

          {/* Communication Feedback */}
          {commFeedback && (
            <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#60a5fa' }}>🗣️</span> Communication Analysis
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <ReactMarkdown>{commFeedback.replace(/\\n/g, '\n')}</ReactMarkdown>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.2rem', margin: 0 }}>Session Deep Dive</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ background: '#1e2330', border: 'none', color: '#9ca3af', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Filter size={16} /></button>
              <button style={{ background: '#1e2330', border: 'none', color: '#9ca3af', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Search size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {breakdown.map((q, i) => (
              <QuestionAccordion key={i} index={i} data={q} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem', position: 'relative' }}>
              End of Session Analysis
              <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', width: '30px', height: '2px', background: '#374151' }}></div>
            </span>
          </div>

      </div>

    </motion.div>
  );
};

export default InterviewReport;
