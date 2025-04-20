import React, { useEffect, useRef, useState } from 'react';
import ChatbotIcon from './components/ChatbotIcon';
import Chatform from './components/Chatform';
import ChatMessage from './components/ChatMessage';
import { companyInfo } from '../CompanyInfo';
import { createClient } from '@deepgram/sdk';

console.log('Env check Vite full:', import.meta.env);
console.log('Env check Vite specific:', import.meta.env.VITE_API_URL, import.meta.env.VITE_DEEPGRAM_API_KEY, import.meta.env.VITE_GEMINI_API_KEY);

const apiUrl = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

console.log('API URL used:', apiUrl);
console.log('API KEY used:', API_KEY);
console.log('Deepgram API Key:', deepgramApiKey);
try {
  const deepgram = deepgramApiKey ? createClient({ apiKey: deepgramApiKey }) : null;
  console.log('Deepgram initialized:', !!deepgram);
} catch (error) {
  console.error('Deepgram initialization failed:', error);
  const deepgram = null;
}

const App = () => {
  const [chatHistory, setChatHistory] = useState([
    { hideInChat: true, role: 'model', text: companyInfo }
  ]);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatBodyRef = useRef(null);
  const recognitionRef = useRef(null);

  const generateBotResponse = async (history) => {
    const API_URL = `${apiUrl}&key=${API_KEY}`;
    console.log('Fetching from:', API_URL);
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== 'Thinking...'),
        { role: 'model', text, isError }
      ]);
    };

    if (!API_URL || !apiUrl) {
      updateHistory('API URL is missing or invalid. Please check .env.', true);
      return;
    }

    history = history.map(({ role, text }) => ({ role, parts: [{ text }] }));

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: history }),
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        updateHistory('Invalid response from API.', true);
        return;
      }

      if (!response.ok) throw new Error(data.error?.message || 'Something went wrong!');

      const apiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/\*\*(.*?)\*\*/g, '$1').trim();
      updateHistory(apiResponseText || 'No response received.');
    } catch (error) {
      console.error('Fetch error:', error);
      updateHistory(error.message, true);
    }
  };

  const startVoiceSearch = () => {
    if (isListening || !deepgram) {
      setChatHistory((prev) => [...prev, { role: 'model', text: 'Voice search unavailable. Please check the Deepgram API key.', isError: true }]);
      return;
    }

    setIsListening(true);
    setChatHistory((prev) => [...prev, { role: 'model', text: 'Listening...' }]);

    const recognition = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      interim_results: false,
    });

    recognitionRef.current = recognition;

    recognition.addListener('open', () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const audioTrack = stream.getAudioTracks()[0];
        recognition.start(audioTrack);
      }).catch((err) => {
        setChatHistory((prev) => [...prev, { role: 'model', text: `Error: ${err.message}`, isError: true }]);
        stopVoiceSearch();
      });
    });

    recognition.addListener('transcriptReceived', (data) => {
      if (data.isFinal) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        if (transcript) {
          setChatHistory((prev) => [
            ...prev.filter((msg) => msg.text !== 'Listening...'),
            { role: 'user', text: transcript }
          ]);
          setTimeout(() => {
            setChatHistory((prev) => [...prev, { role: 'model', text: 'Thinking...' }]);
            generateBotResponse([
              ...chatHistory.filter((msg) => msg.text !== 'Listening...'),
              { role: 'user', text: `Using the details provided above, please address this query: ${transcript}` }
            ]);
          }, 500);
        }
        stopVoiceSearch();
      }
    });

    recognition.addListener('error', (error) => {
      setChatHistory((prev) => [...prev, { role: 'model', text: `Error: ${error.message}`, isError: true }]);
      stopVoiceSearch();
    });
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.finish();
      setIsListening(false);
      setChatHistory((prev) => prev.filter((msg) => msg.text !== 'Listening...'));
    }
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.finish();
      }
    };
  }, []);

  return (
    <div className={`container ${showChatbot ? 'show-chatbot' : ''}`}>
      <button onClick={() => setShowChatbot((prev) => !prev)} id="chatbot-toggler">
        <span className="material-symbols-outlined">mode_comment</span>
        <span className="material-symbols-outlined">close</span>
      </button>
      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="header-info">
            <ChatbotIcon />
            <h2 className="logo-text">Chatbot</h2>
          </div>
          <button onClick={() => setShowChatbot((prev) => !prev)} className="material-symbols-outlined">
            keyboard_arrow_down
          </button>
        </div>
        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Hey there <br />
              How can I help you today?
            </p>
          </div>
          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
          ))}
        </div>
        <div className="chat-footer">
          <Chatform chatHistory={chatHistory} setChatHistory={setChatHistory} generateBotResponse={generateBotResponse} />
          <button
            onClick={isListening ? stopVoiceSearch : startVoiceSearch}
            className="voice-button"
          >
            {isListening ? '🎙️' : '🎙️'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;