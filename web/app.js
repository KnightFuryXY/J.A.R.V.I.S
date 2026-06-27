/* ==========================================================================
   J.A.R.V.I.S. INTERFACE ENGINE - MARK XXXV
   ========================================================================== */

const host = window.location.hostname || 'localhost';
const port = 8080; // WebSocket port
const wsUrl = `ws://${host}:${port}/ws`;
let ws = null;

// Global Shared State
const state = {
    activeLayout: 'terminal', // 'widget' | 'terminal' | 'chat'
    connectionState: 'DISCONNECTED',
    jarvisState: 'OFFLINE', // 'OFFLINE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'STANDBY'
    isRecording: false,
    messages: [
        { sender: 'System', text: 'System Link initialized.', type: 'system', timestamp: new Date() }
    ],
    inputText: '',
    muted: false
};

// UI Element Query Cache
const elements = {
    body: document.body,
    globalStatusDot: document.getElementById('global-status-dot'),
    globalStatusText: document.getElementById('global-status-text'),
    connectionStatus: document.getElementById('connection-status'),
    headerTime: document.getElementById('header-time'),
    
    // Switcher Buttons
    dock: document.getElementById('interface-dock'),
    switchBtns: {
        widget: document.getElementById('switch-btn-widget'),
        terminal: document.getElementById('switch-btn-terminal'),
        chat: document.getElementById('switch-btn-chat')
    },
    
    // Layouts Wrapper Classes
    layouts: {
        widget: document.getElementById('layout-widget'),
        terminal: document.getElementById('layout-terminal'),
        chat: document.getElementById('layout-chat')
    },
    
    // Shared Inputs across views
    inputs: {
        widget: document.getElementById('widget-command-input'),
        terminal: document.getElementById('terminal-command-input'),
        chat: document.getElementById('clean-command-input')
    },
    
    // Mic & Send buttons across views
    micBtns: document.querySelectorAll('.mic-btn'),
    sendBtns: {
        widget: document.getElementById('widget-send-btn'),
        terminal: document.getElementById('terminal-send-btn'),
        chat: document.getElementById('clean-send-btn')
    },
    
    // Chat logs
    logs: {
        widget: document.getElementById('widget-expanded-log'),
        terminal: document.getElementById('terminal-chat-log'),
        chat: document.getElementById('clean-chat-log')
    },
    
    // Layout 1: Widget Elements
    widgetCore: document.getElementById('widget-core-canvas'),
    widgetChatOverlay: document.getElementById('widget-chat-overlay'),
    widgetCloseLogBtn: document.getElementById('widget-close-log-btn'),
    widgetStatusText: document.getElementById('widget-status'),
    
    // Layout 2: Terminal Elements
    telemetry: {
        cpuCanvas: document.getElementById('telemetry-cpu-canvas'),
        ramCanvas: document.getElementById('telemetry-ram-canvas'),
        latencyCanvas: document.getElementById('telemetry-latency-canvas'),
        cpuVal: document.getElementById('cpu-val'),
        ramVal: document.getElementById('ram-val'),
        latencyVal: document.getElementById('latency-val'),
        sysState: document.getElementById('telemetry-sys-state')
    },
    fileTree: document.getElementById('file-tree-container'),
    panelTabs: document.querySelectorAll('.panel-tabs .tab-btn'),
    
    // Layout 3: Chat Elements
    chatSidebar: document.getElementById('chat-sidebar'),
    sidebarOpenBtn: document.getElementById('sidebar-open-btn'),
    sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
    clearChatBtn: document.getElementById('clear-chat-btn'),
    exportLogBtn: document.getElementById('export-log-btn'),
    toggleVoiceBtn: document.getElementById('toggle-voice-btn'),
    voiceBtnLabel: document.getElementById('voice-btn-label')
};

// Audio Stream Context (16kHz PCM)
let audioContext = null;
let mediaStream = null;
let scriptProcessor = null;

// ==========================================================================
// 1. WEBSOCKET TRANSCEIVER CONTROL
// ==========================================================================

