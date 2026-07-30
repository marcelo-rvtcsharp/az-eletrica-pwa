// ═══════════════════════════════════════════════════════════
// AZ ELÉTRICA — Sistema de Gestão
// ═══════════════════════════════════════════════════════════

const API = 'https://web-production-a606c.up.railway.app';

// ── Token ────────────────────────────────────────────────────
const Token = {
  get: () => localStorage.getItem('az_token'),
  set: (t) => localStorage.setItem('az_token', t),
  del: () => { localStorage.removeItem('az_token'); localStorage.removeItem('az_user'); },
};

// ── Fetch com token ──────────────────────────────────────────
async function req(method, path, body) {
  const token = Token.get();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { logout(); return null; }
  if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.detail || 'Erro'); }
  return res.json();
}

// ── Utilidades ───────────────────────────────────────────────
function fmtBR(v) { return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtData(s) { if(!s) return '—'; return new Date(s+'T12:00:00').toLocaleDateString('pt-BR'); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (tipo === 'erro' ? ' erro' : '');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Estado ───────────────────────────────────────────────────
const S = { tela: 'dashboard', orc: null, obras: [], eletricistas: [], orcamentos: [], dash: null };

// ── Login / Logout ───────────────────────────────────────────
function mostrarLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function logout() { Token.del(); mostrarLogin(); }

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value.trim();
  const btn   = document.getElementById('btn-login');
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
  } catch(err) {
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
      req('GET', '/obras/'),
      req('GET', '/eletricistas/'),
      req('GET', '/orcamentos/'),
      req('GET', '/dashboard/'),
    ]);
    if (!obras) return; // 401 — logout já foi chamado
    S.obras = obras || [];
    S.eletricistas = elet || [];
    S.orcamentos = orcs || [];
    S.dash = dash;
    renderMain();
  } catch(err) {
    toast('Erro ao carregar: ' + err.message, 'erro');
  }
}

// ── Navegação ────────────────────────────────────────────────
function navegar(tela) {
  S.tela = tela;
  S.orc = null;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.tela === tela)
  );
  renderMain();
}

