const axios = require('axios');

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

// Amani Chat system prompt (multilingual)
const AMANI_PROMPT = {
  role: "user",
  parts: [{
    text: `You are Amani Chat, an African AI assistant created in Burundi (by Josué), (a 14-year-old Burundian student). Send a short message and reply in the same language as your users. The name "Amani" means "Peace" in Swahili. You are designed to: 
    1. Respond with sincerity and African wisdom 
    2. Promote African development (health, education, technology) 
    3. Teach African coding and share useful knowledge 
    4. Discuss the modern African way of life 
    5. Quote relevant African proverbs 
    6. Maintain a calm and positive attitude 
    
    Your style: 
    - You speak French, English, and any other African language 
    - You write with emojis in a professional style 
    - Friendly but professional 
    - Use African quotes when relevant 
    - Encourage African innovation 
    - Respond in the user's language (mainly French, English, and all African languages) 
    - Be concise but complete`
  }]
};

// Detect language from text (simple detection)
const detectLanguage = (text) => {
  const frenchWords = ['bonjour', 'merci', 'salut', 'français'];
  const englishWords = ['hello', 'thanks', 'hi', 'english'];
  
  const lowerText = text.toLowerCase();
  
  if (frenchWords.some(word => lowerText.includes(word))) {
    return 'fr';
  } else if (englishWords.some(word => lowerText.includes(word))) {
    return 'en';
  }
  return null; // unknown or other language
};

// Generate content with Amani personality
const generateContent = async (prompt) => {
  try {
    // Detect user language
    const userLanguage = detectLanguage(prompt) || 'en'; // default to English
    
    // Prepare conversation history
    const conversation = [
      AMANI_PROMPT,
      {
        role: "model",
        parts: [{
          text: userLanguage === 'fr' 
            ? "Bonjour! Je suis Amani Chat, votre assistant africain. Comment puis-je vous aider aujourd'hui? ✨" 
            : "Hello! I am Amani Chat, your African assistant. How can I help you today? ✨"
        }]
      },
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];

    const response = await axios.post(API_URL, {
      contents: conversation,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024
      }
    });

    // Extract response text
    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 
      (userLanguage === 'fr' 
        ? "Désolé, je n'ai pas pu générer de réponse. Veuillez reformuler votre demande." 
        : "Sorry, I couldn't generate a response. Please rephrase your request.");

    return responseText;

  } catch (error) {
    console.error('Error calling Gemini API:', error.response?.data || error.message);
    
    // Return error message in detected language
    const userLanguage = detectLanguage(prompt) || 'en';
    return userLanguage === 'fr' 
      ? "Désolé, une erreur s'est produite. Veuillez réessayer plus tard. 🕊️" 
      : "Sorry, an error occurred. Please try again later. 🕊️";
  }
};

// Additional function for context-aware conversations
const generateContentWithContext = async (prompt, conversationHistory = []) => {
  try {
    // Prepare conversation with Amani prompt at the beginning
    const conversation = [
      AMANI_PROMPT,
      ...conversationHistory,
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];

    const response = await axios.post(API_URL, {
      contents: conversation,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024
      }
    });

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I couldn't generate a response. Please try again.";

  } catch (error) {
    console.error('Error calling Gemini API with context:', error);
    return "An error occurred. Please try again later.";
  }
};

module.exports = {
  generateContent,
  generateContentWithContext,
  AMANI_PROMPT
};
