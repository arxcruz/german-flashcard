// --- ELEMENTOS DA PÁGINA ---
// (nenhuma mudança aqui, todas as variáveis permanecem)
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
const errosCount = document.getElementById('erros-count');
const verboNivelAtual = document.getElementById('verbo-nivel-atual');
const fimDeJogoContainer = document.getElementById('fim-de-jogo');
const resultadoFinal = document.getElementById('resultado-final');
const errosListaContainer = document.getElementById('erros-lista');
const secaoTreinoErros = document.getElementById('secao-treino-erros');
const contadorErrosSalvos = document.getElementById('contador-erros-salvos');
const treinarErrosBtn = document.getElementById('treinar-erros-btn');
const limparErrosBtn = document.getElementById('limpar-erros-btn');
const iniciarNovoJogoLabel = document.getElementById('iniciar-novo-jogo-label');


// --- VARIÁVEIS DE ESTADO ---
let currentLang = 'pt';
let MASTER_VERB_LIST = []; // NOVO: Lista mestra e imutável de todos os verbos carregados
let todosOsVerbos = []; // Usado para filtragem, pode ser modificado
let verbosDaPartida = [];
let palavrasErradas = [];
let verboAtual = null;
let acertos = 0;
let erros = 0;
let indiceVerboAtual = 0;
let tempoTimer = 3500;
let ultimasConfiguracoes = {};
const STORAGE_KEY = 'errosAnteriores';
let isTrainingMode = false;

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
        const key = element.dataset.translateKey;
        if (element) element.innerText = t(key);
    });
    updateTrainSectionVisibility();
}

// --- FUNÇÕES DE INTERAÇÃO COM LOCALSTORAGE ---
function getSavedErrors() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveErrors(newErrors) {
    if (newErrors.length === 0) return;
    const savedErrors = getSavedErrors();
    const combinedErrors = [...savedErrors, ...newErrors];
    const uniqueErrorsMap = new Map(combinedErrors.map(error => [error.verbo, error]));
    const uniqueErrors = [...uniqueErrorsMap.values()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueErrors));
}

function clearSavedErrors() {
    localStorage.removeItem(STORAGE_KEY);
    alert(t('errorListCleared'));
    updateTrainSectionVisibility();
}

// --- FUNÇÕES DO JOGO ---
function updateTrainSectionVisibility() {
    const savedErrors = getSavedErrors();
    if (savedErrors.length > 0) {
        contadorErrosSalvos.innerText = t('savedErrorsCounter', { count: savedErrors.length });
        secaoTreinoErros.classList.remove('hidden');
    } else {
        secaoTreinoErros.classList.add('hidden');
    }
}

async function prepararJogo(fileName) {
    if (!fileName) return;
    [nivelSelect, quantidadeSelect, timeoutSelect, iniciarBtn].forEach(el => el.disabled = true);
    nivelSelect.innerHTML = `<option>${t('loading')}</option>`;
    try {
        const response = await fetch(fileName);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();
        
        const parsedVerbs = data.trim().split('\n').slice(1).filter(line => line.trim() !== '').map(line => {
            const columns = line.split('|').map(field => {
                const trimmedField = field.trim();
                return (trimmedField.startsWith('"') && trimmedField.endsWith('"')) 
                    ? trimmedField.substring(1, trimmedField.length - 1) 
                    : trimmedField;
            });
            if (columns.length !== 4) return null;
            const [verbo, traducao, exemplo, nivel] = columns;
            return { verbo, traducao, exemplo, nivel };
        }).filter(Boolean);

        // ATUALIZAÇÃO: Popula a lista mestra e a lista de trabalho
        MASTER_VERB_LIST = [...parsedVerbs];
        todosOsVerbos = [...parsedVerbs];

        const niveis = [...new Set(todosOsVerbos.map(v => v.nivel))].sort();
        nivelSelect.innerHTML = `<option value="all">${t('allLevels')}</option>`;
        niveis.forEach(nivel => {
            if (nivel) {
                nivelSelect.innerHTML += `<option value="${nivel}">${nivel}</option>`;
            }
        });
        [nivelSelect, quantidadeSelect, timeoutSelect, iniciarBtn].forEach(el => el.disabled = false);
    } catch (error) {
        console.error("Erro ao carregar ou processar o arquivo CSV:", error);
        nivelSelect.innerHTML = `<option>Erro!</option>`;
        alert(t('csvError'));
    }
}

