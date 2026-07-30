// ── Configuração da API ────────────────────────────────────────────────────
const API_URL = 'https://web-production-a606c.up.railway.app';

function getToken() {
  return localStorage.getItem('az_token');
}
function setToken(t) {
  localStorage.setItem('az_token', t);
}
function clearToken() {
  localStorage.removeItem('az_token');
  localStorage.removeItem('az_usuario');
}
function getUsuario() {
  try { return JSON.parse(localStorage.getItem('az_usuario')); } catch { return null; }
}
function setUsuario(u) {
  localStorage.setItem('az_usuario', JSON.stringify(u));
}

function redirecionarLogin() {
  clearToken();
  const loginScreen = document.getElementById('login-screen');
  const appEl = document.getElementById('app');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appEl) appEl.style.display = 'none';
}

async function api(method, path, body = null) {
  const token = localStorage.getItem('az_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Sem conexão com o servidor. Verifique sua internet.');
  }

  if (res.status === 401) {
    redirecionarLogin();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erro ' + res.status);
  }

  return res.json();
}

const GET  = (path)        => api('GET',    path);
const POST = (path, body)  => api('POST',   path, body);
const PUT  = (path, body)  => api('PUT',    path, body);
const DEL  = (path)        => api('DELETE', path);

// v3
// ── Utilidades ─────────────────────────────────────────────────────────────
function fmtBR(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${tipo}`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Estado ─────────────────────────────────────────────────────────────────
let state = {
  tela: 'dashboard',
  orcamentoAtivo: null,
  obras: [],
  eletricistas: [],
  orcamentos: [],
  dashboard: null,
};

// ── Navegação ──────────────────────────────────────────────────────────────
function navegar(tela) {
  state.tela = tela;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tela === tela);
  });
  renderMain();
}

// ── Login ──────────────────────────────────────────────────────────────────
function mostrarLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

async function mostrarApp() {
  document.getElementById('app').style.display = 'flex';
  document.getElementById('login-screen').style.display = 'none';
  const u = getUsuario();
  document.getElementById('usuario-nome').textContent = u?.nome || '';
  // Aguarda para garantir que o token está no storage
  await new Promise(r => setTimeout(r, 300));
  carregarTudo();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value.trim();
  const btn = document.getElementById('btn-login');
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  try {
    const res = await fetch('https://web-production-a606c.up.railway.app/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(senha),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.detail || 'Email ou senha incorretos');
    }
    window.localStorage.setItem('az_token', data.access_token);
    window.localStorage.setItem('az_usuario', JSON.stringify(data.usuario));
    await new Promise(r => setTimeout(r, 200));
    const tokenSalvo = window.localStorage.getItem('az_token');
    if (!tokenSalvo) throw new Error('Erro ao salvar sessao. Tente novamente.');
    mostrarApp();
  } catch (err) {
    toast(err.message, 'erro');
  } finally {
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

function handleLogout() {
  clearToken();
  mostrarLogin();
}

// ── Carregar dados ─────────────────────────────────────────────────────────
async function carregarTudo() {
  // Verifica se token existe antes de carregar
  const token = window.localStorage.getItem('az_token');
  if (!token) {
    console.warn('carregarTudo: sem token, abortando');
    redirecionarLogin();
    return;
  }
  console.log('carregarTudo: token ok, carregando dados...');
  try {
    const [obras, eletricistas, orcamentos, dashboard] = await Promise.all([
      GET('/obras/'),
      GET('/eletricistas/'),
      GET('/orcamentos/'),
      GET('/dashboard/'),
    ]);
    state.obras = obras || [];
    state.eletricistas = eletricistas || [];
    state.orcamentos = orcamentos || [];
    state.dashboard = dashboard;
    renderMain();
  } catch (err) {
    toast('Erro ao carregar dados: ' + err.message, 'erro');
  }
}

// ── Render principal ───────────────────────────────────────────────────────
function renderMain() {
  const main = document.getElementById('main');
  switch (state.tela) {
    case 'dashboard':   renderDashboard(main); break;
    case 'orcamentos':  renderOrcamentos(main); break;
    case 'obras':       renderObras(main); break;
    case 'equipe':      renderEquipe(main); break;
    default:            renderDashboard(main);
  }
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function renderDashboard(main) {
  const d = state.dashboard;
  if (!d) {
    main.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando...</p></div>`;
    return;
  }

  const obrasHTML = (d.obras.lista || []).map(o => {
    const cor = o.situacao === 'negativo' ? '#ef4444' : o.situacao === 'atencao' ? '#f59e0b' : '#10b981';
    const pct = Math.min(o.percentual, 100);
    return `
      <div class="obra-item">
        <div class="obra-dot" style="background:${cor}"></div>
        <div class="obra-info">
          <div class="obra-nome">${esc(o.nome)}</div>
          <div class="obra-local">${esc(o.cidade || '')}</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cor}"></div></div>
        </div>
        <div class="obra-num">
          <div class="obra-custo" style="color:${cor}">${o.saldo >= 0 ? '+' : ''} R$ ${fmtBR(o.saldo)}</div>
          <div class="obra-perc" style="color:${cor}">${o.percentual}% consumido</div>
        </div>
      </div>`;
  }).join('');

  const ultimosHTML = (d.ultimos_apontamentos || []).map(a => `
    <div class="apontamento-item">
      <div class="avatar">${(a.eletricista || '?').slice(0, 2).toUpperCase()}</div>
      <div class="apto-info">
        <div class="apto-nome">${esc(a.eletricista)}</div>
        <div class="apto-obra">${esc(a.obra)}</div>
      </div>
      <div>
        <div class="apto-val">R$ ${fmtBR(a.valor)}</div>
        <div class="apto-data">${fmtData(a.data)}</div>
      </div>
    </div>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Dashboard</div><div class="topbar-sub">Visão geral</div></div>
      <button class="btn btn-primary" onclick="carregarTudo()">↻ Atualizar</button>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Diárias (semana)</div>
          <div class="metric-val">R$ ${fmtBR(d.semana?.total_diarias)}</div>
          <div class="metric-sub">${d.semana?.inicio} → ${d.semana?.fim}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Obras ativas</div>
          <div class="metric-val amber">${d.obras?.ativas || 0}</div>
          <div class="metric-sub">${d.obras?.atencao || 0} em atenção</div>
        </div>
        <div class="metric">
          <div class="metric-label">Saldo geral</div>
          <div class="metric-val green">R$ ${fmtBR(d.obras?.saldo_geral)}</div>
          <div class="metric-sub">receita – custo</div>
        </div>
        <div class="metric">
          <div class="metric-label">Obras negativas</div>
          <div class="metric-val red">${d.obras?.negativas || 0}</div>
          <div class="metric-sub">estourou o orçamento</div>
        </div>
      </div>
      <div class="row2">
        <div class="card">
          <div class="card-header"><span class="card-title">Desempenho por obra</span></div>
          ${obrasHTML || '<p class="empty">Nenhuma obra ativa</p>'}
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Últimos apontamentos</span></div>
          ${ultimosHTML || '<p class="empty">Nenhum apontamento</p>'}
        </div>
      </div>
    </div>`;
}