function connectWebSocket() {
    console.log(`Connecting to JARVIS Core: ${wsUrl}`);
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        state.connectionState = 'CONNECTED';
        updateConnectionStatus(true);
        updateJarvisState('STANDBY');
        addLogEntry('System', 'Connected to JARVIS Mainframe. Secure line established.', 'system');
    };

    ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'state') {
                    updateJarvisState(msg.state);
                } else if (msg.type === 'log') {
                    addLogEntry(msg.sender, msg.text, msg.sender.toLowerCase());
                }
            } catch (e) {
                console.error("Payload parse error:", e);
            }
        }
    };

    ws.onclose = () => {
        state.connectionState = 'DISCONNECTED';
        updateConnectionStatus(false);
        updateJarvisState('OFFLINE');
        setTimeout(connectWebSocket, 3000); // Reconnect loop
    };

    ws.onerror = (err) => {
        console.error('Socket Error:', err);
    };
}

function updateConnectionStatus(isConnected) {
    if (isConnected) {
        elements.connectionStatus.textContent = 'CONNECTED';
        elements.connectionStatus.classList.add('connected');
    } else {
        elements.connectionStatus.textContent = 'DISCONNECTED';
        elements.connectionStatus.classList.remove('connected');
    }
}

function updateJarvisState(newState) {
    state.jarvisState = newState;
    
    // Synchronize class state on body
    elements.body.classList.remove('state-LISTENING', 'state-SPEAKING', 'state-THINKING', 'state-OFFLINE', 'state-STANDBY');
    elements.body.classList.add(`state-${newState}`);

    // Update state readouts
    elements.globalStatusText.textContent = newState;
    if (elements.telemetry.sysState) elements.telemetry.sysState.textContent = newState;
    if (elements.widgetStatusText) elements.widgetStatusText.textContent = newState;

    // Update global status light
    const dot = elements.globalStatusDot;
    dot.style.boxShadow = '';
    if (newState === 'LISTENING') {
        dot.style.backgroundColor = 'var(--neon-green)';
        dot.style.boxShadow = '0 0 10px var(--neon-green)';
    } else if (newState === 'THINKING' || newState === 'PROCESSING') {
        dot.style.backgroundColor = 'var(--neon-orange)';
        dot.style.boxShadow = '0 0 10px var(--neon-orange)';
    } else if (newState === 'SPEAKING') {
        dot.style.backgroundColor = 'var(--neon-blue)';
        dot.style.boxShadow = '0 0 10px var(--neon-blue)';
    } else if (newState === 'OFFLINE') {
        dot.style.backgroundColor = 'var(--neon-crimson)';
        dot.style.boxShadow = '0 0 10px var(--neon-crimson)';
    } else {
        dot.style.backgroundColor = 'var(--neon-cyan)';
        dot.style.boxShadow = '0 0 10px var(--neon-cyan)';
    }
}

// ==========================================================================
// 2. AUDIO RECORDER SYSTEM (16kHz PCM STREAMING)
// ==========================================================================

async function startRecording() {
    if (state.muted) return;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    }
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
        const source = audioContext.createMediaStreamSource(mediaStream);
        scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);

        scriptProcessor.onaudioprocess = (e) => {
            if (!state.isRecording || !ws || ws.readyState !== WebSocket.OPEN) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Broadcast binary audio
            ws.send(pcm16.buffer);
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        
        state.isRecording = true;
        elements.micBtns.forEach(btn => btn.classList.add('recording'));
        
    } catch (err) {
        console.error("Recording error:", err);
        addLogEntry('System', 'Microphone permissions denied or error occurred.', 'system');
    }
}

function stopRecording() {
    state.isRecording = false;
    elements.micBtns.forEach(btn => btn.classList.remove('recording'));
    
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

// Bind mic events
elements.micBtns.forEach(btn => {
    btn.addEventListener('mousedown', startRecording);
    btn.addEventListener('mouseup', stopRecording);
    btn.addEventListener('mouseleave', stopRecording);

    // Touch actions
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopRecording();
    });
    btn.addEventListener('touchcancel', stopRecording);
});

// ==========================================================================
// 3. LAYOUT MANAGER & SYNCHRONIZER
// ==========================================================================

