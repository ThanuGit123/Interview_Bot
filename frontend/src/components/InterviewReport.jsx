import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, BookOpen, Download, ChevronDown, ChevronUp, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const InterviewReport = ({ reportData, onRestart, messages }) => {
  const score = reportData.overallScore || reportData.score || 0;
  const verdict = reportData.finalVerdict || "Pending Review";
  const metrics = reportData.metrics || {};
  const wentWell = reportData.detailedFeedback?.whatWentWell || reportData.strengths || [];
  const toImprove = reportData.detailedFeedback?.whatToImprove || reportData.weaknesses || [];
  const breakdown = reportData.questionBreakdown || [];

  const getScoreColor = (s) => {
    if (s >= 80) return 'var(--success)';
    if (s >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const scoreColor = getScoreColor(score);

  const getMetricPercentage = (val) => {
    const v = val?.toLowerCase() || '';
    if (v.includes('strong')) return 95;
    if (v.includes('average')) return 70;
    if (v.includes('weak')) return 40;
    return 0;
  };

  const handleDownload = () => {
    let content = `# Interview Bot - Interview Transcript\n\n`;
    content += `**Date:** ${new Date().toLocaleDateString()}\n`;
    content += `**Final Score:** ${score}/100\n`;
    content += `**Verdict:** ${verdict}\n\n`;
    content += `## Conversation\n\n`;
    
    messages.forEach(msg => {
      content += `**${msg.role === 'user' ? 'Candidate' : 'Interviewer'}:**\n${msg.content}\n\n`;
    });

    content += `## Final Report\n\n`;
    content += `### What Went Well\n` + wentWell.map(i => `- ${i}`).join('\n') + `\n\n`;
    content += `### Areas to Improve\n` + toImprove.map(i => `- ${i}`).join('\n') + `\n\n`;
    
    if (breakdown.length > 0) {
      content += `## Detailed Question Breakdown\n\n`;
      breakdown.forEach((q, i) => {
        content += `### Q${i + 1}: ${q.question}\n`;
        content += `**Your Answer:** ${q.candidateAnswer}\n`;
        content += `**Grade:** ${q.correctness}\n`;
        content += `**Explanation:** ${q.detailedExplanation}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const avgMetric = Math.round((getMetricPercentage(metrics.technicalKnowledge) + getMetricPercentage(metrics.problemSolving)) / 2) || score;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '450px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}
    >
      {/* Header Info */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '0.5rem' }}>Brand New Upgrade</div>
        <h2 style={{ fontSize: '2rem', margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontWeight: 'bold', lineHeight: '1.2' }}>Your career path is accelerating.</h2>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button style={{ flex: 1, padding: '0.8rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={onRestart}>
            Update Resume
          </button>
          <button style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onRestart}>
            Mock Interview
          </button>
        </div>
      </div>

      {/* Massive Score Circle */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2rem', fontWeight: 'bold' }}>Progress Score</div>
        
        <div style={{ 
          width: '180px', height: '180px', 
          borderRadius: '50%', 
          border: `8px solid ${scoreColor}`, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 30px ${scoreColor}20`,
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1' }}>{score}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '2px', marginTop: '0.5rem' }}>OUT OF 100</div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Your profile is <span style={{ color: scoreColor, fontWeight: 'bold' }}>Highly Competitive</span> based on this performance. {verdict}
        </p>
      </div>

      {/* Recent Analysis Card */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 'bold', margin: 0 }}>Recent Analysis</h3>
          <FileText size={20} color="var(--text-secondary)" />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span>Technical Knowledge</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{getMetricPercentage(metrics.technicalKnowledge)}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${getMetricPercentage(metrics.technicalKnowledge)}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }} />
            </div>
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span>Problem Solving Impact</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{getMetricPercentage(metrics.problemSolving)}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${getMetricPercentage(metrics.problemSolving)}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <AlertCircle size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>AI Recommendation</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5' }}>
              {toImprove[0] || "Strengthen your core concepts by reviewing the detailed breakdown below."}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Feedback (Upcoming Interviews style) */}
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '1rem' }}>Detailed Question Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {breakdown.map((q, i) => (
            <QuestionAccordion key={i} index={i} data={q} />
          ))}
        </div>
      </div>
      
      {/* Export Action */}
      <button 
        onClick={handleDownload}
        style={{
          marginTop: '2rem',
          background: 'transparent',
          color: 'var(--accent-primary)',
          border: '1px solid var(--accent-primary)',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}
      >
        <Download size={18} /> Export Transcript & Analysis
      </button>

    </motion.div>
  );
};

const QuestionAccordion = ({ data, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getCorrectnessColor = (c) => {
    if (c?.toLowerCase().includes('correct')) return 'var(--success)';
    if (c?.toLowerCase().includes('partial')) return 'var(--warning)';
    return 'var(--danger)';
  };
  const color = getCorrectnessColor(data.correctness);

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
            Q{index + 1}
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>{data.correctness}</div>
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.2rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-primary)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.5rem' }}>Question</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}><ReactMarkdown>{data.question}</ReactMarkdown></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.5rem' }}>Your Answer</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}><ReactMarkdown>{data.candidateAnswer}</ReactMarkdown></div>
              </div>
              <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.5rem' }}>Optimal Answer</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}><ReactMarkdown>{data.detailedExplanation}</ReactMarkdown></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InterviewReport;
