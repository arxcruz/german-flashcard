// --- ELEMENTOS DA PÁGINA ---
const telaConfig = document.getElementById('tela-config');
const gameContainer = document.getElementById('game-container');
const langSelect = document.getElementById('lang-select');
const csvSelect = document.getElementById('csv-select');
const nivelSelect = document.getElementById('nivel-select');
const quantidadeSelect = document.getElementById('quantidade-select');
const timeoutSelect = document.getElementById('timeout-select');
const iniciarBtn = document.getElementById('iniciar-btn');
const novoJogoBtn = document.getElementById('novo-jogo-btn');
const jogarNovamenteBtn = document.getElementById('jogar-novamente-btn');
const verboDisplay = document.getElementById('verbo-display');
const feedbackDisplay = document.getElementById('feedback-display');
const opcoesContainer = document.getElementById('opcoes-container');
const acertosCount = document.getElementById('acertos-count');
const fimDeJogoContainer = document.getElementById('fim-de-jogo');
const resultadoFinal = document.getElementById('resultado-final');
const errosListaContainer = document.getElementById('erros-lista');
const errosCount = document.getElementById('erros-count');
const verboNivelAtual = document.getElementById('verbo-nivel-atual'); // NOVO ELEMENTO

// --- VARIÁVEIS DE ESTADO ---
let currentLang = 'pt';
let todosOsVerbos = [];
let verbosDaPartida = [];
let palavrasErradas = [];
let verboAtual = null;
let acertos = 0;
let erros = 0;
let indiceVerboAtual = 0;
let tempoTimer = 3500;
let ultimasConfiguracoes = {};

// --- LÓGICA DE TRADUÇÃO ---
function t(key, replacements = {}) {
    let text = translations[currentLang]?.[key] || key;
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
}

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        element.innerText = t(element.dataset.translateKey);
    });
    // Garante que as opções dinâmicas também sejam traduzidas
    if (csvSelect.querySelector('option[value=""]')) {
        csvSelect.querySelector('option[value=""]').innerText = t('pleaseSelectCSV');
    }
    if (nivelSelect.querySelector('option[value="all"]')) {
        nivelSelect.querySelector('option[value="all"]').innerText = t('allLevels');
    }
    if (document.querySelector('#quantidade-select option[value="all"]')) {
        document.querySelector('#quantidade-select option[value="all"]').innerText = t('allWords');
    }
    if(document.querySelector('[data-translate-key="levelLabelShort"]')) {
        document.querySelector('[data-translate-key="levelLabelShort"]').innerText = t('levelLabelShort');
    }
}

// --- FUNÇÕES DO JOGO ---
async function prepararJogo(fileName) {
    if (!fileName) return;

    console.log("--- INICIANDO DIAGNÓSTICO ---");
    console.log("Passo 1: Tentando carregar o arquivo:", fileName);

    [nivelSelect, quantidadeSelect, timeoutSelect, iniciarBtn].forEach(el => el.disabled = true);
    nivelSelect.innerHTML = `<option>${t('loading')}</option>`;

    try {
        const response = await fetch(fileName);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.text();
        console.log("Passo 2: Arquivo carregado com sucesso. Conteúdo (primeiros 150 caracteres):", data.substring(0, 150));

        const lines = data.trim().split('\n');
        console.log(`Passo 3: Arquivo dividido em ${lines.length} linhas.`);

        // Usamos .slice(1) para remover a primeira linha (o cabeçalho) antes de processar
        todosOsVerbos = lines.slice(1).filter(line => line.trim() !== '').map(line => {
            const columns = line.split('|').map(field => {
                const trimmedField = field.trim();
                return (trimmedField.startsWith('"') && trimmedField.endsWith('"')) 
                    ? trimmedField.substring(1, trimmedField.length - 1) 
                    : trimmedField;
            });
            if (columns.length !== 4) {
                console.warn('AVISO: Linha malformada no CSV ignorada (não tem 4 colunas):', line);
                return null;
            }
            const [verbo, traducao, exemplo, nivel] = columns;
            return { verbo, traducao, exemplo, nivel };
        }).filter(Boolean); // Filtra quaisquer linhas nulas (malformadas)

        console.log("Passo 4: Verbos processados. Total de verbos válidos:", todosOsVerbos.length, todosOsVerbos);

        const niveis = [...new Set(todosOsVerbos.map(v => v.nivel))].sort();
        console.log("Passo 5: Níveis únicos encontrados:", niveis);

        nivelSelect.innerHTML = `<option value="all">${t('allLevels')}</option>`;
        niveis.forEach(nivel => {
            if (nivel) { 
                nivelSelect.innerHTML += `<option value="${nivel}">${nivel}</option>`;
            }
        });

        console.log("Passo 6: Habilitando controles...");
        [nivelSelect, quantidadeSelect, timeoutSelect, iniciarBtn].forEach(el => el.disabled = false);
        console.log("--- DIAGNÓSTICO CONCLUÍDO COM SUCESSO ---");

    } catch (error) {
        console.error("ERRO CRÍTICO DENTRO DO BLOCO TRY/CATCH:", error);
        nivelSelect.innerHTML = `<option>Erro!</option>`;
        alert(t('csvError'));
    }
}