function iniciarPartida(listaCustomizada = null) {
    isTrainingMode = !!listaCustomizada; // Define o modo de treino se uma lista customizada for passada

    if (isTrainingMode) {
        verbosDaPartida = [...listaCustomizada].sort(() => 0.5 - Math.random());
    } else {
        const nivel = nivelSelect.value;
        const quantidade = quantidadeSelect.value;
        todosOsVerbos = [...MASTER_VERB_LIST]; // Garante que estamos começando com a lista fresca
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
    }

    if (verbosDaPartida.length === 0) return;

    tempoTimer = parseInt(timeoutSelect.value); 
    ultimasConfiguracoes = {
        nivel: nivelSelect.value,
        quantidade: quantidadeSelect.value,
        timeout: timeoutSelect.value,
        csvFile: csvSelect.value,
        isTraining: isTrainingMode
    };
    
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
    verboNivelAtual.innerText = verboAtual.nivel;
    
    // CORREÇÃO: Usa sempre a MASTER_VERB_LIST para gerar opções, garantindo consistência
    const traducoesErradas = MASTER_VERB_LIST
        .filter(v => v.traducao !== verboAtual.traducao)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(v => v.traducao);

    const opcoes = [verboAtual.traducao, ...traducoesErradas];
    
    // Garante que sempre haja 4 opções (se possível)
    while (opcoes.length < 4 && opcoes.length < MASTER_VERB_LIST.length) {
        const randomVerb = MASTER_VERB_LIST[Math.floor(Math.random() * MASTER_VERB_LIST.length)];
        if (!opcoes.includes(randomVerb.traducao)) {
            opcoes.push(randomVerb.traducao);
        }
    }

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

        // MELHORIA: Salva progresso do treino em tempo real
        if (isTrainingMode) {
            const savedErrors = getSavedErrors();
            const updatedErrors = savedErrors.filter(error => error.verbo !== verboAtual.verbo);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedErrors));
            updateTrainSectionVisibility(); // Atualiza o contador na tela de config em tempo real
        }

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
    verboNivelAtual.innerText = '--';
    
    if (isTrainingMode) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(palavrasErradas));
    } else {
        saveErrors(palavrasErradas);
    }
    
    updateTrainSectionVisibility();
    
    if (palavrasErradas.length > 0) {
        const listaUl = errosListaContainer.querySelector('ul');
        listaUl.innerHTML = '';
        palavrasErradas.forEach(palavra => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${palavra.verbo}:</strong> ${palavra.traducao}`;
            listaUl.appendChild(li);
        });
        errosListaContainer.querySelector('h3').style.display = 'block';
    } else {
        errosListaContainer.querySelector('h3').style.display = 'none';
        errosListaContainer.querySelector('ul').innerHTML = `<li>${t('noErrors')}</li>`;
    }
    fimDeJogoContainer.classList.remove('hidden');
}


// --- EVENT LISTENERS ---
langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
csvSelect.addEventListener('change', (e) => prepararJogo(e.target.value));

document.addEventListener('DOMContentLoaded', () => {
    setLanguage(langSelect.value);
    updateTrainSectionVisibility();
});

iniciarBtn.addEventListener('click', () => iniciarPartida());

treinarErrosBtn.addEventListener('click', () => {
    const savedErrors = getSavedErrors();
    if (savedErrors.length === 0) {
        alert(t('noSavedErrors'));
        return;
    }
    iniciarPartida(savedErrors);
});

limparErrosBtn.addEventListener('click', clearSavedErrors);

jogarNovamenteBtn.addEventListener('click', () => {
    if (ultimasConfiguracoes.isTraining) {
        iniciarPartida(getSavedErrors());
    } else {
        csvSelect.value = ultimasConfiguracoes.csvFile;
        prepararJogo(ultimasConfiguracoes.csvFile).then(() => {
            nivelSelect.value = ultimasConfiguracoes.nivel;
            quantidadeSelect.value = ultimasConfiguracoes.quantidade;
            timeoutSelect.value = ultimasConfiguracoes.timeout;
            iniciarPartida();
        });
    }
});

novoJogoBtn.addEventListener('click', () => {
    gameContainer.classList.add('hidden');
    fimDeJogoContainer.classList.add('hidden');
    telaConfig.classList.remove('hidden');
});
