import React, { useState } from 'react';
import { FileText, CheckCircle, Scan } from 'lucide-react';
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.75rem' }}>Optimize Your Trajectory</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '450px', margin: '0 auto', lineHeight: '1.5' }}>
          Upload your current resume to let our AI engineer your professional evolution and identify strategic skill gaps.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1px solid ${isDragging ? '#3b82f6' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: '24px',
          padding: '4rem 2rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : '#111827',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '500px',
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
                background: 'rgba(37, 99, 235, 0.2)', 
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%', 
                marginBottom: '1.5rem' 
              }}>
                <FileText size={36} color="#3b82f6" />
              </div>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.5rem', color: '#f8fafc', fontWeight: '700' }}>Drag & Drop Resume</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
                Supported formats: TXT, MD (Max ~10KB)
              </p>
              
              <button style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '0.85rem 3rem',
                borderRadius: '30px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                width: '85%',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.background = '#2563eb'}
              >
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
              <FileText size={64} color="#475569" style={{ opacity: 0.5 }} />
              
              <motion.div
                animate={{ y: [-40, 40, -40] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  position: 'absolute',
                  width: '100px',
                  height: '4px',
                  background: '#3b82f6',
                  boxShadow: '0 0 15px 5px rgba(59, 130, 246, 0.6)',
                  borderRadius: '2px',
                  zIndex: 10
                }}
              />
              
              <motion.h3 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{ color: '#3b82f6', marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: '600' }}
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
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <CheckCircle size={64} color="#10b981" style={{ marginBottom: '1.5rem' }} />
              <h3 style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: '700' }}>Analysis Complete</h3>
              <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} /> {file.name}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ResumeUploader;
