// ═══════════════════════════════════════════════════════════════
//  ÁREA DO DIARISTA — apontar a própria diária, ferramentas e "meu mês"
//  (usa req, toast, esc, fmtData, comprimirImagem, reqArquivo, vibrar do app2.js)
// ═══════════════════════════════════════════════════════════════
const P = { tela: 'inicio', d: null, ferr: null, ap: null, fotos: {}, busca: '', filtroFerr: 'todas' };
const PT_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pIco = (n, extra = '') => `<i class="ti ti-${n}" aria-hidden="true"${extra}></i>`;
const dt = s => new Date(s + 'T12:00:00');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
const fmtH = h => String(h).replace('.', ',') + 'h';
const primeiroNome = n => { const p = (n || '').replace(/^ENC\.?\s*/i, '').trim().split(/\s+/)[0] || ''; return p.charAt(0) + p.slice(1).toLowerCase(); };

function iniciarPortal() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';
  const el = document.getElementById('portal'); el.style.display = 'block';
  el.innerHTML = '<div class="pt-carregando"><div class="spinner"></div><p>Carregando...</p></div>';
  P.tela = 'inicio'; P.d = null; P.ferr = null;
  carregarPortal();
}

async function carregarPortal(ano, mes) {
  try {
    const q = ano ? `?ano=${ano}&mes=${mes}` : '';
    const [d, f] = await Promise.all([req('GET', '/portal/inicio' + q), P.ferr ? Promise.resolve(P.ferr) : req('GET', '/portal/ferramentas').catch(() => null)]);
    if (!d) return;
    P.d = d; if (f) P.ferr = f;
    renderPortal();
  } catch (err) {
    document.getElementById('portal').innerHTML = `<div class="pt-carregando"><p>${esc(err.message)}</p><button class="pt-btn pt-btn-p" onclick="carregarPortal()">Tentar de novo</button><button class="pt-btn" style="margin-top:8px" onclick="logout()">Sair</button></div>`;
  }
}

async function recarregarFerr() { try { P.ferr = await req('GET', '/portal/ferramentas'); } catch { } }

function ptIr(tela, extra) {
  P.tela = tela;
  if (tela === 'apontar') P.ap = typeof extra === 'object' && extra ? novoApontamento(extra.dia, extra.equipe) : novoApontamento(extra);
  if (tela === 'mes' && (P.d.ano !== +P.d.hoje.slice(0, 4) || P.d.mes !== +P.d.hoje.slice(5, 7)) && !extra) { carregarPortal(); }
  renderPortal();
  document.querySelector('.pt-main')?.scrollTo(0, 0);
}

// ── Layout ─────────────────────────────────────────────────────
function renderPortal() {
  const d = P.d, nome = primeiroNome(d.funcionario.nome);
  const telas = { inicio: ptInicio, apontar: ptApontar, enviado: ptEnviado, ferramentas: ptFerramentas, marcar: ptMarcar, mes: ptMes };
  const nav = [['inicio', 'home', 'Início'], ['apontar', 'clock-check', 'Diária'], ['ferramentas', 'tool', 'Ferramentas'], ['mes', 'calendar-month', 'Meu mês']];
  const ativo = { enviado: 'apontar', marcar: 'ferramentas' }[P.tela] || P.tela;
  document.getElementById('portal').innerHTML = `
    <div class="pt">
      <header class="pt-head">
        <div class="pt-marca"><img src="/brand/logo-mark.svg" alt="AZ" /><span>ELÉTRICA</span></div>
        <button class="pt-eu" onclick="ptPerfil()" aria-label="Meu perfil">
          <span class="pt-eu-txt"><b>${esc(nome)}</b><small>${esc(d.funcionario.funcao || 'Equipe')}</small></span>
          <span class="pt-av">${esc(nome.slice(0, 2).toUpperCase())}</span>
        </button>
      </header>
      <main class="pt-main">${telas[P.tela]()}</main>
      <nav class="pt-nav" aria-label="Menu">${nav.map(([t, i, n]) => `
        <button class="${ativo === t ? 'on' : ''}" onclick="ptIr('${t}')"><span>${pIco(i)}</span>${n}</button>`).join('')}
      </nav>
    </div>`;
  if (P.tela === 'ferramentas' || P.tela === 'inicio' || P.tela === 'marcar') ptFotos();
}

