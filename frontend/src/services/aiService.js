const API_URL = 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('careerForgeToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const uploadResume = async (resumeText) => {
  const response = await fetch(`${API_URL}/resumes/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ extracted_text: resumeText })
  });
  if (!response.ok) throw new Error("Failed to upload resume");
  return await response.json();
};

export const extractSkills = async (resumeText) => {
  try {
    const response = await fetch(`${API_URL}/resumes/extract-skills`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ resumeText })
    });
    if (!response.ok) throw new Error("Failed to extract skills");
    const data = await response.json();
    return data.skills || [];
  } catch (error) {
    console.error("Error extracting skills:", error);
    return [{"skill": "React", "confidence": 0.9}, {"skill": "JavaScript", "confidence": 0.85}, {"skill": "Python", "confidence": 0.8}];
  }
};

export const createThread = async (resumeId, difficulty, maxQuestions, selectedSkills) => {
  const response = await fetch(`${API_URL}/threads/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ 
      resume_id: resumeId, 
      difficulty, 
      max_questions: maxQuestions, 
      skills: selectedSkills 
    })
  });
  if (!response.ok) throw new Error("Failed to create thread");
  return await response.json();
};

export const createCoachThread = async (resumeId) => {
  const response = await fetch(`${API_URL}/threads/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ 
      resume_id: resumeId, 
      type: 'coaching'
    })
  });
  if (!response.ok) throw new Error("Failed to create coach thread");
  return await response.json();
};

export const fetchHistory = async () => {
  try {
    const response = await fetch(`${API_URL}/threads/`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch history");
    return await response.json();
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};
