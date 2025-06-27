// DOM要素の取得
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = document.querySelector('.modal .close-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');

// 設定項目のDOM
const apiKeyInput = document.getElementById('api-key');
const systemPromptInput = document.getElementById('system-prompt');
const maxTokensInput = document.getElementById('max-tokens');
const temperatureInput = document.getElementById('temperature');

let chatHistory = []; // チャット履歴を保持する配列

// --- 設定の読み込みと保存 ---
function saveSettings() {
    const settings = {
        apiKey: apiKeyInput.value,
        systemPrompt: systemPromptInput.value,
        maxTokens: parseInt(maxTokensInput.value, 10),
        temperature: parseFloat(temperatureInput.value)
    };
    localStorage.setItem('claudePwaSettings', JSON.stringify(settings));
    alert('設定を保存しました。');
    settingsModal.style.display = 'none';
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('claudePwaSettings'));
    if (settings) {
        apiKeyInput.value = settings.apiKey || '';
        systemPromptInput.value = settings.systemPrompt || '';
        maxTokensInput.value = settings.maxTokens || 1024;
        temperatureInput.value = settings.temperature || 0.7;
    }
}

// --- チャット履歴の読み込みと保存 ---
function saveChatHistory() {
    localStorage.setItem('claudePwaChatHistory', JSON.stringify(chatHistory));
}

function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem('claudePwaChatHistory'));
    if (history) {
        chatHistory = history;
        chatHistory.forEach(msg => addMessageToUI(msg.role, msg.content));
    }
}

// --- UI操作 ---
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight; // 自動スクロール
}

// --- メッセージ送信処理 ---
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    const settings = JSON.parse(localStorage.getItem('claudePwaSettings'));
    if (!settings || !settings.apiKey) {
        alert('APIキーが設定されていません。設定画面からキーを保存してください。');
        return;
    }

    // ユーザーメッセージをUIと履歴に追加
    addMessageToUI('user', userMessage);
    chatHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307", // 最も高速なモデルでテスト
                system: settings.systemPrompt,
                messages: chatHistory,
                max_tokens: settings.maxTokens,
                temperature: settings.temperature,
                // top_p, top_k も同様に設定から取得
                stream: false // まずはストリームなしで実装
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} ${errorData.error.message}`);
        }

        const data = await response.json();
        const claudeMessage = data.content[0].text;

        // Claudeの応答をUIと履歴に追加
        addMessageToUI('assistant', claudeMessage);
        chatHistory.push({ role: 'assistant', content: claudeMessage });
        saveChatHistory(); // 履歴を保存

    } catch (error) {
        console.error(error);
        addMessageToUI('assistant', `エラーが発生しました: ${error.message}`);
    }
}


// --- イベントリスナー ---
settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'block'; });
closeBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
saveSettingsBtn.addEventListener('click', saveSettings);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// アプリケーション初期化
window.addEventListener('load', () => {
    loadSettings();
    loadChatHistory();
});

// script.js の末尾に追加
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