// ── Início ─────────────────────────────────────────────────────
function ptInicio() {
  const d = P.d, hoje = d.hoje, ontem = iso(new Date(dt(hoje).getTime() - 864e5));
  const h = d.recentes[hoje], o = d.recentes[ontem];
  const saud = (() => { const hr = new Date().getHours(); return hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; })();
  const dataTxt = dt(hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const comigo = (P.ferr?.ferramentas || []).filter(f => f.comigo);
  const cartao = h ? `
    <div class="pt-hero ok">
      <div class="pt-hero-top"><span class="pt-hero-ico">${pIco('circle-check')}</span><div><b>Diária de hoje enviada</b><small>${esc(h.obras.map(x => x.obra_nome + (x.fracao < 1 ? ' (½)' : '')).join(' + '))}${h.horas_extras ? ' · ' + fmtH(h.horas_extras) + ' extra' : ''}</small></div></div>
      ${h.editavel ? `<button class="pt-btn pt-btn-claro" onclick="ptIr('apontar','${hoje}')">${pIco('edit')} Corrigir</button>` : '<small class="pt-hero-nota">Lançada pelo escritório</small>'}
    </div>` : `
    <div class="pt-hero">
      <div class="pt-hero-top"><span class="pt-hero-ico">${pIco('alert-triangle')}</span><div><b>Você ainda não apontou hoje</b><small>Leva menos de 30 segundos</small></div></div>
      <button class="pt-btn pt-btn-am" onclick="ptIr('apontar','${hoje}')">${pIco('clock-check')} Apontar minha diária</button>
    </div>`;
  return `
    <div class="pt-pad">
      <div class="pt-ola"><small>${esc(dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1))}</small><h1>${saud}, ${esc(primeiroNome(d.funcionario.nome))}!</h1></div>
      ${d.usuario.senha_padrao ? `<button class="pt-aviso" onclick="ptPerfil(true)">${pIco('lock')}<span><b>Troque sua senha</b><br>Você ainda usa a senha inicial 123456. Toque aqui para criar a sua.</span></button>` : ''}
      ${cartao}
      ${!o && !h ? '' : !o ? `<button class="pt-aviso amarelo" onclick="ptIr('apontar','${ontem}')">${pIco('calendar-exclamation')}<span><b>Ontem (${ddmm(ontem)}) ficou sem diária</b><br>Se você trabalhou, toque para apontar.</span></button>` : ''}
      ${ptCardEquipe()}
      <div class="pt-grid2">
        <div class="pt-card pt-num"><small>Dias em ${MESES[d.mes - 1].toLowerCase()}</small><b>${d.resumo.dias}</b><span>apontados</span></div>
        <div class="pt-card pt-num"><small>Horas extras</small><b>${fmtH(d.resumo.horas_extras)}</b><span>no mês</span></div>
      </div>
      <div class="pt-card">
        <div class="pt-card-tit"><h2>Ferramentas comigo</h2><button class="pt-link" onclick="P.filtroFerr='comigo';ptIr('ferramentas')">Ver todas</button></div>
        ${comigo.length ? comigo.slice(0, 4).map(ptLinhaFerrCurta).join('') : '<p class="pt-vazio">Nenhuma ferramenta marcada com você.</p>'}
        <button class="pt-btn pt-btn-tracejado" onclick="ptIr('ferramentas')">${pIco('map-pin')} Marcar onde está uma ferramenta</button>
      </div>
    </div>`;
}
function ptCardEquipe() {
  const d = P.d, eq = d.equipe || [];
  if (!eq.length) return '';
  const hoje = d.hoje;
  const linhas = eq.map(m => {
    const a = m.recentes[hoje];
    return `<div class="pt-eq-lin"><span class="pt-eq-av ${a ? 'ok' : ''}">${a ? pIco('check') : esc(primeiroNome(m.nome).slice(0, 2).toUpperCase())}</span>
      <div style="flex:1;min-width:0"><b>${esc(primeiroNome(m.nome))}</b><small>${a ? esc(a.obras.map(o => o.obra_nome + (o.fracao < 1 ? ' (½)' : '')).join(' + ')) : 'Sem diária hoje'}</small></div></div>`;
  }).join('');
  const faltam = eq.filter(m => !m.recentes[hoje]).length;
  return `<div class="pt-card">
    <div class="pt-card-tit"><h2>Minha equipe hoje</h2><small class="pt-eq-cont">${eq.length - faltam}/${eq.length} apontados</small></div>
    ${linhas}
    <button class="pt-btn ${faltam ? 'pt-btn-p' : ''}" style="margin-top:12px" onclick="ptIr('apontar',{dia:'${hoje}',equipe:true})">${pIco('users-group')} Apontar diária da equipe</button>
  </div>`;
}
function ptLinhaFerrCurta(f) {
  const v = f.ultimo_visto;
  return `<div class="pt-fc"><span class="pt-fc-ico">${pIco('tool')}</span><div><b>${esc(f.nome)}</b><small>${v ? 'Marcada ' + haQuanto(v.data) : ''}</small></div></div>`;
}

// ── Apontar diária ─────────────────────────────────────────────
function novoApontamento(dia, comEquipe) {
  const d = P.d; dia = dia || d.hoje;
  const eu = d.funcionario.id;
  const ex = d.recentes[dia];
  // equipe: ao abrir pela equipe, já marca quem ainda não tem diária no dia (e ele mesmo)
  const euLivre = !(ex && !ex.editavel);
  let pessoas = euLivre ? [eu] : [];
  if (comEquipe) pessoas = [...pessoas, ...(d.equipe || []).filter(m => !m.recentes[dia]).map(m => m.id)];
  const base = { data: dia, pessoas, comEquipe: !!comEquipe };
  if (ex && ex.meu) {
    const duas = ex.obras.length > 1;
    return { ...base, modo: duas ? 'duas' : ex.obras[0]?.fracao < 1 ? 'meio' : 'inteiro', obras: ex.obras.map(o => o.obra_id), he: ex.horas_extras || 0,
      obs: ((ex.observacao || '').match(/Obs\.: ([^·]+)/) || [])[1]?.trim() || '', existe: true };
  }
  return { ...base, modo: 'inteiro', obras: d.ultima_obra_id && d.obras.some(o => o.id === d.ultima_obra_id) ? [d.ultima_obra_id] : [], he: 0, obs: '', existe: false };
}
function ptRegistroDe(id, dia) {
  const d = P.d;
  if (id === d.funcionario.id) return d.recentes[dia];
  return (d.equipe || []).find(m => m.id === id)?.recentes[dia];
}
function ptPessoa(id) {
  const a = P.ap;
  if (a.pessoas.includes(id)) a.pessoas = a.pessoas.filter(x => x !== id); else a.pessoas.push(id);
  renderPortal();
}
function ptEquipeTodos(todos) {
  const d = P.d, eu = d.funcionario.id;
  const livre = r => !r || r.editavel;
  const euOk = livre(d.recentes[P.ap.data]) ? [eu] : [];
  P.ap.pessoas = todos ? [...euOk, ...(d.equipe || []).filter(m => livre(m.recentes[P.ap.data])).map(m => m.id)] : euOk;
  renderPortal();
}
function ptBlocoEquipe() {
  const d = P.d, a = P.ap, eq = d.equipe || [];
  if (!eq.length) return '';
  const eu = d.funcionario.id;
  const ligado = a.comEquipe || a.pessoas.some(id => id !== eu);
  if (!ligado) return `<label class="pt-eq-toggle"><input type="checkbox" onchange="P.ap.comEquipe=true;ptEquipeTodos(true)" />
      <span>${pIco('users-group')} <b>Apontar da equipe também</b><small>${esc(eq.map(m => primeiroNome(m.nome)).join(', '))}</small></span></label>`;
  const chip = (id, nome) => {
    const r = ptRegistroDe(id, a.data);
    const bloq = r && !r.editavel;
    const on = a.pessoas.includes(id);
    return `<button class="pt-pessoa ${on ? 'on' : ''}" ${bloq ? 'disabled' : ''} onclick="ptPessoa(${id})" aria-pressed="${on}">
      <span class="pt-check quad">${on ? pIco('check') : ''}</span>
      <span style="flex:1;min-width:0;text-align:left"><b>${esc(nome)}</b><small>${bloq ? 'Já lançado pelo escritório' : r ? 'Já tem diária neste dia · será corrigida' : 'Sem diária neste dia'}</small></span></button>`;
  };
  return `<div class="pt-card pt-eq-box">
    <div class="pt-card-tit"><h2>${pIco('users-group')} Quem trabalhou?</h2>
      <span style="display:flex;gap:4px;align-items:center"><button class="pt-link" onclick="ptEquipeTodos(true)">Todos</button><span style="color:#cbd5e1">|</span><button class="pt-link" onclick="P.ap.comEquipe=false;ptEquipeTodos(false)">Só eu</button></span></div>
    <p class="pt-mini" style="margin:-2px 0 8px">Desmarque quem não foi trabalhar neste dia.</p>
    ${chip(eu, primeiroNome(d.funcionario.nome) + ' (eu)')}
    ${eq.map(m => chip(m.id, primeiroNome(m.nome))).join('')}
  </div>`;
}

function ptApontar() {
  const d = P.d, a = P.ap;
  const dias = [...Array(d.dias_para_tras + 1).keys()].map(k => iso(new Date(dt(d.hoje).getTime() - k * 864e5)));
  const rot = (s, k) => k === 0 ? 'Hoje' : k === 1 ? 'Ontem' : PT_DIAS[dt(s).getDay()].replace(/^./, c => c.toUpperCase());
  const ex = d.recentes[a.data];
  const bloqueado = ex && !ex.editavel && !(d.equipe || []).length;
  const busca = P.busca.toLowerCase();
  const ord = [...d.obras].sort((x, y) => (y.id === d.ultima_obra_id) - (x.id === d.ultima_obra_id) || x.nome.localeCompare(y.nome));
  const lista = ord.filter(o => !busca || o.nome.toLowerCase().includes(busca) || a.obras.includes(o.id));
  const max = a.modo === 'duas' ? 2 : 1;
  return `
    <div class="pt-tit"><button class="pt-voltar" onclick="ptIr('inicio')" aria-label="Voltar">${pIco('arrow-left')}</button><h1>${a.existe ? 'Corrigir diária' : 'Apontar diária'}</h1></div>
    <div class="pt-pad" style="padding-top:4px">
      <div class="pt-dias">${dias.map((s, k) => {
        const r = d.recentes[s];
        return `<button class="pt-dia ${a.data === s ? 'on' : ''}" onclick="ptDia('${s}')"><b>${rot(s, k)}</b><small>${ddmm(s)}</small>${r ? `<span class="pt-dia-ok">${pIco('check')}</span>` : ''}</button>`;
      }).join('')}</div>
      ${ptBlocoEquipe()}
      ${bloqueado ? `<div class="pt-card pt-bloq">${pIco('lock')}<div><b>Esse dia já foi lançado pelo escritório</b><br>${esc(ex.obras.map(o => o.obra_nome).join(' + '))}. Se estiver errado, fale com o engenheiro.</div></div>` : `
      <div class="pt-sec">Como foi o dia?</div>
      <div class="pt-ops">
        ${[['inteiro', 'Dia inteiro'], ['meio', 'Meio dia'], ['duas', 'Duas obras']].map(([m, n]) => `<button class="pt-op ${a.modo === m ? 'on' : ''}" onclick="ptModo('${m}')">${n}</button>`).join('')}
      </div>
      <div class="pt-sec">${a.modo === 'duas' ? 'Escolha as duas obras (meio dia em cada)' : 'Onde você trabalhou?'}</div>
      ${d.obras.length > 6 ? `<label class="pt-busca">${pIco('search')}<input placeholder="Buscar obra..." value="${esc(P.busca)}" oninput="P.busca=this.value;ptReRender('pt-lista-obras')" aria-label="Buscar obra" /></label>` : ''}
      <div id="pt-lista-obras" class="pt-obras">${ptListaObras(lista, a, max)}</div>
      <button class="pt-link pt-link-mais" onclick="ptPedirObra()">${pIco('map-pin-plus')} Não achei a obra · pedir obra nova</button>
      <div class="pt-card pt-he">
        <div><b>Hora extra</b><small>Além do horário normal</small></div>
        <div class="pt-step">
          <button onclick="ptHE(-0.5)" aria-label="Menos meia hora">${pIco('minus')}</button>
          <span id="pt-he">${fmtH(a.he)}</span>
          <button onclick="ptHE(0.5)" aria-label="Mais meia hora">${pIco('plus')}</button>
        </div>
      </div>
      <label class="pt-campo">Observação <small>(opcional)</small>
        <input id="pt-obs" value="${esc(a.obs)}" oninput="P.ap.obs=this.value" placeholder="Ex: puxei cabo do quadro geral" maxlength="300" /></label>
      <button class="pt-btn pt-btn-p pt-enviar" id="pt-enviar" onclick="ptEnviar()">${pIco('send')} ${ptTxtEnviar()}</button>
      ${a.existe && a.pessoas.length === 1 && a.pessoas[0] === d.funcionario.id ? `<button class="pt-btn pt-btn-perigo" onclick="ptApagarDia()">${pIco('trash')} Apagar este dia</button>` : ''}`}
    </div>`;
}
function ptListaObras(lista, a, max) {
  if (!lista.length) return '<p class="pt-vazio">Nenhuma obra encontrada. Peça uma obra nova abaixo.</p>';
  return lista.map(o => {
    const on = a.obras.includes(o.id);
    return `<button class="pt-obra ${on ? 'on' : ''}" onclick="ptObra(${o.id})" aria-pressed="${on}">
      <span class="pt-obra-ico">${pIco('building')}</span>
      <span class="pt-obra-txt"><b>${esc(o.nome)}</b><small>${o.solicitada ? 'Pedida · aguardando o escritório' : esc(o.cidade || '')}${o.id === P.d.ultima_obra_id ? (o.cidade || o.solicitada ? ' · ' : '') + 'sua última obra' : ''}</small></span>
      <span class="pt-check ${max > 1 ? 'quad' : ''}">${on ? pIco('check') : ''}</span></button>`;
  }).join('');
}
function ptReRender(id) {
  const a = P.ap, busca = P.busca.toLowerCase();
  const ord = [...P.d.obras].sort((x, y) => (y.id === P.d.ultima_obra_id) - (x.id === P.d.ultima_obra_id) || x.nome.localeCompare(y.nome));
  document.getElementById(id).innerHTML = ptListaObras(ord.filter(o => !busca || o.nome.toLowerCase().includes(busca) || a.obras.includes(o.id)), a, a.modo === 'duas' ? 2 : 1);
}
function ptTxtEnviar() {
  const a = P.ap, n = a.pessoas.length;
  if (n > 1) return `Enviar diária de ${n} pessoas`;
  if (n === 1 && a.pessoas[0] !== P.d.funcionario.id) return `Enviar diária de ${primeiroNome((P.d.equipe.find(m => m.id === a.pessoas[0]) || {}).nome)}`;
  return a.existe ? 'Salvar correção' : 'Enviar diária';
}
function ptDia(s) { const com = P.ap && P.ap.comEquipe; P.ap = novoApontamento(s, com); renderPortal(); }
function ptModo(m) { P.ap.modo = m; if (m !== 'duas') P.ap.obras = P.ap.obras.slice(0, 1); renderPortal(); }
function ptObra(id) {
  const a = P.ap;
  if (a.modo === 'duas') {
    if (a.obras.includes(id)) a.obras = a.obras.filter(x => x !== id);
    else { a.obras.push(id); if (a.obras.length > 2) a.obras.shift(); }
  } else a.obras = [id];
  ptReRender('pt-lista-obras');
}
function ptHE(delta) { P.ap.he = Math.min(8, Math.max(0, P.ap.he + delta)); document.getElementById('pt-he').textContent = fmtH(P.ap.he); }

async function ptEnviar() {
  const a = P.ap;
  if (a.modo === 'duas' && a.obras.length !== 2) { toast('Escolha as duas obras', 'erro'); return; }
  if (!a.obras.length) { toast('Escolha a obra onde você trabalhou', 'erro'); return; }
  if (!a.pessoas.length) { toast('Marque quem trabalhou neste dia', 'erro'); return; }
  const fr = a.modo === 'inteiro' ? 1 : 0.5;
  const btn = document.getElementById('pt-enviar'); btn.disabled = true; btn.innerHTML = 'Enviando...';
  try {
    const r = await req('POST', '/portal/apontar', { data: a.data, obras: a.obras.map(id => ({ obra_id: id, fracao: fr })), horas_extras: a.he, observacao: a.obs || null, eletricista_ids: a.pessoas });
    if (!r) return;
    const meu = r.itens.find(x => x.eletricista_id === P.d.funcionario.id);
    P.enviado = { ...(meu || r.itens[0]), itens: r.itens, corrigida: r.corrigiu };
    if (meu) P.d.recentes[a.data] = meu;
    P.tela = 'enviado'; renderPortal(); vibrar('ok');
    carregarPortal(P.d.ano, P.d.mes).then(() => { if (P.tela === 'enviado') renderPortal(); });
  } catch (err) { toast(err.message, 'erro'); btn.disabled = false; btn.innerHTML = `${pIco('send')} ${ptTxtEnviar()}`; }
}
async function ptApagarDia() {
  if (!confirm(`Apagar a diária de ${ddmm(P.ap.data)}?`)) return;
  try { await req('DELETE', `/portal/apontar/${P.ap.data}`); delete P.d.recentes[P.ap.data]; toast('Diária apagada'); await carregarPortal(P.d.ano, P.d.mes); ptIr('inicio'); }
  catch (err) { toast(err.message, 'erro'); }
}

function ptPedirObra() {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)fecharModal()">
      <div class="modal pt-modal">
        <div class="modal-header"><span class="modal-title">Pedir obra nova</span><button class="btn" onclick="fecharModal()" aria-label="Fechar">${pIco('x')}</button></div>
        <p style="font-size:13.5px;color:#5b6475;margin:0 0 12px">O escritório recebe o aviso e confere. Você já pode apontar a diária nela.</p>
        <label class="pt-campo">Nome do local *<input id="po-nome" placeholder="Ex: Casa do Sr. Antônio" maxlength="120" /></label>
        <label class="pt-campo">Cidade / bairro<input id="po-cidade" placeholder="Ex: Icaraí" maxlength="80" /></label>
        <label class="pt-campo">Observação<input id="po-obs" placeholder="Ex: cliente novo, serviço de padrão" maxlength="300" /></label>
        <button class="pt-btn pt-btn-p" id="po-btn" onclick="ptEnviarPedidoObra()">${pIco('send')} Pedir e usar esta obra</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('po-nome')?.focus(), 60);
}
async function ptEnviarPedidoObra() {
  const nome = document.getElementById('po-nome').value.trim();
  if (nome.length < 3) { toast('Escreva o nome do local', 'erro'); return; }
  const btn = document.getElementById('po-btn'); btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const o = await req('POST', '/portal/obras/solicitar', { nome, cidade: document.getElementById('po-cidade').value.trim() || null, observacao: document.getElementById('po-obs').value.trim() || null });
    if (!P.d.obras.some(x => x.id === o.id)) P.d.obras.push({ id: o.id, nome: o.nome, cidade: o.cidade, solicitada: o.solicitada });
    if (P.ap.modo === 'duas') { if (!P.ap.obras.includes(o.id)) { P.ap.obras.push(o.id); if (P.ap.obras.length > 2) P.ap.obras.shift(); } } else P.ap.obras = [o.id];
    P.busca = '';
    fecharModal(); toast(o.ja_existia ? `Essa obra já existe: ${o.nome}. Selecionei para você.` : 'Pedido enviado! Obra selecionada.'); renderPortal();
  } catch (err) { toast(err.message, 'erro'); btn.disabled = false; btn.textContent = 'Pedir e usar esta obra'; }
}

