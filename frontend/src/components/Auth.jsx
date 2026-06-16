import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, User as UserIcon, ArrowRight, ArrowLeft } from 'lucide-react';

const Auth = ({ onLoginSuccess, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    
    try {
      const payload = isLogin 
        ? JSON.stringify({ email, password }) 
        : JSON.stringify({ email, password, name: fullName });
        
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers,
        body: payload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Store JWT token
      const token = data.access_token;
      localStorage.setItem('careerForgeToken', token);
      localStorage.setItem('careerForgeUserId', data.user._id);
      
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0b1120', padding: '2rem' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          width: '100%', 
          maxWidth: '420px', 
          background: '#0f172a', 
          borderRadius: '16px',
          border: '2px solid rgba(139, 92, 246, 0.4)', // Glowing purple border
          boxShadow: '0 0 50px rgba(139, 92, 246, 0.15)', // Purple glow
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Particle effect layer */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 2.5rem' }}>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, padding: '0.4rem 0.5rem', borderRadius: '8px', transition: 'color 0.2s' }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#94a3b8')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              <ArrowLeft size={15} /> Back to home
            </button>
          )}

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ 
              fontSize: '2.4rem', 
              fontWeight: '700', 
              margin: '0 0 0.5rem 0',
              color: '#3b82f6', // Solid brighter blue like screenshot
            }}>
              Caliber
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
              Your AI interview trainer
            </p>
          </div>
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.875rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          {/* INNER CARD */}
          <div style={{ background: '#111827', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {!isLogin && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <UserIcon size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '8px', color: 'white', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                      onBlur={(e) => e.target.style.borderColor = '#1e293b'}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '8px', color: 'white', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = '#1e293b'}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Password</label>
                  {isLogin && <span style={{ fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', fontWeight: '500' }}>Forgot?</span>}
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '8px', color: 'white', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = '#1e293b'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem', 
                  background: '#1e3a8a', 
                  color: '#60a5fa', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: '600', 
                  fontSize: '0.875rem',
                  marginTop: '0.5rem', 
                  cursor: loading ? 'not-allowed' : 'pointer', 
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1e40af', e.currentTarget.style.color = 'white')}
                onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1e3a8a', e.currentTarget.style.color = '#60a5fa')}
              >
                {loading ? 'Processing...' : (isLogin ? 'Log in' : 'Sign up')}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              {isLogin ? "No account? " : "Already have an account? "}
              <span 
                onClick={() => setIsLogin(!isLogin)} 
                style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '500' }}
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </span>
            </p>
          </div>

          <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '600', color: '#334155', letterSpacing: '0.15em' }}>
            ✦ ENTERPRISE READY ✦
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
