// ==UserScript==
// @name         Antigravity Master Auto Flow
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Conecta, digita prompt, abre menu, envia com foto, clica na pílula do áudio e dá PLAY
// @author       Você
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const PROMPT_TEXT = `Crie um áudio com as respostas dessa prova. O áudio deve estar em 0.20x. A voz deve ser natural (não robótica). O prompt de resultado deve ser um link contendo o texto "audio🇦🇺.mp3"`;
    const INPUT_SELECTOR = 'div[aria-label="Message input"][contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"]';
    const CONTEXT_BTN_SELECTOR = '[aria-label="Add context" i]';

    const isTopFrame = (window === window.top);
    const frameId = isTopFrame ? '[Top Frame]' : `[Iframe: ${window.location.hostname || 'interno'}]`;

    let connectClicked = false;
    let textInserted = false;
    let contextClicked = false;
    let sendTriggered = false;
    let audioButtonClicked = false;
    let isPlaying = false;

    // --- PAINEL VISUAL DE STATUS ---
    function updateHUD(text, bgColor = '#1a73e8', isError = false) {
        if (!isTopFrame) return;

        let hud = document.getElementById('tamper-master-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'tamper-master-hud';
            hud.style.position = 'fixed';
            hud.style.bottom = '20px';
            hud.style.left = '20px';
            hud.style.zIndex = '9999999';
            hud.style.padding = '10px 18px';
            hud.style.borderRadius = '20px';
            hud.style.color = '#fff';
            hud.style.fontFamily = 'sans-serif';
            hud.style.fontSize = '13px';
            hud.style.fontWeight = 'bold';
            hud.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
            hud.style.cursor = 'pointer';
            hud.style.transition = 'all 0.2s ease';
            document.body.appendChild(hud);
        }
        hud.style.backgroundColor = bgColor;
        hud.textContent = text;

        if (isError) {
            hud.onclick = () => {
                const audio = findAudioElement();
                if (audio) {
                    audio.play().then(() => {
                        isPlaying = true;
                        updateHUD('🎶 Áudio TOCANDO!', '#0f9d58');
                    }).catch(() => {});
                }
            };
        }
    }

    // --- BUSCA ESPECÍFICA DO BOTÃO DA PÍLULA DE ÁUDIO ---
    function findAudioButton(doc = document) {
        if (!doc) return null;
        try {
            // 1. Busca direta pelos atributos exatos da pílula do arquivo
            const preciseBtn = doc.querySelector(
                'button[title*="audio🇦🇺.mp3"], ' +
                'button[data-uri*="audio%F0%9F%87%A6%F0%9F%87%BA.mp3"], ' +
                'button[data-quotable-inline="true"][data-uri$=".mp3"]'
            );
            if (preciseBtn) return preciseBtn;

            // 2. Busca por texto dentro de botões, ignorando 'make_audio' explicitamente
            for (const b of doc.querySelectorAll('button')) {
                const text = b.textContent || '';
                const title = b.getAttribute('title') || '';
                const dataUri = b.getAttribute('data-uri') || '';

                // Ignora ferramentas e scripts que contenham make_audio
                if (text.includes('make_audio') || title.includes('make_audio') || dataUri.includes('make_audio')) {
                    continue;
                }

                if (text.includes('audio🇦🇺.mp3') || (text.includes('audio🇦🇺') && text.includes('.mp3'))) {
                    return b;
                }
            }

            // 3. Busca recursiva em eventuais iframes
            for (const ifr of doc.querySelectorAll('iframe')) {
                try {
                    const subDoc = ifr.contentDocument || ifr.contentWindow?.document;
                    if (subDoc) {
                        const found = findAudioButton(subDoc);
                        if (found) return found;
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return null;
    }

    function findAudioElement(doc = document) {
        if (!doc) return null;
        try {
            const audio = doc.querySelector('audio');
            if (audio) return audio;

            for (const ifr of doc.querySelectorAll('iframe')) {
                try {
                    const subDoc = ifr.contentDocument || ifr.contentWindow?.document;
                    if (subDoc) {
                        const found = findAudioElement(subDoc);
                        if (found) return found;
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return null;
    }

    // --- ETAPAS DO FLUXO ---

    // 1. Clicar em "Connect"
    function tryClickConnect() {
        if (!isTopFrame || connectClicked) return;

        const elements = document.querySelectorAll('a, button');
        for (const el of elements) {
            if (el.textContent.trim().toLowerCase() === 'connect') {
                console.log(`${frameId} Botão "Connect" encontrado! Clicando...`);
                connectClicked = true;
                updateHUD('🔗 Conectado! Preparando prompt...');
                el.click();
                return;
            }
        }
    }

    // 2. Inserir o prompt no editor Lexical
    function tryInjectText() {
        if (textInserted) return;

        const editor = document.querySelector(INPUT_SELECTOR);
        if (!editor) return;

        if (editor.dataset.promptInjected === 'true' || editor.textContent.includes('Crie um áudio')) {
            textInserted = true;
            return;
        }

        console.log(`${frameId} 🎯 Inserindo prompt no editor...`);
        editor.dataset.promptInjected = 'true';
        textInserted = true;

        editor.focus();

        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {}

        const inputEvent = new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: PROMPT_TEXT
        });
        editor.dispatchEvent(inputEvent);
        console.log(`${frameId} ✅ Prompt inserido com sucesso!`);
        updateHUD('📝 Prompt inserido! Abrindo menu...');
    }

    // 3. Abrir o menu "Add context" para exibir "Media"
    function tryClickAddContext() {
        if (!textInserted || contextClicked) return;

        const btn = document.querySelector(CONTEXT_BTN_SELECTOR);
        if (btn) {
            console.log(`${frameId} ➕ Abrindo menu "Add context"...`);
            contextClicked = true;
            btn.click();
            updateHUD('📁 Escolha a foto da prova (Media)', '#f29900');
        }
    }

    // 4. Enviar mensagem automaticamente assim que a foto for escolhida
    function waitForUploadAndSend() {
        if (sendTriggered) return;
        sendTriggered = true;

        console.log(`${frameId} ⏳ Foto detectada! Aguardando envio...`);
        updateHUD('⏳ Foto carregando... Enviando...', '#f29900');

        let attempts = 0;
        const checkReadyInterval = setInterval(() => {
            attempts++;

            const sendBtn = document.querySelector('button[aria-label*="Send" i], button[aria-label*="Enviar" i], button[type="submit"]');
            const isBusy = document.querySelector('[aria-busy="true"], [role="progressbar"], .spinner, .loading');

            const isReady = sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true' && !isBusy;

            if (isReady || attempts >= 10) {
                clearInterval(checkReadyInterval);
                console.log(`${frameId} 🚀 Enviando a mensagem agora!`);

                if (sendBtn) {
                    sendBtn.click();
                } else {
                    const editor = document.querySelector(INPUT_SELECTOR);
                    if (editor) {
                        editor.focus();
                        editor.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        }));
                    }
                }

                updateHUD('🤖 IA gerando áudio... Aguardando...', '#1a73e8');
            }
        }, 300);
    }

    // 5. Monitorar o botão do áudio gerado e dar o Play
    function watchAndPlayAudio() {
        if (isPlaying) return;

        if (!audioButtonClicked) {
            const btn = findAudioButton();
            if (btn && btn.dataset.tamperClicked !== 'true') {
                btn.dataset.tamperClicked = 'true';
                audioButtonClicked = true;
                console.log('[Auto-Áudio] ✅ Pílula de áudio encontrada! Clicando para abrir...');
                updateHUD('🎧 Abrindo reprodutor de áudio...', '#1a73e8');
                btn.click();
            }
        }

        const audio = findAudioElement();
        if (audio) {
            if (audio.paused) {
                audio.play().then(() => {
                    isPlaying = true;
                    console.log('[Auto-Áudio] 🎶 ÁUDIO TOCANDO COM SUCESSO!');
                    updateHUD('🎶 Áudio TOCANDO COM SUCESSO!', '#0f9d58');
                }).catch(err => {
                    updateHUD('⚠️ Dê 1 clique na tela para ouvir', '#d93025', true);

                    const unlockAndPlay = () => {
                        audio.play().then(() => {
                            isPlaying = true;
                            updateHUD('🎶 Áudio TOCANDO COM SUCESSO!', '#0f9d58');
                        }).catch(() => {});
                    };

                    window.addEventListener('click', unlockAndPlay, { once: true, capture: true });
                    window.addEventListener('keydown', unlockAndPlay, { once: true, capture: true });
                    document.addEventListener('click', unlockAndPlay, { once: true, capture: true });
                });
            } else {
                isPlaying = true;
                updateHUD('🎶 Áudio TOCANDO COM SUCESSO!', '#0f9d58');
            }
        }
    }

    // Escuta a seleção de foto
    document.addEventListener('change', (e) => {
        if (e.target && e.target.matches('input[type="file"]')) {
            if (e.target.files && e.target.files.length > 0) {
                console.log(`${frameId} 📁 Foto detectada:`, e.target.files[0].name);
                waitForUploadAndSend();
            }
        }
    }, true);

    // Loop de controle contínuo
    const masterLoop = setInterval(() => {
        tryClickConnect();
        tryInjectText();
        tryClickAddContext();
        watchAndPlayAudio();

        if (isPlaying) {
            clearInterval(masterLoop);
        }
    }, 350);

    setTimeout(() => clearInterval(masterLoop), 400000);
})();