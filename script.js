import {model} from "./mainmodule.js";

const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-container");

// Add conversation history array to store all messages
let conversationHistory = [];

const scrollToBottom = () => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

const formatResponse = (text) => {
    // Format bold (**bold**)
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Format italics (*italic*)
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Format ordered lists (1. Item)
    text = text.replace(/(\d+)\.\s(.+?)(?=\n\d+\.|\n\n|$)/gs, "<li>$2</li>");
    text = text.replace(/(<li>.*<\/li>)+/gs, "<ol>$&</ol>");

    // Format unordered lists (- Item or * Item)
    text = text.replace(/[-*]\s(.+?)(?=\n[-*]|\n\n|$)/gs, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)+/gs, "<ul>$&</ul>");

    // Format inline code (`code`)
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Format multiline code blocks (```code```)
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => 
        `<pre><code>${code.trim()}</code></pre>`
    );

    return text;
};

// New function to save conversation history to localStorage
const saveConversationHistory = () => {
    localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
};

// New function to load conversation history from localStorage
const loadConversationHistory = () => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        
        // Rebuild the chat UI from history
        chatContainer.innerHTML = ''; // Clear current container
        conversationHistory.forEach(entry => {
            if (entry.role === 'user') {
                const chatBubble = document.createElement("div");
                chatBubble.classList.add("chat-content");
                chatBubble.innerHTML = `
                <div class="chat-message user">
                    <div class="chat-body-inner right">
                        <p>${entry.content}</p>
                    </div>
                    <img src="images/furina-bubble.png" class="chat-avatar">
                </div>
                `;
                chatContainer.appendChild(chatBubble);
            } else {
                const pEle = document.createElement("div");
                pEle.classList.add("gemini-response");
                pEle.innerHTML = `
                <div class="chat-message bot">
                    <img src="images/clorinde-bubble.png" class="chat-avatar">
                    <div class="chat-body-inner left">
                        <p>${formatResponse(entry.content)}</p>
                    </div>
                </div>
                `;
                chatContainer.appendChild(pEle);
            }
        });
        
        scrollToBottom();
    }
};

document.getElementById("chat-icon").addEventListener("click", () => {
    // Clear the conversation history before reloading
    localStorage.removeItem('chatHistory');
    conversationHistory = [];
    location.reload(); // Reloads the page to start a new chat
});

// Function to generate suggested questions using the AI model
const generateSuggestedQuestions = async () => {
    try {
        const prompt = "Generate 4 interesting, diverse conversation starter questions that a user might want to ask. Format each question on a new line with a '-' prefix. Keep questions concise and engaging. Make them varied in topic (technology, creativity, advice, fun facts, etc).";
        
        const result = await model.generateContent(prompt);
        const response = await result.response.text();
        
        // Extract questions from the response (assuming they're formatted with '- ' prefix)
        const questionLines = response.split('\n').filter(line => line.trim().startsWith('-'));
        
        // Clean up the questions (remove the '- ' prefix)
        const questions = questionLines.map(line => line.replace(/^-\s*/, '').trim());
        
        return questions.slice(0, 4); // Limit to 4 questions
    } catch (error) {
        console.error("Error generating questions:", error);
        // Fallback to default questions if AI generation fails
        return [
            "What do you think about the future of technology?",
            "Can you tell me a fun fact?",
            "How do I write a professional email?",
            "What are some good programming project ideas?"
        ];
    }
};

// Modified displayQuestions function to use AI-generated questions
async function displayQuestions() {
    const questionContainer = document.querySelector(".question-list");
    if (!questionContainer) {
        console.error("Question container not found!");
        return;
    }
    
    // Only show questions if there's no conversation history
    if (conversationHistory.length > 0) {
        questionContainer.style.display = "none";
        return;
    }
    
    // Clear previous questions
    questionContainer.innerHTML = "";
    
    // Get AI-generated questions without showing loading indicator
    const questions = await generateSuggestedQuestions();
    
    // Add the questions as buttons
    questions.forEach(question => {
        const button = document.createElement("button");
        button.classList.add("question-btn");
        button.textContent = question;
        button.addEventListener("click", () => {
            console.log("Question Clicked:", button.textContent);

            const chatInput = document.querySelector("#chat-input");
            if (!chatInput) {
                console.error("Chat input not found!");
                return;
            }

            chatInput.value = button.textContent;
            handleAPI();

            // Hide the question list
            questionContainer.style.display = "none";
        });

        questionContainer.appendChild(button);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded");

    // Load conversation history when page loads
    loadConversationHistory();
    
    // Display AI-generated questions
    displayQuestions();
});

const getChatResponse = async () => {
    const userText = chatInput.value;
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: userText });
    
    const pEle = document.createElement("div");

    try {
        // Create a formatted conversation history for the model
        // This ensures the model has context of the entire conversation
        const formattedHistory = conversationHistory.map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        
        // Send the entire conversation history to the model
        const result = await model.generateContent(formattedHistory);
        const response = await result.response.text();
        
        // Add bot response to conversation history
        conversationHistory.push({ role: 'assistant', content: response });
        
        // Save updated history
        saveConversationHistory();

        pEle.classList.add("gemini-response");
        pEle.innerHTML = `
        <div class="chat-message bot">
            <img src="images/clorinde-bubble.png" class="chat-avatar">
            <div class="chat-body-inner left">
                <p>${formatResponse(response)}</p>
            </div>
        </div>
        `;

    } catch (error) {
        console.error("Error fetching AI response: ", error);
        const errorMessage = "Sorry, I couldn't process that request. Please try again.";
        
        // Add error message to conversation history
        conversationHistory.push({ role: 'assistant', content: errorMessage });
        saveConversationHistory();
        
        pEle.innerHTML = `
        <div class="chat-message bot">
            <img src="images/clorinde-bubble.png" class="chat-avatar">
            <div class="chat-body-inner left">
                <p>${errorMessage}</p>
            </div>
        </div>
        `;
    }
    
    chatContainer.appendChild(pEle);
    scrollToBottom();
};

const handleAPI = () => {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Hide the question list when a message is sent
    const questionContainer = document.querySelector(".question-list");
    if (questionContainer) {
        questionContainer.style.display = "none";
    }

    // Add user message bubble first
    const chatBubble = document.createElement("div");
    chatBubble.classList.add("chat-content");
    chatBubble.innerHTML = `
    <div class="chat-message user">
        <div class="chat-body-inner right">
            <p>${userText}</p>
        </div>
        <img src="images/furina-bubble.png" class="chat-avatar">
    </div>
    `;
    
    chatContainer.appendChild(chatBubble);
    scrollToBottom();
    
    // Then get the AI response
    getChatResponse();
    chatInput.value = "";
};

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevents new line
        handleAPI();
    }
});

// Add event listener for the send button if it exists
if (sendButton) {
    sendButton.addEventListener("click", handleAPI);
}