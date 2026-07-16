# Simulador SGE — Sistema de Gerenciamento de Energia

Simulador web interativo desenvolvido a partir do TCC **"Sistema de Gerenciamento de Energia: desenvolvimento de uma solução computacional para monitoramento, análise e otimização do consumo elétrico"** (Análise e Desenvolvimento de Sistemas).

O simulador reproduz em JavaScript puro os três blocos centrais do trabalho:

- **Painel geral** — leitura simulada em tempo real de tensão, corrente, potência ativa, potência reativa, potência aparente e fator de potência, com alertas automáticos.
- **Estudo de caso 1** — baixo fator de potência em indústria metalúrgica, com correção por banco de capacitores.
- **Estudo de caso 2** — ultrapassagem de demanda contratada em rede de supermercados, com gerenciamento preditivo de carga.

## Estrutura do projeto

```
simulador-sge/
├── index.html        # estrutura da página e dos três módulos
├── css/
│   └── style.css      # tema visual (painel estilo instrumentação industrial)
├── js/
│   └── script.js       # toda a lógica de simulação e os gráficos
└── README.md
```

Não há build, framework ou instalação de dependências: é HTML/CSS/JS puro, e o único recurso externo é a biblioteca **Chart.js**, carregada por CDN dentro do `index.html`.

---

## Passo a passo — do código à hospedagem

### 1. Testar localmente

Nenhuma instalação é necessária. Duas formas de abrir o projeto:

**a) Direto no navegador**
Dê duplo clique em `index.html` — ele abre normalmente, já que não há chamadas de servidor.

**b) Com um servidor local (recomendado)**
Alguns navegadores restringem certos recursos quando o arquivo é aberto com `file://`. Um servidor local evita isso:

```bash
cd simulador-sge
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador.

Se preferir Node.js:

```bash
npx serve .
```

### 2. Criar o repositório local com Git

```bash
cd simulador-sge
git init
git add .
git commit -m "Primeira versão do simulador SGE"
```

### 3. Criar o repositório no GitHub

1. Acesse [github.com/new](https://github.com/new).
2. Escolha um nome, por exemplo `simulador-sge`.
3. Deixe como **público** (necessário para o GitHub Pages gratuito em repositórios pessoais).
4. **Não** marque a opção de criar `README`, `.gitignore` ou licença — o repositório precisa nascer vazio, já que esses arquivos já existem localmente.
5. Clique em **Create repository**.

### 4. Conectar o repositório local ao GitHub

O próprio GitHub mostra os comandos após criar o repositório, mas em resumo:

```bash
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/simulador-sge.git
git push -u origin main
```

Substitua `SEU-USUARIO` pelo seu nome de usuário no GitHub.

### 5. Ativar o GitHub Pages

1. No repositório, vá em **Settings**.
2. No menu lateral, clique em **Pages**.
3. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
4. Clique em **Save**.
5. Aguarde alguns instantes — o GitHub mostrará o link de publicação, no formato:

```
https://SEU-USUARIO.github.io/simulador-sge/
```

### 6. Atualizações futuras

Sempre que alterar o código:

```bash
git add .
git commit -m "descrição da alteração"
git push
```

O GitHub Pages republica automaticamente em cerca de 1 minuto após o `push`.

---

## Personalização rápida

- **Parâmetros do estudo de caso 1** (potência ativa da indústria, tarifa de energia reativa, limite ANEEL) estão no topo de `js/script.js`, nas constantes `CASE1_ACTIVE_POWER`, `ANEEL_MIN_FP` e `TARIFF_REACTIVE`.
- **Curva de demanda do estudo de caso 2** está no array `BASE_DEMAND_CURVE`, com um valor de potência (kW) para cada hora do dia.
- **Paleta de cores** está centralizada nas variáveis CSS em `css/style.css` (`:root`).

## Créditos

Baseado no TCC de Gildongledson Alves Fernandes — Curso de Análise e Desenvolvimento de Sistemas, Centro Universitário ETEP em convênio com a Faculdade UniBF.