function ptEnviado() {
  const e = P.enviado || {};
  return `
    <div class="pt-pad pt-enviado">
      <div class="pt-ok-ico">${pIco('check')}</div>
      <h1>${(e.itens || []).length > 1 ? (e.corrigida ? 'Diárias salvas!' : 'Diárias enviadas!') : e.corrigida ? 'Diária corrigida!' : 'Diária enviada!'}</h1>
      <p>O escritório já foi avisado. Você acompanha tudo em <b>Meu mês</b>.</p>
      <div class="pt-card pt-resumo">
        <div><span>Data</span><b>${e.data ? PT_DIAS[dt(e.data).getDay()].replace(/^./, c => c.toUpperCase()) + ', ' + ddmm(e.data) : ''}</b></div>
        <div><span>Obra</span><b>${esc((e.obras || []).map(o => o.obra_nome + (o.fracao < 1 ? ' (½)' : '')).join(' + '))}</b></div>
        <div><span>Hora extra</span><b>${e.horas_extras ? fmtH(e.horas_extras) : '—'}</b></div>
        ${(e.itens || []).length > 1 || (e.itens && e.itens[0] && e.itens[0].eletricista_id !== P.d.funcionario.id) ? `<div><span>Pessoas</span><b>${esc(e.itens.map(x => primeiroNome(x.nome)).join(', '))}</b></div>` : ''}
      </div>
      <p class="pt-mini">Errou algo? Dá para corrigir até 2 dias depois.</p>
      <div class="pt-acoes">
        <button class="pt-btn" onclick="ptIr('apontar',{dia:'${e.data}',equipe:${(e.itens || []).length > 1}})">${pIco('edit')} Corrigir</button>
        <button class="pt-btn pt-btn-p" onclick="ptIr('inicio')">Voltar ao início</button>
      </div>
    </div>`;
}

