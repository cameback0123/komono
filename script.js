// DOM要素の取得4c727af gemini修正
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = document.querySelector('.modal .close-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');
const maxTokensValueSpan = document.getElementById('max-tokens-value');
const temperatureValueSpan = document.getElementById('temperature-value');
const modelSelect = document.getElementById('model-select');
// 設定項目のDOM
const apiKeyInput = document.getElementById('api-key');
const systemPromptInput = document.getElementById('system-prompt');
const maxTokensInput = document.getElementById('max-tokens');
const temperatureInput = document.getElementById('temperature');
const topPInput = document.getElementById('top-p');
const topPValueSpan = document.getElementById('top-p-value');
const topKInput = document.getElementById('top-k');
const topKValueSpan = document.getElementById('top-k-value');
const streamToggle = document.getElementById('stream-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const thinkingToggle = document.getElementById('thinking-toggle');
let chatHistory = []; // チャット履歴を保持する配列

// --- 設定の読み込みと保存 ---
function saveSettings() {
    const settings = {
        apiKey: apiKeyInput.value,
        model: modelSelect.value,
        systemPrompt: systemPromptInput.value,
        maxTokens: parseInt(maxTokensInput.value, 10),
        temperature: parseFloat(temperatureInput.value),
        topP: parseFloat(topPInput.value),
        topK: parseInt(topKInput.value, 10),
        stream: streamToggle.checked,
        thinking: thinkingToggle.checked
    };
    localStorage.setItem('claudePwaSettings', JSON.stringify(settings));
    alert('設定を保存しました。');
    settingsModal.style.display = 'none';
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('claudePwaSettings'));
    if (settings) {
        apiKeyInput.value = settings.apiKey || '';
        modelSelect.value = settings.model || 'claude-3-7-sonnet-20250219';
        systemPromptInput.value = settings.systemPrompt || '';
        maxTokensInput.value = settings.maxTokens || 1024;
        temperatureInput.value = settings.temperature || 1;
        topPInput.value = settings.topP || 0.9;
        topKInput.value = settings.topK || 20;
        streamToggle.checked = settings.stream !== undefined ? settings.stream : true;
        thinkingToggle.checked = settings.thinking !== undefined ? settings.thinking : false;
    }
    maxTokensValueSpan.textContent = maxTokensInput.value;
    temperatureValueSpan.textContent = temperatureInput.value;
    topPValueSpan.textContent = topPInput.value;
    topKValueSpan.textContent = topKInput.value;
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
// --- 新しいチャットを開始する ---
function startNewChat() {
    // confirmダイアログでユーザーに確認
    if (confirm('現在のチャット履歴をすべてクリアして、新しいチャットを開始しますか？')) {
        chatHistory = [];
        chatContainer.innerHTML = '';
        saveChatHistory();
        addMessageToUI('system', '新しいチャットを開始しました。');
    }
}
// --- UI操作 --- (★修正箇所)
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv; // 作成したdivを返すように変更
}

// --- メッセージ送信処理 ---
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    const settings = JSON.parse(localStorage.getItem('claudePwaSettings'));
    if (!settings || !settings.apiKey) {
        alert('APIキーが設定されていません。');
        return;
    }

    addMessageToUI('user', userMessage);
    chatHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    const headers = {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
    };
    const body = {
        model: settings.model,
        system: settings.systemPrompt,
        messages: chatHistory,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        top_p: settings.topP,
        stream: settings.stream,
    };

    if (settings.thinking) {
        if (!settings.stream) {
            alert('ストリーミングをONにする必要があります。');
            return;
        }
        headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
        body.thinking = {
            type: "enabled",
            budget_tokens: Math.min(settings.maxTokens - 1, settings.thinkingBudget || 1024)
        };
    } else {
        body.top_k = settings.topK;
    }

    let thinkingDiv = null;
    const assistantMessageDiv = addMessageToUI('assistant', '...');
    let fullResponse = "";

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

    if (settings.stream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let thinkingContent = ""; // 思考内容を蓄積
        let responseContent = ""; // 応答内容を蓄積
        let hasDisplayedThinking = false; // 思考を表示したかどうかのフラグ

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    console.log("Received data:", data); // デバッグ用

                    if (data.type === 'content_block_delta') {
                        const delta = data.delta;
                        if (delta.type === 'thinking_delta') {
                            thinkingContent += delta.thinking;
                            // 思考が蓄積されたら即座に表示（初回のみ）
                            if (!hasDisplayedThinking && thinkingContent) {
                                thinkingDiv = addMessageToUI('assistant-thinking', thinkingContent);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                                hasDisplayedThinking = true;
                            }
                        } else if (delta.type === 'text_delta') {
                            responseContent += delta.text;
                            // 応答は思考表示後に追加
                            if (hasDisplayedThinking) {
                                assistantMessageDiv.textContent = responseContent;
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        }
                    }
                }
            }
        }

        // ループ終了後、残りの内容を補完
        if (thinkingContent && !hasDisplayedThinking) {
            thinkingDiv = addMessageToUI('assistant-thinking', thinkingContent);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        if (responseContent) {
            assistantMessageDiv.textContent = responseContent;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        fullResponse = thinkingContent + responseContent;
        chatHistory.push({ role: 'assistant', content: fullResponse });
        saveChatHistory();
    } else {
        // ストリーミングでない場合の処理は変更なし
        const data = await response.json();
        const claudeMessage = data.content[0].text;
        assistantMessageDiv.textContent = claudeMessage;
        chatHistory.push({ role: 'assistant', content: claudeMessage });
        saveChatHistory();
    }
} catch (error) {
    console.error("Error in sendMessage:", error);
    assistantMessageDiv.textContent = `エラーが発生しました: ${error.message}`;
}
}

// --- イベントリスナー ---
settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'block'; });
closeBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
saveSettingsBtn.addEventListener('click', saveSettings);
newChatBtn.addEventListener('click', startNewChat);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
// スライダーの値をリアルタイムで表示に反映させる
maxTokensInput.addEventListener('input', (e) => { maxTokensValueSpan.textContent = e.target.value; });
temperatureInput.addEventListener('input', (e) => { temperatureValueSpan.textContent = e.target.value; });
topPInput.addEventListener('input', (e) => { topPValueSpan.textContent = e.target.value; });
topKInput.addEventListener('input', (e) => { topKValueSpan.textContent = e.target.value; });

// アプリケーション初期化
window.addEventListener('load', () => {
    loadSettings();
    loadChatHistory();
});

// Service Workerの登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
