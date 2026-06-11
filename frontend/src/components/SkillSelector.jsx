import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, CheckCircle } from 'lucide-react';

const SkillSelector = ({ extractedSkills, onStartInterview, isLoading }) => {
  const [selected, setSelected] = useState([]);

  const toggleSkill = (skill) => {
    if (selected.includes(skill)) {
      setSelected(selected.filter(s => s !== skill));
    } else {
      setSelected([...selected, skill]);
    }
  };

  const handleStart = () => {
    if (selected.length >= 2) {
      onStartInterview(selected);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Target size={40} className="spinner" style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-primary)' }} />
        </div>
        <h3>Analyzing your resume...</h3>
        <p>Extracting key technical skills to target.</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Select Target Skills</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          We extracted the following skills from your resume. Select <strong>at least two</strong> skills that you want the AI to rigorously test you on.
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.8rem', 
        justifyContent: 'center',
        marginBottom: '2rem'
      }}>
        {extractedSkills.map((skill, index) => {
          const isSelected = selected.includes(skill);
          return (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleSkill(skill)}
              style={{
                background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
                color: isSelected ? 'white' : 'var(--text-secondary)',
                padding: '0.6rem 1.2rem',
                borderRadius: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              {isSelected && <CheckCircle size={16} />}
              {skill}
            </motion.button>
          );
        })}
      </div>

      <button 
        onClick={handleStart}
        disabled={selected.length < 2}
        style={{ 
          width: '100%', 
          maxWidth: '300px',
          padding: '1rem', 
          background: selected.length >= 2 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
          border: 'none', 
          color: selected.length >= 2 ? 'white' : 'rgba(255,255,255,0.3)', 
          borderRadius: '8px', 
          cursor: selected.length >= 2 ? 'pointer' : 'not-allowed', 
          fontWeight: 'bold',
          fontSize: '1rem',
          transition: 'all 0.3s'
        }}
      >
        {selected.length < 2 ? `Select ${2 - selected.length} more skill${selected.length === 1 ? '' : 's'}` : 'Start Interview'}
      </button>
    </div>
  );
};

export default SkillSelector;
