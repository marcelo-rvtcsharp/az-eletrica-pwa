const API = 'https://web-production-a606c.up.railway.app';
window._TOKEN = localStorage.getItem('az_token') || null;

const Token = {
  get: () => window._TOKEN,
  set: (t) => { window._TOKEN = t; localStorage.setItem('az_token', t); },
  del: () => { window._TOKEN = null; localStorage.removeItem('az_token'); localStorage.removeItem('az_user'); },
};

async function req(method, path, body) {
  const token = window._TOKEN;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { logout(); return null; }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Erro ' + res.status); }
  return res.json();
}

function fmtBR(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtData(s) { if (!s) return '—'; return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function toast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (tipo === 'erro' ? ' erro' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

const S = { tela: 'dashboard', orc: null, obras: [], eletricistas: [], orcamentos: [], dash: null };

function mostrarLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function logout() { Token.del(); mostrarLogin(); }

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value.trim();
  const btn = document.getElementById('btn-login');
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(senha),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(data.detail || 'Email ou senha incorretos');
    Token.set(data.access_token);
    localStorage.setItem('az_user', JSON.stringify(data.usuario));
    iniciarApp();
  } catch (err) {
    toast(err.message, 'erro');
  } finally {
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

function iniciarApp() {
  const u = JSON.parse(localStorage.getItem('az_user') || '{}');
  document.getElementById('usuario-nome').textContent = u.nome || '';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  navegar('dashboard');
  carregarDados();
}

async function carregarDados() {
  try {
    const [obras, elet, orcs, dash] = await Promise.all([
      req('GET', '/obras/'), req('GET', '/eletricistas/'),
      req('GET', '/orcamentos/'), req('GET', '/dashboard/'),
    ]);
    if (!obras) return;
    S.obras = obras || []; S.eletricistas = elet || [];
    S.orcamentos = orcs || []; S.dash = dash;
    renderMain();
  } catch (err) { toast('Erro ao carregar: ' + err.message, 'erro'); }
}

function navegar(tela) {
  S.tela = tela; S.orc = null;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.tela === tela)
  );
  renderMain();
}

function renderMain() {
  const main = document.getElementById('main');
  if (!main) return;
  if (S.orc) { renderEditorOrc(main); return; }
  switch (S.tela) {
    case 'dashboard': renderDash(main); break;
    case 'orcamentos': renderOrcs(main); break;
    case 'obras': renderObrasPage(main); break;
    case 'equipe': renderEquipePage(main); break;
    case 'apontamentos': renderApontamentos(main); break;
  }
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDash(main) {
  const d = S.dash;
  if (!d) { main.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando...</p></div>'; return; }

  const obrasHTML = (d.obras?.lista || []).map(o => {
    const cor = o.situacao === 'negativo' ? '#ef4444' : o.situacao === 'atencao' ? '#f59e0b' : '#10b981';
    const corTxt = o.situacao === 'negativo' ? '#b91c1c' : o.situacao === 'atencao' ? '#a16207' : '#15803d';
    return `<div class="obra-item">
      <div class="obra-dot" style="background:${cor}"></div>
      <div class="obra-info">
        <div class="obra-nome">${esc(o.nome)}</div>
        <div class="obra-loc">${esc(o.cidade || '')} · ${esc(o.cliente || '')}</div>
        <div class="prog"><div class="prog-fill" style="width:${Math.min(o.percentual, 100)}%;background:${cor}"></div></div>
      </div>
      <div class="obra-saldo">
        <div class="obra-val" style="color:${corTxt}">${o.saldo >= 0 ? '+' : ''} R$ ${fmtBR(o.saldo)}</div>
        <div class="obra-pct">${o.percentual}% consumido</div>
      </div>
    </div>`;
  }).join('') || '<p class="empty">Nenhuma obra ativa</p>';

  const ultHTML = (d.ultimos_apontamentos || []).slice(0, 5).map(a => `
    <div class="apto-item">
      <div class="av" style="background:#dbeafe;color:#1d4ed8">${(a.eletricista || '?').slice(0, 2).toUpperCase()}</div>
      <div class="apto-info"><div class="apto-nome">${esc(a.eletricista)}</div><div class="apto-obra">${esc(a.obra)}</div></div>
      <div class="apto-r"><div class="apto-val">R$ ${fmtBR(a.valor)}</div><div class="apto-data">${fmtData(a.data)}</div></div>
    </div>`).join('') || '<p class="empty">Nenhum apontamento</p>';

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Dashboard</div><div class="topbar-sub">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="carregarDados()"><i class="ti ti-refresh" aria-hidden="true"></i> Atualizar</button>
        <button class="btn btn-p" onclick="navegar('apontamentos')"><i class="ti ti-plus" aria-hidden="true"></i> Apontar diária</button>
      </div>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric">
          <div class="metric-ico blue"><i class="ti ti-currency-real" aria-hidden="true"></i></div>
          <div class="metric-label">Diárias semana</div>
          <div class="metric-val">R$ ${fmtBR(d.semana?.total_diarias)}</div>
          <div class="metric-sub">${d.semana?.inicio || ''} → ${d.semana?.fim || ''}</div>
        </div>
        <div class="metric">
          <div class="metric-ico amber"><i class="ti ti-building-factory-2" aria-hidden="true"></i></div>
          <div class="metric-label">Obras ativas</div>
          <div class="metric-val">${d.obras?.ativas || 0}</div>
          <div class="metric-sub">${d.obras?.atencao || 0} em atenção</div>
        </div>
        <div class="metric">
          <div class="metric-ico green"><i class="ti ti-trending-up" aria-hidden="true"></i></div>
          <div class="metric-label">Saldo geral</div>
          <div class="metric-val" style="color:#15803d">R$ ${fmtBR(d.obras?.saldo_geral)}</div>
          <div class="metric-sub">receita – custo</div>
        </div>
        <div class="metric">
          <div class="metric-ico red"><i class="ti ti-alert-triangle" aria-hidden="true"></i></div>
          <div class="metric-label">Obras negativas</div>
          <div class="metric-val" style="color:#b91c1c">${d.obras?.negativas || 0}</div>
          <div class="metric-sub">estourou o orçamento</div>
        </div>
      </div>
      <div class="row2">
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="ti ti-building-factory-2" aria-hidden="true"></i> Desempenho por obra</span></div>
          ${obrasHTML}
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="ti ti-clock-check" aria-hidden="true"></i> Últimos apontamentos</span></div>
          ${ultHTML}
        </div>
      </div>
    </div>`;
}

// ── APONTAMENTOS ─────────────────────────────────────────────
function renderApontamentos(main) {
  const elets = S.eletricistas.filter(e => e.status === 'Ativo');
  const obras = S.obras.filter(o => o.status === 'Em andamento');
  const hoje = new Date().toISOString().slice(0, 10);

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Novo apontamento</div><div class="topbar-sub">Lance diárias por eletricista e obra</div></div>
      <button class="btn" onclick="navegar('dashboard')"><i class="ti ti-arrow-left" aria-hidden="true"></i> Voltar</button>
    </div>
    <div class="content">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px"><i class="ti ti-clock-check" aria-hidden="true"></i> Dados do apontamento</div>
        <div class="form-grid2">
          <div class="field">
            <label>Eletricista *</label>
            <select id="ap-elet">
              <option value="">Selecione...</option>
              ${elets.map(e => `<option value="${e.id}" data-valor="${e.valor_diaria}">${esc(e.nome)} (R$ ${fmtBR(e.valor_diaria)}/dia)</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Data *</label>
            <input type="date" id="ap-data" value="${hoje}" />
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label>Observação (opcional)</label>
          <input type="text" id="ap-obs" placeholder="Ex: serviço pesado, chuva..." />
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="ti ti-building-factory-2" aria-hidden="true"></i> Obras do dia</span>
          <button class="btn btn-p" onclick="addObraLinha()"><i class="ti ti-plus" aria-hidden="true"></i> Adicionar obra</button>
        </div>
        <div id="obras-linhas">
          ${gerarLinhaObra(obras, 0)}
        </div>
        <div id="preview-total" style="margin-top:12px;padding:12px;background:var(--surface-1);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--text-secondary)">Total do dia</span>
          <span style="font-size:18px;font-weight:500;color:var(--text-primary)" id="total-dia">R$ 0,00</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:14px"><i class="ti ti-bolt" aria-hidden="true"></i> Adicionais</div>
        <div id="adicionais-linhas"></div>
        <button class="btn" style="margin-top:8px" onclick="addAdicionalLinha()"><i class="ti ti-plus" aria-hidden="true"></i> Adicionar adicional</button>
      </div>

      <button class="btn btn-p" style="width:100%;padding:12px;font-size:14px;justify-content:center" onclick="salvarApontamento()">
        <i class="ti ti-device-floppy" aria-hidden="true"></i> Salvar apontamento
      </button>
    </div>`;

  document.getElementById('ap-elet').addEventListener('change', recalcTotal);
}

let _obraCount = 1;
let _adCount = 0;

function gerarLinhaObra(obras, idx) {
  return `<div class="linha-obra" id="lo-${idx}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
    <select class="lo-obra" style="flex:1" onchange="recalcTotal()">
      <option value="">Selecione a obra...</option>
      ${obras.map(o => `<option value="${o.id}">${esc(o.nome)} — ${esc(o.cidade || '')}</option>`).join('')}
    </select>
    <input class="lo-valor" type="number" placeholder="R$ valor" step="0.01" style="width:110px" oninput="recalcTotal()" />
    <button class="btn" onclick="removerLinha('lo-${idx}')" title="Remover"><i class="ti ti-trash" aria-hidden="true"></i></button>
  </div>`;
}

function addObraLinha() {
  const obras = S.obras.filter(o => o.status === 'Em andamento');
  const cont = document.getElementById('obras-linhas');
  const div = document.createElement('div');
  div.innerHTML = gerarLinhaObra(obras, _obraCount++);
  cont.appendChild(div.firstElementChild);
}

function addAdicionalLinha() {
  const cont = document.getElementById('adicionais-linhas');
  const idx = _adCount++;
  const div = document.createElement('div');
  div.id = 'ad-' + idx;
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
  div.innerHTML = `
    <select class="ad-tipo" style="width:160px">
      <option value="sabado_feriado">Sábado/Feriado</option>
      <option value="semana_pesada">Semana pesada</option>
      <option value="hora_extra">Hora extra</option>
      <option value="outro">Outro</option>
    </select>
    <input class="ad-desc" type="text" placeholder="Descrição" style="flex:1" />
    <input class="ad-valor" type="number" placeholder="R$ valor" step="0.01" style="width:110px" oninput="recalcTotal()" />
    <button class="btn" onclick="removerLinha('ad-${idx}')" title="Remover"><i class="ti ti-trash" aria-hidden="true"></i></button>`;
  cont.appendChild(div);
}

function removerLinha(id) {
  document.getElementById(id)?.remove();
  recalcTotal();
}

function recalcTotal() {
  let total = 0;
  document.querySelectorAll('.lo-valor').forEach(i => { total += parseFloat(i.value) || 0; });
  document.querySelectorAll('.ad-valor').forEach(i => { total += parseFloat(i.value) || 0; });
  const el = document.getElementById('total-dia');
  if (el) el.textContent = 'R$ ' + fmtBR(total);
}

async function salvarApontamento() {
  const elet_id = parseInt(document.getElementById('ap-elet').value);
  const data = document.getElementById('ap-data').value;
  const obs = document.getElementById('ap-obs').value;
  if (!elet_id || !data) { toast('Selecione o eletricista e a data', 'erro'); return; }

  const itens = [];
  document.querySelectorAll('.linha-obra').forEach(row => {
    const obra_id = parseInt(row.querySelector('.lo-obra').value);
    const valor = parseFloat(row.querySelector('.lo-valor').value);
    if (obra_id && valor > 0) itens.push({ obra_id, valor });
  });
  if (itens.length === 0) { toast('Adicione pelo menos uma obra', 'erro'); return; }

  const adicionais = [];
  document.querySelectorAll('[id^="ad-"]').forEach(row => {
    const tipo = row.querySelector('.ad-tipo')?.value;
    const desc = row.querySelector('.ad-desc')?.value;
    const valor = parseFloat(row.querySelector('.ad-valor')?.value);
    if (tipo && desc && valor > 0) adicionais.push({ tipo, descricao: desc, valor });
  });

  try {
    await req('POST', '/apontamentos/', { eletricista_id: elet_id, data, observacao: obs, itens, adicionais });
    toast('Apontamento salvo!');
    _obraCount = 1; _adCount = 0;
    navegar('dashboard');
    carregarDados();
  } catch (err) { toast(err.message, 'erro'); }
}

// ── OBRAS ────────────────────────────────────────────────────
function renderObrasPage(main) {
  const cards = S.obras.map(o => {
    const cor = o.situacao === 'negativo' ? '#ef4444' : o.situacao === 'atencao' ? '#f59e0b' : '#10b981';
    const corTxt = o.situacao === 'negativo' ? '#b91c1c' : o.situacao === 'atencao' ? '#a16207' : '#15803d';
    const bc = o.situacao === 'negativo' ? 'b-r' : o.situacao === 'atencao' ? 'b-a' : 'b-g';
    const lb = o.situacao === 'negativo' ? 'Negativa' : o.situacao === 'atencao' ? 'Atenção' : 'Em dia';
    return `<div class="obra-card">
      <div class="obra-card-top">
        <div class="obra-card-header">
          <div class="obra-card-nome">${esc(o.nome)}</div>
          <span class="badge ${bc}">${lb}</span>
        </div>
        <div class="obra-card-loc"><i class="ti ti-map-pin" aria-hidden="true"></i> ${esc(o.cidade || '')} · ${esc(o.cliente)}</div>
      </div>
      <div class="obra-fin">
        <div class="fin-row"><span class="fin-label">Contratado</span><span class="fin-val">R$ ${fmtBR(o.valor_contratado)}</span></div>
        <div class="fin-row"><span class="fin-label">Gasto em diárias</span><span class="fin-val">R$ ${fmtBR(o.total_gasto)}</span></div>
        <div class="fin-row"><span class="fin-label">Saldo</span><span class="fin-val" style="color:${corTxt}">R$ ${fmtBR(o.saldo)}</span></div>
        <div class="prog" style="margin-top:8px"><div class="prog-fill" style="width:${Math.min(o.percentual_consumido || 0, 100)}%;background:${cor}"></div></div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${o.percentual_consumido || 0}% consumido</div>
      </div>
      <div class="obra-card-footer">
        <span style="font-size:11px;color:var(--text-muted)">${esc(o.tipo_servico || '')}</span>
        <div style="display:flex;gap:6px">
          <button class="btn" onclick="editarObra(${o.id})" title="Editar"><i class="ti ti-edit" aria-hidden="true"></i></button>
          <button class="btn" onclick="excluirObra(${o.id}, '${esc(o.nome)}')" title="Excluir" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>
    </div>`;
  }).join('') || '<p class="empty">Nenhuma obra cadastrada</p>';

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Obras</div><div class="topbar-sub">${S.obras.length} cadastradas</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="zerarObras()" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i> Zerar obras</button>
        <button class="btn btn-p" onclick="abrirModalObra()"><i class="ti ti-plus" aria-hidden="true"></i> Nova obra</button>
      </div>
    </div>
    <div class="content"><div class="obras-grid">${cards}</div></div>`;
}

function abrirModalObra(id) {
  const o = id ? S.obras.find(x => x.id === id) : null;
  const titulo = o ? 'Editar obra' : 'Nova obra';
  const html = `
    <div class="modal-overlay" onclick="if(event.target===this)fecharModal()">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${titulo}</span><button class="btn" onclick="fecharModal()"><i class="ti ti-x" aria-hidden="true"></i></button></div>
        <div class="field"><label>Nome da obra *</label><input id="m-nome" value="${esc(o?.nome || '')}" placeholder="Ex: Residência João Silva" /></div>
        <div class="form-grid2">
          <div class="field"><label>Cliente *</label><input id="m-cliente" value="${esc(o?.cliente || '')}" placeholder="Nome do cliente" /></div>
          <div class="field"><label>Contato</label><input id="m-contato" value="${esc(o?.contato || '')}" placeholder="(88) 9 0000-0000" /></div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>Cidade *</label><input id="m-cidade" value="${esc(o?.cidade || '')}" placeholder="Ex: Amontada" /></div>
          <div class="field"><label>Bairro</label><input id="m-bairro" value="${esc(o?.bairro || '')}" placeholder="Ex: Centro" /></div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>Valor contratado (R$) *</label><input id="m-valor" type="number" value="${o?.valor_contratado || ''}" placeholder="0,00" /></div>
          <div class="field"><label>Tipo de serviço</label>
            <select id="m-tipo">
              ${['Elétrica residencial','Elétrica comercial','Elétrica industrial','SPDA / Para-raios','Iluminação pública','Outro'].map(t => `<option ${o?.tipo_servico === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>Início</label><input id="m-inicio" type="date" value="${o?.data_inicio || ''}" /></div>
          <div class="field"><label>Previsão de término</label><input id="m-prev" type="date" value="${o?.data_previsao || ''}" /></div>
        </div>
        <div class="field"><label>Observações</label><textarea id="m-obs" placeholder="Ex: Inclui fornecimento de material...">${esc(o?.observacoes || '')}</textarea></div>
        <div class="field"><label>Alerta de consumo (%)</label>
          <select id="m-alerta">
            <option ${o?.alerta_percentual === 70 ? 'selected' : ''} value="70">70% — Aviso antecipado</option>
            <option ${(!o || o?.alerta_percentual === 85) ? 'selected' : ''} value="85">85% — Padrão</option>
            <option ${o?.alerta_percentual === 95 ? 'selected' : ''} value="95">95% — Somente crítico</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="fecharModal()">Cancelar</button>
          <button class="btn btn-p" onclick="salvarObra(${o?.id || 'null'})">${o ? 'Salvar alterações' : 'Cadastrar obra'}</button>
        </div>
      </div>
    </div>`;
  document.getElementById('modal-root').innerHTML = html;
}

function editarObra(id) { abrirModalObra(id); }

async function salvarObra(id) {
  const data = {
    nome: document.getElementById('m-nome').value,
    cliente: document.getElementById('m-cliente').value,
    contato: document.getElementById('m-contato').value,
    cidade: document.getElementById('m-cidade').value,
    bairro: document.getElementById('m-bairro').value,
    valor_contratado: parseFloat(document.getElementById('m-valor').value) || 0,
    tipo_servico: document.getElementById('m-tipo').value,
    data_inicio: document.getElementById('m-inicio').value || null,
    data_previsao: document.getElementById('m-prev').value || null,
    observacoes: document.getElementById('m-obs').value,
    alerta_percentual: parseInt(document.getElementById('m-alerta').value),
    status: 'Em andamento',
  };
  if (!data.nome || !data.cliente || !data.valor_contratado) { toast('Preencha os campos obrigatórios', 'erro'); return; }
  try {
    if (id) {
      const u = await req('PUT', `/obras/${id}`, data);
      S.obras = S.obras.map(o => o.id === id ? u : o);
    } else {
      const nova = await req('POST', '/obras/', data);
      S.obras = [nova, ...S.obras];
    }
    fecharModal(); toast(id ? 'Obra atualizada!' : 'Obra cadastrada!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirObra(id, nome) {
  if (!confirm(`Excluir a obra "${nome}"?\nTodos os apontamentos desta obra serão mantidos.`)) return;
  try {
    await req('DELETE', `/obras/${id}`);
    S.obras = S.obras.filter(o => o.id !== id);
    toast('Obra excluída!'); renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function zerarObras() {
  if (!confirm('Excluir TODAS as obras? Esta ação não pode ser desfeita.')) return;
  try {
    await Promise.all(S.obras.map(o => req('DELETE', `/obras/${o.id}`)));
    S.obras = []; toast('Obras zeradas!'); renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

// ── EQUIPE ────────────────────────────────────────────────────
function renderEquipePage(main) {
  const fb = { Encarregado: 'b-a', Eletricista: 'b-g', Auxiliar: '' };
  const linhas = S.eletricistas.map(e => `
    <tr style="${e.status !== 'Ativo' ? 'opacity:.55' : ''}">
      <td>
        <div class="elet-cell">
          <div class="av" style="background:#dbeafe;color:#1d4ed8">${e.nome.slice(0, 2).toUpperCase()}</div>
          <div><div style="font-size:13px;font-weight:500;color:var(--text-primary)">${esc(e.nome)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(e.telefone || '')}</div></div>
        </div>
      </td>
      <td><span class="badge ${fb[e.funcao] || ''}">${esc(e.funcao)}</span></td>
      <td style="font-weight:500;color:var(--text-primary)">R$ ${fmtBR(e.valor_diaria)}</td>
      <td><span class="badge ${e.status === 'Ativo' ? 'b-g' : ''}">${esc(e.status)}</span></td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn" onclick="editarElet(${e.id})" title="Editar"><i class="ti ti-edit" aria-hidden="true"></i></button>
          <button class="btn" onclick="excluirElet(${e.id}, '${esc(e.nome)}')" title="Excluir" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Equipe</div><div class="topbar-sub">${S.eletricistas.length} cadastrados · ${S.eletricistas.filter(e => e.status === 'Ativo').length} ativos</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="zerarEquipe()" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i> Zerar equipe</button>
        <button class="btn btn-p" onclick="abrirModalElet()"><i class="ti ti-plus" aria-hidden="true"></i> Novo membro</button>
      </div>
    </div>
    <div class="content">
      <div class="table-card">
        <table>
          <thead><tr><th>Membro</th><th>Função</th><th>Valor/dia</th><th>Status</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="5" class="empty">Nenhum cadastrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function abrirModalElet(id) {
  const e = id ? S.eletricistas.find(x => x.id === id) : null;
  const titulo = e ? 'Editar membro' : 'Novo membro';
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)fecharModal()">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">${titulo}</span><button class="btn" onclick="fecharModal()"><i class="ti ti-x" aria-hidden="true"></i></button></div>
        <div class="field"><label>Nome completo *</label><input id="me-nome" value="${esc(e?.nome || '')}" placeholder="Ex: João Lima Junior" /></div>
        <div class="form-grid2">
          <div class="field"><label>Telefone / WhatsApp</label><input id="me-tel" value="${esc(e?.telefone || '')}" placeholder="(88) 9 0000-0000" /></div>
          <div class="field"><label>CPF</label><input id="me-cpf" value="${esc(e?.cpf || '')}" placeholder="000.000.000-00" /></div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>Função *</label>
            <select id="me-funcao">
              ${['Encarregado','Eletricista','Auxiliar','Estagiário'].map(f => `<option ${e?.funcao === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Valor da diária (R$) *</label><input id="me-valor" type="number" value="${e?.valor_diaria || ''}" placeholder="200,00" /></div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>Tipo de contrato</label>
            <select id="me-contrato">
              ${['Diarista','Mensalista','PJ'].map(t => `<option ${e?.tipo_contrato === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Status</label>
            <select id="me-status">
              ${['Ativo','Inativo','Afastado'].map(s => `<option ${e?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid2">
          <div class="field"><label>NR-10 válido até</label><input id="me-nr10" type="date" value="${e?.nr10_validade || ''}" /></div>
          <div class="field"><label>NR-35 válido até</label><input id="me-nr35" type="date" value="${e?.nr35_validade || ''}" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="fecharModal()">Cancelar</button>
          <button class="btn btn-p" onclick="salvarElet(${e?.id || 'null'})">${e ? 'Salvar alterações' : 'Cadastrar membro'}</button>
        </div>
      </div>
    </div>`;
}

function editarElet(id) { abrirModalElet(id); }

async function salvarElet(id) {
  const data = {
    nome: document.getElementById('me-nome').value,
    telefone: document.getElementById('me-tel').value,
    cpf: document.getElementById('me-cpf').value,
    funcao: document.getElementById('me-funcao').value,
    valor_diaria: parseFloat(document.getElementById('me-valor').value) || 0,
    tipo_contrato: document.getElementById('me-contrato').value,
    status: document.getElementById('me-status').value,
    nr10_validade: document.getElementById('me-nr10').value || null,
    nr35_validade: document.getElementById('me-nr35').value || null,
  };
  if (!data.nome || !data.valor_diaria) { toast('Preencha nome e valor da diária', 'erro'); return; }
  try {
    if (id) {
      const u = await req('PUT', `/eletricistas/${id}`, data);
      S.eletricistas = S.eletricistas.map(e => e.id === id ? u : e);
    } else {
      const novo = await req('POST', '/eletricistas/', data);
      S.eletricistas = [...S.eletricistas, novo];
    }
    fecharModal(); toast(id ? 'Membro atualizado!' : 'Membro cadastrado!');
    renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function excluirElet(id, nome) {
  if (!confirm(`Excluir "${nome}" da equipe?`)) return;
  try {
    await req('DELETE', `/eletricistas/${id}`);
    S.eletricistas = S.eletricistas.filter(e => e.id !== id);
    toast('Membro excluído!'); renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function zerarEquipe() {
  if (!confirm('Excluir TODOS os membros da equipe? Esta ação não pode ser desfeita.')) return;
  try {
    await Promise.all(S.eletricistas.map(e => req('DELETE', `/eletricistas/${e.id}`)));
    S.eletricistas = []; toast('Equipe zerada!'); renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

// ── ORÇAMENTOS ────────────────────────────────────────────────
function renderOrcs(main) {
  const bc = { Rascunho: 'bs-r', Enviado: 'bs-e', Aprovado: 'bs-a', Reprovado: 'bs-rep' };
  const total = S.orcamentos.reduce((a, o) => a + (o.total || 0), 0);
  const aprov = S.orcamentos.filter(o => o.status === 'Aprovado').reduce((a, o) => a + o.total, 0);
  const env = S.orcamentos.filter(o => o.status === 'Enviado').reduce((a, o) => a + o.total, 0);
  const rasc = S.orcamentos.filter(o => o.status === 'Rascunho').length;

  const linhas = S.orcamentos.map(o => `
    <tr onclick="abrirOrc(${o.id})" style="cursor:pointer">
      <td style="font-size:11px;color:var(--text-muted);font-family:monospace">${esc(o.numero || '')}</td>
      <td style="font-size:13px;font-weight:500;color:var(--text-primary)">${esc(o.cliente_nome || '—')}</td>
      <td style="font-size:11px;color:var(--text-muted)">${esc(o.obra_descricao || '—')}</td>
      <td style="font-size:11px;color:var(--text-muted)">${fmtData(o.data)}</td>
      <td style="text-align:right;font-size:13px;font-weight:500">R$ ${fmtBR(o.total)}</td>
      <td><span class="badge ${bc[o.status] || ''}">${o.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn" onclick="event.stopPropagation();dupOrc(${o.id})" title="Duplicar"><i class="ti ti-copy" aria-hidden="true"></i></button>
          <button class="btn" onclick="event.stopPropagation();pdfOrc(${o.id})" title="PDF"><i class="ti ti-file-download" aria-hidden="true"></i></button>
          <button class="btn" onclick="event.stopPropagation();delOrc(${o.id})" title="Excluir" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Orçamentos</div><div class="topbar-sub">${S.orcamentos.length} orçamentos</div></div>
      <button class="btn btn-p" onclick="novoOrc()"><i class="ti ti-plus" aria-hidden="true"></i> Novo orçamento</button>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric"><div class="metric-label">Total orçado</div><div class="metric-val">R$ ${fmtBR(total)}</div></div>
        <div class="metric"><div class="metric-label">Aprovados</div><div class="metric-val" style="color:#15803d">R$ ${fmtBR(aprov)}</div></div>
        <div class="metric"><div class="metric-label">Aguardando</div><div class="metric-val" style="color:#1d4ed8">R$ ${fmtBR(env)}</div></div>
        <div class="metric"><div class="metric-label">Rascunhos</div><div class="metric-val" style="color:var(--text-muted)">${rasc}</div></div>
      </div>
      <div class="table-card">
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Obra</th><th>Data</th><th style="text-align:right">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="7" class="empty">Nenhum orçamento</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function novoOrc() {
  try {
    const o = await req('POST', '/orcamentos/', { data: new Date().toISOString().slice(0, 10), status: 'Rascunho', itens: [] });
    S.orcamentos = [o, ...S.orcamentos]; S.orc = o; renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

function abrirOrc(id) { S.orc = S.orcamentos.find(o => o.id === id) || null; renderMain(); }
function fecharOrc() { S.orc = null; carregarDados(); }

function totalOrc() { return (S.orc?.itens || []).reduce((a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0); }
function updOrcCampo(f, v) { S.orc = { ...S.orc, [f]: v }; atualizarTotalFixo(); }
function updOrcCliente(f, v) { S.orc = { ...S.orc, [f]: v }; if (f === 'cliente_nome') { const el = document.querySelector('.editor-titulo'); if (el) el.textContent = v || 'Novo orçamento'; } }
function updItem(i, f, v) { const itens = [...S.orc.itens]; itens[i] = { ...itens[i], [f]: v }; S.orc = { ...S.orc, itens }; atualizarTotalFixo(); const c = document.getElementById('chip-' + i); if (c) { const vt = (parseFloat(itens[i].qtd) || 0) * (parseFloat(itens[i].vunit) || 0); c.textContent = 'R$ ' + fmtBR(vt); } }
function delItem(i) { S.orc = { ...S.orc, itens: S.orc.itens.filter((_, x) => x !== i) }; renderMain(); }
function addItem() { const desc = (document.getElementById('n-desc')?.value || '').trim(); const und = document.getElementById('n-und')?.value || 'UND'; const qtd = parseFloat(document.getElementById('n-qtd')?.value) || 0; const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0; if (!desc) { toast('Preencha a descrição', 'erro'); return; } S.orc = { ...S.orc, itens: [...S.orc.itens, { descricao: desc, und, qtd, vunit }] }; renderMain(); }
function atualizarTotalFixo() { const t = totalOrc(); const el = document.querySelector('.total-fixo-valor'); if (el) el.textContent = 'R$ ' + fmtBR(t); const tv = document.querySelector('.tv'); if (tv) tv.textContent = 'R$ ' + fmtBR(t); }
function prevItem() { const qtd = parseFloat(document.getElementById('n-qtd')?.value) || 0; const vunit = parseFloat(document.getElementById('n-vunit')?.value) || 0; const prev = qtd * vunit; const bar = document.getElementById('preview-bar'); if (!bar) return; if (prev > 0) { const tot = totalOrc() + prev; bar.innerHTML = `<div class="preview-bar"><span style="color:var(--text-muted);font-size:12px">Este item:</span><span style="font-weight:500;color:#1d4ed8;font-size:12px;flex:1;margin-left:6px">+ R$ ${fmtBR(prev)}</span><span style="font-size:12px;color:var(--text-muted)">→ Total:</span><span style="font-weight:500;color:var(--text-primary);font-size:12px;margin-left:6px">R$ ${fmtBR(tot)}</span></div>`; } else bar.innerHTML = ''; }

async function salvarOrc() {
  const o = S.orc; if (!o) return;
  try {
    const u = await req('PUT', `/orcamentos/${o.id}`, { cliente_nome: o.cliente_nome, cliente_cnpj: o.cliente_cnpj, cliente_endereco: o.cliente_endereco, obra_descricao: o.obra_descricao, data: o.data, validade: parseInt(o.validade) || 10, status: o.status, obs: o.obs, itens: (o.itens || []).map((it, i) => ({ descricao: it.descricao, und: it.und, qtd: parseFloat(it.qtd) || 0, vunit: parseFloat(it.vunit) || 0, ordem: i })) });
    S.orc = u; S.orcamentos = S.orcamentos.map(x => x.id === u.id ? u : x); toast('Salvo!'); renderMain();
  } catch (err) { toast(err.message, 'erro'); }
}

async function dupOrc(id) { const o = S.orcamentos.find(x => x.id === id); if (!o) return; try { const c = await req('POST', '/orcamentos/', { cliente_nome: (o.cliente_nome || '') + ' (cópia)', cliente_cnpj: o.cliente_cnpj, cliente_endereco: o.cliente_endereco, obra_descricao: o.obra_descricao, data: new Date().toISOString().slice(0, 10), validade: o.validade, status: 'Rascunho', obs: o.obs, itens: (o.itens || []).map((it, i) => ({ descricao: it.descricao, und: it.und, qtd: it.qtd, vunit: it.vunit, ordem: i })) }); S.orcamentos = [c, ...S.orcamentos]; S.orc = c; toast('Duplicado!'); renderMain(); } catch (err) { toast(err.message, 'erro'); } }
async function delOrc(id) { if (!confirm('Excluir este orçamento?')) return; try { await req('DELETE', `/orcamentos/${id}`); S.orcamentos = S.orcamentos.filter(o => o.id !== id); if (S.orc?.id === id) S.orc = null; toast('Excluído!'); renderMain(); } catch (err) { toast(err.message, 'erro'); } }
function pdfOrc(id) { const o = S.orcamentos.find(x => x.id === id) || S.orc; if (o) imprimirPDF(o); }

function imprimirPDF(orc) {
  const total = (orc.itens || []).reduce((a, it) => a + (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0), 0);
  const linhas = (orc.itens || []).map((it, i) => { const vt = (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0); return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f5f7f5'}"><td style="text-align:center;padding:5px">${String(i + 1).padStart(2, '0')}</td><td style="padding:5px">${esc(it.descricao)}</td><td style="text-align:center;padding:5px">${esc(it.und)}</td><td style="text-align:right;padding:5px">${fmtBR(it.qtd)}</td><td style="text-align:right;padding:5px">${fmtBR(it.vunit)}</td><td style="text-align:right;padding:5px;font-weight:700;color:#1a3a5c">${fmtBR(vt)}</td></tr>`; }).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px}.h{background:#1a3a5c;padding:14px 20px;display:flex;justify-content:space-between}.en{color:#f5a623;font-size:20px;font-weight:bold}.ei{color:#aac;font-size:8px;margin-top:4px}.no{color:rgba(245,166,35,.7);font-size:9px;text-align:right}.no strong{color:#f5a623;font-size:13px;display:block}.cb{padding:10px 20px;border-bottom:1px solid #ddd}.cn{font-size:11px;font-weight:bold}.ob{font-size:10px;font-weight:bold;color:#0e4e64;margin-top:6px}table{width:calc(100% - 40px);margin:10px 20px 0;border-collapse:collapse;font-size:9px}thead tr{background:#1a3a5c}thead th{color:#f5a623;font-weight:bold;padding:6px 5px;font-size:8px;text-transform:uppercase}td{border-bottom:1px solid #eee}.tb{background:#0f2d4a;margin:0 20px;padding:8px 10px;display:flex;justify-content:space-between}.tl{color:rgba(245,166,35,.7);font-size:9px;font-weight:bold}.tv{color:#f5a623;font-size:15px;font-weight:bold}.obs{background:#FFF9C4;margin:10px 20px;padding:8px;font-size:8.5px;color:#504000;white-space:pre-line}.ass{margin:20px 20px 0;border-top:1px solid #888;width:180px;padding-top:4px;font-size:8px;color:#888}.rod{text-align:center;font-size:7px;color:#bbb;margin-top:20px;padding-bottom:10px}</style></head><body>
<div class="h"><div><div class="en">AZ ELÉTRICA</div><div class="ei">Fone (88)98161-0318 · Elderazevedo22@hotmail.com · CNPJ: 63.824.949/0001-26</div></div><div class="no"><strong>${esc(orc.numero || orc.id)}</strong>Data: ${fmtData(orc.data)}</div></div>
<div class="cb"><div class="cn">${esc(orc.cliente_nome || '—')}${orc.cliente_cnpj ? ' — CNPJ: ' + esc(orc.cliente_cnpj) : ''}</div>${orc.cliente_endereco ? `<div style="font-size:9px;color:#555">Endereço: ${esc(orc.cliente_endereco)}</div>` : ''}${orc.obra_descricao ? `<div class="ob">Objeto: ${esc(orc.obra_descricao)}</div>` : ''}</div>
<table><thead><tr><th style="width:28px">Nº</th><th>Descrição</th><th style="width:52px;text-align:center">UND</th><th style="width:40px;text-align:right">Qtd</th><th style="width:70px;text-align:right">Vl unit</th><th style="width:75px;text-align:right">Vl total</th></tr></thead><tbody>${linhas}</tbody></table>
<div class="tb"><span class="tl">VALOR TOTAL</span><span class="tv">R$ ${fmtBR(total)}</span></div>
<div class="obs">OBS: Orçamento válido por ${orc.validade || 10} dias. — Amontada – CE, ${fmtData(orc.data)}${orc.obs ? '\n' + orc.obs : ''}</div>
<div class="ass">Assinatura / AZ Elétrica</div>
<div class="rod">Documento gerado por AZ Elétrica</div>
</body></html>`;
  const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.onload = () => w.print();
}

function renderEditorOrc(main) {
  const o = S.orc; const t = totalOrc();
  const linhas = (o.itens || []).map((it, i) => { const vt = (parseFloat(it.qtd) || 0) * (parseFloat(it.vunit) || 0); return `<tr><td style="color:var(--text-muted);text-align:center;font-size:10px">${String(i + 1).padStart(2, '0')}</td><td><input class="inline-inp" value="${esc(it.descricao)}" oninput="updItem(${i},'descricao',this.value)" /></td><td><input class="inline-inp inp-sm" value="${esc(it.und)}" oninput="updItem(${i},'und',this.value)" /></td><td><input class="inline-inp inp-num" type="number" value="${it.qtd}" oninput="updItem(${i},'qtd',this.value)" /></td><td><input class="inline-inp inp-num" type="number" step="0.01" value="${it.vunit}" oninput="updItem(${i},'vunit',this.value)" /></td><td style="text-align:right"><span class="chip" id="chip-${i}">R$ ${fmtBR(vt)}</span></td><td><button class="btn-rem" onclick="delItem(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button></td></tr>`; }).join('');
  main.innerHTML = `
    <div class="editor-topbar">
      <button class="btn-voltar" onclick="fecharOrc()"><i class="ti ti-arrow-left" aria-hidden="true"></i> Orçamentos</button>
      <div style="flex:1"><div class="editor-titulo">${esc(o.cliente_nome || 'Novo orçamento')}</div><div style="font-size:11px;color:var(--text-muted)">${esc(o.numero || '')} · ${fmtData(o.data)}</div></div>
      <div style="display:flex;gap:7px">
        <button class="btn" onclick="pdfOrc(${o.id})"><i class="ti ti-file-download" aria-hidden="true"></i> PDF</button>
        <button class="btn btn-p" onclick="salvarOrc()"><i class="ti ti-device-floppy" aria-hidden="true"></i> Salvar</button>
      </div>
    </div>
    <div class="total-fixo"><span style="font-size:11px;color:rgba(255,255,255,.6)">${(o.itens || []).length} itens · Total</span><span class="total-fixo-valor">R$ ${fmtBR(t)}</span></div>
    <div class="editor-scroll">
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">Dados do cliente</div>
        <div class="form-grid2">
          <div class="field col-full"><label>Nome / Razão social</label><input value="${esc(o.cliente_nome)}" oninput="updOrcCliente('cliente_nome',this.value)" placeholder="Ex: Prefeitura de Amontada" /></div>
          <div class="field"><label>CNPJ / CPF</label><input value="${esc(o.cliente_cnpj)}" oninput="updOrcCliente('cliente_cnpj',this.value)" placeholder="00.000.000/0001-00" /></div>
          <div class="field"><label>Data</label><input type="date" value="${o.data || ''}" oninput="updOrcCampo('data',this.value)" /></div>
          <div class="field col-full"><label>Endereço</label><input value="${esc(o.cliente_endereco)}" oninput="updOrcCliente('cliente_endereco',this.value)" /></div>
          <div class="field col-full"><label>Objeto / Obra</label><input value="${esc(o.obra_descricao)}" oninput="updOrcCliente('obra_descricao',this.value)" /></div>
          <div class="field"><label>Válido (dias)</label><input type="number" value="${o.validade || 10}" oninput="updOrcCampo('validade',this.value)" style="width:90px" /></div>
          <div class="field"><label>Status</label><select onchange="updOrcCampo('status',this.value)">${['Rascunho','Enviado','Aprovado','Reprovado'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">Itens do orçamento</div>
        <div style="overflow-x:auto"><table class="itens-table">
          <thead><tr><th style="width:30px">Nº</th><th>Descrição</th><th style="width:60px;text-align:right">UND</th><th style="width:60px;text-align:right">Qtd</th><th style="width:90px;text-align:right">Vl unit</th><th style="width:100px;text-align:right">Vl total</th><th style="width:30px"></th></tr></thead>
          <tbody>${linhas}<tr style="background:#ebf4ff;border-top:1.5px dashed #90c2f7"><td style="color:var(--text-muted);text-align:center;font-size:10px">—</td><td><input class="inline-inp" id="n-desc" placeholder="Nova descrição..." /></td><td><input class="inline-inp inp-sm" id="n-und" value="UND" /></td><td><input class="inline-inp inp-num" id="n-qtd" type="number" placeholder="0" oninput="prevItem()" /></td><td><input class="inline-inp inp-num" id="n-vunit" type="number" step="0.01" placeholder="0,00" oninput="prevItem()" /></td><td></td><td><button class="btn-add-item" onclick="addItem()">+</button></td></tr></tbody>
        </table></div>
        <div id="preview-bar"></div>
        <div class="total-bar"><span class="tl">Valor total</span><span class="tv">R$ ${fmtBR(t)}</span></div>
      </div>
      <div class="card"><div class="card-title" style="margin-bottom:10px">Observações</div><div class="field"><textarea oninput="updOrcCampo('obs',this.value)" placeholder="Ex: Prazo de execução: 30 dias.">${esc(o.obs)}</textarea></div></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:32px">
        <button class="btn" onclick="delOrc(${o.id})" style="color:var(--text-danger)"><i class="ti ti-trash" aria-hidden="true"></i> Excluir</button>
        <button class="btn" onclick="dupOrc(${o.id})"><i class="ti ti-copy" aria-hidden="true"></i> Duplicar</button>
        <button class="btn btn-p" onclick="salvarOrc()"><i class="ti ti-device-floppy" aria-hidden="true"></i> Salvar</button>
      </div>
    </div>`;
  document.getElementById('n-desc')?.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
}

function fecharModal() { document.getElementById('modal-root').innerHTML = ''; }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').onsubmit = handleLogin;
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navegar(el.dataset.tela))
  );
  if (window._TOKEN) { iniciarApp(); } else { mostrarLogin(); }
});
