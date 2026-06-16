import React from 'react';
import { motion } from 'framer-motion';
import { Bot, PlayCircle, Shield, Code2, Cloud, Server, Terminal, Lock } from 'lucide-react';
import './LandingPage.css';

const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="lp-navbar">
        <div className="lp-logo">
          <Bot size={28} color="#38bdf8" />
          Caliber
        </div>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#curriculum">Curriculum</a>
          <a href="#success-stories">Success Stories</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn-ghost" onClick={onGetStarted}>Sign In</button>
          <button className="lp-btn-primary" onClick={onGetStarted}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-badge">
            ✨ NEW: STREAMING REAL-TIME AI AGENTS
          </div>
          <h1 className="lp-title">
            Master Your
            <span className="lp-title-highlight">Technical</span>
            <span className="lp-title-highlight">Interview</span>
          </h1>
          <p className="lp-subtitle">
            The AI-powered trainer that plans, acts, and reflects on your performance in real-time. Experience a world-class coach available 24/7.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary lp-btn-large" onClick={onGetStarted}>
              Get Started for Free
            </button>
            <button className="lp-btn-secondary" onClick={() => alert("Demo coming soon!")}>
              <PlayCircle size={20} />
              Watch 3-min Demo
            </button>
          </div>
          <div className="lp-stats">
            <div className="lp-stat-item">
              <h3>50k+</h3>
              <p>Engineers Trained</p>
            </div>
            <div className="lp-stat-item">
              <h3>84%</h3>
              <p>Success Rate</p>
            </div>
            <div className="lp-stat-item">
              <h3>24/7</h3>
              <p>AI Availability</p>
            </div>
          </div>
        </div>
        <div className="lp-hero-visual">
          <motion.img 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            src="/hero_mockup.png" 
            alt="Caliber Dashboard Mockup" 
            className="lp-hero-image"
          />
        </div>
      </section>

      {/* Trusted By */}
      <section className="lp-trusted">
        <p>TRUSTED BY ENGINEERS FROM TOP-TIER COMPANIES</p>
        <div className="lp-logos">
          <div className="lp-logo-item"><Code2 size={20}/> Google</div>
          <div className="lp-logo-item"><Shield size={20}/> Meta</div>
          <div className="lp-logo-item"><Cloud size={20}/> Amazon</div>
          <div className="lp-logo-item"><Terminal size={20}/> Microsoft</div>
          <div className="lp-logo-item"><Server size={20}/> Netflix</div>
          <div className="lp-logo-item"><Lock size={20}/> Stripe</div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="lp-cta-wrapper">
        <div className="lp-cta-card">
          <h2 className="lp-cta-title">Ready to Ace Your Next Round?</h2>
          <p className="lp-cta-subtitle">
            Join 50,000+ engineers who used Caliber to land offers at their dream companies. Start practicing today.
          </p>
          <div className="lp-cta-actions">
            <button className="lp-btn-white" onClick={onGetStarted}>Get Lifetime Access</button>
            <button className="lp-btn-outline" onClick={() => alert("Enterprise sales team will be added soon!")}>Schedule Enterprise Demo</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-logo">
              <Bot size={24} color="#38bdf8" />
              Caliber
            </div>
            <p>The world's most advanced AI platform for engineering interview preparation. Master the craft, land the job.</p>
          </div>
          <div className="lp-footer-col">
            <h4>PRODUCT</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#updates">Updates</a></li>
              <li><a href="#api">API Access</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h4>COMPANY</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#terms">Terms of Service</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#support">Contact Support</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2024 Interview Systems Inc. All rights reserved.</span>
          <span>Built for Engineers, by Engineers</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
