import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResumeUploader from './components/ResumeUploader';
import ConfigureSession from './components/ConfigureSession';
import ChatWindow from './components/ChatWindow';
import CoachChat from './components/CoachChat';
import InterviewReport from './components/InterviewReport';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import { uploadResume, createThread, fetchHistory, extractSkills, createCoachThread } from './services/aiService';

function App() {
  const [step, setStep] = useState(localStorage.getItem('careerForgeToken') ? 'upload' : 'landing'); // 'landing' | 'auth' | 'upload' | 'history' | 'coach' | 'configure' | 'chat' | 'report'
  const [resumeText, setResumeText] = useState('');
  
  // Settings
  const [difficulty, setDifficulty] = useState('');
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [timeLimit, setTimeLimit] = useState(0); 
  
  // Skills
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [resumeId, setResumeId] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [coachThreadId, setCoachThreadId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Tracking progress & Anti-cheat
  const [questionCount, setQuestionCount] = useState(0);
  const [reportData, setReportData] = useState(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  
  // History
  const [pastInterviews, setPastInterviews] = useState([]);

  useEffect(() => {
    const loadHistory = async () => {
      const data = await fetchHistory();
      if (data && Array.isArray(data)) {
        setPastInterviews(data);
      }
    };
    if (step === 'upload' || step === 'history') {
      loadHistory();
    }
  }, [step]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'chat') {
        setTabSwitches(prev => prev + 1);
        setMessages(prev => [
          ...prev, 
          { 
            role: 'bot', 
            content: `⚠️ **ANTI-CHEAT WARNING**: Tab switching detected. Please remain on this screen. This incident has been recorded and will impact your final evaluation.` 
          }
        ]);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [step]);

  const handleUploadComplete = async (text) => {
    setResumeText(text);
    setIsLoading(true);
    setIsExtractingSkills(true);
    
    try {
      const data = await uploadResume(text);
      setResumeId(data.resume_id);
      
      // Start skill extraction in background
      extractSkills(text).then(skills => {
        setExtractedSkills(skills);
        setIsExtractingSkills(false);
      }).catch(err => {
        setExtractedSkills(["React", "Node.js", "Python", "System Design", "Algorithms"]);
        setIsExtractingSkills(false);
      });
      
      const coachData = await createCoachThread(data.resume_id);
      setCoachThreadId(coachData.thread_id);
      setStep('coach');
    } catch (err) {
      console.error(err);
      alert("Failed to start coach session.");
      setStep('upload');
      setIsExtractingSkills(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartInterview = async (selectedDifficulty, skills) => {
    setDifficulty(selectedDifficulty);
    setSelectedSkills(skills);
    setMaxQuestions(5); // Hardcoded for now
    setTimeLimit(0); // Unlimited time
    
    setStep('chat');
    setIsLoading(true);
    setQuestionCount(1);
    setTabSwitches(0);
    setHintCount(0);
    
    if (!resumeId) {
      alert("Error: Resume was not uploaded properly. Please go back and upload again.");
      setStep('upload');
      setIsLoading(false);
      return;
    }

    try {
      const data = await createThread(resumeId, selectedDifficulty, 5, skills);
      setThreadId(data.thread_id);
    } catch (err) {
      console.error(err);
      alert("Could not start interview. Check if backend is running.");
      setStep('upload');
    }
    setIsLoading(false);
  };

  const handleInterviewComplete = (finalReportData) => {
    setReportData(finalReportData);
    setStep('report');
  };

  const handleRestart = () => {
    setStep('upload');
    setResumeText('');
    setDifficulty('');
    setMessages([]);
    setQuestionCount(0);
    setReportData(null);
    setTabSwitches(0);
    setHintCount(0);
    setSelectedSkills([]);
    setCoachThreadId(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('careerForgeToken');
    localStorage.removeItem('careerForgeUserId');
    setStep('auth');
    setPastInterviews([]);
  };

  const handleTabChange = async (tabId) => {
    if (tabId === 'history') setStep('history');
    if (tabId === 'new') setStep('upload');
    if (tabId === 'coach') {
      if (coachThreadId) {
        setStep('coach');
      } else if (resumeId) {
        setIsLoading(true);
        try {
          const coachData = await createCoachThread(resumeId);
          setCoachThreadId(coachData.thread_id);
          setStep('coach');
        } catch (err) {
          console.error("Failed to create coach thread", err);
        }
        setIsLoading(false);
      } else {
        alert("Please upload a resume first to access the Coach Chat.");
      }
    }
  };

  if (step === 'landing') {
    return <LandingPage onGetStarted={() => setStep('auth')} />;
  }

  if (step === 'auth') {
    return <Auth onLoginSuccess={() => setStep('upload')} />;
  }

  const getActiveTab = () => {
    if (step === 'history') return 'history';
    if (step === 'coach') return 'coach';
    return 'new'; // upload, configure, chat, report all fall under "new interview" flow
  };

  return (
    <DashboardLayout activeTab={getActiveTab()} onTabChange={handleTabChange} onLogout={handleLogout}>
      {isLoading && step === 'upload' ? (
         <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
            <div style={{ width: '50px', height: '50px', border: '4px solid #3b82f6', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Preparing Tech Lead Session...</p>
         </div>
      ) : (
      <AnimatePresence mode="wait">
        
        {step === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}
          >
            <h2 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Interview History</h2>
            {pastInterviews.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{h.date}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'capitalize' }}>{h.difficulty} Difficulty</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: h.score >= 80 ? '#10b981' : h.score >= 60 ? '#f59e0b' : '#ef4444' }}>Score: {h.score}</div>
                  <div style={{ fontSize: '0.9rem' }}>{h.verdict}</div>
                </div>
              </div>
            ))}
            {pastInterviews.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center' }}>No past interviews found.</p>
            )}
          </motion.div>
        )}

        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%' }}
          >
            <ResumeUploader onUploadComplete={handleUploadComplete} />
          </motion.div>
        )}

        {step === 'coach' && coachThreadId && (
          <motion.div
            key="coach"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%' }}
          >
            <CoachChat 
              threadId={coachThreadId}
              token={localStorage.getItem('careerForgeToken')}
              onProceed={() => setStep('configure')}
              resumeText={resumeText}
              setResumeText={setResumeText}
              extractedSkills={extractedSkills}
            />
          </motion.div>
        )}

        {step === 'configure' && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%' }}
          >
            <ConfigureSession 
              extractedSkills={extractedSkills}
              isExtractingSkills={isExtractingSkills}
              onStartInterview={handleStartInterview}
              onBack={() => setStep('coach')}
            />
          </motion.div>
        )}

        {step === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%' }}
          >
            <ChatWindow 
              threadId={threadId}
              token={localStorage.getItem('careerForgeToken')}
              timeLimit={timeLimit}
              questionCount={questionCount}
              maxQuestions={maxQuestions}
              onComplete={handleInterviewComplete}
            />
          </motion.div>
        )}

        {step === 'report' && reportData && (
          <motion.div
            key="report"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring' }}
            style={{ height: '100%' }}
          >
            <InterviewReport reportData={reportData} onRestart={handleRestart} messages={messages} />
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </DashboardLayout>
  );
}

export default App;