function switchLayout(targetLayoutName) {
    if (targetLayoutName === state.activeLayout) return;
    
    // Handle specific docking changes
    Object.keys(elements.layouts).forEach(key => {
        if (key === targetLayoutName) {
            elements.layouts[key].style.display = (key === 'terminal') ? 'block' : 'flex';
        } else {
            elements.layouts[key].style.display = 'none';
        }
    });

    // Update active button layout
    Object.keys(elements.switchBtns).forEach(key => {
        if (key === targetLayoutName) {
            elements.switchBtns[key].classList.add('active');
        } else {
            elements.switchBtns[key].classList.remove('active');
        }
    });

    // Body styling layout active
    elements.body.className = elements.body.className.replace(/layout-\w+-active/g, '');
    elements.body.classList.add(`layout-${targetLayoutName}-active`);

    state.activeLayout = targetLayoutName;
    console.log(`Layout switched to: ${targetLayoutName}`);

    // If switching to widget, snap layout-widget coordinates to viewport if offset
    if (targetLayoutName === 'widget') {
        const w = elements.layouts.widget;
        if (!w.style.top || !w.style.left) {
            w.style.bottom = '100px';
            w.style.right = '40px';
            w.style.top = '';
            w.style.left = '';
        }
    }
}

// Attach Switcher dock handlers
Object.keys(elements.switchBtns).forEach(key => {
    elements.switchBtns[key].addEventListener('click', () => switchLayout(key));
});

// Input synchronization across all views
Object.keys(elements.inputs).forEach(key => {
    elements.inputs[key].addEventListener('input', (e) => {
        state.inputText = e.target.value;
        // Keep other layout textboxes synced
        Object.keys(elements.inputs).forEach(otherKey => {
            if (otherKey !== key) {
                elements.inputs[otherKey].value = state.inputText;
            }
        });
    });
    
    elements.inputs[key].addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeCommand();
    });
});

// Send Buttons click events
Object.keys(elements.sendBtns).forEach(key => {
    elements.sendBtns[key].addEventListener('click', executeCommand);
});

function executeCommand() {
    const text = state.inputText.trim();
    if (!text) return;
    
    // Clear input buffers
    state.inputText = '';
    Object.keys(elements.inputs).forEach(k => elements.inputs[k].value = '');

    // Add locally to the chat log
    addLogEntry('You', text, 'user');

    // Send payload to ws server
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'command', text: text }));
    } else {
        console.warn("WebSocket disconnected. Simulating action locally...");
        // Auto-reply mock if offline for demonstration
        setTimeout(() => {
            simulateResponse(text);
        }, 800);
    }
}

// ==========================================================================
// 4. DIALOGUE LOG CONSOLE ENGINE & PARSER
// ==========================================================================

function addLogEntry(sender, text, type) {
    const timestamp = new Date();
    state.messages.push({ sender, text, type, timestamp });
    
    // Parse formatting (e.g., Code Blocks)
    const formattedHTML = parseMarkdown(text);
    
    // Append to L2 Terminal Log
    const entryL2 = document.createElement('div');
    entryL2.className = `log-entry ${type}`;
    entryL2.innerHTML = `
        <div class="log-entry-header">
            <span>${sender.toUpperCase()}</span>
            <span>${formatTime(timestamp)}</span>
        </div>
        <div>${formattedHTML}</div>
    `;
    elements.logs.terminal.appendChild(entryL2);
    elements.logs.terminal.scrollTop = elements.logs.terminal.scrollHeight;

    // Append to L3 Clean Chat Log
    const entryL3 = document.createElement('div');
    entryL3.className = `log-entry ${type}`;
    if (type === 'system') {
        entryL3.innerHTML = `<div class="message-text italic">${formattedHTML}</div>`;
    } else {
        const initials = sender === 'You' ? 'U' : 'J';
        entryL3.innerHTML = `
            <div class="log-entry-header">
                <span class="avatar">${initials}</span>
                <span class="status-text">${sender}</span>
            </div>
            <div class="message-text">${formattedHTML}</div>
        `;
    }
    elements.logs.chat.appendChild(entryL3);
    elements.logs.chat.scrollTop = elements.logs.chat.scrollHeight;

    // Append to L1 Expanded Widget log (Limit to last 10 entries)
    const entryL1 = document.createElement('div');
    entryL1.className = `log-entry ${type}`;
    entryL1.innerHTML = `<strong>${sender}:</strong> ${text}`;
    elements.logs.widget.appendChild(entryL1);
    
    // Keep widget log brief
    while (elements.logs.widget.childNodes.length > 10) {
        elements.logs.widget.removeChild(elements.logs.widget.firstChild);
    }
    elements.logs.widget.scrollTop = elements.logs.widget.scrollHeight;
}