// ── ORÇAMENTOS ─────────────────────────────────────────────────────────────
function renderOrcamentos(main) {
  if (state.orcamentoAtivo !== null) {
    renderEditorOrcamento(main);
    return;
  }

  const total = state.orcamentos.reduce((a, o) => a + (o.total || 0), 0);
  const aprovados = state.orcamentos.filter(o => o.status === 'Aprovado').reduce((a, o) => a + o.total, 0);
  const aguardando = state.orcamentos.filter(o => o.status === 'Enviado').reduce((a, o) => a + o.total, 0);
  const rascunhos = state.orcamentos.filter(o => o.status === 'Rascunho').length;

  const badgeCor = { Rascunho: 'bs-rascunho', Enviado: 'bs-enviado', Aprovado: 'bs-aprovado', Reprovado: 'bs-reprovado' };

  const linhas = state.orcamentos.map(o => `
    <tr onclick="abrirOrcamento(${o.id})">
      <td><span class="orc-num">${esc(o.numero || '')}</span></td>
      <td><div class="orc-cliente">${esc(o.cliente_nome || '—')}</div></td>
      <td><span class="orc-obra">${esc(o.obra_descricao || '—')}</span></td>
      <td style="font-size:11px;color:var(--text-muted)">${fmtData(o.data)}</td>
      <td class="td-r"><span class="valor-bold">R$ ${fmtBR(o.total)}</span></td>
      <td><span class="badge ${badgeCor[o.status] || 'bs-rascunho'}">${o.status}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-acao" onclick="event.stopPropagation();duplicarOrcamento(${o.id})" title="Duplicar">⧉</button>
          <button class="btn-acao" onclick="event.stopPropagation();gerarPDFOrcamento(${o.id})" title="PDF">↓</button>
          <button class="btn-acao" onclick="event.stopPropagation();excluirOrcamento(${o.id})" title="Excluir" style="color:var(--text-danger)">✕</button>
        </div>
      </td>
    </tr>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Orçamentos</div><div class="topbar-sub">${state.orcamentos.length} orçamentos</div></div>
      <button class="btn btn-primary" onclick="novoOrcamento()">+ Novo orçamento</button>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric"><div class="metric-label">Total orçado</div><div class="metric-val">R$ ${fmtBR(total)}</div></div>
        <div class="metric"><div class="metric-label">Aprovados</div><div class="metric-val green">R$ ${fmtBR(aprovados)}</div></div>
        <div class="metric"><div class="metric-label">Aguardando</div><div class="metric-val" style="color:#1d4ed8">R$ ${fmtBR(aguardando)}</div></div>
        <div class="metric"><div class="metric-label">Rascunhos</div><div class="metric-val muted">${rascunhos}</div></div>
      </div>
      <div class="table-card">
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Obra</th><th>Data</th><th class="th-r">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="7" class="empty">Nenhum orçamento</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function novoOrcamento() {
  try {
    const orc = await POST('/orcamentos/', {
      data: new Date().toISOString().slice(0, 10),
      status: 'Rascunho',
      itens: [],
    });
    state.orcamentos = [orc, ...state.orcamentos];
    state.orcamentoAtivo = orc;
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function abrirOrcamento(id) {
  const orc = state.orcamentos.find(o => o.id === id);
  if (orc) { state.orcamentoAtivo = orc; renderMain(); }
}

function fecharEditor() {
  state.orcamentoAtivo = null;
  carregarTudo();
}

async function salvarOrcamento() {
  const orc = state.orcamentoAtivo;
  if (!orc) return;
  try {
    const updated = await PUT(`/orcamentos/${orc.id}`, {
      cliente_nome:     orc.cliente_nome,
      cliente_cnpj:     orc.cliente_cnpj,
      cliente_endereco: orc.cliente_endereco,
      obra_descricao:   orc.obra_descricao,
      data:             orc.data,
      validade:         parseInt(orc.validade) || 10,
      status:           orc.status,
      obs:              orc.obs,
      itens:            orc.itens.map((it, idx) => ({
        descricao: it.descricao, und: it.und,
        qtd: parseFloat(it.qtd) || 0, vunit: parseFloat(it.vunit) || 0, ordem: idx
      })),
    });
    state.orcamentoAtivo = updated;
    state.orcamentos = state.orcamentos.map(o => o.id === updated.id ? updated : o);
    toast('Salvo!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

function updateOrcCampo(campo, valor) {
  state.orcamentoAtivo = { ...state.orcamentoAtivo, [campo]: valor };
  atualizarTotalFixo();
}

function updateOrcCliente(campo, valor) {
  state.orcamentoAtivo = {
    ...state.orcamentoAtivo,
    [campo]: valor,
  };
  if (campo === 'cliente_nome') {
    const el = document.querySelector('.editor-titulo');
    if (el) el.textContent = valor || 'Novo orçamento';
  }
}

function updateItem(idx, campo, valor) {
  const itens = [...state.orcamentoAtivo.itens];
  itens[idx] = { ...itens[idx], [campo]: valor };
  state.orcamentoAtivo = { ...state.orcamentoAtivo, itens };
  atualizarTotalFixo();
  // Atualiza chip da linha
  const chip = document.querySelector(`#chip-${idx}`);
  if (chip) {
    const vt = (parseFloat(itens[idx].qtd) || 0) * (parseFloat(itens[idx].vunit) || 0);
    chip.textContent = 'R$ ' + fmtBR(vt);
  }
}

function removerItem(idx) {
  const itens = state.orcamentoAtivo.itens.filter((_, i) => i !== idx);
  state.orcamentoAtivo = { ...state.orcamentoAtivo, itens };
  renderMain();
}

function adicionarItem() {
  const desc  = document.getElementById('n-desc')?.value.trim();
  const und   = document.getElementById('n-und')?.value.trim() || 'UND';
  const qtd   = parseFloat(document.getElementById('n-qtd')?.value) || 0;
  const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0;
  if (!desc) { toast('Preencha a descrição', 'erro'); return; }
  const itens = [...state.orcamentoAtivo.itens, { descricao: desc, und, qtd, vunit }];
  state.orcamentoAtivo = { ...state.orcamentoAtivo, itens };
  renderMain();
}

function atualizarTotalFixo() {
  const total = (state.orcamentoAtivo?.itens || []).reduce(
    (a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0
  );
  const el = document.querySelector('.total-fixo-valor');
  if (el) el.textContent = 'R$ ' + fmtBR(total);
  const el2 = document.querySelector('.total-valor');
  if (el2) el2.textContent = 'R$ ' + fmtBR(total);
  const sub = document.querySelector('.total-fixo-label');
  if (sub) sub.textContent = `${state.orcamentoAtivo?.itens?.length || 0} itens · Total`;
}

function atualizarPreview() {
  const qtd   = parseFloat(document.getElementById('n-qtd')?.value) || 0;
  const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0;
  const preview = qtd * vunit;
  const bar = document.getElementById('preview-bar');
  if (!bar) return;
  if (preview > 0) {
    const totalAtual = (state.orcamentoAtivo?.itens || []).reduce(
      (a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0
    );
    bar.innerHTML = `
      <div class="preview-bar">
        <span class="preview-label">Este item:</span>
        <span class="preview-valor">+ R$ ${fmtBR(preview)}</span>
        <span>→</span>
        <span class="preview-novo">Total: R$ ${fmtBR(totalAtual + preview)}</span>
      </div>`;
  } else {
    bar.innerHTML = '';
  }
}

async function duplicarOrcamento(id) {
  const origem = state.orcamentos.find(o => o.id === id);
  if (!origem) return;
  try {
    const copia = await POST('/orcamentos/', {
      cliente_nome:     (origem.cliente_nome || '') + ' (cópia)',
      cliente_cnpj:     origem.cliente_cnpj,
      cliente_endereco: origem.cliente_endereco,
      obra_descricao:   origem.obra_descricao,
      data:             new Date().toISOString().slice(0, 10),
      validade:         origem.validade,
      status:           'Rascunho',
      obs:              origem.obs,
      itens:            origem.itens.map((it, idx) => ({
        descricao: it.descricao, und: it.und, qtd: it.qtd, vunit: it.vunit, ordem: idx
      })),
    });
    state.orcamentos = [copia, ...state.orcamentos];
    state.orcamentoAtivo = copia;
    toast('Orçamento duplicado!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirOrcamento(id) {
  if (!confirm('Excluir este orçamento?')) return;
  try {
    await DEL(`/orcamentos/${id}`);
    state.orcamentos = state.orcamentos.filter(o => o.id !== id);
    if (state.orcamentoAtivo?.id === id) state.orcamentoAtivo = null;
    toast('Excluído!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

function gerarPDFOrcamento(id) {
  const orc = state.orcamentos.find(o => o.id === id) || state.orcamentoAtivo;
  if (!orc) return;
  _imprimirPDF(orc);
}

function _imprimirPDF(orc) {
  const total = (orc.itens || []).reduce((a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0);
  const numOrc = orc.numero || orc.id;
  const linhas = (orc.itens || []).map((it, idx) => {
    const vt = (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0);
    return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f5f7f5'}">
      <td style="text-align:center;padding:5px">${String(idx + 1).padStart(2, '0')}</td>
      <td style="padding:5px">${esc(it.descricao)}</td>
      <td style="text-align:center;padding:5px">${esc(it.und)}</td>
      <td style="text-align:right;padding:5px">${fmtBR(it.qtd)}</td>
      <td style="text-align:right;padding:5px">${fmtBR(it.vunit)}</td>
      <td style="text-align:right;padding:5px;font-weight:700;color:#1a3a5c">${fmtBR(vt)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a}
.header{background:#1a3a5c;padding:14px 20px;display:flex;justify-content:space-between;align-items:flex-start}
.empresa-nome{color:#FFD700;font-size:20px;font-weight:bold}.empresa-info{color:#aac;font-size:8px;margin-top:4px}
.num-orc{color:rgba(255,215,0,.7);font-size:9px;text-align:right}.num-orc strong{color:#FFD700;font-size:13px;display:block}
.cliente-box{padding:10px 20px;border-bottom:1px solid #ddd}
.cli-nome{font-size:11px;font-weight:bold;margin-bottom:2px}.cli-info{font-size:9px;color:#555;margin-bottom:2px}
.obra{font-size:10px;font-weight:bold;color:#0e4e64;margin-top:6px}
table{width:calc(100% - 40px);margin:10px 20px 0;border-collapse:collapse;font-size:9px}
thead tr{background:#1a3a5c}thead th{color:#FFD700;font-weight:bold;padding:6px 5px;font-size:8px;text-transform:uppercase}
th.r,td.r{text-align:right}th.c,td.c{text-align:center}td{border-bottom:1px solid #eee}
.total-bar{background:#0f2d4a;margin:0 20px;padding:8px 10px;display:flex;justify-content:space-between}
.total-label{color:rgba(255,215,0,.7);font-size:9px;font-weight:bold}.total-valor{color:#FFD700;font-size:15px;font-weight:bold}
.obs-box{background:#FFF9C4;margin:10px 20px;padding:8px 10px;font-size:8.5px;color:#504000;line-height:1.6;white-space:pre-line}
.assinatura{margin:20px 20px 0;border-top:1px solid #888;width:180px;padding-top:4px;font-size:8px;color:#888}
.rodape{text-align:center;font-size:7px;color:#bbb;margin-top:20px;padding-bottom:10px}
</style></head><body>
<div class="header">
  <div><div class="empresa-nome">AZ ELÉTRICA</div>
  <div class="empresa-info">Fone (88)98161-0318 · Elderazevedo22@hotmail.com · CNPJ: 63.824.949/0001-26</div></div>
  <div class="num-orc"><strong>${esc(numOrc)}</strong>Data: ${fmtData(orc.data)}</div>
</div>
<div class="cliente-box">
  <div class="cli-nome">${esc(orc.cliente_nome || '—')}${orc.cliente_cnpj ? ' — CNPJ: ' + esc(orc.cliente_cnpj) : ''}</div>
  ${orc.cliente_endereco ? `<div class="cli-info">Endereço: ${esc(orc.cliente_endereco)}</div>` : ''}
  ${orc.obra_descricao ? `<div class="obra">Objeto: ${esc(orc.obra_descricao)}</div>` : ''}
</div>
<table><thead><tr>
  <th style="width:28px" class="c">Nº</th><th>Descrição</th>
  <th style="width:52px" class="c">UND</th><th style="width:40px" class="r">Qtd</th>
  <th style="width:70px" class="r">Vl unit</th><th style="width:75px" class="r">Vl total</th>
</tr></thead><tbody>${linhas}</tbody></table>
<div class="total-bar"><span class="total-label">VALOR TOTAL</span><span class="total-valor">R$ ${fmtBR(total)}</span></div>
<div class="obs-box">OBS: Orçamento válido por ${orc.validade || 10} dias. — Amontada – CE, ${fmtData(orc.data)}${orc.obs ? '\n' + orc.obs : ''}</div>
<div class="assinatura">Assinatura / AZ Elétrica</div>
<div class="rodape">Documento gerado por AZ Elétrica — sistema de orçamentos</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

function renderEditorOrcamento(main) {
  const orc = state.orcamentoAtivo;
  const total = (orc.itens || []).reduce(
    (a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0
  );
  const badgeCor = { Rascunho: 'bs-rascunho', Enviado: 'bs-enviado', Aprovado: 'bs-aprovado' };

  const linhasItens = (orc.itens || []).map((it, idx) => {
    const vt = (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0);
    return `<tr>
      <td style="color:var(--text-muted);text-align:center;font-size:10px">${String(idx + 1).padStart(2, '0')}</td>
      <td><input class="inline-inp" value="${esc(it.descricao)}" oninput="updateItem(${idx},'descricao',this.value)" placeholder="Descrição" /></td>
      <td><input class="inline-inp inp-sm" value="${esc(it.und)}" oninput="updateItem(${idx},'und',this.value)" /></td>
      <td><input class="inline-inp inp-num" type="number" value="${it.qtd}" oninput="updateItem(${idx},'qtd',this.value)" /></td>
      <td><input class="inline-inp inp-num" type="number" step="0.01" value="${it.vunit}" oninput="updateItem(${idx},'vunit',this.value)" /></td>
      <td class="right"><span class="chip" id="chip-${idx}">R$ ${fmtBR(vt)}</span></td>
      <td><button class="btn-rem-item" onclick="removerItem(${idx})">✕</button></td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="editor-topbar">
      <button class="btn-voltar" onclick="fecharEditor()">← Orçamentos</button>
      <div style="flex:1">
        <div class="editor-titulo">${esc(orc.cliente_nome || 'Novo orçamento')}</div>
        <div class="editor-sub">${esc(orc.numero || '')} · ${fmtData(orc.data)}</div>
      </div>
      <div style="display:flex;gap:7px">
        <button class="btn" onclick="gerarPDFOrcamento(${orc.id})">↓ PDF</button>
        <button class="btn btn-primary" onclick="salvarOrcamento()">💾 Salvar</button>
      </div>
    </div>
    <div class="total-fixo">
      <span class="total-fixo-label">${orc.itens?.length || 0} itens · Total</span>
      <span class="total-fixo-valor">R$ ${fmtBR(total)}</span>
    </div>
    <div class="editor-scroll">
      <div class="card">
        <div class="card-title">Dados do cliente</div>
        <div class="grid2">
          <div class="field col-full"><label>Nome / Razão social</label>
            <input value="${esc(orc.cliente_nome)}" oninput="updateOrcCliente('cliente_nome',this.value)" placeholder="Ex: Prefeitura de Amontada" /></div>
          <div class="field"><label>CNPJ / CPF</label>
            <input value="${esc(orc.cliente_cnpj)}" oninput="updateOrcCliente('cliente_cnpj',this.value)" placeholder="00.000.000/0001-00" /></div>
          <div class="field"><label>Data</label>
            <input type="date" value="${orc.data || ''}" oninput="updateOrcCampo('data',this.value)" /></div>
          <div class="field col-full"><label>Endereço</label>
            <input value="${esc(orc.cliente_endereco)}" oninput="updateOrcCliente('cliente_endereco',this.value)" placeholder="Rua, nº, cidade" /></div>
          <div class="field col-full"><label>Objeto / Obra</label>
            <input value="${esc(orc.obra_descricao)}" oninput="updateOrcCliente('obra_descricao',this.value)" placeholder="Ex: Iluminação da Orla — 850m" /></div>
          <div class="field"><label>Válido (dias)</label>
            <input type="number" value="${orc.validade || 10}" oninput="updateOrcCampo('validade',this.value)" style="width:90px" /></div>
          <div class="field"><label>Status</label>
            <select onchange="updateOrcCampo('status',this.value)">
              <option ${orc.status === 'Rascunho' ? 'selected' : ''}>Rascunho</option>
              <option ${orc.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
              <option ${orc.status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
              <option ${orc.status === 'Reprovado' ? 'selected' : ''}>Reprovado</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Itens do orçamento</div>
        <div class="table-wrap">
          <table class="itens-table">
            <thead><tr>
              <th style="width:30px">Nº</th><th>Descrição</th>
              <th style="width:60px" class="r">UND</th><th style="width:60px" class="r">Qtd</th>
              <th style="width:90px" class="r">Vl unit</th><th style="width:100px" class="r">Vl total</th>
              <th style="width:30px"></th>
            </tr></thead>
            <tbody>
              ${linhasItens}
              <tr class="novo-tr">
                <td style="color:var(--text-muted);text-align:center;font-size:10px">—</td>
                <td><input class="inline-inp" id="n-desc" placeholder="Nova descrição..." /></td>
                <td><input class="inline-inp inp-sm" id="n-und" value="UND" /></td>
                <td><input class="inline-inp inp-num" id="n-qtd" type="number" placeholder="0" oninput="atualizarPreview()" /></td>
                <td><input class="inline-inp inp-num" id="n-vunit" type="number" step="0.01" placeholder="0,00" oninput="atualizarPreview()" /></td>
                <td></td>
                <td><button class="btn-add-item" onclick="adicionarItem()">+</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div id="preview-bar"></div>
        <div class="total-bar">
          <span class="tl">Valor total</span>
          <span class="total-valor tv">R$ ${fmtBR(total)}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Observações</div>
        <div class="field">
          <textarea oninput="updateOrcCampo('obs',this.value)" placeholder="Ex: Prazo de execução: 30 dias corridos.">${esc(orc.obs)}</textarea>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:32px">
        <button class="btn" onclick="excluirOrcamento(${orc.id})" style="color:var(--text-danger)">✕ Excluir</button>
        <button class="btn" onclick="duplicarOrcamento(${orc.id})">⧉ Duplicar</button>
        <button class="btn btn-primary" onclick="salvarOrcamento()">💾 Salvar orçamento</button>
      </div>
    </div>`;

  document.getElementById('n-desc')?.addEventListener('keydown', e => { if (e.key === 'Enter') adicionarItem(); });
}

// ── OBRAS ──────────────────────────────────────────────────────────────────
function renderObras(main) {
  const badgeSit = { ok: 'bs-aprovado', atencao: 'bs-enviado', negativo: 'bs-reprovado' };
  const labelSit = { ok: 'Em dia', atencao: 'Atenção', negativo: 'Negativa' };

  const cards = state.obras.map(o => {
    const cor = o.situacao === 'negativo' ? '#ef4444' : o.situacao === 'atencao' ? '#f59e0b' : '#10b981';
    const pct = Math.min(o.percentual_consumido || 0, 100);
    return `
      <div class="obra-card">
        <div class="obra-card-top">
          <div class="obra-card-header">
            <div class="obra-nome">${esc(o.nome)}</div>
            <span class="badge ${badgeSit[o.situacao] || 'bs-rascunho'}">${labelSit[o.situacao] || o.status}</span>
          </div>
          <div class="obra-local">📍 ${esc(o.cidade || '')} ${esc(o.bairro || '')}</div>
          <div class="obra-cliente">Cliente: ${esc(o.cliente)}</div>
        </div>
        <div class="obra-fin">
          <div class="fin-row"><span class="fin-label">Valor contratado</span><span class="fin-val">R$ ${fmtBR(o.valor_contratado)}</span></div>
          <div class="fin-row"><span class="fin-label">Diárias gastas</span><span class="fin-val">R$ ${fmtBR(o.total_gasto)}</span></div>
          <div class="fin-row"><span class="fin-label">Saldo restante</span><span class="fin-val" style="color:${cor}">R$ ${fmtBR(o.saldo)}</span></div>
          <div class="progress-wrap">
            <div class="progress-label"><span>Consumido</span><span style="color:${cor}">${o.percentual_consumido}%</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cor}"></div></div>
          </div>
        </div>
        <div class="obra-footer">
          <span style="font-size:10px;color:var(--text-muted)">${o.tipo_servico || ''}</span>
          <span style="font-size:10px;color:var(--text-muted)">${o.data_inicio ? 'Início: ' + fmtData(o.data_inicio) : ''}</span>
        </div>
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Obras</div><div class="topbar-sub">${state.obras.length} cadastradas</div></div>
      <button class="btn btn-primary" onclick="modalObra()">+ Nova obra</button>
    </div>
    <div class="content">
      <div class="obras-grid">${cards || '<p class="empty">Nenhuma obra cadastrada</p>'}</div>
    </div>`;
}

async function modalObra() {
  const nome     = prompt('Nome da obra:');
  if (!nome) return;
  const cliente  = prompt('Cliente:');
  if (!cliente) return;
  const cidade   = prompt('Cidade:') || '';
  const valor    = parseFloat(prompt('Valor contratado (R$):') || '0');

  try {
    const nova = await POST('/obras/', {
      nome, cliente, cidade,
      valor_contratado: valor,
      data_inicio: new Date().toISOString().slice(0, 10),
      status: 'Em andamento',
    });
    state.obras = [nova, ...state.obras];
    toast('Obra cadastrada!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

// ── EQUIPE ─────────────────────────────────────────────────────────────────
function renderEquipe(main) {
  const funcaoBadge = { Encarregado: 'b-enc', Eletricista: 'b-ele', Auxiliar: 'b-aux' };
  const linhas = state.eletricistas.map(e => `
    <tr style="${e.status !== 'Ativo' ? 'opacity:.55' : ''}">
      <td>
        <div class="elet-cell">
          <div class="avatar">${e.nome.slice(0, 2).toUpperCase()}</div>
          <div><div class="elet-nome">${esc(e.nome)}</div><div class="elet-tel">${esc(e.telefone || '')}</div></div>
        </div>
      </td>
      <td><span class="badge ${funcaoBadge[e.funcao] || 'b-ele'}">${esc(e.funcao)}</span></td>
      <td style="font-weight:500">R$ ${fmtBR(e.valor_diaria)}</td>
      <td><span class="status-dot ${e.status === 'Ativo' ? 'dot-ativo' : 'dot-inativo'}"></span>${esc(e.status)}</td>
    </tr>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Equipe</div><div class="topbar-sub">${state.eletricistas.length} cadastrados</div></div>
      <button class="btn btn-primary" onclick="modalEletricista()">+ Novo membro</button>
    </div>
    <div class="content">
      <div class="table-card">
        <table>
          <thead><tr><th>Membro</th><th>Função</th><th>Valor/dia</th><th>Status</th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="4" class="empty">Nenhum cadastrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function modalEletricista() {
  const nome   = prompt('Nome completo:');
  if (!nome) return;
  const funcao = prompt('Função (Encarregado / Eletricista / Auxiliar):') || 'Eletricista';
  const valor  = parseFloat(prompt('Valor da diária (R$):') || '200');
  const tel    = prompt('Telefone (opcional):') || '';

  try {
    const novo = await POST('/eletricistas/', {
      nome, funcao, valor_diaria: valor, telefone: tel, status: 'Ativo'
    });
    state.eletricistas = [...state.eletricistas, novo];
    toast('Membro cadastrado!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

// ── Service Worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.tela));
  });

  if (getToken()) {
    await mostrarApp();
  } else {
    mostrarLogin();
  }
});