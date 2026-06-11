import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Target, Zap, ShieldAlert, Award, ChevronDown } from 'lucide-react';

const DifficultySelector = ({ onSelectSettings }) => {
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [timeLimit, setTimeLimit] = useState(5);

  const handleSelect = (difficulty) => {
    onSelectSettings({ difficulty, maxQuestions, timeLimit });
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mock Interview Scheduler</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Sharpen your skills with Lumina's industry-calibrated AI agents. Select your intensity level and find a time that works for your schedule.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Basic Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '16px', 
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Introductory</div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <MessageSquare size={20} color="var(--success)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Basic</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Focus on soft skills, elevator pitches, and common behavioral questions.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Clock size={16} /> 30 Minutes Session</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><MessageSquare size={16} /> Behavioral Scenarios</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Award size={16} /> Low Pressure Feedback</div>
          </div>
          
          <button onClick={() => handleSelect('basic')} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>Select Level</button>
        </div>

        {/* Medium Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '16px', 
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Standard</div>
          <div style={{ background: 'rgba(37, 99, 235, 0.1)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Zap size={20} color="var(--accent-primary)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Medium</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Deep specific technical depth and challenging situational scenarios.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Clock size={16} /> 45 Minutes Session</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Target size={16} /> Technical Deep Dive</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><MessageSquare size={16} /> Mid-tension Roleplay</div>
          </div>
          
          <button onClick={() => handleSelect('medium')} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>Select Level</button>
        </div>

        {/* Hard Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '16px', 
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Executive</div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <ShieldAlert size={20} color="var(--warning)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Hard</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Aggressive questioning, high-stakes negotiation, and stress testing.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Clock size={16} /> 60 Minutes Session</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><ShieldAlert size={16} /> Stress & Pivot Scenarios</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Award size={16} /> Critical Performance Review</div>
          </div>
          
          <button onClick={() => handleSelect('advanced')} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>Select Level</button>
        </div>

      </div>
    </div>
  );
};

export default DifficultySelector;
