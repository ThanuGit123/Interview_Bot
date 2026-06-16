import React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, History, MessageSquare, LogOut, Bot } from 'lucide-react';

const DashboardLayout = ({ children, activeTab = 'new', onTabChange, onLogout }) => {
  
  const navItems = [
    { id: 'new', label: 'New Interview', icon: PlusCircle },
    { id: 'history', label: 'Interview History', icon: History },
    { id: 'coach', label: 'Coach Chat', icon: MessageSquare }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      background: '#111827', 
      color: 'white',
      padding: '2rem',
      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize: '20px 20px'
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          width: '100%', 
          maxWidth: '1200px', 
          height: '100%',
          minHeight: '800px',
          background: '#0b1120', 
          borderRadius: '16px',
          border: '2px solid rgba(139, 92, 246, 0.4)', // Glowing purple border
          boxShadow: '0 0 50px rgba(139, 92, 246, 0.15)', // Purple glow
          overflow: 'hidden',
          display: 'flex'
        }}
      >
        {/* Sidebar */}
        <div style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem', background: '#0b1120' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
            <Bot size={28} color="#3b82f6" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6', margin: 0 }}>Interview Bot</h1>
          </div>

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange && onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: activeTab === item.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: activeTab === item.id ? '#f8fafc' : '#64748b',
                  fontWeight: activeTab === item.id ? '600' : '500',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  width: '100%'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.color = '#cbd5e1';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              width: '100%',
              marginTop: 'auto'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, position: 'relative', background: '#0f172a', borderLeft: '1px solid rgba(255,255,255,0.02)' }}>
          {/* Particle effect layer specific to the right panel */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '30px 30px', pointerEvents: 'none', zIndex: 0 }} />
          
          <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', overflowY: 'auto' }}>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardLayout;