// ── Ferramentas ────────────────────────────────────────────────
function ptFerramentas() {
  if (!P.ferr) { recarregarFerr().then(() => P.tela === 'ferramentas' && renderPortal()); return '<div class="pt-carregando"><div class="spinner"></div></div>'; }
  const lista0 = P.ferr.ferramentas || [];
  const busca = (P.buscaFerr || '').toLowerCase();
  let lista = lista0.filter(f => !busca || f.nome.toLowerCase().includes(busca));
  if (P.filtroFerr === 'comigo') lista = lista.filter(f => f.comigo);
  const nComigo = lista0.filter(f => f.comigo).length;
  return `
    <div class="pt-tit"><button class="pt-voltar" onclick="ptIr('inicio')" aria-label="Voltar">${pIco('arrow-left')}</button><h1>Ferramentas</h1></div>
    <div class="pt-pad" style="padding-top:4px">
      <label class="pt-busca">${pIco('search')}<input placeholder="Buscar ferramenta..." value="${esc(P.buscaFerr || '')}" oninput="P.buscaFerr=this.value;ptAtualizaListaFerr()" aria-label="Buscar ferramenta" /></label>
      <div class="pt-ops pt-ops-chips">
        <button class="pt-op ${P.filtroFerr !== 'comigo' ? 'on' : ''}" onclick="P.filtroFerr='todas';renderPortal()">Todas (${lista0.length})</button>
        <button class="pt-op ${P.filtroFerr === 'comigo' ? 'on' : ''}" onclick="P.filtroFerr='comigo';renderPortal()">Comigo (${nComigo})</button>
      </div>
      <div id="pt-lista-ferr">${ptListaFerr(lista)}</div>
      <p class="pt-mini" style="text-align:center">Toque em ${pIco('map-pin')} para dizer onde a ferramenta está agora.</p>
    </div>`;
}
function ptAtualizaListaFerr() {
  const busca = (P.buscaFerr || '').toLowerCase();
  let l = (P.ferr.ferramentas || []).filter(f => !busca || f.nome.toLowerCase().includes(busca));
  if (P.filtroFerr === 'comigo') l = l.filter(f => f.comigo);
  document.getElementById('pt-lista-ferr').innerHTML = ptListaFerr(l); ptFotos();
}
function ptListaFerr(lista) {
  if (!lista.length) return `<p class="pt-vazio">${P.filtroFerr === 'comigo' ? 'Nenhuma ferramenta marcada com você.' : 'Nenhuma ferramenta encontrada.'}</p>`;
  return lista.map(f => {
    const v = f.ultimo_visto;
    const thumb = v && v.tem_foto ? `<img class="pt-ft-img" data-pt-foto="${v.id}" alt="Foto de ${esc(f.nome)}" />` : `<span class="pt-ft-img sem">${pIco('tool')}</span>`;
    return `<div class="pt-ferr">${thumb}
      <div class="pt-ferr-txt"><b>${esc(f.nome)}${f.comigo ? ' <span class="pt-tag">COMIGO</span>' : ''}</b>
        <span class="pt-ferr-local">${pIco('map-pin')} ${v ? esc(v.local) : (f.locais?.length ? esc(f.locais.map(l => l.obra_nome).join(', ')) : 'Depósito')}</span>
        <small>${v ? `${fmtData(v.data)} · ${haQuanto(v.data)}${v.registrado_por ? ' · por ' + esc(primeiroNome(v.registrado_por)) : ''}` : 'Ainda não marcada no app'}</small></div>
      <button class="pt-pin" onclick="ptAbrirMarcar(${f.id})" aria-label="Marcar onde está ${esc(f.nome)}">${pIco('map-pin')}</button></div>`;
  }).join('');
}
async function ptFotos() {
  document.querySelectorAll('img[data-pt-foto]').forEach(async img => {
    const vid = img.dataset.ptFoto;
    if (!P.fotos[vid]) P.fotos[vid] = reqArquivo(`/portal/ferramentas/vistos/${vid}/foto`).then(r => URL.createObjectURL(r.blob)).catch(() => '');
    const u = await P.fotos[vid]; if (u) img.src = u;
  });
}

