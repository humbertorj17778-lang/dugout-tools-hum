// ==UserScript==
// @name         Dugout Unified Tools V58.0
// @namespace    http://tampermonkey.net/
// @version      58.0
// @description  Ferramenta completa com Painel de Treinamento, OPS, Mapeador, Atirador e Efetividade.
// @author       Você
// @match        https://www.dugout-online.com/*
// @grant        GM_xmlhttpRequest
// @connect      dugout-online.com
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function fetchPage(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 15000,
                onload: (res) => resolve(res.responseText),
                onerror: (err) => reject(new Error("Erro de rede")),
                ontimeout: () => reject(new Error("Timeout"))
            });
        });
    }

    function getLocalTime(timeStr) {
        let match = timeStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (!match) return null;
        let day = parseInt(match[1]); let month = parseInt(match[2]) - 1; let year = parseInt(match[3]); let hour = parseInt(match[4]); let minute = parseInt(match[5]);
        let targetDate = new Date(year, month, day, hour, minute); let diffMinutes = 0; let serverClock = document.getElementById('doFtrClock');
        if (serverClock) {
            let cleanText = serverClock.textContent.trim().replace(/[^0-9:]/g, ''); let parts = cleanText.split(':');
            if (parts.length >= 2) {
                let serverH = parseInt(parts[0]); let serverM = parseInt(parts[1]); let localDate = new Date(); let localH = localDate.getHours(); let localM = localDate.getMinutes();
                diffMinutes = (serverH * 60 + serverM) - (localH * 60 + localM);
                if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60; if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
            }
        } else if (window.currenttime) {
            let serverDateObj = new Date(window.currenttime); let localDateObj = new Date(); diffMinutes = (serverDateObj.getTime() - localDateObj.getTime()) / 60000;
        }
        targetDate = new Date(targetDate.getTime() - diffMinutes * 60000);
        return `${targetDate.getDate().toString().padStart(2, '0')}.${(targetDate.getMonth() + 1).toString().padStart(2, '0')}.${targetDate.getFullYear()} ${targetDate.getHours().toString().padStart(2, '0')}:${targetDate.getMinutes().toString().padStart(2, '0')}`;
    }

    const v4StatOrder = ['REF','TCK','PAS','SHT','AGG','ONE','MRK','CRE','DRI','INF','HND','HEA','LSH','PSN','TMW','COM','CRS','FTO','STR','SPD','ECC'];

    function getPositionIndex(position) {
        switch (position) { case "GK": return 0; case "DL": return 1; case "DC": return 2; case "DR": return 3; case "ML": return 4; case "MC": return 5; case "MR": return 6; case "FL": return 7; case "FC": return 8; case "FR": return 9; case "DMC": return 10; case "AMC": return 11; default: return 0; }
    }

    function calcularOPS(data, pos) {
        var positions = [ [0, 5, 10, 15, 13], [16, 6, 1, 15, 13], [6, 11, 1, 15, 13], [16, 6, 1, 15, 13], [16, 17, 7, 2, 13], [12, 17, 7, 2, 13], [16, 17, 7, 2, 13], [3, 8, 17, 16, 13], [3, 8, 17, 11, 13], [3, 8, 17, 16, 13], [1, 6, 7, 2, 13], [12, 2, 7, 3, 8] ];
        var posNames = ['GK', 'DL', 'DC', 'DR', 'ML', 'MC', 'MR', 'FL', 'FC', 'FR', 'DMC', 'AMC'];
        let ops = []; let maxOps = 0;
        for (var i = 0; i < positions.length; ++i) { ops[i] = positions[i].reduce((sum, index) => sum + (data[index] || 0), 0); if (ops[i] >= ops[maxOps]) maxOps = i; }
        let natPos = getPositionIndex(pos);
        return { ops: ops[natPos], high: ops[maxOps], highPos: posNames[maxOps] };
    }

    function getBadgeStyle(pos) {
        if (pos === 'GK') return 'background-color: #9c27b0; color: #fff;';
        if (['DL', 'DC', 'DR'].includes(pos)) return 'background-color: #4CAF50; color: #fff;';
        if (['ML', 'MC', 'MR', 'DMC', 'AMC'].includes(pos)) return 'background-color: #f39c12; color: #fff;';
        if (['FL', 'FC', 'FR'].includes(pos)) return 'background-color: #f44336; color: #fff;';
        return 'background-color: #4CAF50; color: #fff;';
    }

    function extractClubStats(doc) {
        let rating = 0; let capacidade = 0; let tds = doc.querySelectorAll('td');
        for (let j = 0; j < tds.length; j++) {
            let text = tds[j].textContent.replace(/\s+/g, ' ').trim().toLowerCase();
            if (text === 'rating' && j + 1 < tds.length) { let val = tds[j+1].textContent.replace(/[^0-9]/g, ''); if (val) rating = parseInt(val); }
            if ((text === 'estádio' || text === 'estadio') && j + 1 < tds.length) { let val = tds[j+1].textContent; let match = val.match(/\(([\d\.,\s]+)\/([\d\.,\s]+)\)/); if (match) capacidade = parseInt(match[1].replace(/\D/g, '')); }
        }
        if (rating === 0) { let el = Array.from(doc.querySelectorAll('div, td, th, span')).find(e => e.textContent.trim() === 'Rating' || e.textContent.trim().startsWith('Rating')); if (el) { let container = el.closest('.do-facts-row, tr, .do-facts-item, .do-facts-block, td, div'); if (container) { let valEl = container.querySelector('.do-facts-value'); if (valEl) rating = parseInt(valEl.textContent.replace(/\D/g, '')); } } }
        if (capacidade === 0) { let el = Array.from(doc.querySelectorAll('div, td, th, span')).find(e => e.textContent.trim() === 'Total' || e.textContent.trim() === 'Capacity'); if (el) { let container = el.closest('.do-facts-row, tr, .do-facts-item, .do-facts-block, td, div'); if (container) { let valEl = container.querySelector('.do-facts-value'); if (valEl) capacidade = parseInt(valEl.textContent.replace(/\D/g, '')); } } }
        if (rating === 0) { let match = doc.body.textContent.match(/Rating\s*([\d\.,]+)/i); if (match) rating = parseInt(match[1].replace(/\D/g, '')); }
        if (capacidade === 0) { let match = doc.body.textContent.match(/(?:Total|Capacity|Capacidade)\s*([\d\.,]+)/i); if (match) { let num = parseInt(match[1].replace(/\D/g, '')); if (num > 1000) capacidade = num; } }
        return { rating, capacidade };
    }

    // ==========================================
    // PARTE 1: PÁGINA INICIAL
    // ==========================================
    function initHomePage() {
        setTimeout(() => {
            if (document.getElementById('unified-settings-panel')) return;
            const panel = document.createElement('div');
            panel.id = 'unified-settings-panel';
            panel.className = 'do-panel';
            panel.style.cssText = 'margin-top: 20px; padding: 15px; background: #f9fbf9; border: 1px solid #a6bdaa; border-radius: 8px;';
            const isPanelEnabled = localStorage.getItem('unified_show_search_panel') !== 'false';
            panel.innerHTML = `
                <h3 class="do-panel-title" style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">⚙️ Unified Tools - Configurações</h3>
                <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                    <label class="check_selector" style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="chk-search-panel" ${isPanelEnabled ? 'checked' : ''} style="margin-right: 8px; width: 20px; height: 20px;">
                        <span style="font-weight: bold; font-size: 13px;">Mostrar Painel 50/50 (Mapeador/Atirador) na Busca de Clubes</span>
                    </label>
                </div>
            `;
            const content = document.querySelector('#content_main') || document.body;
            content.appendChild(panel);
            document.getElementById('chk-search-panel').addEventListener('change', (e) => {
                localStorage.setItem('unified_show_search_panel', e.target.checked);
            });
        }, 1000);
    }

    // ==========================================
    // PARTE 2: PÁGINA DE ELENCO E TREINAMENTO (OPS)
    // ==========================================
    function initSquadPage() {
        const headerMap = { 'REF': 'REF', 'DES': 'TCK', 'MAR': 'MRK', 'DOM': 'FTO', 'PAS': 'PAS', 'CRU': 'CRS', 'DRI': 'DRI', 'CRI': 'CRE', 'CHU': 'SHT', 'CAB': 'HEA', 'POS': 'PSN', 'TRE': 'TMW', 'EXC': 'ECC', 'AGR': 'AGG', 'COM': 'COM', 'ENC': 'HND', 'CHL': 'LSH', 'FOR': 'STR', 'VEL': 'SPD', 'INF': 'INF', '1x1': 'ONE' };

        function applyBadge(row, isSpreadsheet) {
            const cellSelector = isSpreadsheet ? '.genie-ss-ops' : '.genie-ops';
            const genieCells = row.querySelectorAll(cellSelector);
            if (genieCells.length < 2) return; 
            const highCell = genieCells[genieCells.length - 1];
            if (highCell.querySelector('.high-badge-wrapper')) return; 

            let values = []; let posText = "";
            if (isSpreadsheet) posText = row.cells[1]?.innerText.trim() || ""; 
            else posText = row.querySelector('.do-col-pos')?.innerText.trim() || row.cells[1]?.innerText.trim() || ""; 
            
            posText = posText.replace(/[^A-Z]/g, '').substring(0, 2);
            if (!posText) return;

            if (isSpreadsheet) {
                const table = row.closest('table'); if (!table) return;
                const headers = Array.from(table.tHead.rows[0].cells); const colMap = {};
                headers.forEach((th, idx) => { let txt = th.innerText.trim().toUpperCase(); let statKey = headerMap[txt]; if (statKey && colMap[statKey] === undefined) colMap[statKey] = idx; });
                values = v4StatOrder.map(key => { let idx = colMap[key]; if (idx !== undefined && row.cells[idx]) { let val = row.cells[idx].getAttribute('data-v') || row.cells[idx].innerText.trim(); return parseInt(val) || 0; } return 0; });
            } else {
                const rawStats = row.querySelector('.do-stats-btn')?.getAttribute('data-stats'); if (!rawStats) return;
                try { const statsObj = JSON.parse(rawStats); values = v4StatOrder.map(key => { if (key === 'SPD') return Number(statsObj['SPD'] || 0); return Number(statsObj[key] || 0); }); } catch(e) { return; }
            }

            if (values.length === 21 && values.every(Number.isFinite)) {
                const result = calcularOPS(values, posText);
                const highValueNaTela = parseInt(highCell.innerText.trim().replace(/[^0-9]/g, ''));
                if (!isNaN(highValueNaTela) && highValueNaTela > result.ops) {
                    const badgeStyle = getBadgeStyle(result.highPos);
                    const dataV = highCell.getAttribute('data-v'); 
                    highCell.innerHTML = `<div class="high-badge-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 4px;"><span style="font-weight: bold; color: inherit;">${highValueNaTela}</span><span style="${badgeStyle} font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 4px; text-transform: uppercase;">${result.highPos}</span></div>`;
                    if (dataV) highCell.setAttribute('data-v', dataV); 
                }
            }
        }

        if (!window.genieSquadEnhancerTimer) {
            window.genieSquadEnhancerTimer = setInterval(() => {
                document.querySelectorAll('.do-players-table tbody tr').forEach(row => applyBadge(row, false));
                document.querySelectorAll('.do-ss-table tbody tr').forEach(row => applyBadge(row, true));
            }, 1000);
        }
    }

    // ==========================================
    // PARTE 3: PÁGINA DE BUSCA DE CLUBES (MAPEADOR E ATIRADOR)
    // ==========================================
    let stopAtirador = false; let stopMapeador = false;

    function initSearchClubsPage() {
        try {
            if (localStorage.getItem('unified_show_search_panel') === 'false') return;
            const searchGrid = document.querySelector('.do-se-grid');
            if (!searchGrid || document.getElementById('unified-tools-container')) return;

            const wrapper = document.createElement('div');
            wrapper.id = 'unified-split-wrapper';
            wrapper.style.cssText = 'display: flex; gap: 15px; align-items: stretch; width: 100%; margin-bottom: 15px;';
            searchGrid.parentNode.insertBefore(wrapper, searchGrid);
            wrapper.appendChild(searchGrid);
            searchGrid.style.flex = '1'; searchGrid.style.width = '50%';

            const container = document.createElement('div');
            container.id = 'unified-tools-container';
            container.style.cssText = 'flex: 1; width: 50%; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid #a6bdaa; border-radius: 4px; background: #f9fbf9;';

            const rowAtk = document.createElement('div');
            rowAtk.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid #ddd; padding-bottom: 10px;';
            rowAtk.innerHTML = `
                <label style="font-weight: bold; min-width: 60px; font-size: 13px;">🎯 Atirador</label>
                <span style="font-size: 12px; margin-right: auto; color:#555;">Alvos: <b id="atk-count" style="color: #000;">${JSON.parse(localStorage.getItem('dugout_alvos_salvos') || '[]').length}</b></span>
                <button id="btn-export" type="button" class="do-btn do-btn-outline do-btn-sm">Exp.</button>
                <button id="btn-import" type="button" class="do-btn do-btn-outline do-btn-sm">Imp.</button>
                <button id="btn-atk" type="button" class="do-btn do-btn-outline do-btn-sm" style="font-weight: bold; background:#eef3ee;">Iniciar</button>
                <button id="btn-atk-stop" type="button" class="do-btn do-btn-danger do-btn-sm" disabled>Parar</button>
            `;
            const rowMap = document.createElement('div');
            rowMap.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
            rowMap.innerHTML = `
                <label style="font-weight: bold; min-width: 60px; font-size: 13px;">🔍 Mapeador</label>
                <span style="font-size: 12px; margin-right: auto; color:#555;">R>800 | E>60k</span>
                <button id="btn-map" type="button" class="do-btn do-btn-outline do-btn-sm" style="font-weight: bold; background:#eef3ee;">Iniciar</button>
                <button id="btn-map-stop" type="button" class="do-btn do-btn-danger do-btn-sm" disabled>Parar</button>
                <label style="font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="auto-page-chk"> Auto Pág/Mundo</label>
            `;
            const rowLog = document.createElement('div');
            rowLog.id = 'tool-log';
            rowLog.style.cssText = 'background: #1e1e1e; color: #4CAF50; font-family: monospace; font-size: 12px; padding: 8px; border-radius: 4px; height: 200px; max-height: 250px; overflow-y: scroll; border: 1px inset #555; display: block; box-sizing: border-box;';
            rowLog.innerHTML = `<div>Sistema pronto.</div>`;

            container.appendChild(rowAtk); container.appendChild(rowMap); container.appendChild(rowLog); wrapper.appendChild(container);

            const fileInput = document.createElement('input');
            fileInput.type = 'file'; fileInput.accept = '.json'; fileInput.style.display = 'none'; document.body.appendChild(fileInput);

            let logs = ["Sistema pronto."];
            function logTool(msg) { logs.push(msg); if (logs.length > 50) logs.shift(); document.getElementById('tool-log').innerHTML = logs.map(l => `<div>${l}</div>`).join(''); const logContainer = document.getElementById('tool-log'); logContainer.scrollTop = logContainer.scrollHeight; }

            document.getElementById('btn-export').onclick = () => {
                try {
                    let alvos = JSON.parse(localStorage.getItem('dugout_alvos_salvos') || '[]');
                    if (alvos.length === 0) return alert("Lista vazia.");
                    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alvos, null, 2));
                    let a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", "dugout_alvos_estadios.json"); document.body.appendChild(a); a.click(); a.remove(); logTool("Backup exportado.");
                } catch(e) { logTool("Erro ao exportar."); }
            };
            document.getElementById('btn-import').onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                let file = e.target.files[0]; if (!file) return;
                let reader = new FileReader();
                reader.onload = function(evt) {
                    try {
                        let imported = JSON.parse(evt.target.result);
                        if (Array.isArray(imported)) {
                            let alvos = JSON.parse(localStorage.getItem('dugout_alvos_salvos') || '[]'); let ids = new Set(alvos.map(a => a.id)); let add = 0;
                            imported.forEach(item => { if (!ids.has(item.id)) { alvos.push(item); add++; } });
                            localStorage.setItem('dugout_alvos_salvos', JSON.stringify(alvos)); document.getElementById('atk-count').innerText = alvos.length; logTool(`Importado! ${add} novos clubes.`);
                        }
                    } catch (err) { alert("Erro ao ler o JSON."); }
                };
                reader.readAsText(file); e.target.value = '';
            };

            const autoPageChk = document.getElementById('auto-page-chk');
            autoPageChk.checked = localStorage.getItem('dugout_auto_paginate') === 'true';
            autoPageChk.addEventListener('change', (e) => { localStorage.setItem('dugout_auto_paginate', e.target.checked); if(e.target.checked) logTool("Modo Auto-Página/País ATIVADO."); else logTool("Modo Auto-Página/País desativado."); });

            document.getElementById('btn-map').onclick = async () => {
                stopMapeador = false; document.getElementById('btn-map').disabled = true; document.getElementById('btn-map-stop').disabled = false;
                try { await runMapeador(logTool); } catch(e) { logTool("Erro crítico no Mapeador."); }
                document.getElementById('btn-map').disabled = false; document.getElementById('btn-map-stop').disabled = true;
            };
            document.getElementById('btn-map-stop').onclick = () => { stopMapeador = true; localStorage.setItem('dugout_auto_paginate', 'false'); if(autoPageChk) autoPageChk.checked = false; logTool("Mapeador: Parando..."); };
            document.getElementById('btn-atk').onclick = async () => {
                stopAtirador = false; document.getElementById('btn-atk').disabled = true; document.getElementById('btn-atk-stop').disabled = false;
                try { await runAtirador(logTool); } catch(e) { logTool("Erro crítico no Atirador."); }
                document.getElementById('btn-atk').disabled = false; document.getElementById('btn-atk-stop').disabled = true;
            };
            document.getElementById('btn-atk-stop').onclick = () => { stopAtirador = true; logTool("Atirador: Parando..."); };

            if (autoPageChk.checked) { logTool("Retomando mapeamento automático..."); setTimeout(() => { document.getElementById('btn-map').click(); }, 1000); }
        } catch(e) { console.error("[Unified] Erro na UI de Busca:", e); }
    }

    async function runMapeador(logFn) {
        let alvos = JSON.parse(localStorage.getItem('dugout_alvos_salvos') || '[]'); let idsSalvos = new Set(alvos.map(a => a.id)); let linksClubes = document.querySelectorAll('a[href*="clubid/"]'); let idsUnicos = new Set();
        linksClubes.forEach(link => { let match = link.href.match(/clubid\/(\d+)/); if (match) idsUnicos.add(match[1]); });
        let salvos = 0; logFn(`Iniciando página atual (${idsUnicos.size} clubes)...`);

        for (let clubId of idsUnicos) {
            if (stopMapeador) break; if (idsSalvos.has(clubId)) continue;
            let trPai = Array.from(document.querySelectorAll('tr')).find(tr => tr.innerHTML.includes(`clubid/${clubId}`)); if (!trPai) continue;
            let htmlLinha = trPai.innerHTML.toLowerCase(); let textoLinha = trPai.innerText.toLowerCase();
            if (htmlLinha.includes('brz.png') || textoLinha.includes('brasil')) continue;
            let linkEl = trPai.querySelector(`a[href*="clubid/${clubId}"]`); let nomeClube = linkEl ? linkEl.innerText.trim() : `Clube ${clubId}`; logFn(`Lendo: ${nomeClube}...`);

            try {
                let urlCanonica = `https://www.dugout-online.com/clubinfo/none/clubid/${clubId}`; let htmlClube = await fetchPage(urlCanonica); let docClube = new DOMParser().parseFromString(htmlClube, "text/html"); let { rating, capacidade } = extractClubStats(docClube);
                if (rating === 0 && capacidade === 0) { logFn(`⚠️ Erro de leitura: ${nomeClube}`); await sleep(1500); continue; }

                if (rating >= 800 && capacidade >= 60000) {
                    let linkDesafio = `https://www.dugout-online.com/clubinfo/challengeteam/club_id/${clubId}`;
                    alvos.push({ id: clubId, nome: nomeClube, estadio: capacidade, rating: rating, link: linkDesafio }); localStorage.setItem('dugout_alvos_salvos', JSON.stringify(alvos)); idsSalvos.add(clubId);
                    logFn(`✅ Salvo: ${nomeClube} (R:${rating} E:${capacidade})`); salvos++; document.getElementById('atk-count').innerText = alvos.length;
                } else { logFn(`❌ Ignorado: ${nomeClube} (R:${rating} E:${capacidade})`); }
            } catch (e) { logFn(`⚠️ Erro de rede: ${nomeClube}`); }
            await sleep(Math.floor(Math.random() * 3000) + 2000);
        }

        let isAutoPage = localStorage.getItem('dugout_auto_paginate') === 'true';
        if (isAutoPage && !stopMapeador) {
            let currentPageEl = document.querySelector('.do-se-page.is-current'); let nextPageBtn = null;
            if (currentPageEl) { let currPage = parseInt(currentPageEl.innerText); nextPageBtn = document.querySelector(`button.do-se-page[onclick*="doSePage(${currPage + 1})"]`) || document.querySelector(`.do-se-page[onclick*="${currPage + 1}"]`); }
            if (nextPageBtn) { logFn(`📄 Indo para a página seguinte...`); await sleep(2000); nextPageBtn.click(); } 
            else {
                let countrySelect = document.querySelector('select[name="from"]');
                if (countrySelect) {
                    let options = Array.from(countrySelect.options); let validCountries = options.filter(opt => opt.value !== '' && opt.value !== 'BRZ'); let currentVal = countrySelect.value;
                    let currentIdx = validCountries.findIndex(opt => opt.value === currentVal); let nextIdx = currentIdx + 1;
                    if (nextIdx < validCountries.length) {
                        let nextCountry = validCountries[nextIdx]; logFn(`🌍 Fim das páginas. Mudando país para: ${nextCountry.text}...`); countrySelect.value = nextCountry.value;
                        let searchBtn = document.querySelector('button[type="submit"]') || document.querySelector('input[value="Buscar"]') || document.querySelector('.do-btn-primary');
                        if (searchBtn) searchBtn.click(); else countrySelect.closest('form')?.submit();
                    } else {
                        logFn(`🏁 Todos os países e páginas foram mapeados! Fim do trabalho.`); localStorage.setItem('dugout_auto_paginate', 'false'); let chk = document.getElementById('auto-page-chk'); if(chk) chk.checked = false;
                    }
                } else { logFn(`🏁 Última página alcançada. Fim do mapeamento.`); localStorage.setItem('dugout_auto_paginate', 'false'); let chk = document.getElementById('auto-page-chk'); if(chk) chk.checked = false; }
            }
        } else { logFn(stopMapeador ? "Mapeador parado." : `Mapeador finalizado. +${salvos} salvos.`); }
    }

    async function runAtirador(logFn) {
        let alvos = JSON.parse(localStorage.getItem('dugout_alvos_salvos') || '[]'); alvos.sort(() => Math.random() - 0.5); let env = 0; logFn("Atirador iniciado.");
        for (let alvo of alvos) {
            if (stopAtirador) break; if (!alvo || !alvo.id) continue; logFn(`Auditando: ${alvo.nome || alvo.id}...`);
            try {
                let cleanUrl = `https://www.dugout-online.com/clubinfo/none/clubid/${alvo.id}`; let htmlClube = await fetchPage(cleanUrl); let docClube = new DOMParser().parseFromString(htmlClube, "text/html"); let { rating, capacidade } = extractClubStats(docClube);
                if (rating < 800 || capacidade < 60000) { logFn(`❌ Ignorado: ${alvo.nome} (R:${rating} E:${capacidade})`); await sleep(1000); continue; }
                let htmlDesafio = await fetchPage(`https://www.dugout-online.com/clubinfo/challengeteam/club_id/${alvo.id}`); let docDesafio = new DOMParser().parseFromString(htmlDesafio, "text/html");
                let selectEstadio = docDesafio.querySelector('select[name="playedin"]'); let selectData = docDesafio.querySelector('select[name="playedon"]');
                if (!selectEstadio || !selectData || selectEstadio.options.length === 0) { logFn(`⚠️ Sem opções: ${alvo.nome}`); await sleep(2000); continue; }
                await fetchPage(`https://www.dugout-online.com/clubinfo/none/challenge/1/playedIn/${selectEstadio.options[0].value}/playedOn/${selectData.options[0].value}/clubid/${alvo.id}`);
                env++; logFn(`📨 Enviado! (${env}) - ${alvo.nome}`);
            } catch (e) { logFn(`⚠️ Erro de rede: ${alvo.nome || '?'}`); }
            await sleep(Math.floor(Math.random() * 4000) + 8000);
        }
        logFn(stopAtirador ? `Atirador parado (${env}).` : `Fim! (${env} enviados).`);
    }

    // ==========================================
    // PARTE 4: PÁGINA DE LEILÕES E BUSCA DE JOGADORES
    // ==========================================
    function initTransfersPage() {
        const table = document.querySelector('.do-se-table'); if (!table || document.getElementById('auto-ops-started')) return;
        table.id = 'auto-ops-started'; table.style.tableLayout = 'auto'; table.style.width = '100%';
        const headerRow = table.querySelector('thead tr'); if (!headerRow) return;
        let valColIndex = -1; let endColIndex = -1; const headers = Array.from(headerRow.children);
        for (let i = 0; i < headers.length; i++) { let txt = headers[i].innerText.toUpperCase(); if (txt.includes('VALOR EST')) valColIndex = i; if (txt.includes('ENCERRAMENTO')) endColIndex = i; }
        const thOps = document.createElement('th'); thOps.className = 'c-num'; thOps.innerText = 'OPS'; thOps.style.width = '50px';
        const thHigh = document.createElement('th'); thHigh.className = 'c-num'; thHigh.innerText = 'HIGH'; thHigh.style.width = '85px';
        headerRow.appendChild(thOps); headerRow.appendChild(thHigh);

        async function autoCalculateOPS() {
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            for (let row of rows) {
                const link = row.querySelector('a[href*="playerID"]'); if (!link || row.querySelector('.calc-ops-cell')) continue;
                const match = link.href.match(/playerID\/(\d+)/); if (!match) continue; const pId = match[1];
                const posSpan = row.querySelector('.do-pos-badge'); const posText = posSpan ? posSpan.innerText.trim() : '';
                const tdOps = document.createElement('td'); tdOps.className = 'c-num calc-ops-cell'; tdOps.innerText = '...'; tdOps.style.width = '50px';
                const tdHigh = document.createElement('td'); tdHigh.className = 'c-num calc-ops-cell'; tdHigh.innerText = '...'; tdHigh.style.width = '85px'; tdHigh.style.whiteSpace = 'nowrap'; tdHigh.style.overflow = 'visible';
                row.appendChild(tdOps); row.appendChild(tdHigh);
                try {
                    if (endColIndex !== -1 && row.cells[endColIndex]) {
                        const endCell = row.cells[endColIndex]; const endText = endCell.innerText.trim(); const localTime = getLocalTime(endText);
                        if (localTime && !endCell.querySelector('.unified-time')) {
                            const timeDiv = document.createElement('div'); timeDiv.className = 'unified-time'; timeDiv.style.cssText = 'font-size: 9px; color: #666; line-height: 1; margin-top: 2px;';
                            timeDiv.innerHTML = `<span style="background: #eee; padding: 0px 3px; border-radius: 2px; display: inline-block;">Local: ${localTime}</span>`; endCell.appendChild(timeDiv);
                        }
                    }
                    let htmlProfile = await fetchPage(`https://www.dugout-online.com/players/details/playerID/${pId}`); let docProfile = new DOMParser().parseFromString(htmlProfile, "text/html");
                    let salarioText = null; let salarioMatch = docProfile.body.textContent.match(/\(([\d\.,]+)\s*\$\s*\/semana\)/i);
                    if (salarioMatch) salarioText = salarioMatch[1] + ' $/sem';
                    if (salarioText && valColIndex !== -1 && row.cells[valColIndex]) {
                        const valEstCell = row.cells[valColIndex]; valEstCell.style.fontSize = '11px';
                        if (!valEstCell.querySelector('.unified-salary')) {
                            const salDiv = document.createElement('div'); salDiv.className = 'unified-salary'; salDiv.style.cssText = 'font-size: 9px; color: #666; line-height: 1; margin-top: 2px;';
                            salDiv.innerHTML = `<span style="background: #eee; padding: 0px 3px; border-radius: 2px; display: inline-block;">${salarioText}</span>`; valEstCell.appendChild(salDiv);
                        }
                    }
                    let attrs = []; let values = Array.from(docProfile.querySelectorAll('.do-pd-attrgrid .do-pd-av')).map(el => parseInt(el.innerText) || 0);
                    if (values.length === 21) attrs = [0,18,8,14,6,1,17,7,15,12,2,16,10,4,19,3,9,11,20,13,5].map(i => values[i]);
                    else {
                        let statsBtn = docProfile.querySelector('.do-stats-btn');
                        if (statsBtn && statsBtn.dataset.stats) { let statsObj = JSON.parse(statsBtn.dataset.stats); attrs = v4StatOrder.map(k => parseInt(statsObj[k === 'SPD' ? 'SP' : k]) || 0); }
                    }
                    if (attrs.length === 21 && attrs.every(v => !isNaN(v))) {
                        let result = calcularOPS(attrs, posText); tdOps.innerText = result.ops;
                        if (result.high > result.ops) { const badgeStyle = getBadgeStyle(result.highPos); tdHigh.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; gap: 4px;"><span style="font-weight: bold; font-size: 13px;">${result.high}</span><span style="${badgeStyle} font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 4px; text-transform: uppercase;">${result.highPos}</span></div>`; } else { tdHigh.innerText = result.high; }
                    } else { tdOps.innerText = '-'; tdHigh.innerText = '-'; }
                } catch (e) { tdOps.innerText = 'X'; tdHigh.innerText = 'X'; }
                await sleep(1000);
            }
        }
        setTimeout(autoCalculateOPS, 2000);
    }

    // ==========================================
    // PARTE 5: PÁGINA DE OFERTAS DO CLUBE (Bids)
    // ==========================================
    function initClubBidsPage() {
        const deadlineCells = document.querySelectorAll('.do-bids-col-deadline');
        deadlineCells.forEach(cell => {
            if (cell.querySelector('.unified-time')) return;
            const endText = cell.innerText.trim(); const localTime = getLocalTime(endText);
            if (localTime) {
                const timeDiv = document.createElement('div'); timeDiv.className = 'unified-time'; timeDiv.style.cssText = 'font-size: 9px; color: #666; line-height: 1; margin-top: 2px;';
                timeDiv.innerHTML = `<span style="background: #eee; padding: 0px 3px; border-radius: 2px; display: inline-block;">Local: ${localTime}</span>`; cell.appendChild(timeDiv);
            }
        });
    }

    // ==========================================
    // PARTE 6: DASHBOARD DE TREINAMENTO
    // ==========================================
    function createDashboard() {
        const qualityContainer = document.querySelector('.do-tr-quality');
        if (!qualityContainer) return;

        if (document.getElementById('genie-train-dashboard')) {
            updateDashboardValues();
            return;
        }

        const metrics = qualityContainer.querySelectorAll('.do-tr-metric');
        if (metrics.length === 0) return;

        const dashboard = document.createElement('div');
        dashboard.id = 'genie-train-dashboard';
        dashboard.className = 'do-panel';
        dashboard.style.cssText = `
            margin-top: 15px;
            margin-bottom: 15px;
            background: #f9fbf9;
            border: 1px solid #a6bdaa;
            border-radius: 4px;
            padding: 15px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            width: 100%;
            box-sizing: border-box;
        `;
        
        const trCols = document.querySelector('.do-tr-cols');
        if (trCols) {
            trCols.parentNode.insertBefore(dashboard, trCols);
        } else {
            qualityContainer.parentNode.appendChild(dashboard);
        }

        const nomes = { gk: 'Goleiro', df: 'Defesa', mf: 'Meio-campo', fw: 'Ataque', phy: 'Physical', tac: 'Tactical', yth: 'Juvenil' };
        const metas = { gk: 67, df: 67, mf: 67, fw: 67, phy: 224, tac: 224, yth: 67 };

        metrics.forEach(metric => {
            const area = metric.getAttribute('data-metric');
            if (!area) return;
            const meta = metas[area] || 67;

            const card = document.createElement('div');
            card.id = `card-${area}`;
            card.style.cssText = `
                flex: 1;
                min-width: 85px;
                display: flex;
                flex-direction: column;
                align-items: center;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;
            
            card.innerHTML = `
                <div style="font-size: 10px; font-weight: bold; color: #555; text-transform: uppercase;">${nomes[area] || area}</div>
                <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0;">
                    <span class="genie-train-value" id="val-${area}" style="font-size: 22px; font-weight: bold; color: #5e81ac; line-height: 1;">0</span>
                    <span class="genie-train-badge" id="badge-${area}" style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 10px; background: #f39c12; color: #fff;">0</span>
                </div>
                <div style="width: 100%; height: 6px; background: #ddd; border-radius: 3px; overflow: hidden; margin-bottom: 2px;">
                    <div class="genie-train-progress" id="prog-${area}" style="width: 0%; height: 100%; background: #5e81ac; transition: width 0.3s ease;"></div>
                </div>
                <div style="width: 100%; display: flex; justify-content: space-between; font-size: 9px; color: #888;">
                    <span>0</span><span>${meta}</span>
                </div>
            `;
            dashboard.appendChild(card);
        });

        updateDashboardValues();
    }

    function updateDashboardValues() {
        const qualityContainer = document.querySelector('.do-tr-quality');
        if (!qualityContainer) return;

        const metas = { gk: 67, df: 67, mf: 67, fw: 67, phy: 224, tac: 224, yth: 67 };
        const mapSkill = { gk: 'gk', df: 'df', mf: 'mf', fw: 'fw', phy: 'phy', tac: 'tac', yth: 'yth' };

        const brutoCalculado = { gk: 0, df: 0, mf: 0, fw: 0, phy: 0, tac: 0, yth: 0 };
        
        document.querySelectorAll('.do-tr-coach').forEach(coach => {
            const selectFocus = coach.querySelector('.do-tr-focus');
            if (!selectFocus) return;
            
            const focusVal = selectFocus.value; 
            const mapFocus = { '2': 'gk', '3': 'df', '4': 'mf', '5': 'fw', '7': 'yth' };

            Object.keys(mapSkill).forEach(area => {
                const skillInput = coach.querySelector(`.do-tr-cskill[data-skill="${mapSkill[area]}"]`);
                if (!skillInput) return;
                
                let skillVal = parseInt(skillInput.value) || 0;
                
                if (mapFocus[focusVal] === area) brutoCalculado[area] += skillVal;
                else if (focusVal === '1') brutoCalculado[area] += (skillVal * 0.15);
            });
        });

        qualityContainer.querySelectorAll('.do-tr-metric').forEach(metric => {
            const area = metric.getAttribute('data-metric');
            const ballsDiv = metric.querySelector('.do-tr-balls');
            if (!area || !ballsDiv) return;

            const valorFinal = parseInt(ballsDiv.getAttribute('data-val')) || 0;
            const meta = metas[area] || 67;
            
            let valorBruto = Math.round(brutoCalculado[area]);
            
            if (valorBruto === 0 && valorFinal > 0) {
                if (area === 'phy' || area === 'tac') valorBruto = Math.round(valorFinal / 0.855);
                else valorBruto = Math.round(valorFinal / 3);
            }

            const valEl = document.getElementById(`val-${area}`);
            const progEl = document.getElementById(`prog-${area}`);
            const badgeEl = document.getElementById(`badge-${area}`);

            if (valEl && progEl && badgeEl) {
                if (valorBruto > meta && valorFinal < 200) valorBruto = meta;
                
                const falta = meta - valorBruto;

                valEl.innerText = valorBruto;
                
                if (falta <= 0) {
                    badgeEl.innerText = '✔';
                    badgeEl.style.background = '#4CAF50';
                    badgeEl.style.color = '#fff';
                } else {
                    badgeEl.innerText = `-${falta}`;
                    badgeEl.style.background = '#f39c12';
                    badgeEl.style.color = '#fff';
                }
                
                let porcentagem = Math.min((valorBruto / meta) * 100, 100);
                progEl.style.width = `${porcentagem}%`;

                if (valorFinal >= 200) { valEl.style.color = '#bf616a'; progEl.style.background = '#bf616a'; }
                else if (area === 'phy') { valEl.style.color = '#d08770'; progEl.style.background = '#d08770'; }
                else if (area === 'tac') { valEl.style.color = '#b48ead'; progEl.style.background = '#b48ead'; }
                else if (valorFinal === 0) { valEl.style.color = '#999'; progEl.style.background = '#999'; }
                else { valEl.style.color = '#5e81ac'; progEl.style.background = '#5e81ac'; }
            }
        });
    }

    // ==========================================
    // PARTE 7: EFETIVIDADE DOS TÉCNICOS
    // ==========================================
    function initCoachEffectiveness() {
        if (document.getElementById('unified-coach-effectiveness')) return;

        const quality = document.querySelector('.do-tr-quality') || document.querySelector('.training_quality_wrapper');
        if (!quality) return;

        const coaches = document.querySelectorAll('.do-tr-coach, .coach_cell').length;
        if (coaches === 0) return;

        const box = document.createElement('div'); 
        box.id = 'unified-coach-effectiveness'; 
        box.className = 'genie-training-controls';
        box.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 10px 0; flex-wrap: wrap;';
        
        const result = document.createElement('span'); 
        result.setAttribute('role', 'status'); 
        result.textContent = 'Efetividade dos técnicos: —';
        
        const button = document.createElement('button'); 
        button.type = 'button';
        button.textContent = 'Calcular';
        button.className = 'do-btn do-btn-outline do-btn-sm';

        button.addEventListener('click', async () => {
            const urls = [...new Set(Array.from(document.querySelectorAll('.do-tr-prow a[href*="/players/"], tr[class*="row"] a[href*="/players/"]'), a => a.href))];
            
            button.disabled = true; 
            result.textContent = 'Consultando contratos…';
            
            let contracted = 0, failures = 0;

            for (let i = 0; i < urls.length; i += 5) {
                const batch = await Promise.all(urls.slice(i, i + 5).map(async url => {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(String(response.status));
                        
                        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                        let contractValue = null;
                        
                        const elements = Array.from(doc.querySelectorAll('div, span, td, th, p, b'));
                        for (const el of elements) {
                            const text = el.textContent.trim().toLowerCase();
                            if (text === 'contrato' || text === 'contract') {
                                let valorEl = el.nextElementSibling || el.parentElement?.nextElementSibling;
                                if (valorEl) {
                                    contractValue = valorEl.textContent.trim();
                                }
                                break;
                            }
                        }

                        if (!contractValue) {
                            const bodyText = doc.body.textContent;
                            const match = bodyText.match(/(?:contrato|contract)\s*(?:\n|\r|:)*\s*([^\n\r]+)/i);
                            if (match && match[1]) contractValue = match[1].trim();
                        }

                        if (!contractValue) throw new Error('Contrato não encontrado');
                        
                        const isNotContracted = contractValue === '/' || contractValue === '' || contractValue.toLowerCase() === 'no contract' || contractValue.toLowerCase() === 'sem contrato';
                        
                        return !isNotContracted; 
                    } catch (error) { 
                        console.warn('[Unified] Contrato indisponível:', url, error); 
                        return null; 
                    }
                }));
                
                contracted += batch.filter(value => value === true).length;
                failures += batch.filter(value => value === null).length;
            }

            if (failures) {
                result.textContent = 'Efetividade indisponível: ' + failures + ' contrato(s) não lido(s).';
            } else {
                const excess = Math.max(0, contracted - coaches * 7);
                const percentages = [100, 99, 98, 96, 92, 88, 82, 76, 68, 60, 50, 40, 28, 16];
                result.textContent = 'Jogadores contratados: ' + contracted + ' · Efetividade dos técnicos: ' + (excess > 13 ? 10 : percentages[excess]) + '%';
            }
            
            button.disabled = false;
        });

        box.append(result, button); 
        quality.after(box);
    }

    // ==========================================
    // INICIALIZAÇÃO E OBSERVER
    // ==========================================
    const url = window.location.href;
    if (url.includes('/home/none/')) {
        initHomePage();
    } else if (url.includes('/players/none/') || url.includes('/players/') || url.includes('/training/')) {
        setTimeout(initSquadPage, 800);
    } else if (url.includes('/search_clubs/')) {
        setTimeout(initSearchClubsPage, 1000);
    } else if (url.includes('/search_transfers/') || url.includes('/search_players/')) {
        setTimeout(initTransfersPage, 1500);
    } else if (url.includes('/clubinfo/bids/')) {
        setInterval(initClubBidsPage, 1000);
    }

    setInterval(() => {
        if (document.querySelector('.do-tr-quality') || document.querySelector('.training_quality_wrapper')) {
            createDashboard();
            initCoachEffectiveness();
        }
    }, 1000);

})();
