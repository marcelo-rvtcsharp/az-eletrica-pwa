// ── Utils ──────────────────────────────────────────────────────────────────
function fmtBR(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtDataCurta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
function totalOrc(orc) {
  return (orc.itens || []).reduce((a, i) => a + (parseFloat(i.qtd) || 0) * (parseFloat(i.vunit) || 0), 0);
}

// ── Storage ────────────────────────────────────────────────────────────────
const KEY = 'az_eletrica_orcamentos';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// ── State ──────────────────────────────────────────────────────────────────
let orcamentos = load();
let ativoId = null;

function ativo() { return orcamentos.find(o => o.id === ativoId) || null; }

function novoOrcamento() {
  return {
    id: uuidv4(),
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    cliente: { nome: '', cnpj: '', endereco: '', obra: '' },
    data: new Date().toISOString().slice(0, 10),
    validade: '10',
    obs: '',
    itens: [],
  };
}

function atualizar(id, patch) {
  orcamentos = orcamentos.map(o =>
    o.id === id ? { ...o, ...patch, atualizadoEm: new Date().toISOString() } : o
  );
  save(orcamentos);
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  const lista = document.getElementById('sidebar-lista');
  const footer = document.getElementById('sidebar-footer');

  footer.textContent = `${orcamentos.length} orçamento${orcamentos.length !== 1 ? 's' : ''} salvos`;

  if (orcamentos.length === 0) {
    lista.innerHTML = `<div class="sidebar-vazio">Nenhum orçamento ainda.<br>Clique em "+ Novo" para começar.</div>`;
    return;
  }

  lista.innerHTML = orcamentos.map(orc => `
    <div class="orc-item ${orc.id === ativoId ? 'ativo' : ''}" data-id="${orc.id}">
      <div class="orc-item-top">
        <span class="orc-nome ${orc.cliente.nome ? '' : 'vazio'}">${orc.cliente.nome || 'Sem cliente'}</span>
        <span class="orc-valor">R$ ${fmtBR(totalOrc(orc))}</span>
      </div>
      <div class="orc-meta">
        <span>${orc.itens.length} item${orc.itens.length !== 1 ? 's' : ''}</span>
        <span>${fmtDataCurta(orc.atualizadoEm)}</span>
      </div>
      ${orc.id === ativoId ? `
        <div class="orc-acoes">
          <button onclick="duplicar('${orc.id}')">⧉ Duplicar</button>
          <button class="btn-excluir" onclick="excluir('${orc.id}')">✕ Excluir</button>
        </div>` : ''}
    </div>
  `).join('');

  lista.querySelectorAll('.orc-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      ativoId = el.dataset.id;
      render();
    });
  });
}

