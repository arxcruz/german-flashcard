// --- ELEMENTOS DA PÁGINA ---
const idiomaSelect = document.getElementById('idioma-select');
const verboDisplay = document.getElementById('verbo-display');
const feedbackDisplay = document.getElementById('feedback-display');
const opcoesContainer = document.getElementById('opcoes-container');
const acertosCount = document.getElementById('acertos-count');
const errosCount = document.getElementById('erros-count');
const fimDeJogoContainer = document.getElementById('fim-de-jogo');
const resultadoFinal = document.getElementById('resultado-final');

// --- VARIÁVEIS DO JOGO ---
let todosOsVerbos = [];
let verbosEmbaralhados = [];
let verboAtual = null;
let acertos = 0;
let erros = 0;
let indiceVerboAtual = 0;
const TEMPO_TIMER = 4000; // 4 segundos

// --- FUNÇÕES DE LÓGICA ---

// Função principal que inicia ou reinicia o jogo com o arquivo CSV selecionado
async function iniciarPartida() {
    const arquivoCSV = idiomaSelect.value;
    verboDisplay.innerText = "Carregando...";
    opcoesContainer.innerHTML = '';
    feedbackDisplay.innerText = '';
    fimDeJogoContainer.classList.add('hidden');

    try {
        const response = await fetch(arquivoCSV);
        if (!response.ok) throw new Error(`Arquivo ${arquivoCSV} não encontrado.`);
        
        const data = await response.text();
        todosOsVerbos = data.trim().split('\n').filter(line => line).map(line => {
            const [verbo, traducao, exemplo] = line.split(',');
            return { verbo, traducao, exemplo };
        });
        
        // Reseta o estado do jogo
        acertos = 0;
        erros = 0;
        indiceVerboAtual = 0;
        acertosCount.innerText = acertos;
        errosCount.innerText = erros;

        verbosEmbaralhados = [...todosOsVerbos].sort(() => 0.5 - Math.random());
        carregarProximoVerbo();

    } catch (error) {
        console.error('Erro ao iniciar a partida:', error);
        verboDisplay.innerText = "Erro ao carregar.";
        feedbackDisplay.innerText = "Verifique o arquivo CSV e a conexão.";
    }
}

function carregarProximoVerbo() {
    feedbackDisplay.innerText = '';
    opcoesContainer.innerHTML = '';

    if (indiceVerboAtual >= verbosEmbaralhados.length) {
        mostrarFimDeJogo();
        return;
    }

    verboAtual = verbosEmbaralhados[indiceVerboAtual];
    verboDisplay.innerText = verboAtual.verbo;

    // Gerar opções de resposta
    const traducoesErradas = todosOsVerbos
        .filter(v => v.traducao !== verboAtual.traducao)
        .map(v => v.traducao)
        .sort(() => 0.5 - Math.random());
    
    const opcoes = [verboAtual.traducao, ...traducoesErradas.slice(0, 3)];
    
    // Cria os botões na tela
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
        feedbackDisplay.innerText = `Correto! Exemplo: ${verboAtual.exemplo}`;
        
        setTimeout(() => {
            indiceVerboAtual++;
            carregarProximoVerbo();
        }, TEMPO_TIMER);

    } else {
        erros++;
        errosCount.innerText = erros;
        botaoClicado.classList.add('errado');
        feedbackDisplay.innerText = `Errado! Correto era: "${verboAtual.traducao}"`;

        botoes.forEach(b => {
            if (b.innerText === verboAtual.traducao) b.classList.add('correto');
        });

        setTimeout(() => {
            indiceVerboAtual++;
            carregarProximoVerbo();
        }, TEMPO_TIMER + 1000);
    }
}

function mostrarFimDeJogo() {
    opcoesContainer.innerHTML = ''; // Limpa as opções
    verboDisplay.innerText = 'Parabéns!';
    feedbackDisplay.innerText = 'Você concluiu todos os verbos.';
    resultadoFinal.innerText = `Sua pontuação final foi: ${acertos} acertos e ${erros} erros.`;
    fimDeJogoContainer.classList.remove('hidden');
}

// --- INICIALIZAÇÃO DO SCRIPT ---

// Adiciona um "ouvinte" para o evento 'change'. Toda vez que o usuário mudar a opção, a função iniciarPartida será chamada.
idiomaSelect.addEventListener('change', iniciarPartida);

// Inicia o jogo pela primeira vez assim que a página termina de carregar.
document.addEventListener('DOMContentLoaded', iniciarPartida);