function ptAbrirMarcar(fid) {
  const hojeAp = P.d.recentes[P.d.hoje];
  const obraHoje = hojeAp?.obras?.[0];
  P.marcar = { fid, local: obraHoje ? obraHoje.obra_nome : '', obra_id: obraHoje ? obraHoje.obra_id : null, foto: null, outro: false, obs: '' };
  P.tela = 'marcar'; renderPortal();
}
function ptMarcar() {
  const m = P.marcar, f = (P.ferr.ferramentas || []).find(x => x.id === m.fid) || {};
  const v = f.ultimo_visto;
  const comigo = P.ferr.local_comigo;
  const hojeAp = P.d.recentes[P.d.hoje];
  const sug = [];
  (hojeAp?.obras || []).forEach(o => sug.push({ n: o.obra_nome, i: 'building', obra_id: o.obra_id, sub: 'obra de hoje' }));
  sug.push({ n: comigo, i: 'user', rot: 'Comigo' }, { n: 'Carro da equipe', i: 'car' }, { n: 'Depósito', i: 'building-warehouse' });
  return `
    <div class="pt-tit"><button class="pt-voltar" onclick="ptIr('ferramentas')" aria-label="Voltar">${pIco('arrow-left')}</button><h1>Onde está?</h1></div>
    <div class="pt-pad" style="padding-top:4px">
      <div class="pt-card pt-ferr-sel"><span class="pt-fc-ico">${pIco('tool')}</span><div><b>${esc(f.nome || '')}</b><small>${v ? 'Última vez: ' + esc(v.local) + ' · ' + haQuanto(v.data) : 'Ainda não marcada'}</small></div></div>
      <div class="pt-sec">Onde ela está agora?</div>
      <div class="pt-locais">${sug.map((s, k) => `
        <button class="pt-local ${!m.outro && m.local === s.n ? 'on' : ''}" onclick="ptLocal(${k})">${pIco(s.i)}<b>${esc(s.rot || s.n)}</b>${s.sub ? `<small>${s.sub}</small>` : ''}</button>`).join('')}
        <button class="pt-local ${m.outro ? 'on' : ''}" onclick="ptLocal(-1)">${pIco('dots')}<b>Outra obra ou lugar</b></button>
      </div>
      ${m.outro ? `<label class="pt-campo">Qual lugar?<input id="pm-outro" list="pm-obras" value="${esc(m.local)}" oninput="P.marcar.local=this.value;P.marcar.obra_id=null" placeholder="Nome da obra ou do lugar" />
        <datalist id="pm-obras">${P.d.obras.map(o => `<option value="${esc(o.nome)}"></option>`).join('')}</datalist></label>` : ''}
      <div class="pt-sec">Foto <small>(ajuda a achar depois)</small></div>
      <div class="pt-foto-linha">
        ${m.foto ? `<div class="pt-foto-prev"><img src="${URL.createObjectURL(m.foto)}" alt="Prévia da foto" /><button onclick="P.marcar.foto=null;renderPortal()" aria-label="Remover foto">${pIco('x')}</button></div>` : ''}
        <label class="pt-foto-btn">${pIco('camera')}<span>${m.foto ? 'Tirar outra' : 'Tirar foto'}</span><input type="file" accept="image/*" capture="environment" onchange="ptEscolheuFoto(this)" /></label>
      </div>
      <label class="pt-campo">Observação <small>(opcional)</small><input value="${esc(m.obs)}" oninput="P.marcar.obs=this.value" placeholder="Ex: em cima do andaime, no quarto de ferramentas" maxlength="300" /></label>
      <button class="pt-btn pt-btn-p pt-enviar" id="pm-salvar" onclick="ptSalvarMarcar()">${pIco('map-pin')} Marcar aqui</button>
    </div>`;
}
function ptLocal(k) {
  const m = P.marcar;
  if (k < 0) { m.outro = true; m.local = ''; m.obra_id = null; renderPortal(); setTimeout(() => document.getElementById('pm-outro')?.focus(), 50); return; }
  const hojeAp = P.d.recentes[P.d.hoje];
  const sug = [...(hojeAp?.obras || []).map(o => ({ n: o.obra_nome, obra_id: o.obra_id })), { n: P.ferr.local_comigo }, { n: 'Carro da equipe' }, { n: 'Depósito' }];
  m.outro = false; m.local = sug[k].n; m.obra_id = sug[k].obra_id || null; renderPortal();
}
function ptEscolheuFoto(inp) { const f = inp.files?.[0]; if (f) { P.marcar.foto = f; renderPortal(); } }
async function ptSalvarMarcar() {
  const m = P.marcar;
  const local = (m.local || '').trim();
  if (!local) { toast('Escolha onde a ferramenta está', 'erro'); return; }
  const btn = document.getElementById('pm-salvar'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const fd = new FormData();
    fd.append('local', local);
    const obra = m.obra_id || (P.d.obras.find(o => o.nome.toLowerCase() === local.toLowerCase()) || {}).id;
    if (obra) fd.append('obra_id', obra);
    if (m.obs.trim()) fd.append('observacao', m.obs.trim());
    if (m.foto) { const f = await comprimirImagem(m.foto, 1280, 0.8); fd.append('foto', f, f.name || 'foto.jpg'); }
    const res = await fetch(API + `/portal/ferramentas/${m.fid}/visto`, { method: 'POST', headers: { Authorization: 'Bearer ' + window._TOKEN }, body: fd });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || 'Erro ' + res.status); }
    await recarregarFerr();
    toast('Ferramenta marcada!'); P.tela = 'ferramentas'; renderPortal();
  } catch (err) { toast(err.message, 'erro'); btn.disabled = false; btn.innerHTML = `${pIco('map-pin')} Marcar aqui`; }
}