function renderMain() {
  const main = document.getElementById('main');
  if (!main) return;
  if (S.orc) { renderEditorOrc(main); return; }
  switch(S.tela) {
    case 'dashboard':  renderDash(main); break;
    case 'orcamentos': renderOrcs(main); break;
    case 'obras':      renderObras(main); break;
    case 'equipe':     renderEquipe(main); break;
  }
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDash(main) {
  const d = S.dash;
  if (!d) { main.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando...</p></div>'; return; }
  const obrasHTML = (d.obras?.lista||[]).map(o => {
    const cor = o.situacao==='negativo'?'#ef4444':o.situacao==='atencao'?'#f59e0b':'#10b981';
    return `<div class="obra-item">
      <div class="obra-dot" style="background:${cor}"></div>
      <div class="obra-info">
        <div class="obra-nome">${esc(o.nome)}</div>
        <div class="obra-local">${esc(o.cidade||'')}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(o.percentual,100)}%;background:${cor}"></div></div>
      </div>
      <div class="obra-num">
        <div style="color:${cor};font-size:13px;font-weight:600">${o.saldo>=0?'+':''} R$ ${fmtBR(o.saldo)}</div>
        <div style="color:${cor};font-size:11px">${o.percentual}% consumido</div>
      </div>
    </div>`;
  }).join('');
  const ultHTML = (d.ultimos_apontamentos||[]).map(a => `
    <div class="apontamento-item">
      <div class="avatar">${(a.eletricista||'?').slice(0,2).toUpperCase()}</div>
      <div class="apto-info"><div class="apto-nome">${esc(a.eletricista)}</div><div class="apto-obra">${esc(a.obra)}</div></div>
      <div><div class="apto-val">R$ ${fmtBR(a.valor)}</div><div class="apto-data">${fmtData(a.data)}</div></div>
    </div>`).join('');
  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Dashboard</div><div class="topbar-sub">Visão geral</div></div>
      <button class="btn btn-primary" onclick="carregarDados()">↻ Atualizar</button>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric"><div class="metric-label">Diárias (semana)</div><div class="metric-val">R$ ${fmtBR(d.semana?.total_diarias)}</div><div class="metric-sub">${d.semana?.inicio||''} → ${d.semana?.fim||''}</div></div>
        <div class="metric"><div class="metric-label">Obras ativas</div><div class="metric-val amber">${d.obras?.ativas||0}</div><div class="metric-sub">${d.obras?.atencao||0} em atenção</div></div>
        <div class="metric"><div class="metric-label">Saldo geral</div><div class="metric-val green">R$ ${fmtBR(d.obras?.saldo_geral)}</div><div class="metric-sub">receita – custo</div></div>
        <div class="metric"><div class="metric-label">Obras negativas</div><div class="metric-val red">${d.obras?.negativas||0}</div><div class="metric-sub">estourou o orçamento</div></div>
      </div>
      <div class="row2">
        <div class="card"><div class="card-header"><span class="card-title">Desempenho por obra</span></div>${obrasHTML||'<p class="empty">Nenhuma obra</p>'}</div>
        <div class="card"><div class="card-header"><span class="card-title">Últimos apontamentos</span></div>${ultHTML||'<p class="empty">Nenhum apontamento</p>'}</div>
      </div>
    </div>`;
}

// ── ORÇAMENTOS ───────────────────────────────────────────────
function renderOrcs(main) {
  const bc = {Rascunho:'bs-rascunho',Enviado:'bs-enviado',Aprovado:'bs-aprovado',Reprovado:'bs-reprovado'};
  const total = S.orcamentos.reduce((a,o)=>a+(o.total||0),0);
  const aprovados = S.orcamentos.filter(o=>o.status==='Aprovado').reduce((a,o)=>a+o.total,0);
  const enviados  = S.orcamentos.filter(o=>o.status==='Enviado').reduce((a,o)=>a+o.total,0);
  const rascunhos = S.orcamentos.filter(o=>o.status==='Rascunho').length;
  const linhas = S.orcamentos.map(o=>`
    <tr onclick="abrirOrc(${o.id})">
      <td><span class="orc-num">${esc(o.numero||'')}</span></td>
      <td><div class="orc-cliente">${esc(o.cliente_nome||'—')}</div></td>
      <td><span class="orc-obra">${esc(o.obra_descricao||'—')}</span></td>
      <td style="font-size:11px;color:var(--muted)">${fmtData(o.data)}</td>
      <td class="td-r"><span class="valor-bold">R$ ${fmtBR(o.total)}</span></td>
      <td><span class="badge ${bc[o.status]||'bs-rascunho'}">${o.status}</span></td>
      <td><div class="acoes">
        <button class="btn-acao" onclick="event.stopPropagation();dupOrc(${o.id})" title="Duplicar">⧉</button>
        <button class="btn-acao" onclick="event.stopPropagation();pdfOrc(${o.id})" title="PDF">↓</button>
        <button class="btn-acao" onclick="event.stopPropagation();delOrc(${o.id})" style="color:var(--perigo)" title="Excluir">✕</button>
      </div></td>
    </tr>`).join('');
  main.innerHTML = `
    <div class="topbar">
      <div><div class="topbar-title">Orçamentos</div><div class="topbar-sub">${S.orcamentos.length} orçamentos</div></div>
      <button class="btn btn-primary" onclick="novoOrc()">+ Novo orçamento</button>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric"><div class="metric-label">Total orçado</div><div class="metric-val">R$ ${fmtBR(total)}</div></div>
        <div class="metric"><div class="metric-label">Aprovados</div><div class="metric-val green">R$ ${fmtBR(aprovados)}</div></div>
        <div class="metric"><div class="metric-label">Aguardando</div><div class="metric-val" style="color:#1d4ed8">R$ ${fmtBR(enviados)}</div></div>
        <div class="metric"><div class="metric-label">Rascunhos</div><div class="metric-val muted">${rascunhos}</div></div>
      </div>
      <div class="table-card">
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Obra</th><th>Data</th><th class="th-r">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${linhas||'<tr><td colspan="7" class="empty">Nenhum orçamento</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function novoOrc() {
  try {
    const o = await req('POST', '/orcamentos/', { data: new Date().toISOString().slice(0,10), status:'Rascunho', itens:[] });
    S.orcamentos = [o, ...S.orcamentos];
    S.orc = o;
    renderMain();
  } catch(e) { toast(e.message,'erro'); }
}

function abrirOrc(id) { S.orc = S.orcamentos.find(o=>o.id===id)||null; renderMain(); }

function fecharOrc() { S.orc = null; carregarDados(); }

function updOrcCampo(f, v) { S.orc = {...S.orc, [f]:v}; atualizarTotalFixo(); }
function updOrcCliente(f, v) {
  S.orc = {...S.orc, [f]:v};
  if(f==='cliente_nome') { const el=document.querySelector('.editor-titulo'); if(el) el.textContent=v||'Novo orçamento'; }
}
function updItem(i, f, v) {
  const itens=[...S.orc.itens]; itens[i]={...itens[i],[f]:v}; S.orc={...S.orc,itens};
  atualizarTotalFixo();
  const c=document.getElementById('chip-'+i);
  if(c){const vt=(parseFloat(itens[i].qtd)||0)*(parseFloat(itens[i].vunit)||0);c.textContent='R$ '+fmtBR(vt);}
}
function delItem(i) { const itens=S.orc.itens.filter((_,x)=>x!==i); S.orc={...S.orc,itens}; renderMain(); }
function addItem() {
  const desc=(document.getElementById('n-desc')?.value||'').trim();
  const und=document.getElementById('n-und')?.value||'UND';
  const qtd=parseFloat(document.getElementById('n-qtd')?.value)||0;
  const vunit=parseFloat(document.getElementById('n-vunit')?.value)||0;
  if(!desc){toast('Preencha a descrição','erro');return;}
  S.orc={...S.orc,itens:[...S.orc.itens,{descricao:desc,und,qtd,vunit}]};
  renderMain();
}
function prevItem() {
  const qtd=parseFloat(document.getElementById('n-qtd')?.value)||0;
  const vunit=parseFloat(document.getElementById('n-vunit')?.value)||0;
  const prev=qtd*vunit; const bar=document.getElementById('preview-bar'); if(!bar)return;
  if(prev>0){const tot=totalOrc()+prev;bar.innerHTML=`<div class="preview-bar"><span class="preview-label">Este item:</span><span class="preview-valor">+ R$ ${fmtBR(prev)}</span><span>→</span><span class="preview-novo">Total: R$ ${fmtBR(tot)}</span></div>`;}
  else bar.innerHTML='';
}
function totalOrc() { return (S.orc?.itens||[]).reduce((a,it)=>a+(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0),0); }
function atualizarTotalFixo() {
  const t=totalOrc();
  const el=document.querySelector('.total-fixo-valor'); if(el) el.textContent='R$ '+fmtBR(t);
  const tv=document.querySelector('.tv'); if(tv) tv.textContent='R$ '+fmtBR(t);
}

async function salvarOrc() {
  const o=S.orc; if(!o)return;
  try {
    const u=await req('PUT',`/orcamentos/${o.id}`,{
      cliente_nome:o.cliente_nome, cliente_cnpj:o.cliente_cnpj,
      cliente_endereco:o.cliente_endereco, obra_descricao:o.obra_descricao,
      data:o.data, validade:parseInt(o.validade)||10, status:o.status, obs:o.obs,
      itens:(o.itens||[]).map((it,i)=>({descricao:it.descricao,und:it.und,qtd:parseFloat(it.qtd)||0,vunit:parseFloat(it.vunit)||0,ordem:i})),
    });
    S.orc=u; S.orcamentos=S.orcamentos.map(x=>x.id===u.id?u:x);
    toast('Salvo!'); renderMain();
  } catch(e){toast(e.message,'erro');}
}

async function dupOrc(id) {
  const o=S.orcamentos.find(x=>x.id===id); if(!o)return;
  try {
    const c=await req('POST','/orcamentos/',{cliente_nome:(o.cliente_nome||'')+' (cópia)',cliente_cnpj:o.cliente_cnpj,cliente_endereco:o.cliente_endereco,obra_descricao:o.obra_descricao,data:new Date().toISOString().slice(0,10),validade:o.validade,status:'Rascunho',obs:o.obs,itens:(o.itens||[]).map((it,i)=>({descricao:it.descricao,und:it.und,qtd:it.qtd,vunit:it.vunit,ordem:i}))});
    S.orcamentos=[c,...S.orcamentos]; S.orc=c; toast('Duplicado!'); renderMain();
  } catch(e){toast(e.message,'erro');}
}

async function delOrc(id) {
  if(!confirm('Excluir este orçamento?'))return;
  try { await req('DELETE',`/orcamentos/${id}`); S.orcamentos=S.orcamentos.filter(o=>o.id!==id); if(S.orc?.id===id)S.orc=null; toast('Excluído!'); renderMain(); }
  catch(e){toast(e.message,'erro');}
}

function pdfOrc(id) { const o=S.orcamentos.find(x=>x.id===id)||S.orc; if(o)imprimirPDF(o); }

function imprimirPDF(orc) {
  const total=(orc.itens||[]).reduce((a,it)=>a+(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0),0);
  const linhas=(orc.itens||[]).map((it,i)=>`<tr style="background:${i%2===0?'#fff':'#f5f7f5'}"><td style="text-align:center;padding:5px">${String(i+1).padStart(2,'0')}</td><td style="padding:5px">${esc(it.descricao)}</td><td style="text-align:center;padding:5px">${esc(it.und)}</td><td style="text-align:right;padding:5px">${fmtBR(it.qtd)}</td><td style="text-align:right;padding:5px">${fmtBR(it.vunit)}</td><td style="text-align:right;padding:5px;font-weight:700;color:#1a3a5c">${fmtBR((parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0))}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px}.header{background:#1a3a5c;padding:14px 20px;display:flex;justify-content:space-between}.empresa-nome{color:#FFD700;font-size:20px;font-weight:bold}.empresa-info{color:#aac;font-size:8px;margin-top:4px}.num-orc{color:rgba(255,215,0,.7);font-size:9px;text-align:right}.num-orc strong{color:#FFD700;font-size:13px;display:block}.cliente-box{padding:10px 20px;border-bottom:1px solid #ddd}.cli-nome{font-size:11px;font-weight:bold}.obra{font-size:10px;font-weight:bold;color:#0e4e64;margin-top:6px}table{width:calc(100% - 40px);margin:10px 20px 0;border-collapse:collapse;font-size:9px}thead tr{background:#1a3a5c}thead th{color:#FFD700;font-weight:bold;padding:6px 5px;font-size:8px;text-transform:uppercase}td{border-bottom:1px solid #eee}.total-bar{background:#0f2d4a;margin:0 20px;padding:8px 10px;display:flex;justify-content:space-between}.total-label{color:rgba(255,215,0,.7);font-size:9px;font-weight:bold}.total-valor{color:#FFD700;font-size:15px;font-weight:bold}.obs-box{background:#FFF9C4;margin:10px 20px;padding:8px;font-size:8.5px;color:#504000;white-space:pre-line}.assinatura{margin:20px 20px 0;border-top:1px solid #888;width:180px;padding-top:4px;font-size:8px;color:#888}.rodape{text-align:center;font-size:7px;color:#bbb;margin-top:20px;padding-bottom:10px}</style></head><body>
<div class="header"><div><div class="empresa-nome">AZ ELÉTRICA</div><div class="empresa-info">Fone (88)98161-0318 · Elderazevedo22@hotmail.com · CNPJ: 63.824.949/0001-26</div></div><div class="num-orc"><strong>${esc(orc.numero||orc.id)}</strong>Data: ${fmtData(orc.data)}</div></div>
<div class="cliente-box"><div class="cli-nome">${esc(orc.cliente_nome||'—')}${orc.cliente_cnpj?' — CNPJ: '+esc(orc.cliente_cnpj):''}</div>${orc.cliente_endereco?`<div style="font-size:9px;color:#555">Endereço: ${esc(orc.cliente_endereco)}</div>`:''} ${orc.obra_descricao?`<div class="obra">Objeto: ${esc(orc.obra_descricao)}</div>`:''}</div>
<table><thead><tr><th style="width:28px">Nº</th><th>Descrição</th><th style="width:52px;text-align:center">UND</th><th style="width:40px;text-align:right">Qtd</th><th style="width:70px;text-align:right">Vl unit</th><th style="width:75px;text-align:right">Vl total</th></tr></thead><tbody>${linhas}</tbody></table>
<div class="total-bar"><span class="total-label">VALOR TOTAL</span><span class="total-valor">R$ ${fmtBR(total)}</span></div>
<div class="obs-box">OBS: Orçamento válido por ${orc.validade||10} dias. — Amontada – CE, ${fmtData(orc.data)}${orc.obs?'\n'+orc.obs:''}</div>
<div class="assinatura">Assinatura / AZ Elétrica</div>
<div class="rodape">Documento gerado por AZ Elétrica</div>
</body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.onload=()=>w.print();
}

function renderEditorOrc(main) {
  const o=S.orc; const t=totalOrc();
  const linhas=(o.itens||[]).map((it,i)=>{const vt=(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);return`<tr><td style="color:var(--muted);text-align:center;font-size:10px">${String(i+1).padStart(2,'0')}</td><td><input class="inline-inp" value="${esc(it.descricao)}" oninput="updItem(${i},'descricao',this.value)" /></td><td><input class="inline-inp inp-sm" value="${esc(it.und)}" oninput="updItem(${i},'und',this.value)" /></td><td><input class="inline-inp inp-num" type="number" value="${it.qtd}" oninput="updItem(${i},'qtd',this.value)" /></td><td><input class="inline-inp inp-num" type="number" step="0.01" value="${it.vunit}" oninput="updItem(${i},'vunit',this.value)" /></td><td class="right"><span class="chip" id="chip-${i}">R$ ${fmtBR(vt)}</span></td><td><button class="btn-rem-item" onclick="delItem(${i})">✕</button></td></tr>`;}).join('');
  main.innerHTML=`
    <div class="editor-topbar">
      <button class="btn-voltar" onclick="fecharOrc()">← Orçamentos</button>
      <div style="flex:1"><div class="editor-titulo">${esc(o.cliente_nome||'Novo orçamento')}</div><div class="editor-sub">${esc(o.numero||'')} · ${fmtData(o.data)}</div></div>
      <div style="display:flex;gap:7px">
        <button class="btn" onclick="pdfOrc(${o.id})">↓ PDF</button>
        <button class="btn btn-primary" onclick="salvarOrc()">💾 Salvar</button>
      </div>
    </div>
    <div class="total-fixo"><span class="total-fixo-label">${(o.itens||[]).length} itens · Total</span><span class="total-fixo-valor">R$ ${fmtBR(t)}</span></div>
    <div class="editor-scroll">
      <div class="card">
        <div class="card-title">Dados do cliente</div>
        <div class="grid2">
          <div class="field col-full"><label>Nome / Razão social</label><input value="${esc(o.cliente_nome)}" oninput="updOrcCliente('cliente_nome',this.value)" placeholder="Ex: Prefeitura de Amontada" /></div>
          <div class="field"><label>CNPJ / CPF</label><input value="${esc(o.cliente_cnpj)}" oninput="updOrcCliente('cliente_cnpj',this.value)" placeholder="00.000.000/0001-00" /></div>
          <div class="field"><label>Data</label><input type="date" value="${o.data||''}" oninput="updOrcCampo('data',this.value)" /></div>
          <div class="field col-full"><label>Endereço</label><input value="${esc(o.cliente_endereco)}" oninput="updOrcCliente('cliente_endereco',this.value)" /></div>
          <div class="field col-full"><label>Objeto / Obra</label><input value="${esc(o.obra_descricao)}" oninput="updOrcCliente('obra_descricao',this.value)" /></div>
          <div class="field"><label>Válido (dias)</label><input type="number" value="${o.validade||10}" oninput="updOrcCampo('validade',this.value)" style="width:90px" /></div>
          <div class="field"><label>Status</label><select onchange="updOrcCampo('status',this.value)"><option ${o.status==='Rascunho'?'selected':''}>Rascunho</option><option ${o.status==='Enviado'?'selected':''}>Enviado</option><option ${o.status==='Aprovado'?'selected':''}>Aprovado</option><option ${o.status==='Reprovado'?'selected':''}>Reprovado</option></select></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Itens</div>
        <div class="table-wrap"><table class="itens-table">
          <thead><tr><th style="width:30px">Nº</th><th>Descrição</th><th style="width:60px" class="r">UND</th><th style="width:60px" class="r">Qtd</th><th style="width:90px" class="r">Vl unit</th><th style="width:100px" class="r">Vl total</th><th style="width:30px"></th></tr></thead>
          <tbody>${linhas}<tr class="novo-tr"><td style="color:var(--muted);text-align:center;font-size:10px">—</td><td><input class="inline-inp" id="n-desc" placeholder="Nova descrição..." /></td><td><input class="inline-inp inp-sm" id="n-und" value="UND" /></td><td><input class="inline-inp inp-num" id="n-qtd" type="number" placeholder="0" oninput="prevItem()" /></td><td><input class="inline-inp inp-num" id="n-vunit" type="number" step="0.01" placeholder="0,00" oninput="prevItem()" /></td><td></td><td><button class="btn-add-item" onclick="addItem()">+</button></td></tr></tbody>
        </table></div>
        <div id="preview-bar"></div>
        <div class="total-bar"><span class="tl">Valor total</span><span class="tv">R$ ${fmtBR(t)}</span></div>
      </div>
      <div class="card"><div class="card-title">Observações</div><div class="field"><textarea oninput="updOrcCampo('obs',this.value)" placeholder="Ex: Prazo de execução: 30 dias.">${esc(o.obs)}</textarea></div></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:32px">
        <button class="btn" onclick="delOrc(${o.id})" style="color:var(--perigo)">✕ Excluir</button>
        <button class="btn" onclick="dupOrc(${o.id})">⧉ Duplicar</button>
        <button class="btn btn-primary" onclick="salvarOrc()">💾 Salvar</button>
      </div>
    </div>`;
  document.getElementById('n-desc')?.addEventListener('keydown',e=>{if(e.key==='Enter')addItem();});
}

// ── OBRAS ────────────────────────────────────────────────────
function renderObras(main) {
  const cards=S.obras.map(o=>{
    const cor=o.situacao==='negativo'?'#ef4444':o.situacao==='atencao'?'#f59e0b':'#10b981';
    const bc=o.situacao==='negativo'?'bs-reprovado':o.situacao==='atencao'?'bs-enviado':'bs-aprovado';
    const lb=o.situacao==='negativo'?'Negativa':o.situacao==='atencao'?'Atenção':'Em dia';
    return`<div class="obra-card">
      <div class="obra-card-top"><div class="obra-card-header"><div class="obra-nome">${esc(o.nome)}</div><span class="badge ${bc}">${lb}</span></div>
      <div class="obra-local">📍 ${esc(o.cidade||'')} ${esc(o.bairro||'')}</div><div class="obra-cliente">Cliente: ${esc(o.cliente)}</div></div>
      <div class="obra-fin">
        <div class="fin-row"><span class="fin-label">Valor contratado</span><span class="fin-val">R$ ${fmtBR(o.valor_contratado)}</span></div>
        <div class="fin-row"><span class="fin-label">Diárias gastas</span><span class="fin-val">R$ ${fmtBR(o.total_gasto)}</span></div>
        <div class="fin-row"><span class="fin-label">Saldo restante</span><span class="fin-val" style="color:${cor}">R$ ${fmtBR(o.saldo)}</span></div>
        <div class="progress-wrap"><div class="progress-label"><span>Consumido</span><span style="color:${cor}">${o.percentual_consumido}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(o.percentual_consumido||0,100)}%;background:${cor}"></div></div></div>
      </div>
      <div class="obra-footer"><span style="font-size:10px;color:var(--muted)">${esc(o.tipo_servico||'')}</span><span style="font-size:10px;color:var(--muted)">${o.data_inicio?'Início: '+fmtData(o.data_inicio):''}</span></div>
    </div>`;}).join('');
  main.innerHTML=`
    <div class="topbar"><div><div class="topbar-title">Obras</div><div class="topbar-sub">${S.obras.length} cadastradas</div></div><button class="btn btn-primary" onclick="modalObra()">+ Nova obra</button></div>
    <div class="content"><div class="obras-grid">${cards||'<p class="empty">Nenhuma obra cadastrada</p>'}</div></div>`;
}

async function modalObra() {
  const nome=prompt('Nome da obra:'); if(!nome)return;
  const cliente=prompt('Cliente:'); if(!cliente)return;
  const cidade=prompt('Cidade:')||'';
  const valor=parseFloat(prompt('Valor contratado (R$):')||'0');
  try { const o=await req('POST','/obras/',{nome,cliente,cidade,valor_contratado:valor,data_inicio:new Date().toISOString().slice(0,10),status:'Em andamento'}); S.obras=[o,...S.obras]; toast('Obra cadastrada!'); renderMain(); }
  catch(e){toast(e.message,'erro');}
}

// ── EQUIPE ───────────────────────────────────────────────────
function renderEquipe(main) {
  const fb={Encarregado:'b-enc',Eletricista:'b-ele',Auxiliar:'b-aux'};
  const linhas=S.eletricistas.map(e=>`
    <tr style="${e.status!=='Ativo'?'opacity:.55':''}">
      <td><div class="elet-cell"><div class="avatar">${e.nome.slice(0,2).toUpperCase()}</div><div><div class="elet-nome">${esc(e.nome)}</div><div class="elet-tel">${esc(e.telefone||'')}</div></div></div></td>
      <td><span class="badge ${fb[e.funcao]||'b-ele'}">${esc(e.funcao)}</span></td>
      <td style="font-weight:500">R$ ${fmtBR(e.valor_diaria)}</td>
      <td><span class="status-dot ${e.status==='Ativo'?'dot-ativo':'dot-inativo'}"></span>${esc(e.status)}</td>
    </tr>`).join('');
  main.innerHTML=`
    <div class="topbar"><div><div class="topbar-title">Equipe</div><div class="topbar-sub">${S.eletricistas.length} cadastrados</div></div><button class="btn btn-primary" onclick="modalElet()">+ Novo membro</button></div>
    <div class="content"><div class="table-card"><table>
      <thead><tr><th>Membro</th><th>Função</th><th>Valor/dia</th><th>Status</th></tr></thead>
      <tbody>${linhas||'<tr><td colspan="4" class="empty">Nenhum cadastrado</td></tr>'}</tbody>
    </table></div></div>`;
}

async function modalElet() {
  const nome=prompt('Nome completo:'); if(!nome)return;
  const funcao=prompt('Função (Encarregado/Eletricista/Auxiliar):')||'Eletricista';
  const valor=parseFloat(prompt('Valor da diária (R$):')||'200');
  const tel=prompt('Telefone (opcional):')||'';
  try { const e=await req('POST','/eletricistas/',{nome,funcao,valor_diaria:valor,telefone:tel,status:'Ativo'}); S.eletricistas=[...S.eletricistas,e]; toast('Membro cadastrado!'); renderMain(); }
  catch(e){toast(e.message,'erro');}
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navegar(el.dataset.tela))
  );
  if (Token.get()) {
    iniciarApp();
  } else {
    mostrarLogin();
  }
});