import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertTriangle, Lightbulb, FileText, X, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

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
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
          {value}%
        </div>
      </div>
      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', textAlign: 'center', minHeight: '34px' }}>{label}</div>
      <div style={{ background: '#2a303c', color: color, fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{subLabel}</div>
    </div>
  );
};

export default function AtsReport({ reportData, resumeId }) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!reportData) return null;

  const {
    atsScore = 0,
    missingKeywords = [],
    resumeWeaknesses = [],
    improvedBullets = [],
    recommendations = []
  } = reportData;

  const handleDownload = () => {
    setIsDownloading(true);
    const element = document.getElementById('ats-report-content');
    
    // Temporarily hide the download button from the PDF
    const downloadBtn = document.getElementById('download-btn-container');
    if (downloadBtn) downloadBtn.style.display = 'none';

    const opt = {
      margin: 1,
      filename: `ATS_Analysis_Report.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      if (downloadBtn) downloadBtn.style.display = 'flex';
      setIsDownloading(false);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 w-full h-full overflow-y-auto custom-scrollbar"
      style={{ backgroundColor: '#111827' }}
    >
      <div id="ats-report-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid #2a303c', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.8rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText color="#3b82f6" /> ATS Analysis Report
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0 }}>AI-driven resume optimization and keyword extraction.</p>
          </div>
          
          <div id="download-btn-container" style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleDownload}
              disabled={isDownloading}
              style={{ background: '#374151', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.9rem', opacity: isDownloading ? 0.7 : 1 }}
            >
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isDownloading ? "Saving..." : "Save Report"}
            </button>
            <button 
              onClick={async () => {
                const btn = document.getElementById('overleaf-btn-text');
                const spinner = document.getElementById('overleaf-btn-spinner');
                if (btn) btn.innerText = "Generating (takes ~30s)...";
                if (spinner) spinner.style.display = 'block';

                try {
                  const { getLatexResume } = await import('@/lib/services/api');
                  const response = await getLatexResume(resumeId);
                  if (response.latex) {
                    const form = document.createElement('form');
                    form.action = 'https://www.overleaf.com/docs';
                    form.method = 'POST';
                    form.target = '_blank'; // Open in a new tab
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'snip';
                    input.value = response.latex;
                    form.appendChild(input);
                    document.body.appendChild(form);
                    form.submit();
                    document.body.removeChild(form);
                  }
                } catch (err) {
                  console.error("Failed to generate Latex", err);
                  alert("Failed to generate LaTeX resume.");
                } finally {
                  if (btn) btn.innerText = "Generate Resume (Overleaf)";
                  if (spinner) spinner.style.display = 'none';
                }
              }}
              style={{ background: '#47a141', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
            >
              <Loader2 id="overleaf-btn-spinner" size={16} className="animate-spin" style={{ display: 'none' }} />
              <FileText size={16} />
              <span id="overleaf-btn-text">Generate Resume (Overleaf)</span>
            </button>
          </div>
        </div>

        {/* Top Section: Score & Keywords */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <CircularProgress value={atsScore} label="Overall ATS Score" status="Evaluated" />
          
          <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: '#fff', fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="#f59e0b" /> Missing Critical Keywords
            </h3>
            {missingKeywords.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {missingKeywords.map((kw, i) => (
                  <span key={i} style={{ background: '#451a1a', color: '#fca5a5', fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #7f1d1d' }}>
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0 }}>Your resume matches all critical industry keywords. Great job!</p>
            )}
          </div>
        </div>

        {/* Weaknesses & Recommendations */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: '#fff', fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <X size={18} color="#ef4444" /> Resume Weaknesses
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {resumeWeaknesses.map((w, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>{w}</li>
              ))}
            </ul>
          </div>
          
          <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: '#fff', fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lightbulb size={18} color="#10b981" /> Actionable Recommendations
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {recommendations.map((r, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Improved Bullet Points */}
        <div style={{ background: '#1e2330', padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={20} color="#3b82f6" /> AI-Improved Bullet Points
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {improvedBullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingBottom: '1.5rem', borderBottom: i !== improvedBullets.length - 1 ? '1px solid #2a303c' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: '#111827', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                    <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Original</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.5' }}>{bullet.original}</div>
                  </div>
                  <div style={{ background: '#064e3b20', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Improved</div>
                    <div style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.5' }}>{bullet.improved}</div>
                  </div>
                </div>
                <div style={{ color: '#60a5fa', fontSize: '0.8rem', background: '#1e3a8a20', padding: '0.8rem 1rem', borderRadius: '6px', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>Reasoning:</span> {bullet.reason}
                </div>
              </div>
            ))}
            
            {improvedBullets.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', margin: '1rem 0' }}>No bullet point improvements generated for this resume.</p>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
