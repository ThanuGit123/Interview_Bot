import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Mic, MicOff, Lightbulb, Clock, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { getHint } from '../services/aiService';
import Editor from '@monaco-editor/react';

const ChatWindow = ({ messages, onSendMessage, isLoading, timeLimitMinutes, questionCount, onHintRequested, isCodingRound }) => {
  const [input, setInput] = useState('');
  const [codeValue, setCodeValue] = useState('// Write your code here...\n');
  const [language, setLanguage] = useState('javascript');
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [hintLoading, setHintLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    setTimeLeft(timeLimitMinutes * 60);
  }, [questionCount, timeLimitMinutes]);

  useEffect(() => {
    if (timeLimitMinutes === 0 || isLoading) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSendMessage(input || "(Time Expired - Auto Submitted Blank Answer)");
          setInput('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isLoading, timeLimitMinutes, onSendMessage, input]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Input. Try Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? " " : "") + transcript);
      setIsRecording(false);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleSend = (e) => {
    e.preventDefault();
    
    // If it's a coding round and there is code, submit the code along with the message
    let submission = input.trim();
    if (isCodingRound && codeValue.trim() !== '// Write your code here...') {
      submission += `\n\n\`\`\`${language}\n${codeValue}\n\`\`\``;
    }
    
    if (submission && !isLoading) {
      onSendMessage(submission);
      setInput('');
      // Reset code for the next question
      if (isCodingRound) {
        setCodeValue('// Write your code here...\n');
      }
    }
  };

  const requestHint = async () => {
    if (hintLoading || isLoading) return;
    setHintLoading(true);
    const hintText = await getHint(messages);
    onHintRequested(hintText);
    setHintLoading(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', maxWidth: isCodingRound ? '1400px' : '900px', margin: '0 auto', transition: 'all 0.5s ease' }}>
      
      {/* CHAT SECTION */}
      <div className="glass-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 150px)',
        flex: 1,
        position: 'relative'
      }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={requestHint}
            disabled={isLoading || hintLoading}
            style={{
              background: 'rgba(234, 179, 8, 0.1)',
              color: 'var(--warning)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: (isLoading || hintLoading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            <Lightbulb size={16} /> {hintLoading ? 'Thinking...' : 'Get Hint (-5 pts)'}
          </button>

          {timeLimitMinutes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: timeLeft < 60 ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>
              <Clock size={20} /> {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {messages.map((msg, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                gap: '1rem',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {msg.role === 'user' ? <User size={20} color="white" /> : <Bot size={20} color="var(--accent-secondary)" />}
              </div>
              <div style={{
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                padding: msg.role === 'user' ? '1.2rem' : '1.5rem',
                borderRadius: '16px',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'bot' ? '4px' : '16px',
                maxWidth: '85%',
                color: 'var(--text-primary)',
                boxShadow: msg.role === 'user' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                lineHeight: '1.6',
                overflowX: 'auto',
                width: msg.role === 'bot' ? '100%' : 'auto',
                border: msg.role === 'bot' ? '1px solid rgba(255,255,255,0.05)' : 'none'
              }}>
                {msg.role === 'bot' ? (
                  msg.content.includes('### Feedback') && msg.content.includes('### Next Question') ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                      <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--accent-primary)' }}>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Feedback on Last Answer</div>
                        <ReactMarkdown>{msg.content.split('### Next Question')[0].replace('### Feedback', '').trim()}</ReactMarkdown>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Next Question</div>
                        <ReactMarkdown>{msg.content.split('### Next Question')[1].trim()}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0', background: 'transparent' }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )
                ) : (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} color="var(--accent-secondary)" />
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.2rem', borderRadius: '16px', borderTopLeftRadius: '4px', color: 'var(--text-secondary)' }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  Interviewer is typing...
                </motion.div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} style={{ 
          padding: '1.5rem', 
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          gap: '1rem',
          background: 'var(--bg-primary)',
          borderBottomLeftRadius: '24px',
          borderBottomRightRadius: '24px',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isLoading}
            style={{
              background: isRecording ? 'var(--danger)' : 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isRecording ? '0 0 15px var(--danger)' : 'none'
            }}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Type your response to Lumina..."}
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '30px',
              padding: '0 1.5rem',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />

          <button 
            type="submit"
            disabled={isLoading || (!input.trim() && !isCodingRound)}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (isLoading) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || (!input.trim() && !isCodingRound)) ? 0.5 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Send size={20} />
          </button>
        </form>
      </div>

      {/* CODE EDITOR SECTION (Only visible during coding rounds) */}
      <AnimatePresence>
        {isCodingRound && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '600px', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="glass-panel"
            style={{ 
              height: 'calc(100vh - 150px)', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                <Code2 size={20} color="var(--accent-secondary)" /> IDE / Compiler
              </div>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: 'none',
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            
            <div style={{ flex: 1, padding: '1rem 0' }}>
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={codeValue}
                onChange={(val) => setCodeValue(val)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on'
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

export default ChatWindow;