function renderMain() {
  const main = document.getElementById('main');
  const orc = ativo();

  if (!orc) {
    main.innerHTML = `
      <div class="main-vazio">
        <div class="main-vazio-box">
          <div class="main-vazio-icone">⚡</div>
          <h2>AZ Elétrica — Orçamentos</h2>
          <p>Selecione um orçamento na lista ou crie um novo para começar.</p>
          <button class="btn-criar" onclick="criarNovo()">+ Criar primeiro orçamento</button>
        </div>
      </div>`;
    return;
  }

  const total = totalOrc(orc);

  main.innerHTML = `
    <div class="total-fixo">
      <span class="total-fixo-label">${orc.itens.length} item${orc.itens.length !== 1 ? 's' : ''}</span>
      <span class="total-fixo-valor">R$ ${fmtBR(total)}</span>
    </div>

    <div class="editor">
      <div class="editor-topbar">
        <div>
          <div class="editor-titulo">${orc.cliente.nome || 'Novo orçamento'}</div>
          <div class="editor-sub">Salvo automaticamente</div>
        </div>
        <button class="btn-pdf" onclick="gerarPDF()" ${orc.itens.length === 0 ? 'disabled' : ''}>↓ Gerar PDF</button>
      </div>

      <!-- Cliente -->
      <div class="card">
        <div class="card-title">Dados do cliente</div>
        <div class="grid2">
          <div class="field col-full">
            <label>Nome / Razão social</label>
            <input value="${esc(orc.cliente.nome)}" oninput="updateCliente('nome', this.value)" placeholder="Ex: Prefeitura de Amontada" />
          </div>
          <div class="field">
            <label>CNPJ / CPF</label>
            <input value="${esc(orc.cliente.cnpj)}" oninput="updateCliente('cnpj', this.value)" placeholder="00.000.000/0001-00" />
          </div>
          <div class="field">
            <label>Data do orçamento</label>
            <input type="date" value="${orc.data}" oninput="updateField('data', this.value)" />
          </div>
          <div class="field col-full">
            <label>Endereço</label>
            <input value="${esc(orc.cliente.endereco)}" oninput="updateCliente('endereco', this.value)" placeholder="Rua, nº, bairro, cidade" />
          </div>
          <div class="field col-full">
            <label>Descrição da obra / objeto</label>
            <input value="${esc(orc.cliente.obra)}" oninput="updateCliente('obra', this.value)" placeholder="Ex: Iluminação da Orla Marítima — 850m" />
          </div>
          <div class="field">
            <label>Válido por (dias)</label>
            <input type="number" value="${orc.validade}" oninput="updateField('validade', this.value)" style="width:100px" />
          </div>
        </div>
      </div>

      <!-- Itens -->
      <div class="card">
        <div class="card-title">
          Itens do orçamento
          <span class="badge">${orc.itens.length}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:36px">Nº</th>
                <th>Descrição</th>
                <th style="width:70px" class="r">UND/MTS</th>
                <th style="width:80px" class="r">Qtd</th>
                <th style="width:110px" class="r">Vl unit (R$)</th>
                <th style="width:130px" class="r">Vl total (R$)</th>
                <th style="width:36px"></th>
              </tr>
            </thead>
            <tbody id="tbody-itens">
              ${orc.itens.map((it, idx) => renderItem(it, idx)).join('')}
              ${renderNovoItem()}
            </tbody>
          </table>
        </div>
        <div id="preview-bar"></div>
        <div class="total-bar">
          <span class="total-label">Valor total</span>
          <span class="total-valor">R$ ${fmtBR(total)}</span>
        </div>
      </div>

      <!-- Observações -->
      <div class="card">
        <div class="card-title">Observações</div>
        <div class="field">
          <textarea oninput="updateField('obs', this.value)" placeholder="Ex: Prazo de execução: 30 dias corridos após aprovação.">${esc(orc.obs)}</textarea>
        </div>
      </div>

      <button class="btn-pdf-grande" onclick="gerarPDF()" ${orc.itens.length === 0 ? 'disabled' : ''}>
        ↓ Gerar e Baixar PDF
      </button>
    </div>`;

  // Bind preview em tempo real
  bindPreview();
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderItem(it, idx) {
  const vt = (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0);
  return `
    <tr>
      <td class="center" style="color:var(--muted);font-size:11px">${String(idx+1).padStart(2,'0')}</td>
      <td><input class="inline-input" value="${esc(it.desc)}" oninput="updateItem('${it.id}','desc',this.value)" placeholder="Descrição" /></td>
      <td><input class="inline-input input-sm" value="${esc(it.und)}" oninput="updateItem('${it.id}','und',this.value)" /></td>
      <td><input class="inline-input input-num" type="number" value="${it.qtd}" oninput="updateItemNum('${it.id}','qtd',this.value)" /></td>
      <td><input class="inline-input input-num" type="number" step="0.01" value="${it.vunit}" oninput="updateItemNum('${it.id}','vunit',this.value)" /></td>
      <td class="right"><span class="chip-total">R$ ${fmtBR(vt)}</span></td>
      <td><button class="btn-rem" onclick="removerItem('${it.id}')">✕</button></td>
    </tr>`;
}

function renderNovoItem() {
  return `
    <tr class="novo-row" id="tr-novo">
      <td class="center" style="color:var(--muted);font-size:11px">—</td>
      <td><input class="inline-input" id="n-desc" placeholder="Nova descrição..." /></td>
      <td><input class="inline-input input-sm" id="n-und" value="UND" /></td>
      <td><input class="inline-input input-num" id="n-qtd" type="number" placeholder="0" /></td>
      <td><input class="inline-input input-num" id="n-vunit" type="number" step="0.01" placeholder="0,00" /></td>
      <td></td>
      <td>
        <button class="btn-add-item" onclick="adicionarItem()" title="Adicionar">+</button>
      </td>
    </tr>`;
}

function bindPreview() {
  ['n-qtd','n-vunit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', atualizarPreview);
  });
  const desc = document.getElementById('n-desc');
  if (desc) desc.addEventListener('keydown', e => { if(e.key === 'Enter') adicionarItem(); });
}

