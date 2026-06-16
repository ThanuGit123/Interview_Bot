import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, User, Briefcase, Award, Target, ArrowRight, ArrowLeft } from 'lucide-react';

const ConfigureSession = ({ extractedSkills = [], isExtractingSkills = false, onStartInterview, onBack }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedSkills, setSelectedSkills] = useState([]);

  const toggleSkill = (skillName) => {
    if (selectedSkills.includes(skillName)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skillName));
    } else {
      setSelectedSkills([...selectedSkills, skillName]);
    }
  };

  const difficulties = [
    {
      id: 'basic',
      title: 'Junior',
      icon: User,
      description: 'Foundational concepts, basic problem solving, and syntax-level questions.'
    },
    {
      id: 'medium',
      title: 'Mid-Level',
      icon: Briefcase,
      description: 'Architectural patterns, performance optimization, and project trade-offs.'
    },
    {
      id: 'advanced',
      title: 'Senior',
      icon: Award,
      description: 'System design, scalability, leadership, and high-level strategy decisions.'
    }
  ];

  return (
    <div style={{ padding: '2rem 3rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Progress Tracker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', padding: '0 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} color="#60a5fa" />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Resume Uploaded</span>
        </div>
        
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 1rem', alignSelf: 'flex-start', marginTop: '15px' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold' }}>
            02
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Configure Session</span>
        </div>

        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 1rem', alignSelf: 'flex-start', marginTop: '15px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
            03
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Start Interview</span>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.5rem' }}>Configure Your Interview Session</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Tailor the AI behavior to match the role and your expertise level.</p>
      </div>

      {/* Difficulty Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', marginBottom: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>
          <Check size={18} /> Session Difficulty
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {difficulties.map(diff => {
            const isSelected = selectedDifficulty === diff.id;
            return (
              <motion.div
                key={diff.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDifficulty(diff.id)}
                style={{
                  flex: 1,
                  background: isSelected ? 'rgba(37, 99, 235, 0.1)' : '#111827',
                  border: `1px solid ${isSelected ? '#2563eb' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '12px',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <diff.icon size={18} color={isSelected ? '#60a5fa' : '#94a3b8'} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: isSelected ? '#f8fafc' : '#cbd5e1', marginBottom: '0.5rem' }}>{diff.title}</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: '1.4' }}>{diff.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Skills Section */}
      <div style={{ marginBottom: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', marginBottom: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>
          <Target size={18} /> Targeted Skills
        </div>
        
        <div style={{ background: '#111827', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em', marginBottom: '1rem', textTransform: 'uppercase' }}>
            SUGGESTED BASED ON YOUR RESUME
          </div>
          
          {isExtractingSkills ? (
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#38bdf8', fontSize: '0.9rem', padding: '1rem 0' }}>
               <Target size={18} className="spinner" style={{ animation: 'spin 2s linear infinite' }} />
               Extracting skills...
               <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
             </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {extractedSkills.map((skillObj, index) => {
                const skillName = typeof skillObj === 'string' ? skillObj : skillObj.skill;
                const confidence = skillObj.confidence ? Math.round(skillObj.confidence * 100) : null;
                const isSelected = selectedSkills.includes(skillName);
                return (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleSkill(skillName)}
                    style={{
                      background: isSelected ? '#1e3a8a' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.05)'}`,
                      color: isSelected ? '#f8fafc' : '#94a3b8',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {skillName}
                    {confidence && (
                      <span style={{ fontSize: '0.7rem', color: isSelected ? '#93c5fd' : '#475569', background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                        {confidence}%
                      </span>
                    )}
                  </motion.button>
                );
              })}
              {extractedSkills.length === 0 && (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No skills found. Try re-uploading a more detailed resume.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button 
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#94a3b8'}
          onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <ArrowLeft size={16} /> Re-upload Resume
        </button>

        <button 
          onClick={() => onStartInterview(selectedDifficulty, selectedSkills)}
          disabled={isExtractingSkills || selectedSkills.length < 2}
          style={{ 
            background: (isExtractingSkills || selectedSkills.length < 2) ? 'rgba(37, 99, 235, 0.5)' : '#2563eb', 
            color: 'white', 
            border: 'none', 
            padding: '0.75rem 1.5rem', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '0.9rem', 
            fontWeight: '600',
            cursor: (isExtractingSkills || selectedSkills.length < 2) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { if(!isExtractingSkills && selectedSkills.length >= 2) e.currentTarget.style.background = '#1d4ed8' }}
          onMouseOut={(e) => { if(!isExtractingSkills && selectedSkills.length >= 2) e.currentTarget.style.background = '#2563eb' }}
        >
          {selectedSkills.length < 2 ? `Select ${2 - selectedSkills.length} more skill${selectedSkills.length === 1 ? '' : 's'}` : 'Start Interview'}
          <ArrowRight size={16} />
        </button>
      </div>

    </div>
  );
};

export default ConfigureSession;
