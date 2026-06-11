const API_URL = 'http://localhost:5000/api';

export const extractSkills = async (resumeText) => {
  try {
    const response = await fetch(`${API_URL}/extract-skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resumeText })
    });
    
    if (!response.ok) throw new Error("Failed to extract skills");
    
    const data = await response.json();
    return data.skills || [];
  } catch (error) {
    console.error("Error extracting skills:", error);
    return ["React", "JavaScript", "Python"]; // Fallback
  }
};

export const generateInterviewQuestions = async (resumeText, difficulty, maxQuestions, selectedSkills) => {
  try {
    const response = await fetch(`${API_URL}/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resumeText, difficulty, maxQuestions, selectedSkills })
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch from backend");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error generating question:", error);
    return { message: "Error connecting to backend server. Is it running?", context: "" };
  }
};

export const evaluateAnswer = async (resumeText, difficulty, chatHistory, latestAnswer, isFinalQuestion, tabSwitches, currentRound, hintCount, maxQuestions, selectedSkills) => {
  try {
    const response = await fetch(`${API_URL}/evaluate-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resumeText, difficulty, chatHistory, latestAnswer, isFinalQuestion, tabSwitches, currentRound, hintCount, maxQuestions, selectedSkills })
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from backend");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return { message: "Error connecting to backend server to evaluate your answer.", isReport: false };
  }
};

export const getHint = async (chatHistory) => {
  try {
    const response = await fetch(`${API_URL}/get-hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chatHistory })
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from backend");
    }

    const data = await response.json();
    return data.hint;
  } catch (error) {
    console.error("Error getting hint:", error);
    return "Try re-reading the problem statement carefully.";
  }
};