function atualizarPreview() {
  const qtd = parseFloat(document.getElementById('n-qtd')?.value) || 0;
  const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0;
  const preview = qtd * vunit;
  const bar = document.getElementById('preview-bar');
  if (!bar) return;
  if (preview > 0) {
    const novoTotal = totalOrc(ativo()) + preview;
    bar.innerHTML = `
      <div class="preview-bar">
        <span class="preview-label">Este item:</span>
        <span class="preview-valor">+ R$ ${fmtBR(preview)}</span>
        <span>→</span>
        <span class="preview-novo">Total: R$ ${fmtBR(novoTotal)}</span>
      </div>`;
  } else {
    bar.innerHTML = '';
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
function criarNovo() {
  const novo = novoOrcamento();
  orcamentos = [novo, ...orcamentos];
  save(orcamentos);
  ativoId = novo.id;
  render();
}

function excluir(id) {
  const orc = orcamentos.find(o => o.id === id);
  if (!confirm(`Excluir orçamento de "${orc?.cliente?.nome || 'sem cliente'}"?`)) return;
  orcamentos = orcamentos.filter(o => o.id !== id);
  save(orcamentos);
  if (ativoId === id) ativoId = null;
  render();
}

function duplicar(id) {
  const origem = orcamentos.find(o => o.id === id);
  if (!origem) return;
  const copia = {
    ...JSON.parse(JSON.stringify(origem)),
    id: uuidv4(),
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    cliente: { ...origem.cliente, nome: origem.cliente.nome + ' (cópia)' },
  };
  orcamentos = [copia, ...orcamentos];
  save(orcamentos);
  ativoId = copia.id;
  render();
}

function updateCliente(field, value) {
  const orc = ativo();
  if (!orc) return;
  atualizar(orc.id, { cliente: { ...orc.cliente, [field]: value } });
  // Atualiza só o título e sidebar sem re-renderizar tudo
  document.querySelector('.editor-titulo').textContent = orcamentos.find(o => o.id === ativoId)?.cliente?.nome || 'Novo orçamento';
  renderSidebar();
}

function updateField(field, value) {
  const orc = ativo();
  if (!orc) return;
  atualizar(orc.id, { [field]: value });
}

function updateItem(id, field, value) {
  const orc = ativo();
  if (!orc) return;
  const itens = orc.itens.map(it => it.id === id ? { ...it, [field]: value } : it);
  atualizar(orc.id, { itens });
  atualizarTotalBar();
}

function updateItemNum(id, field, value) {
  const orc = ativo();
  if (!orc) return;
  const itens = orc.itens.map(it => it.id === id ? { ...it, [field]: parseFloat(value) || 0 } : it);
  atualizar(orc.id, { itens });
  // Atualiza chip da linha
  const total = (parseFloat(orcamentos.find(o=>o.id===ativoId)?.itens?.find(i=>i.id===id)?.qtd)||0) *
                (parseFloat(orcamentos.find(o=>o.id===ativoId)?.itens?.find(i=>i.id===id)?.vunit)||0);
  atualizarTotalBar();
  renderSidebar();
}

function atualizarTotalBar() {
  const orc = ativo();
  if (!orc) return;
  const t = totalOrc(orc);
  const el = document.querySelector('.total-valor');
  if (el) el.textContent = 'R$ ' + fmtBR(t);
  const fx = document.querySelector('.total-fixo-valor');
  if (fx) fx.textContent = 'R$ ' + fmtBR(t);
  const fl = document.querySelector('.total-fixo-label');
  if (fl) fl.textContent = `${orc.itens.length} item${orc.itens.length !== 1 ? 's' : ''}`;
}

function removerItem(id) {
  const orc = ativo();
  if (!orc) return;
  atualizar(orc.id, { itens: orc.itens.filter(it => it.id !== id) });
  render();
}

function adicionarItem() {
  const desc  = document.getElementById('n-desc')?.value.trim();
  const und   = document.getElementById('n-und')?.value.trim() || 'UND';
  const qtd   = parseFloat(document.getElementById('n-qtd')?.value) || 0;
  const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0;

  if (!desc || qtd <= 0 || vunit < 0) {
    alert('Preencha descrição, quantidade e valor unitário.');
    return;
  }
  const orc = ativo();
  if (!orc) return;
  atualizar(orc.id, { itens: [...orc.itens, { id: uuidv4(), desc, und, qtd, vunit }] });
  render();
}

// ── PDF ────────────────────────────────────────────────────────────────────
function gerarPDF() {
  const orc = ativo();
  if (!orc || orc.itens.length === 0) return;

  const total = totalOrc(orc);
  const numOrc = orc.id.slice(0, 8).toUpperCase();
  const obsTexto = [
    `OBS: Orçamento válido por ${orc.validade || '10'} dias.  —  Data: ${fmtData(orc.data)},  Amontada – CE`,
    orc.obs || ''
  ].filter(Boolean).join('\n');

  const linhas = orc.itens.map((it, idx) => {
    const vt = (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0);
    return `
      <tr style="background:${idx%2===0?'#fff':'#f5f7f5'}">
        <td style="text-align:center;padding:5px">${String(idx+1).padStart(2,'0')}</td>
        <td style="padding:5px">${it.desc}</td>
        <td style="text-align:center;padding:5px">${it.und}</td>
        <td style="text-align:right;padding:5px">${fmtBR(it.qtd)}</td>
        <td style="text-align:right;padding:5px">${fmtBR(it.vunit)}</td>
        <td style="text-align:right;padding:5px;font-weight:700;color:#1a3a5c">${fmtBR(vt)}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a}
.header{background:#1a3a5c;padding:14px 20px;display:flex;justify-content:space-between;align-items:flex-start}
.empresa-nome{color:#FFD700;font-size:20px;font-weight:bold}
.empresa-info{color:#aac;font-size:8px;margin-top:4px}
.num-orc{color:rgba(255,215,0,.7);font-size:9px;text-align:right}
.num-orc strong{color:#FFD700;font-size:13px;display:block}
.cliente-box{padding:10px 20px;border-bottom:1px solid #ddd}
.cli-nome{font-size:11px;font-weight:bold;margin-bottom:2px}
.cli-info{font-size:9px;color:#555;margin-bottom:2px}
.obra{font-size:10px;font-weight:bold;color:#0e4e64;margin-top:6px}
table{width:calc(100% - 40px);margin:10px 20px 0;border-collapse:collapse;font-size:9px}
thead tr{background:#1a3a5c}
thead th{color:#FFD700;font-weight:bold;padding:6px 5px;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
th.r,td.r{text-align:right}
th.c,td.c{text-align:center}
td{border-bottom:1px solid #eee}
.total-bar{background:#0f2d4a;margin:0 20px;padding:8px 10px;display:flex;justify-content:space-between}
.total-label{color:rgba(255,215,0,.7);font-size:9px;font-weight:bold}
.total-valor{color:#FFD700;font-size:15px;font-weight:bold}
.obs-box{background:#FFF9C4;margin:10px 20px;padding:8px 10px;font-size:8.5px;color:#504000;line-height:1.6;white-space:pre-line}
.assinatura{margin:20px 20px 0;border-top:1px solid #888;width:180px;padding-top:4px;font-size:8px;color:#888}
.rodape{text-align:center;font-size:7px;color:#bbb;margin-top:20px;padding-bottom:10px}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="empresa-nome">AZ ELÉTRICA</div>
    <div class="empresa-info">Fone (88)98161-0318 · Elderazevedo22@hotmail.com · CNPJ: 63.824.949/0001-26</div>
  </div>
  <div class="num-orc"><strong>ORC-${numOrc}</strong>Data: ${fmtData(orc.data)}</div>
</div>
<div class="cliente-box">
  <div class="cli-nome">${orc.cliente.nome || '—'}${orc.cliente.cnpj ? ' — CNPJ: '+orc.cliente.cnpj : ''}</div>
  ${orc.cliente.endereco ? `<div class="cli-info">Endereço: ${orc.cliente.endereco}</div>` : ''}
  ${orc.cliente.obra ? `<div class="obra">Objeto: ${orc.cliente.obra}</div>` : ''}
</div>
<table>
  <thead>
    <tr>
      <th style="width:28px" class="c">Nº</th>
      <th>Descrição</th>
      <th style="width:52px" class="c">UND/MTS</th>
      <th style="width:40px" class="r">Qtd</th>
      <th style="width:70px" class="r">Vl unit (R$)</th>
      <th style="width:75px" class="r">Vl total (R$)</th>
    </tr>
  </thead>
  <tbody>${linhas}</tbody>
</table>
<div class="total-bar">
  <span class="total-label">VALOR TOTAL</span>
  <span class="total-valor">R$ ${fmtBR(total)}</span>
</div>
<div class="obs-box">${obsTexto}</div>
<div class="assinatura">Assinatura / AZ Elétrica</div>
<div class="rodape">Documento gerado por AZ Elétrica — sistema de orçamentos</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

// ── Service Worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-novo').addEventListener('click', criarNovo);
  render();
});
