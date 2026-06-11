import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, Scan } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ResumeUploader = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (selectedFile) => {
    if (selectedFile && (selectedFile.type === 'text/plain' || selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.txt'))) {
      setFile(selectedFile);
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        // Dramatic 3-second laser scan animation before proceeding
        setTimeout(() => {
          setIsUploading(false);
          onUploadComplete(e.target.result);
        }, 3000); 
      };
      reader.readAsText(selectedFile);
    } else {
      alert("Please upload a .txt or .md file for this demo.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    processFile(droppedFile);
  };

  const handleChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel"
      style={{ padding: '2.5rem', maxWidth: '550px', margin: '0 auto', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Optimize Your Trajectory</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
          Upload your current resume to let our AI engineer your professional evolution and identify strategic skill gaps.
        </p>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1px solid ${isDragging ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: '24px',
          padding: '4rem 2rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-secondary)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '350px'
        }}
        onClick={() => !isUploading && document.getElementById('resume-upload').click()}
      >
        <input 
          type="file" 
          id="resume-upload" 
          style={{ display: 'none' }} 
          accept=".txt,.md" 
          onChange={handleChange}
          disabled={isUploading}
        />
        
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
            >
              <div style={{ 
                background: 'rgba(37, 99, 235, 0.1)', 
                padding: '1.5rem', 
                borderRadius: '50%', 
                marginBottom: '1.5rem' 
              }}>
                <FileText size={48} color="var(--accent-primary)" />
              </div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Drag & Drop Resume</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                Supported formats: TXT, MD (Max ~10KB)
              </p>
              
              <button style={{
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                padding: '1rem 3rem',
                borderRadius: '30px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                width: '80%'
              }}>
                Select File
              </button>
            </motion.div>
          ) : isUploading ? (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'relative', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <FileText size={64} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
              
              <motion.div
                animate={{ y: [-40, 40, -40] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  position: 'absolute',
                  width: '100px',
                  height: '4px',
                  background: 'var(--accent-primary)',
                  boxShadow: '0 0 15px 5px rgba(37, 99, 235, 0.6)',
                  borderRadius: '2px',
                  zIndex: 10
                }}
              />
              
              <motion.h3 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{ color: 'var(--accent-primary)', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}
              >
                <Scan size={20} /> AI Analyzing Resume Profile...
              </motion.h3>
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '1.5rem' }} />
              <h3 style={{ color: 'var(--success)', fontSize: '1.5rem' }}>Analysis Complete</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <FileText size={18} /> {file.name}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ResumeUploader;
