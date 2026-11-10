import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {createStore} from './lib/db.mjs';
import {generateReply} from './lib/ai.mjs';
const config={
  port:Number(process.env.PORT||3005),
  businessName:process.env.BUSINESS_NAME||'Nexo Digital',
  adminUser:process.env.ADMIN_USER||'admin',
  adminPass:process.env.ADMIN_PASSWORD||'',
  geminiKey:process.env.GEMINI_API_KEY||'',
  geminiModel:process.env.GEMINI_MODEL||'gemini-2.5-flash',
  metaSecret:process.env.META_APP_SECRET||'',
  verifyToken:process.env.META_VERIFY_TOKEN||'',
  accessToken:process.env.META_ACCESS_TOKEN||'',
  phoneId:process.env.META_PHONE_NUMBER_ID||'',
  graphVersion:process.env.META_GRAPH_VERSION||'v24.0',
  ownerPhone:process.env.OWNER_PHONE||'',
  hotTemplate:process.env.HOT_LEAD_TEMPLATE||'',
  catalog:[],
};
try {config.catalog=JSON.parse(process.env.CATALOG_JSON || '[]');if(!Array.isArray(config.catalog))config.catalog=[];}
catch{console.warn('CATALOG_JSON no es JSON válido; se usará un catálogo vacío.');}
if(!config.adminPass || config.adminPass.length<12){
  console.error('Configura ADMIN_PASSWORD (mínimo 12 caracteres) para proteger los datos de clientes.');
  process.exit(1);
}
const store=createStore(resolve(process.env.DATA_PATH||'./data/leads.sqlite'));
const h=(text)=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function safeEqual(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length && timingSafeEqual(x,y);}
function basicAuth(req){
  const header=req.headers.authorization||'';
  if(!header.startsWith('Basic '))return false;
  try{const auth=Buffer.from(header.slice(6),'base64').toString('utf8');const i=auth.indexOf(':');return i>0 && safeEqual(auth.slice(0,i),config.adminUser) && safeEqual(auth.slice(i+1),config.adminPass);}catch{return false;}
}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function readBody(req,limit=512_000){return new Promise((ok,fail)=>{let parts=[],size=0;req.on('data',d=>{size+=d.length;if(size>limit){fail(Error('Solicitud demasiado grande'));req.destroy();return;}parts.push(d)});req.on('end',()=>ok(Buffer.concat(parts)));req.on('error',fail);});}
function verifySignature(raw,signature){if(!config.metaSecret || !signature?.startsWith('sha256='))return false;const digest='sha256='+createHmac('sha256',config.metaSecret).update(raw).digest('hex');return safeEqual(digest,signature);}
async function sendWhatsApp(to,text){
  if(!config.accessToken || !config.phoneId) return false;
  const endpoint=`https://graph.facebook.com/${encodeURIComponent(config.graphVersion)}/${encodeURIComponent(config.phoneId)}/messages`;
  const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${config.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{preview_url:false,body:text}})});
  if(!r.ok)throw Error(`Cloud API ${r.status}: ${(await r.text()).slice(0,400)}`);
  return true;
}
async function sendOwnerTemplate(lead){
  if(!config.ownerPhone || !config.hotTemplate || !config.accessToken || !config.phoneId)return false;
  const r=await fetch(`https://graph.facebook.com/${encodeURIComponent(config.graphVersion)}/${encodeURIComponent(config.phoneId)}/messages`,{
    method:'POST',headers:{Authorization:`Bearer ${config.accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:config.ownerPhone,type:'template',template:{name:config.hotTemplate,language:{code:'es'},components:[{type:'body',parameters:[lead.name||'Cliente',lead.product||'Producto',lead.phone].map(text=>({type:'text',text}))}]}})
  });
  if(!r.ok)throw Error(`Alerta no enviada (${r.status})`);
  store.markNotified(lead.phone);
  return true;
}
async function processInbound({id,phone,name,text},send=true){
  if(!/^\d{8,16}$/.test(phone)|| typeof text!=='string'||!text.trim())return {ignored:true};
  const result=store.applyInbound({id,phone,name,text:text.slice(0,4000)});
  if(result.duplicate)return result;
  const lead=result.lead;
  if(result.justQualified){console.info('LEAD LISTO:',lead.phone,lead.product);
    try{await sendOwnerTemplate(lead)}catch(e){console.warn(e.message)}
  }
  const shouldAutoReply = lead.manual_status === 'pendiente' && (lead.stage !== 'listo_para_asesor' || result.justQualified);
  const reply = shouldAutoReply ? await generateReply({message:text,lead,config}) : '';
  if(send&&reply){
    // Solo responder mensajes entrantes, dentro de ventana de servicio.
    const sent=await sendWhatsApp(phone,reply);
    if(sent)store.recordOutbound(phone,reply);
  }
  return {...result,reply};
}
function dashboard(){return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nexo CRM - Ventas</title><style>
:root{color-scheme:dark;font-family:system-ui,Arial}*{box-sizing:border-box}body{margin:0;background:#071420;color:#e8f6fa}header{background:#0b202c;border-bottom:1px solid #214352;padding:22px 16px}h1{margin:0;font-size:26px;color:#44e1cd}header p{color:#aac3ce;margin:7px 0 0}main{max-width:1000px;margin:auto;padding:18px 14px}h2{font-size:19px}#stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}article,.stat,.demo{background:#102735;border:1px solid #1e4955;border-radius:12px;padding:14px}.stat{font-weight:600}.stat span{display:block;color:#45ded0;font-size:26px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px}button,a.action{border:0;border-radius:7px;background:#41dcca;color:#031a20;font-weight:700;padding:10px;cursor:pointer;text-decoration:none;display:inline-block}.secondary{background:#244551;color:#f4ffff}.muted{color:#abc5cf;font-size:13px}article{margin:10px 0}article.hot{border-color:#e7b767}.line{display:flex;align-items:center;justify-content:space-between;gap:8px}.chip{background:#253d48;color:#dcf4ff;border-radius:20px;padding:4px 9px;font-size:12px}.hot .chip{background:#594423;color:#ffe0a1}input,select,textarea{width:100%;background:#051e28;color:white;border:1px solid #2a5964;border-radius:8px;padding:11px;margin:6px 0}textarea{min-height:75px}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:9px}small{color:#9bb5c0}#error{color:#f7aaaa}footer{padding:30px 15px;color:#95b0bc;font-size:12px;text-align:center}@media(max-width:400px){#stats{grid-template-columns:1fr 1fr}.line{align-items:start}}
</style></head><body><header><h1>◈ Nexo CRM</h1><p>Agentes comerciales · Leads por WhatsApp</p></header><main><div id="stats"></div><div class="toolbar"><h2>Clientes</h2><button onclick="refresh()">Actualizar</button></div><div id="error"></div><div id="leads"></div><section class="demo"><h2>Probar sin conectar WhatsApp</h2><p class="muted">Simula la conversación de un cliente. El envío real solo funcionará después de configurar la API oficial.</p><input id="phone" placeholder="Teléfono de prueba, ej. 573001234567" value="573001234567"/><input id="name" placeholder="Nombre del cliente" value="Cliente de prueba"/><textarea id="message" placeholder="Ejemplo: Hola, ¿qué precio tiene Disney Premium?"></textarea><button onclick="simulate()">Simular mensaje entrante</button><p id="reply" class="muted"></p></section></main><footer>Prototipo v0.1 · No confirma pagos ni disponibilidad · Protege los datos personales</footer><script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw Error('Solicitud fallida: '+r.status);return r.json()}
async function refresh(){try{const data=await call('/api/leads');const a=data.leads;document.getElementById('stats').innerHTML=[['Total',a.length],['Para atender',a.filter(x=>x.stage==='listo_para_asesor'&&x.manual_status==='pendiente').length],['Ventas',a.filter(x=>x.manual_status==='vendido').length]].map(([n,v])=>'<div class="stat"><span>'+v+'</span>'+n+'</div>').join('');document.getElementById('leads').innerHTML=a.length?a.map(x=>{const hot=x.stage==='listo_para_asesor';const link='https://wa.me/'+encodeURIComponent(x.phone);return '<article class="'+(hot?'hot':'')+'"><div class="line"><strong>'+esc(x.name||x.phone)+'</strong><span class="chip">'+esc(hot?'LISTO PARA ASESOR':x.stage)+'</span></div><p class="muted">'+esc(x.phone)+' · '+esc(x.product||'Sin producto')+' · Puntaje '+x.score+'/100</p><p>'+esc(x.last_message)+'</p><div class="actions"><a class="action" href="'+link+'" target="_blank" rel="noopener">Abrir WhatsApp</a><select aria-label="Estado de gestión" onchange="setStatus(this,'+JSON.stringify(x.phone)+')"><option value="pendiente" '+(x.manual_status==='pendiente'?'selected':'')+'>Pendiente</option><option value="contactado" '+(x.manual_status==='contactado'?'selected':'')+'>Contactado</option><option value="vendido" '+(x.manual_status==='vendido'?'selected':'')+'>Vendido</option><option value="perdido" '+(x.manual_status==='perdido'?'selected':'')+'>Perdido</option></select></div><small>Último mensaje: '+esc(x.last_at||'-')+'</small></article>'}).join(''):'<p class="muted">Todavía no hay leads. Usa el simulador para comenzar.</p>';document.getElementById('error').textContent='';}catch(e){document.getElementById('error').textContent=e.message;}}
async function setStatus(el,phone){try{await call('/api/leads/status',{method:'POST',body:JSON.stringify({phone,status:el.value})});refresh()}catch(e){alert(e.message)}}
async function simulate(){try{const d=await call('/api/demo',{method:'POST',body:JSON.stringify({phone:document.getElementById('phone').value,name:document.getElementById('name').value,text:document.getElementById('message').value})});document.getElementById('reply').textContent='Respuesta del asistente: '+d.reply;refresh()}catch(e){document.getElementById('reply').textContent=e.message}}
refresh();</script></body></html>`}
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(u.pathname==='/webhook/whatsapp'&&req.method==='GET'){
    const mode=u.searchParams.get('hub.mode'),token=u.searchParams.get('hub.verify_token'),challenge=u.searchParams.get('hub.challenge');
    if(config.verifyToken&&mode==='subscribe'&&safeEqual(token||'',config.verifyToken)&&challenge){res.writeHead(200,{'Content-Type':'text/plain'});res.end(challenge)}else json(res,403,{error:'No autorizado'});
    return;
  }
  if(u.pathname==='/webhook/whatsapp'&&req.method==='POST'){
    try{
      const raw=await readBody(req);
      if(!verifySignature(raw,req.headers['x-hub-signature-256']))return json(res,403,{error:'Firma no válida'});
      const payload=JSON.parse(raw.toString('utf8'));
      // Demo operativa en proceso persistente. Producción: encolar durablemente antes del ACK.
      json(res,200,{ok:true});
      for(const e of payload.entry||[])for(const change of e.changes||[]){
        for(const m of change.value?.messages||[]){
          if(m.type!=='text'||!m.text?.body)continue;
          const name=(change.value?.contacts||[]).find(c=>c.wa_id===m.from)?.profile?.name||'';
          processInbound({id:m.id,phone:m.from,name,text:m.text.body}).catch(err=>console.error('Webhook process:',err.message));
        }
      }
    }catch(e){if(!res.headersSent)json(res,400,{error:'Webhook inválido'});else console.error(e.message)}
    return;
  }
  if(!basicAuth(req)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Nexo CRM"','Content-Type':'text/plain'});res.end('Credenciales requeridas');return;}
  // Se requiere protección de origen para mutaciones del dashboard con HTTP Basic.
  if(req.method==='POST'){
    const origin=req.headers.origin;
    if(origin && new URL(origin).host!==req.headers.host)return json(res,403,{error:'Origen no autorizado'});
  }
  if(u.pathname==='/'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});res.end(dashboard());return;
  }
  if(u.pathname==='/health'&&req.method==='GET')return json(res,200,{ok:true});
  if(u.pathname==='/api/leads'&&req.method==='GET')return json(res,200,{leads:store.listLeads()});
  if(u.pathname==='/api/demo'&&req.method==='POST'){
    try{const data=JSON.parse((await readBody(req)).toString('utf8'));
      if(!data?.text?.trim())return json(res,400,{error:'Escribe un mensaje'});
      const r=await processInbound({id:`demo-${Date.now()}-${Math.random()}`,phone:data.phone||'',name:data.name||'Cliente',text:data.text},false);
      return json(res,r.ignored?400:200,r);
    }catch(e){return json(res,400,{error:e.message})}
  }
  if(u.pathname==='/api/leads/status'&&req.method==='POST'){
    try{const data=JSON.parse((await readBody(req)).toString('utf8'));const lead=store.changeStatus(data.phone,data.status);return json(res,lead?200:404,{lead});}catch(e){return json(res,400,{error:e.message})}
  }
  return json(res,404,{error:'No encontrado'});
});
server.listen(config.port,'0.0.0.0',()=>console.log(`Nexo CRM MVP en http://localhost:${config.port}. Cloud API ${config.metaSecret&&config.accessToken?'configurada':'NO configurada'}.`));