// *** LÓGICA CENTRALIZADA EM UMA ÚNICA FUNÇÃO ***
function iniciarPartida() {
    const nivel = nivelSelect.value;
    const quantidade = quantidadeSelect.value;
    const timeout = timeoutSelect.value;
    const csvFile = csvSelect.value;
    
    tempoTimer = parseInt(timeout); 
    ultimasConfiguracoes = { nivel, quantidade, timeout, csvFile };

    let verbosFiltrados = todosOsVerbos;
    if (nivel !== 'all') {
        verbosFiltrados = todosOsVerbos.filter(v => v.nivel === nivel);
    }
    
    if (verbosFiltrados.length === 0) {
        alert(t('noWordsForLevel', { level: nivel }));
        return;
    }

    verbosFiltrados.sort(() => 0.5 - Math.random());
    verbosDaPartida = (quantidade === 'all') ? verbosFiltrados : verbosFiltrados.slice(0, parseInt(quantidade));
    
    acertos = 0;
    erros = 0;
    indiceVerboAtual = 0;
    palavrasErradas = [];
    acertosCount.innerText = acertos;
    errosCount.innerText = erros;
    verboNivelAtual.innerText = '--';

    fimDeJogoContainer.classList.add('hidden');
    telaConfig.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    carregarProximoVerbo();
}

function carregarProximoVerbo() {
    feedbackDisplay.innerText = '';
    opcoesContainer.innerHTML = '';
    if (indiceVerboAtual >= verbosDaPartida.length) {
        mostrarFimDeJogo();
        return;
    }
    verboAtual = verbosDaPartida[indiceVerboAtual];
    verboDisplay.innerText = verboAtual.verbo;
    
    // *** MUDANÇA PRINCIPAL AQUI ***
    // Atualiza o display com o nível do verbo atual
    verboNivelAtual.innerText = verboAtual.nivel;

    const traducoesErradas = todosOsVerbos.filter(v => v.traducao !== verboAtual.traducao).sort(() => 0.5 - Math.random()).slice(0, 3).map(v => v.traducao);
    const opcoes = [verboAtual.traducao, ...traducoesErradas];
    opcoes.sort(() => 0.5 - Math.random()).forEach(opcao => {
        const button = document.createElement('button');
        button.innerText = opcao;
        button.addEventListener('click', () => verificarResposta(opcao, button));
        opcoesContainer.appendChild(button);
    });
}

function verificarResposta(opcaoSelecionada, botaoClicado) {
    const botoes = opcoesContainer.querySelectorAll('button');
    botoes.forEach(b => b.disabled = true);
    if (opcaoSelecionada === verboAtual.traducao) {
        acertos++;
        acertosCount.innerText = acertos;
        botaoClicado.classList.add('correto');
        feedbackDisplay.innerText = `${t('correctFeedback')} ${verboAtual.exemplo}`;
    } else {
        erros++;
        errosCount.innerText = erros;
        botaoClicado.classList.add('errado');
        feedbackDisplay.innerText = `${t('incorrectFeedback')} "${verboAtual.traducao}"`;
        palavrasErradas.push(verboAtual);
        botoes.forEach(b => {
            if (b.innerText === verboAtual.traducao) b.classList.add('correto');
        });
    }
    setTimeout(() => {
        indiceVerboAtual++;
        carregarProximoVerbo();
    }, tempoTimer);
}

function mostrarFimDeJogo() {
    opcoesContainer.innerHTML = '';
    verboDisplay.innerText = t('endGameTitle');
    feedbackDisplay.innerText = '';
    resultadoFinal.innerText = t('finalScore', { acertos: acertos, erros: erros });
    if (palavrasErradas.length > 0) {
        const listaUl = errosListaContainer.querySelector('ul');
        listaUl.innerHTML = '';
        palavrasErradas.forEach(palavra => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${palavra.verbo}:</strong> ${palavra.traducao}`;
            listaUl.appendChild(li);
        });
        errosListaContainer.style.display = 'block';
    } else {
        errosListaContainer.querySelector('ul').innerHTML = `<li>${t('noErrors')}</li>`;
        errosListaContainer.style.display = 'block';
    }
    fimDeJogoContainer.classList.remove('hidden');
}


// --- EVENT LISTENERS ---
langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
csvSelect.addEventListener('change', (e) => prepararJogo(e.target.value));

document.addEventListener('DOMContentLoaded', () => {
    setLanguage(langSelect.value);
});

// O botão de Iniciar agora chama a função centralizada
iniciarBtn.addEventListener('click', iniciarPartida);

// O botão de Jogar Novamente também usa a função centralizada, de forma mais limpa
jogarNovamenteBtn.addEventListener('click', () => {
    csvSelect.value = ultimasConfiguracoes.csvFile;
    prepararJogo(ultimasConfiguracoes.csvFile).then(() => {
        nivelSelect.value = ultimasConfiguracoes.nivel;
        quantidadeSelect.value = ultimasConfiguracoes.quantidade;
        timeoutSelect.value = ultimasConfiguracoes.timeout;
        iniciarPartida();
    });
});

novoJogoBtn.addEventListener('click', () => {
    gameContainer.classList.add('hidden');
    fimDeJogoContainer.classList.add('hidden');
    telaConfig.classList.remove('hidden');
});
