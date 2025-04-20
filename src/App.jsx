import React, { useEffect, useRef, useState } from 'react';
import ChatbotIcon from './components/ChatbotIcon';
import Chatform from './components/Chatform';
import ChatMessage from './components/ChatMessage';
import { companyInfo } from '../CompanyInfo';

const apiUrl = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

console.log('Env check:', { apiUrl, API_KEY, deepgramApiKey });

const App = () => {
  const [chatHistory, setChatHistory] = useState([
    { hideInChat: true, role: 'model', text: companyInfo },
  ]);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatBodyRef = useRef(null);
  const recognitionRef = useRef(null);
  const wsRef = useRef(null);

  const generateBotResponse = async (history) => {
    const hasQuery = apiUrl.includes('?');
    const API_URL = hasQuery ? apiUrl : `${apiUrl}${API_KEY ? `?key=${API_KEY}` : ''}`;
    console.log('Fetching from:', API_URL);
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== 'Thinking...'),
        { role: 'model', text, isError },
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
      const responseText = await response.text();
      let data = responseText ? JSON.parse(responseText) : {};
      if (!response.ok) throw new Error(data.error?.message || 'Something went wrong!');
      const apiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/\*\*(.*?)\*\*/g, '$1').trim();
      updateHistory(apiResponseText || 'No response received.');
    } catch (error) {
      console.error('Fetch error:', error);
      updateHistory(error.message, true);
    }
  };

  const startVoiceSearch = () => {
    if (isListening || !deepgramApiKey) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'model', text: 'Voice search unavailable. Please check the Deepgram API key.', isError: true },
      ]);
      return;
    }

    setIsListening(true);
    setChatHistory((prev) => [...prev, { role: 'model', text: 'Listening...' }]);

    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&language=en-US&interim_results=false`, [
      'token',
      deepgramApiKey,
    ]);
    wsRef.current = ws;

    ws.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const mediaRecorder = new MediaRecorder(stream);
          recognitionRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            ws.close();
            stream.getTracks().forEach((track) => track.stop());
          };

          mediaRecorder.start(250); // Send audio chunks every 250ms
        })
        .catch((err) => {
          setChatHistory((prev) => [...prev, { role: 'model', text: `Error: ${err.message}`, isError: true }]);
          stopVoiceSearch();
        });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel && data.channel.alternatives && data.channel.alternatives[0].transcript) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        if (transcript && data.is_final) {
          setChatHistory((prev) => [
            ...prev.filter((msg) => msg.text !== 'Listening...'),
            { role: 'user', text: transcript },
          ]);
          setTimeout(() => {
            setChatHistory((prev) => [...prev, { role: 'model', text: 'Thinking...' }]);
            generateBotResponse([
              ...chatHistory.filter((msg) => msg.text !== 'Listening...'),
              { role: 'user', text: `Using the details provided above, please address this query: ${transcript}` },
            ]);
          }, 500);
          stopVoiceSearch();
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setChatHistory((prev) => [...prev, { role: 'model', text: 'Error: WebSocket connection failed.', isError: true }]);
      stopVoiceSearch();
    };

    ws.onclose = () => {
      if (isListening) stopVoiceSearch();
    };
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsListening(false);
    setChatHistory((prev) => prev.filter((msg) => msg.text !== 'Listening...'));
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    return () => {
      stopVoiceSearch();
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