// ── Meu mês ────────────────────────────────────────────────────
function ptMes() {
  const d = P.d, ano = d.ano, mes = d.mes;
  const porDia = Object.fromEntries(d.apontamentos.map(a => [a.data, a]));
  const ini = new Date(ano, mes - 1, 1), nDias = new Date(ano, mes, 0).getDate();
  const celulas = [...Array(ini.getDay()).fill('<div></div>')];
  for (let i = 1; i <= nDias; i++) {
    const s = `${ano}-${String(mes).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const a = porDia[s];
    celulas.push(`<div class="pt-cal-d ${a ? 'on' : ''} ${s === d.hoje ? 'hoje' : ''}" ${a ? `title="${esc(a.obras.map(o => o.obra_nome).join(' + '))}"` : ''}>${i}${a && a.horas_extras ? '<span class="pt-cal-he"></span>' : ''}</div>`);
  }
  const ehAtual = ano === +d.hoje.slice(0, 4) && mes === +d.hoje.slice(5, 7);
  const prox = mes === 12 ? [ano + 1, 1] : [ano, mes + 1], ant = mes === 1 ? [ano - 1, 12] : [ano, mes - 1];
  const lista = [...d.apontamentos].reverse().map(a => `
    <div class="pt-dia-lin"><div class="pt-dl-data"><b>${a.data.slice(8, 10)}</b><small>${PT_DIAS[dt(a.data).getDay()].slice(0, 3)}</small></div>
      <div style="flex:1;min-width:0"><b>${esc(a.obras.map(o => o.obra_nome + (o.fracao < 1 ? ' (½)' : '')).join(' + '))}</b>
      <small>${a.horas_extras ? fmtH(a.horas_extras) + ' extra · ' : ''}${{ voce: 'apontado por você', encarregado: 'apontado pelo encarregado', funcionario: 'apontado no app', escritorio: 'lançado pelo escritório' }[a.origem] || ''}</small></div>
      ${a.editavel ? `<button class="pt-pin" onclick="ptIr('apontar','${a.data}')" aria-label="Corrigir dia ${ddmm(a.data)}">${pIco('edit')}</button>` : ''}</div>`).join('');
  return `
    <div class="pt-tit"><button class="pt-voltar" onclick="ptIr('inicio')" aria-label="Voltar">${pIco('arrow-left')}</button><h1>Meu mês</h1></div>
    <div class="pt-pad" style="padding-top:4px">
      <div class="pt-card">
        <div class="pt-cal-nav"><button onclick="carregarPortal(${ant[0]},${ant[1]})" aria-label="Mês anterior">${pIco('chevron-left')}</button>
          <b>${MESES[mes - 1]} de ${ano}</b>
          <button onclick="carregarPortal(${prox[0]},${prox[1]})" aria-label="Próximo mês" ${ehAtual ? 'disabled' : ''}>${pIco('chevron-right')}</button></div>
        <div class="pt-cal">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(x => `<div class="pt-cal-h">${x}</div>`).join('')}${celulas.join('')}</div>
        <div class="pt-cal-leg"><span><i class="pt-leg on"></i>Dia trabalhado</span><span><i class="pt-leg he"></i>Com hora extra</span></div>
      </div>
      <div class="pt-grid3">
        <div class="pt-card pt-num c"><b>${d.resumo.dias}</b><span>dias</span></div>
        <div class="pt-card pt-num c"><b>${fmtH(d.resumo.horas_extras)}</b><span>extras</span></div>
        <div class="pt-card pt-num c"><b>${d.resumo.obras}</b><span>obras</span></div>
      </div>
      <div class="pt-card">${lista || '<p class="pt-vazio">Nenhum dia apontado neste mês.</p>'}</div>
    </div>`;
}

// ── Perfil: trocar senha, vibração, sair ───────────────────────
function ptPerfil(focarSenha) {
  const d = P.d, vib = localStorage.getItem('az_vibrar') !== '0';
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)fecharModal()">
      <div class="modal pt-modal">
        <div class="modal-header"><span class="modal-title">${esc(d.funcionario.nome)}</span><button class="btn" onclick="fecharModal()" aria-label="Fechar">${pIco('x')}</button></div>
        <p style="font-size:13px;color:#5b6475;margin:-4px 0 12px">Login: <b>${esc(d.usuario.email)}</b></p>
        <div class="pt-sec" style="margin-top:0">Trocar senha</div>
        <label class="pt-campo">Senha atual<input id="ps-atual" type="password" autocomplete="current-password" ${d.usuario.senha_padrao ? 'placeholder="123456"' : ''} /></label>
        <label class="pt-campo">Nova senha <small>(mínimo 6)</small><input id="ps-nova" type="password" autocomplete="new-password" /></label>
        <button class="pt-btn pt-btn-p" onclick="ptTrocarSenha()">${pIco('lock')} Salvar nova senha</button>
        <label class="pt-switch"><span>${pIco('device-mobile-vibration')} Vibrar ao tocar</span><input type="checkbox" ${vib ? 'checked' : ''} onchange="localStorage.setItem('az_vibrar', this.checked ? '1' : '0'); if (this.checked) vibrar('ok')" /></label>
        <button class="pt-btn pt-btn-perigo" onclick="fecharModal();logout()">${pIco('logout')} Sair do app</button>
      </div>
    </div>`;
  if (focarSenha) setTimeout(() => { const a = document.getElementById('ps-atual'); if (a) { a.value = '123456'; document.getElementById('ps-nova').focus(); } }, 60);
}
async function ptTrocarSenha() {
  const atual = document.getElementById('ps-atual').value, nova = document.getElementById('ps-nova').value;
  if (nova.length < 6) { toast('A nova senha precisa ter pelo menos 6 caracteres', 'erro'); return; }
  try { await req('POST', '/auth/senha', { atual, nova }); P.d.usuario.senha_padrao = false; fecharModal(); toast('Senha trocada!'); renderPortal(); }
  catch (err) { toast(err.message, 'erro'); }
}
