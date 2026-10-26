import {useEffect,useState,FormEvent,ReactNode} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from './supabase'
import {Extras,Admin,Bars,Equipo,useQ} from './extra'
type Row=Record<string,any>
const ESTADOS=['pendiente_contactar','contactada','propuesta_enviada','negociando','aceptada','rechazada','cliente_activo','inactiva']
const L=(s:string)=>s.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())
const Logo=()=><div className="logo"><svg width="24" height="24" viewBox="0 0 32 32" aria-hidden><path d="M3 5h8l5 13 5-13h8L16 29z" fill="#526BFF"/><path d="M16 18l5-13h-4.2z" fill="#8B78FF"/></svg>VÉRTICE</div>
function useRows(table:string,select='*',order='created_at'){
  const [rows,set]=useState<Row[]>([]);const [err,setErr]=useState('')
  const load=()=>{supabase.from(table).select(select).order(order,{ascending:false}).then(({data,error})=>{set((data as any)??[]);setErr(error?.message??'')})}
  useEffect(load,[table]);return {rows,err,load}
}
const Empty=({t}:{t:string})=><div className="empty">{t}</div>
function Shell({tabs,tab,setTab,portal,children,extra}:{tabs:string[],tab:string,setTab:(t:string)=>void,portal?:boolean,children:ReactNode,extra?:ReactNode}){
  return <div className={portal?'portal':''}><div className="app"><nav className="side" aria-label="Principal"><Logo/>
    {tabs.map(t=><button key={t} className="n" aria-current={t===tab} onClick={()=>setTab(t)}>{t}</button>)}
    {extra}<button className="n out" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></nav><main>{children}</main></div></div>
}
function Login(){
  const [e,setE]=useState('');const [p,setP]=useState('');const [m,setM]=useState('')
  const go=async(ev:FormEvent)=>{ev.preventDefault();const {error}=await supabase.auth.signInWithPassword({email:e,password:p});if(error)setM('Credenciales no válidas.')}
  return <form className="login" onSubmit={go}><Logo/><div className="row"><input type="email" placeholder="Correo electrónico" value={e} onChange={x=>setE(x.target.value)} required aria-label="Correo"/>
  <input type="password" placeholder="Contraseña" value={p} onChange={x=>setP(x.target.value)} required aria-label="Contraseña"/><button className="b">Entrar</button><span className="err">{m}</span>
  <small>El acceso lo concede un administrador de VÉRTICE.</small></div></form>
}
function Ficha({c,back}:{c:Row,back:()=>void}){
  const [co,setCo]=useState(c);const acts=useRows('activities');const tasks=useRows('tasks');const props=useRows('proposals');const [t,setT]=useState('');const [sh,setSh]=useState(false)
  const save=async(patch:Row)=>{const {data}=await supabase.from('companies').update(patch).eq('id',co.id).select().single();if(data)setCo(data)}
  const add=async(ev:FormEvent)=>{ev.preventDefault();await supabase.from('activities').insert({company_id:co.id,title:t,kind:'otro',shared:sh});setT('');setSh(false);acts.load()}
  const mine=(r:Row[])=>r.filter(x=>x.company_id===co.id)
  return <><a className="l" onClick={back}>← Empresas</a><h1>{co.name}</h1>
  <div className="p"><h2>Datos y estado comercial</h2><div className="row"><select value={co.status} onChange={e=>save({status:e.target.value})} aria-label="Estado">{ESTADOS.map(s=><option key={s} value={s}>{L(s)}</option>)}</select>
  <span className="tag">{co.sector||'Sin sector'}</span><span className="tag">Fuente: {co.source||'sin indicar'}</span></div>
  {co.status==='rechazada'&&<input placeholder="Motivo del rechazo" defaultValue={co.rejection_reason??''} onBlur={e=>save({rejection_reason:e.target.value})}/>}</div>
  <div className="p"><h2>Notas internas <span className="tag i">Privado: nunca se muestra al cliente</span></h2><textarea rows={3} style={{width:'100%'}} defaultValue={co.internal_notes??''} onBlur={e=>save({internal_notes:e.target.value})}/></div>
  <div className="p"><h2>Actividad y comunicaciones</h2><form className="row" onSubmit={add}><input value={t} onChange={e=>setT(e.target.value)} placeholder="Nueva actividad" required/>
  <label><input type="checkbox" checked={sh} onChange={e=>setSh(e.target.checked)}/> Compartir con el cliente</label><button className="b">Registrar</button></form>
  {mine(acts.rows).length?<table><tbody>{mine(acts.rows).map(a=><tr key={a.id}><td>{a.title}</td><td><span className={'tag '+(a.shared?'s':'i')}>{a.shared?'Compartida':'Interna'}</span></td><td>{new Date(a.occurred_at).toLocaleDateString('es-ES')}</td></tr>)}</tbody></table>:<Empty t="Sin actividad registrada."/>}</div>
  <Extras c={co}/></>
}
function Empresas(){
  const {rows,err,load}=useRows('companies');const [sel,setSel]=useState<Row|null>(null);const [f,setF]=useState('');const [n,setN]=useState('')
  const add=async(ev:FormEvent)=>{ev.preventDefault();await supabase.from('companies').insert({name:n});setN('');load()}
  if(sel)return <Ficha c={sel} back={()=>{setSel(null);load()}}/>
  const v=rows.filter(r=>!f||r.status===f)
  return <><h1>Empresas</h1><form className="row" onSubmit={add}><input value={n} onChange={e=>setN(e.target.value)} placeholder="Nueva empresa" required/><button className="b">Añadir</button>
  <select value={f} onChange={e=>setF(e.target.value)} aria-label="Filtrar"><option value="">Todos los estados</option>{ESTADOS.map(s=><option key={s} value={s}>{L(s)}</option>)}</select></form><span className="err">{err}</span>
  <div className="p">{v.length?<table><thead><tr><th>Empresa</th><th>Estado</th><th>Origen</th></tr></thead><tbody>{v.map(r=><tr key={r.id}><td><a className="l" onClick={()=>setSel(r)}>{r.name}</a>{r.is_demo&&<span className="tag i"> Demo</span>}</td><td>{L(r.status)}</td><td>{r.source||'—'}</td></tr>)}</tbody></table>:<Empty t="Aún no hay empresas. Añade la primera."/>}</div></>
}
function Oportunidades(){
  const {rows,err,load}=useRows('opportunities');const cs=useRows('companies');const [c,setC]=useState('');const [t,setT]=useState('')
  const add=async(ev:FormEvent)=>{ev.preventDefault();await supabase.from('opportunities').insert({company_id:c,title:t});setT('');load()}
  const nm=(id:string)=>cs.rows.find(x=>x.id===id)?.name??'—'
  return <><h1>Oportunidades</h1><form className="row" onSubmit={add}><select value={c} onChange={e=>setC(e.target.value)} required aria-label="Empresa"><option value="">Empresa…</option>{cs.rows.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
  <input value={t} onChange={e=>setT(e.target.value)} placeholder="Oportunidad" required/><button className="b">Añadir</button></form><span className="err">{err}</span>
  <div className="p">{rows.length?<table><thead><tr><th>Oportunidad</th><th>Empresa</th><th>Prioridad</th><th>Próxima acción</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.title}</td><td>{nm(r.company_id)}</td><td>{r.priority}</td><td>{r.next_action||'—'}</td></tr>)}</tbody></table>:<Empty t="Sin oportunidades registradas."/>}</div></>
}
function Cuentas({rows,t}:{rows:Row[],t:string}){return <div className="g">{ESTADOS.map(s=><div className="p" key={s}><b>{rows.filter(r=>r.status===s).length}</b>{L(s)}</div>)}<Empty t={t}/></div>}
function Interno(){
  const [tab,setTab]=useState('Resumen');const cs=useRows('companies');const tk=useRows('tasks','*','due_date')
  const hoy=new Date().toISOString().slice(0,10);const venc=tk.rows.filter(t=>!t.done&&t.due_date&&t.due_date<hoy).length
  return <Shell tabs={['Resumen','Empresas','Oportunidades','Resultados']} tab={tab} setTab={setTab} extra={<button className="n" onClick={()=>setTab('Administración')}>Administración</button>}>
  {tab==='Administración'&&<Admin/>}
  {tab==='Resumen'&&<><h1>Resumen</h1><div className="g"><div className="p"><b>{cs.rows.filter(r=>r.status==='cliente_activo').length}</b>Clientes activos</div><div className="p"><b>{cs.rows.filter(r=>r.status==='propuesta_enviada').length}</b>Propuestas pendientes</div><div className="p"><b>{venc}</b>Tareas vencidas</div></div></>}
  {tab==='Empresas'&&<Empresas/>}{tab==='Oportunidades'&&<Oportunidades/>}
  {tab==='Resultados'&&<><h1>Resultados</h1>{cs.rows.length?<><Cuentas rows={cs.rows} t="Recuento real por estado comercial. Fuente: tabla companies."/><div className="p"><Bars data={ESTADOS.map(e=>[L(e),cs.rows.filter(r=>r.status===e).length] as [string,number])}/></div></>:<Empty t="Aún no hay datos suficientes."/>}</>}</Shell>
}
function Portal({ws,role}:{ws:Row,role:string}){
  const [tab,setTab]=useState('Resumen');const a=useQ('portal_activity',q=>q,'occurred_at');const d=useQ('client_reports');const [de,setDe]=useState('');const [ha,setHa]=useState('')
  const rows=a.rows.filter(r=>(!de||r.occurred_at.slice(0,10)>=de)&&(!ha||r.occurred_at.slice(0,10)<=ha))
  const n=(ks:string[])=>rows.filter(r=>ks.includes(r.kind)).length
  const mes:Record<string,number>={};rows.forEach(r=>{const k=r.occurred_at.slice(0,7);mes[k]=(mes[k]||0)+1})
  const open=async(r:Row)=>{const {data}=await supabase.storage.from('documentos').createSignedUrl(r.file_path,60);if(data)window.open(data.signedUrl,'_blank')}
  const Filtro=<div className="row"><label>Desde <input type="date" value={de} onChange={e=>setDe(e.target.value)}/></label><label>Hasta <input type="date" value={ha} onChange={e=>setHa(e.target.value)}/></label></div>
  return <Shell portal tabs={['Resumen','Actividad','Resultados','Documentos']} tab={tab} setTab={setTab}>
  {tab==='Resumen'&&<><h1>{ws.name}</h1><div className="g"><div className="p"><b>{a.rows.length}</b>Actividades compartidas</div><div className="p"><b>{d.rows.length}</b>Documentos publicados</div></div><Equipo ws={ws} admin={role==='admin'}/></>}
  {tab==='Actividad'&&<><h1>Actividad</h1>{Filtro}<div className="p">{rows.length?<table><tbody>{rows.map(r=><tr key={r.id}><td>{r.title}</td><td>{L(r.kind)}</td><td>{new Date(r.occurred_at).toLocaleDateString('es-ES')}</td></tr>)}</tbody></table>:<Empty t="No hay actividad compartida en este periodo."/>}</div></>}
  {tab==='Resultados'&&<><h1>Resultados</h1>{Filtro}{rows.length?<>
  <div className="p"><h2>Indicadores de actividad</h2><div className="g"><div><b>{n(['analisis'])}</b>Empresas analizadas</div><div><b>{n(['contacto'])}</b>Contactos realizados</div></div></div>
  <div className="p"><h2>Resultados comerciales registrados</h2><div className="g"><div><b>{n(['respuesta'])}</b>Respuestas recibidas</div><div><b>{n(['reunion'])}</b>Reuniones obtenidas</div><div><b>{n(['conversion'])}</b>Conversiones</div></div></div>
  {Object.keys(mes).length>1&&<div className="p"><h2>Evolución mensual</h2><Bars data={Object.entries(mes).sort() as [string,number][]}/></div>}
  <small>Definición: eventos compartidos y registrados por VÉRTICE para tu empresa en el periodo seleccionado. Fuente: registro de actividad.</small></>:<Empty t="Sin datos registrados en este periodo."/>}</>}
  {tab==='Documentos'&&<><h1>Documentos</h1><div className="p">{d.rows.length?d.rows.map(r=><div className="row" key={r.id}>{r.title}{r.file_path&&<a className="l" onClick={()=>open(r)}>Abrir</a>}</div>):<Empty t="Aún no hay documentos publicados."/>}</div></>}</Shell>
}
export default function App(){
  const [s,setS]=useState<Session|null|undefined>(undefined);const [mem,setMem]=useState<Row[]|null>(null)
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setS(data.session));const {data}=supabase.auth.onAuthStateChange((_,x)=>setS(x));return()=>data.subscription.unsubscribe()},[])
  useEffect(()=>{if(!s){setMem(null);return};supabase.from('workspace_members').select('role,workspaces(id,name,kind)').eq('user_id',s.user.id).then(({data})=>setMem((data as any)??[]))},[s])
  if(s===undefined)return null;if(!s)return <Login/>;if(!mem)return null
  const w=(k:string)=>mem.map(x=>x.workspaces).find((x:Row)=>x?.kind===k)
  if(w('internal'))return <Interno/>
  const cm=mem.find(x=>x.workspaces?.kind==='client');if(cm)return <Portal ws={cm.workspaces} role={cm.role}/>
  return <div className="login"><Logo/><p>Tu cuenta aún no tiene acceso. Contacta con VÉRTICE.</p><button className="b" onClick={()=>supabase.auth.signOut()}>Salir</button></div>
}
