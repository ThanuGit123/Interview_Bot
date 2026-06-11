import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResumeUploader from './components/ResumeUploader';
import DifficultySelector from './components/DifficultySelector';
import SkillSelector from './components/SkillSelector';
import ChatWindow from './components/ChatWindow';
import InterviewReport from './components/InterviewReport';
import { generateInterviewQuestions, evaluateAnswer, extractSkills } from './services/aiService';
import { History, Bot } from 'lucide-react';

function App() {
  const [step, setStep] = useState('upload'); // 'upload' | 'history' | 'difficulty' | 'skills' | 'chat' | 'report'
  const [resumeText, setResumeText] = useState('');
  
  // Settings
  const [difficulty, setDifficulty] = useState('');
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [timeLimit, setTimeLimit] = useState(0); 
  
  // Skills
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);

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
    const saved = localStorage.getItem('careerForgeHistory');
    if (saved) {
      setPastInterviews(JSON.parse(saved));
    }
  }, []);

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

  const handleUploadComplete = (text) => {
    setResumeText(text);
    setStep('difficulty');
  };

  const handleDifficultySelect = async (settings) => {
    setDifficulty(settings.difficulty);
    setMaxQuestions(settings.maxQuestions);
    setTimeLimit(settings.timeLimit);
    
    // Move to skills extraction screen
    setStep('skills');
    setIsExtractingSkills(true);
    const skills = await extractSkills(resumeText);
    setExtractedSkills(skills);
    setIsExtractingSkills(false);
  };

  const handleStartInterview = async (skills) => {
    setSelectedSkills(skills);
    setStep('chat');
    setIsLoading(true);
    setQuestionCount(1);
    setTabSwitches(0);
    setHintCount(0);
    
    const botResponse = await generateInterviewQuestions(resumeText, difficulty, maxQuestions, skills);
    
    setMessages([
      { 
        role: 'bot', 
        content: botResponse.message 
      }
    ]);
    setIsLoading(false);
  };

  const handleSendMessage = async (text) => {
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsLoading(true);

    const isFinalQuestion = questionCount >= maxQuestions;
    const nextRound = questionCount + 1;
    
    const botResponse = await evaluateAnswer(resumeText, difficulty, messages, text, isFinalQuestion, tabSwitches, nextRound, hintCount, maxQuestions, selectedSkills);

    if (botResponse.isReport) {
      setReportData(botResponse.reportData);
      setStep('report');
      
      const newHistory = [
        { 
          date: new Date().toLocaleDateString(), 
          score: botResponse.reportData.overallScore, 
          difficulty,
          verdict: botResponse.reportData.finalVerdict 
        }, 
        ...pastInterviews
      ];
      setPastInterviews(newHistory);
      localStorage.setItem('careerForgeHistory', JSON.stringify(newHistory));

    } else {
      setMessages([...newMessages, { role: 'bot', content: botResponse.message }]);
      setQuestionCount(prev => prev + 1);
    }
    
    setIsLoading(false);
  };

  const handleHintRequested = (hintText) => {
    setHintCount(prev => prev + 1);
    setMessages(prev => [
      ...prev,
      { role: 'bot', content: `💡 **Hint (-5 pts)**: ${hintText}` }
    ]);
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
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '2rem', 
      background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.05), transparent 40%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem', position: 'relative' }}>
        
        {step === 'upload' && pastInterviews.length > 0 && (
          <button 
            onClick={() => setStep('history')}
            style={{ position: 'absolute', right: '2rem', top: '2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <History size={18} /> View History
          </button>
        )}

        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            margin: 0,
            background: 'linear-gradient(to right, #60A5FA, #2563EB)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.8rem'
          }}
        >
          <Bot size={36} color="#3B82F6" />
          Interview Bot
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ color: 'var(--text-secondary)' }}
        >
          {step === 'chat' 
            ? `Question ${questionCount} of ${maxQuestions} (${difficulty})` 
            : step === 'report' 
              ? 'Interview Results' 
              : 'Your ultimate FAANG interview simulator.'}
        </motion.p>
      </header>

      <main style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="wait">
          
          {step === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel"
              style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}
            >
              <h2 style={{ marginBottom: '2rem' }}>Interview History</h2>
              {pastInterviews.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{h.date}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'capitalize' }}>{h.difficulty} Difficulty</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: h.score >= 80 ? 'var(--success)' : h.score >= 60 ? 'var(--warning)' : 'var(--danger)' }}>Score: {h.score}</div>
                    <div style={{ fontSize: '0.9rem' }}>{h.verdict}</div>
                  </div>
                </div>
              ))}
              <button onClick={() => setStep('upload')} style={{ marginTop: '2rem', padding: '0.5rem 1rem', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>Back to Home</button>
            </motion.div>
          )}

          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <ResumeUploader onUploadComplete={handleUploadComplete} />
            </motion.div>
          )}

          {step === 'difficulty' && (
            <motion.div
              key="difficulty"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <DifficultySelector onSelectSettings={handleDifficultySelect} />
            </motion.div>
          )}

          {step === 'skills' && (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <SkillSelector 
                extractedSkills={extractedSkills} 
                onStartInterview={handleStartInterview} 
                isLoading={isExtractingSkills}
              />
            </motion.div>
          )}

          {step === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: 'spring' }}
            >
              <ChatWindow 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                isLoading={isLoading} 
                timeLimitMinutes={timeLimit}
                questionCount={questionCount}
                onHintRequested={handleHintRequested}
                isCodingRound={((questionCount - 1) % 5) + 1 === 3}
              />
            </motion.div>
          )}

          {step === 'report' && reportData && (
            <motion.div
              key="report"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <InterviewReport reportData={reportData} onRestart={handleRestart} messages={messages} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