function parseMarkdown(text) {
    // Escape standard HTML tags to prevent injections
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Syntax Highlighted Code Blocks: ```javascript ... ```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    escaped = escaped.replace(codeBlockRegex, (match, lang, code) => {
        const language = lang || 'code';
        const highlighted = highlightCode(code, language);
        return `
            <div class="code-container">
                <div class="code-header">
                    <span>${language.toUpperCase()} ENGINE</span>
                    <button class="code-copy-btn" onclick="copyCodeBlock(this)">COPY</button>
                </div>
                <pre><code>${highlighted}</code></pre>
            </div>
        `;
    });

    // Inline tags: `code`
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="hl-number">$1</code>');
    
    // Bold: **text**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Replace linebreaks
    return escaped.replace(/\n/g, '<br>');
}

function highlightCode(code, lang) {
    // Basic regex highlighter for terminal styling
    let h = code;
    if (lang === 'js' || lang === 'javascript' || lang === 'py' || lang === 'python') {
        // keywords
        h = h.replace(/\b(const|let|var|function|return|def|import|from|class|if|else|for|while|try|except|async|await)\b/g, '<span class="hl-keyword">$1</span>');
        // strings
        h = h.replace(/(['"`])(.*?)\1/g, '<span class="hl-string">$1$2$1</span>');
        // comments
        h = h.replace(/(#.*|\/\/.*)/g, '<span class="hl-comment">$1</span>');
        // numbers
        h = h.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');
    }
    return h;
}

window.copyCodeBlock = (btn) => {
    const container = btn.closest('.code-container');
    const codeElem = container.querySelector('code');
    navigator.clipboard.writeText(codeElem.innerText).then(() => {
        btn.textContent = 'COPIED';
        setTimeout(() => btn.textContent = 'COPY', 1500);
    });
};

function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

// ==========================================================================
// 5. ORB CORE VISUALIZER ENGINE
// ==========================================================================

function initOrbVisualizer() {
    const canvas = elements.widgetCore;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let tick = 0;
    
    function draw() {
        requestAnimationFrame(draw);
        
        const W = canvas.width;
        const H = canvas.height;
        const CX = W / 2;
        const CY = H / 2;
        
        ctx.clearRect(0, 0, W, H);
        
        tick++;
        
        // Define speeds and scaling based on state
        let speedMult = 1.0;
        let scaleMult = 1.0;
        let ringGlow = 'var(--neon-cyan)';
        
        if (state.jarvisState === 'LISTENING') {
            speedMult = 0.5;
            scaleMult = 1.0 + Math.sin(tick * 0.05) * 0.02;
            ringGlow = '#00ff66';
        } else if (state.jarvisState === 'THINKING' || state.jarvisState === 'PROCESSING') {
            speedMult = 2.0;
            scaleMult = 0.98 + Math.sin(tick * 0.15) * 0.03;
            ringGlow = 'var(--neon-orange)';
        } else if (state.jarvisState === 'SPEAKING') {
            speedMult = 1.5;
            scaleMult = 1.05 + Math.sin(tick * 0.25) * 0.08;
            ringGlow = 'var(--neon-blue)';
        } else if (state.jarvisState === 'OFFLINE') {
            speedMult = 0.2;
            scaleMult = 0.95;
            ringGlow = 'var(--neon-crimson)';
        }
        
        // Ring 1 (Outer dashboard ticks)
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(tick * 0.005 * speedMult);
        ctx.strokeStyle = ringGlow;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 75 * scaleMult, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw tick marks
        for (let i = 0; i < 36; i++) {
            ctx.rotate(Math.PI / 18);
            ctx.beginPath();
            ctx.moveTo(0, -78 * scaleMult);
            ctx.lineTo(0, -74 * scaleMult);
            ctx.stroke();
        }
        ctx.restore();
        
        // Ring 2 (Dashed Orbit Ring)
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(-tick * 0.01 * speedMult);
        ctx.strokeStyle = ringGlow;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 35]);
        ctx.beginPath();
        ctx.arc(0, 0, 60 * scaleMult, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // Ring 3 (Inner Double Arc)
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(tick * 0.02 * speedMult);
        ctx.strokeStyle = ringGlow;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 48 * scaleMult, 0, Math.PI * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 48 * scaleMult, Math.PI, Math.PI * 1.6);
        ctx.stroke();
        ctx.restore();
        
        // Core Visualizer Sphere
        ctx.save();
        const coreGradient = ctx.createRadialGradient(CX, CY, 5, CX, CY, 30 * scaleMult);
        if (state.jarvisState === 'LISTENING') {
            coreGradient.addColorStop(0, '#34d399');
            coreGradient.addColorStop(1, '#059669');
        } else if (state.jarvisState === 'THINKING' || state.jarvisState === 'PROCESSING') {
            coreGradient.addColorStop(0, '#fbbf24');
            coreGradient.addColorStop(1, '#d97706');
        } else if (state.jarvisState === 'SPEAKING') {
            coreGradient.addColorStop(0, '#60a5fa');
            coreGradient.addColorStop(1, '#1d4ed8');
        } else if (state.jarvisState === 'OFFLINE') {
            coreGradient.addColorStop(0, '#f87171');
            coreGradient.addColorStop(1, '#991b1b');
        } else {
            coreGradient.addColorStop(0, 'var(--neon-cyan)');
            coreGradient.addColorStop(1, 'var(--neon-blue)');
        }
        
        ctx.fillStyle = coreGradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ringGlow;
        ctx.beginPath();
        ctx.arc(CX, CY, 28 * scaleMult, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Concentric spectrum wave (For speaking/listening visualization)
        if (state.jarvisState === 'SPEAKING' || state.jarvisState === 'LISTENING') {
            ctx.save();
            ctx.strokeStyle = ringGlow;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
                // Wave noise formula
                const noise = Math.sin(angle * 8 + tick * 0.2) * Math.cos(angle * 3) * (state.jarvisState === 'SPEAKING' ? 12 : 5);
                const r = (32 + noise) * scaleMult;
                const x = CX + Math.cos(angle) * r;
                const y = CY + Math.sin(angle) * r;
                if (angle === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }
    
    draw();
}

// ==========================================================================
// 6. TELEMETRY GRAPHICS SIMULATION Engine
// ==========================================================================

function startTelemetryCharts() {
    const charts = [
        { canvas: elements.telemetry.cpuCanvas, valueEl: elements.telemetry.cpuVal, data: Array(30).fill(15), min: 8, max: 28, color: 'var(--neon-cyan)' },
        { canvas: elements.telemetry.ramCanvas, valueEl: elements.telemetry.ramVal, data: Array(30).fill(42), min: 41, max: 43, color: 'var(--neon-orange)' },
        { canvas: elements.telemetry.latencyCanvas, valueEl: elements.telemetry.latencyVal, data: Array(30).fill(18), min: 14, max: 24, color: 'var(--neon-blue)' }
    ];

    function drawChart(chart) {
        const c = chart.canvas;
        if (!c) return;
        const ctx = c.getContext('2d');
        const W = c.width = c.parentElement.clientWidth;
        const H = c.height = 65;
        
        ctx.clearRect(0, 0, W, H);
        
        // Push a random point
        let variance = Math.random() * 4 - 2;
        // React to processing states
        if (state.jarvisState === 'THINKING' || state.jarvisState === 'PROCESSING') {
            if (chart.canvas.id.includes('cpu')) {
                chart.min = 55; chart.max = 85;
            }
            if (chart.canvas.id.includes('latency')) {
                chart.min = 120; chart.max = 280;
            }
        } else {
            if (chart.canvas.id.includes('cpu')) {
                chart.min = 8; chart.max = 18;
            }
            if (chart.canvas.id.includes('latency')) {
                chart.min = 15; chart.max = 25;
            }
        }
        
        let lastVal = chart.data[chart.data.length - 1];
        let newVal = Math.max(chart.min, Math.min(chart.max, lastVal + variance));
        chart.data.push(newVal);
        chart.data.shift();
        
        // Update text tags
        chart.valueEl.textContent = chart.canvas.id.includes('latency') ? `${Math.round(newVal)} ms` : `${Math.round(newVal)}%`;
        
        // Drawing Grid Lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let y = 10; y < H; y += 15) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        
        // Drawing graph line
        ctx.strokeStyle = chart.color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = chart.color;
        ctx.beginPath();
        
        const step = W / (chart.data.length - 1);
        for (let i = 0; i < chart.data.length; i++) {
            // map val to bounds
            const raw = chart.data[i];
            const maxVal = chart.canvas.id.includes('cpu') ? 100 : chart.max * 1.2;
            const y = H - (raw / maxVal) * (H - 10) - 5;
            const x = i * step;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
        
        // Fill area gradient
        ctx.save();
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
        fillGrad.addColorStop(0, chart.color.replace('var', 'rgba').replace(')', ', 0.15)'));
        fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
        ctx.restore();
    }

    setInterval(() => {
        charts.forEach(drawChart);
    }, 1000);
}

// ==========================================================================
// 7. DIRECTORY TREE COMPONENT CREATOR
// ==========================================================================

function populateWorkspaceTree() {
    const mockFiles = [
        { name: 'actions', type: 'folder', children: [
            { name: 'browser_control.py', type: 'file' },
            { name: 'computer_control.py', type: 'file' },
            { name: 'dev_agent.py', type: 'file' },
            { name: 'file_controller.py', type: 'file' },
            { name: 'game_updater.py', type: 'file' },
            { name: 'web_search.py', type: 'file' }
        ]},
        { name: 'core', type: 'folder', children: [
            { name: 'prompt.txt', type: 'file' }
        ]},
        { name: 'web', type: 'folder', children: [
            { name: 'index.html', type: 'file' },
            { name: 'style.css', type: 'file' },
            { name: 'app.js', type: 'file' }
        ]},
        { name: 'main.py', type: 'file' },
        { name: 'ui.py', type: 'file' },
        { name: 'requirements.txt', type: 'file' }
    ];

    function createTreeHTML(items, indent = 0) {
        let html = '';
        items.forEach(item => {
            const spacing = `<span class="tree-indent"></span>`.repeat(indent);
            if (item.type === 'folder') {
                html += `
                    <div class="tree-folder" onclick="toggleTreeFolder(this)">
                        ${spacing}📁 ${item.name}
                    </div>
                    <div class="folder-children" style="display: block;">
                        ${createTreeHTML(item.children, indent + 1)}
                    </div>
                `;
            } else {
                html += `
                    <div class="tree-file" onclick="selectTreeFile('${item.name}')">
                        ${spacing}📄 ${item.name}
                    </div>
                `;
            }
        });
        return html;
    }

    elements.fileTree.innerHTML = createTreeHTML(mockFiles);
}

window.toggleTreeFolder = (elem) => {
    const childrenDiv = elem.nextElementSibling;
    if (childrenDiv.style.display === 'none') {
        childrenDiv.style.display = 'block';
        elem.innerHTML = elem.innerHTML.replace('📁', '📂');
    } else {
        childrenDiv.style.display = 'none';
        elem.innerHTML = elem.innerHTML.replace('📂', '📁');
    }
};

window.selectTreeFile = (fileName) => {
    addLogEntry('System', `Focused workspace editor on: ${fileName}`, 'system');
};

// Toggle left panel tabs
elements.panelTabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        // toggle active btn
        elements.panelTabs.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // toggle tab panel displays
        document.querySelectorAll('.panel-left .tab-content').forEach(panel => {
            if (panel.id === targetId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    });
});

// ==========================================================================
// 8. INTERACTIVE DRAG WIDGET SYSTEM
// ==========================================================================

function makeWidgetDraggable() {
    const widget = elements.layouts.widget;
    const handle = widget.querySelector('.widget-drag-handle');
    
    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    handle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = widget.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
        widget.style.left = `${initialX}px`;
        widget.style.top = `${initialY}px`;
        
        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        // Viewport constraint checks
        const x = Math.max(10, Math.min(window.innerWidth - widget.clientWidth - 10, initialX + dx));
        const y = Math.max(10, Math.min(window.innerHeight - widget.clientHeight - 10, initialY + dy));
        
        widget.style.left = `${x}px`;
        widget.style.top = `${y}px`;
    });

    handle.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            handle.releasePointerCapture(e.pointerId);
        }
    });
}

// Visualizer click triggers expanded widget log
elements.widgetCore.addEventListener('click', () => {
    elements.widgetChatOverlay.classList.add('expanded');
});
elements.widgetCloseLogBtn.addEventListener('click', () => {
    elements.widgetChatOverlay.classList.remove('expanded');
});

// ==========================================================================
// 9. MOBILE CHAT SIDEBAR PANEL & GENERAL ACTIONS
// ==========================================================================

// Collapsible side panel control
elements.sidebarOpenBtn.addEventListener('click', () => {
    elements.chatSidebar.classList.remove('collapsed');
});
elements.sidebarCloseBtn.addEventListener('click', () => {
    elements.chatSidebar.classList.add('collapsed');
});

// Clear log panel values
elements.clearChatBtn.addEventListener('click', () => {
    state.messages = [{ sender: 'System', text: 'Chat logs cleared by user.', type: 'system', timestamp: new Date() }];
    elements.logs.terminal.innerHTML = '<div class="log-entry system">Chat session logs reset.</div>';
    elements.logs.chat.innerHTML = '<div class="log-entry system">Chat session logs reset.</div>';
    elements.logs.widget.innerHTML = '<div class="log-entry system">Logs reset.</div>';
});

// Export Session Dialog to text downloads
elements.exportLogBtn.addEventListener('click', () => {
    const formattedLog = state.messages.map(m => {
        return `[${formatTime(m.timestamp)}] ${m.sender.toUpperCase()}: ${m.text}`;
    }).join('\n');
    
    const blob = new Blob([formattedLog], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JARVIS_Dialogue_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

// Toggle local mic states
elements.toggleVoiceBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    if (state.muted) {
        elements.voiceBtnLabel.textContent = "Voice Off";
        elements.toggleVoiceBtn.classList.add('muted');
        elements.toggleVoiceBtn.style.color = 'var(--neon-crimson)';
        updateJarvisState('OFFLINE');
    } else {
        elements.voiceBtnLabel.textContent = "Voice On";
        elements.toggleVoiceBtn.classList.remove('muted');
        elements.toggleVoiceBtn.style.color = '';
        updateJarvisState('STANDBY');
    }
});

// ==========================================================================
// 10. SYSTEM TELEMETRY INITIATOR
// ==========================================================================

function updateClock() {
    const d = new Date();
    elements.headerTime.textContent = d.toTimeString().split(' ')[0];
}

function simulateResponse(input) {
    updateJarvisState('THINKING');
    
    setTimeout(() => {
        updateJarvisState('SPEAKING');
        
        let response = '';
        const norm = input.toLowerCase();
        
        if (norm.includes('hello') || norm.includes('hey')) {
            response = "Greetings, Sir. Standing by to coordinate system scripts or launch workspace diagnostics.";
        } else if (norm.includes('status') || norm.includes('system')) {
            response = "All systems operational. WebSockets listening. Voice transceiver samples queued. Telemetries show safe temperatures.";
        } else if (norm.includes('code') || norm.includes('write')) {
            response = "Certainly. Initiating file edit layout.\n```javascript\n// Dynamic state switcher triggered\nfunction getSystemDetails() {\n    return {\n        model: 'MARK XXXV',\n        core: 'Active',\n        time: new Date()\n    };\n}\nconsole.log(getSystemDetails());\n```\nLet me know if you want me to write this back into the directory tree.";
        } else {
            response = `Understood. Processing request: "${input}". Re-routing packet directives... Standard offline responses loaded. Connect core client to link real AI.`;
        }
        
        addLogEntry('Jarvis', response, 'jarvis');
        
        // Reset state after speaking
        setTimeout(() => {
            updateJarvisState('STANDBY');
        }, 3000);
        
    }, 1500);
}

// Start operations on load
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    initOrbVisualizer();
    startTelemetryCharts();
    populateWorkspaceTree();
    makeWidgetDraggable();
    
    setInterval(updateClock, 1000);
    updateClock();
    
    // Set default view active
    switchLayout('terminal');
});
