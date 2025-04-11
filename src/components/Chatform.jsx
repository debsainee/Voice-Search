import React, { useRef } from "react";

const Chatform = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef();

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;
    inputRef.current.value = "";

    setChatHistory((history) => [
      ...history,
      { role: "user", text: userMessage },
    ]);

    setTimeout(() => {
      setChatHistory((history) => [
        ...history,
        { role: "model", text: "Thinking..." },
      ]);

      generateBotResponse([
        ...chatHistory,
        { role: "user", text: `Using the details provided above, please address this query: ${userMessage}` },
      ]);
    }, 500); // Added a slight delay to simulate processing time
  };

  return (
    <form action="#" className="chat-form" onSubmit={handleFormSubmit}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Message..."
        className="message-input"
        required
      />
      <button type="submit">
        <span className="material-symbols-outlined">send</span>
      </button>
    </form>
  );
};

export default Chatform;
