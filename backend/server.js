require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getLeetCodeDifficulty = (diff) => {
  if (diff === 'basic') return 'LeetCode Easy';
  if (diff === 'medium') return 'LeetCode Medium';
  if (diff === 'advanced') return 'LeetCode Hard';
  return 'LeetCode Medium';
};

app.post('/api/generate-questions', async (req, res) => {
  const { resumeText, difficulty, maxQuestions } = req.body;
  const lcDifficulty = getLeetCodeDifficulty(difficulty);
  
  if (!process.env.GROQ_API_KEY) {
    return res.json({
      message: `Hi! We'll do a ${maxQuestions}-round comprehensive interview today. \n\nLet's start with Round 1: I see you worked on a specific project. Can you explain the biggest technical challenge you faced?`,
      context: "User is ready."
    });
  }

  try {
    const prompt = `You are an expert technical interviewer conducting a holistic ${maxQuestions}-round interview.
    
    Difficulty Standard: ${lcDifficulty}
    Resume Context: ${resumeText.substring(0, 3000)}
    
    Task: This is ROUND 1. Greet the candidate professionally, and immediately ask a "Project Deep-Dive" question.
    Pick one specific project or experience from their resume and ask a challenging question about their technical decisions, architecture, or a challenge they faced.
    Keep it conversational but rigorous. Do not ask algorithmic questions yet.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
    });
    
    res.json({
      message: chatCompletion.choices[0]?.message?.content || "Could not generate a response.",
      context: "Interview started."
    });
  } catch (error) {
    console.error("Error generating question:", error);
    res.status(500).json({ error: "Error connecting to AI." });
  }
});

app.post('/api/get-hint', async (req, res) => {
  const { chatHistory } = req.body;
  
  if (!process.env.GROQ_API_KEY) {
    return res.json({ hint: "Consider using a hash map or two pointers." });
  }

  try {
    const conversation = chatHistory.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`).join('\n\n');
    const prompt = `You are an expert technical interviewer. The candidate is stuck and has requested a hint for the current question.
    
    Conversation History:
    ${conversation}
    
    Task: Look at the most recent question asked by the interviewer. Provide a very brief, subtle hint to nudge the candidate in the right direction. Do NOT give them the direct answer or the full code. 1-2 sentences maximum.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
    });
    
    res.json({ hint: chatCompletion.choices[0]?.message?.content || "Try breaking down the problem into smaller steps." });
  } catch (error) {
    console.error("Error generating hint:", error);
    res.status(500).json({ error: "Error connecting to AI." });
  }
});

app.post('/api/evaluate-answer', async (req, res) => {
  const { resumeText, difficulty, chatHistory, latestAnswer, isFinalQuestion, tabSwitches, hintCount, currentRound, maxQuestions } = req.body;
  const lcDifficulty = getLeetCodeDifficulty(difficulty);
  
  if (!process.env.GROQ_API_KEY) {
    if (isFinalQuestion) {
      return res.json({
        isReport: true,
        reportData: {
          overallScore: 85,
          metrics: {
            projectExplanation: "Strong",
            technicalKnowledge: "Average",
            problemSolving: "Weak",
            communication: "Strong"
          },
          detailedFeedback: {
            whatWentWell: ["Explained projects clearly", "Good communication"],
            whatToImprove: ["Need to study algorithms", `Tab switched ${tabSwitches} times`, `Used ${hintCount} hints`]
          },
          recommendedTopicsToStudy: ["Dynamic Programming", "React Hooks"],
          finalVerdict: "Lean Hire"
        }
      });
    }
    return res.json({
      message: `**Feedback (Simulated):**\nIncorrect.\n\n**Next Question:**\nExplain React Lifecycle.`,
      isReport: false
    });
  }

  try {
    const conversation = chatHistory.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`).join('\n\n');
    
    if (isFinalQuestion) {
      const prompt = `You are an expert technical interviewer evaluating a candidate after a comprehensive ${maxQuestions}-round interview (${lcDifficulty} difficulty).
      
      Resume Context: ${resumeText.substring(0, 2000)}
      Complete Interview Conversation:
      ${conversation}
      Candidate's Final Answer:
      ${latestAnswer}
      Anti-Cheat System: The candidate switched tabs ${tabSwitches} times.
      Hint System: The candidate requested ${hintCount} hints.
      
      Task: The interview is over. Evaluate the candidate's performance holistically across all rounds (Projects, Skills, Algorithms, System Design, Behavioral).
      
      CRITICAL: You MUST severely penalize their overallScore if they switched tabs (deduct ~10 pts per switch) and if they used hints (deduct ~5 pts per hint).
      
      You MUST respond with ONLY a valid JSON object matching this exact structure:
      {
        "overallScore": (a number out of 100),
        "metrics": {
          "projectExplanation": "Strong | Average | Weak",
          "technicalKnowledge": "Strong | Average | Weak",
          "problemSolving": "Strong | Average | Weak",
          "communication": "Strong | Average | Weak"
        },
        "detailedFeedback": {
          "whatWentWell": ["2-3 specific points they did well"],
          "whatToImprove": ["2-3 specific areas for improvement (mention tab switches and hints if applicable)"]
        },
        "recommendedTopicsToStudy": ["2-3 specific CS/Framework topics to practice"],
        "finalVerdict": "Hire | Lean Hire | No Hire",
        "questionBreakdown": [
          {
            "question": "The exact question you asked",
            "candidateAnswer": "Summary of what they answered",
            "correctness": "Correct | Partial | Wrong",
            "detailedExplanation": "A VERY detailed explanation of the optimal, correct answer and why they were right/wrong."
          }
        ]
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        response_format: { type: "json_object" }
      });

      const reportData = JSON.parse(chatCompletion.choices[0]?.message?.content);
      return res.json({ isReport: true, reportData });
    } else {
      
      // Cycle through 5 round types regardless of maxQuestions
      const roundType = ((currentRound - 1) % 5) + 1;
      let roundInstruction = "";
      
      if (roundType === 1) {
        roundInstruction = `This is ROUND ${currentRound}: Project Deep-Dive. Ask a challenging question about another project from their resume.`;
      } else if (roundType === 2) {
        roundInstruction = `This is ROUND ${currentRound}: Core Technical Skills. Ask a conceptual/trivia question about the primary framework or language listed on their resume (e.g. React, Node, Python).`;
      } else if (roundType === 3) {
        roundInstruction = `This is ROUND ${currentRound}: Algorithmic Problem Solving. Ask a classic ${lcDifficulty} algorithmic coding problem. Tell them to provide logic/code and time/space complexity.`;
      } else if (roundType === 4) {
        roundInstruction = `This is ROUND ${currentRound}: Architecture & Scenario. Ask them how they would design a specific system or handle a scaling/architecture scenario relevant to their experience.`;
      } else {
        roundInstruction = `This is ROUND ${currentRound}: Behavioral. Ask a classic 'Tell me about a time when...' behavioral question to assess culture fit and soft skills.`;
      }

      const prompt = `You are an expert technical interviewer conducting a holistic interview.
      
      Previous Conversation:
      ${conversation}
      
      Candidate's Latest Answer:
      ${latestAnswer}
      
      Task: 
      1. CRITICAL FEEDBACK RULE: Evaluate their latest answer. Keep your feedback SHORT AND CONCISE (1-3 sentences of direct feedback), BUT if their code or logic was wrong, you MUST provide a short, correct code snippet in your feedback to show them the optimal solution.
      2. ${roundInstruction} If the difficulty is Basic, keep the question extremely simple and short. Strictly stick to exactly what is prominent on their resume (e.g. Python, LSTM). Do NOT ask about OS, Networking, or DBMS unless explicitly stated on their resume.
      
      CRITICAL RULE AGAINST REPETITION: You MUST review the "Complete Interview Conversation". 
      1. Do NOT ask a question that is identical or even slightly similar to any question you have already asked.
      2. If this is an Algorithmic/LeetCode round, you are STRICTLY FORBIDDEN from asking a coding problem that has already been asked in this conversation.
      
      FORMATTING RULE: You MUST format your response with exactly two markdown headers:
      ### Feedback
      (Put your short feedback here)
      ### Next Question
      (Put your next question here)`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
      });
      
      return res.json({ 
        message: chatCompletion.choices[0]?.message?.content || "Could not generate a response.", 
        isReport: false 
      });
    }
  } catch (error) {
    console.error("Error evaluating answer:", error);
    res.status(500).json({ error: "Error connecting to AI." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
