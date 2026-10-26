import {useEffect,useState,FormEvent} from 'react'
import {supabase} from './supabase'
type Row=Record<string,any>
export const L=(s:string)=>s.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())
export function useQ(table:string,f:(q:any)=>any=q=>q,order='created_at'){
  const [rows,set]=useState<Row[]>([]);const [err,setErr]=useState('')
  const load=()=>{f(supabase.from(table).select('*').order(order,{ascending:false})).then(({data,error}:any)=>{set(data??[]);setErr(error?.message??'')})}
  useEffect(load,[table]);return {rows,err,load}
}
export const Empty=({t}:{t:string})=><div className="empty">{t}</div>
export function Bars({data}:{data:[string,number][]}){
  const m=Math.max(1,...data.map(d=>d[1]))
  return <svg role="img" aria-label="Gráfico de barras" width="100%" style={{maxWidth:data.length*70}} viewBox={`0 0 ${data.length*60} 110`}>{data.map(([k,v],i)=><g key={k}>
    <rect x={i*60+10} y={85-v/m*65} width="40" height={v/m*65} rx="3" fill="#526BFF"/><text x={i*60+30} y="100" fontSize="9" textAnchor="middle" fill="currentColor">{k.slice(0,10)}</text>
    <text x={i*60+30} y={80-v/m*65} fontSize="10" textAnchor="middle" fill="currentColor">{v}</text></g>)}</svg>
}
function AddRow({ph,date,go}:{ph:string,date?:boolean,go:(t:string,d:string)=>any}){
  const [t,setT]=useState('');const [d,setD]=useState('')
  return <form className="row" onSubmit={async(e:FormEvent)=>{e.preventDefault();await go(t,d);setT('');setD('')}}><input value={t} onChange={e=>setT(e.target.value)} placeholder={ph} required aria-label={ph}/>
  {date&&<input type="date" value={d} onChange={e=>setD(e.target.value)} aria-label="Fecha"/>}<button className="b">Añadir</button></form>
}
export function Extras({c}:{c:Row}){
  const pr=useQ('proposals',q=>q.eq('company_id',c.id));const tk=useQ('tasks',q=>q.eq('company_id',c.id));const sv=useQ('services',q=>q.eq('company_id',c.id))
  const rp=useQ('client_reports',q=>q.eq('company_id',c.id));const ws=useQ('workspaces',q=>q.eq('kind','client'))
  const [wsid,setWs]=useState<string>(c.client_workspace_id??'');const [msg,setMsg]=useState('');const [ti,setTi]=useState('');const [pub,setPub]=useState(false);const [file,setFile]=useState<File|null>(null)
  const run=async(p:PromiseLike<{error:any}>,r:{load:()=>void})=>{const {error}=await p;setMsg(error?.message??'');r.load()}
  const upload=async(e:FormEvent)=>{e.preventDefault();if(!file||!wsid)return;const path=`${wsid}/${Date.now()}-${file.name.replace(/[^\w.-]/g,'_')}`
    const up=await supabase.storage.from('documentos').upload(path,file);if(up.error){setMsg(up.error.message);return}
    await run(supabase.from('client_reports').insert({workspace_id:wsid,company_id:c.id,title:ti,file_path:path,published:pub,published_at:pub?new Date().toISOString():null}),rp);setTi('');setFile(null)}
  return <><span className="err">{msg}</span>
  <div className="p"><h2>Propuestas</h2><AddRow ph="Nueva propuesta" go={t=>run(supabase.from('proposals').insert({company_id:c.id,title:t}),pr)}/>
   {pr.rows.length?pr.rows.map(x=><div className="row" key={x.id}>{x.title}<select value={x.status} aria-label="Estado de la propuesta" onChange={e=>run(supabase.from('proposals').update({status:e.target.value,...(e.target.value==='enviada'?{sent_at:new Date().toISOString()}:{})}).eq('id',x.id),pr)}>{['borrador','enviada','aceptada','rechazada'].map(s=><option key={s} value={s}>{L(s)}</option>)}</select></div>):<Empty t="Sin propuestas."/>}</div>
  <div className="p"><h2>Tareas y seguimientos</h2><AddRow ph="Nueva tarea" date go={(t,d)=>run(supabase.from('tasks').insert({company_id:c.id,title:t,due_date:d||null}),tk)}/>
   {tk.rows.length?tk.rows.map(x=><label className="row" key={x.id}><input type="checkbox" checked={x.done} onChange={e=>run(supabase.from('tasks').update({done:e.target.checked}).eq('id',x.id),tk)}/>{x.title}{x.due_date&&` · ${x.due_date}`}</label>):<Empty t="Sin tareas."/>}</div>
  <div className="p"><h2>Servicios contratados</h2><AddRow ph="Nuevo servicio" go={t=>run(supabase.from('services').insert({company_id:c.id,name:t}),sv)}/>
   {sv.rows.length?sv.rows.map(x=><div key={x.id}>{x.name} · {L(x.status)}</div>):<Empty t="Sin servicios."/>}</div>
  <div className="p"><h2>Portal del cliente</h2><div className="row"><select value={wsid} aria-label="Espacio de cliente" onChange={async e=>{setWs(e.target.value);await run(supabase.from('companies').update({client_workspace_id:e.target.value||null}).eq('id',c.id),rp)}}>
   <option value="">Sin portal (solo panel interno)</option>{ws.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
   <small>El cliente solo accede si un administrador le da de alta en Administración.</small>
   {wsid&&<form className="row" onSubmit={upload}><input value={ti} onChange={e=>setTi(e.target.value)} placeholder="Título del documento" required/><input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} required aria-label="Archivo"/>
   <label><input type="checkbox" checked={pub} onChange={e=>setPub(e.target.checked)}/> Publicar al cliente</label><button className="b">Subir</button></form>}
   {rp.rows.map(x=><label className="row" key={x.id}><input type="checkbox" checked={x.published} onChange={e=>run(supabase.from('client_reports').update({published:e.target.checked,published_at:e.target.checked?new Date().toISOString():null}).eq('id',x.id),rp)}/>{x.title} <span className={'tag '+(x.published?'s':'i')}>{x.published?'Publicado':'Privado'}</span></label>)}</div></>
}
export function Equipo({ws,admin}:{ws:Row,admin:boolean}){
  const mm=useQ('workspace_members',q=>q.eq('workspace_id',ws.id));const pf=useQ('profiles');const [mail,setMail]=useState('');const [msg,setMsg]=useState('')
  const add=async(e:FormEvent)=>{e.preventDefault();const {error}=await supabase.rpc('add_member',{ws:ws.id,mail,r:'member'});setMsg(error?.message??'Usuario añadido.');setMail('');mm.load();pf.load()}
  return <div className="p"><h2>Usuarios autorizados</h2>{mm.rows.map(m=><div key={m.user_id}>{pf.rows.find(p=>p.id===m.user_id)?.full_name||'Usuario'} · {m.role==='admin'?'Administrador':'Miembro'}</div>)}
  {admin&&<form className="row" onSubmit={add}><input type="email" value={mail} onChange={e=>setMail(e.target.value)} placeholder="Correo de un usuario ya invitado" required aria-label="Correo"/><button className="b">Añadir</button></form>}<small>{msg}</small></div>
}
export function Admin(){
  const ws=useQ('workspaces',q=>q.eq('kind','client'));const sr=useQ('scoring_rules');const ig=useQ('integrations');const [sel,setSel]=useState('');const [mail,setMail]=useState('');const [rol,setRol]=useState('member');const [msg,setMsg]=useState('')
  const rpc=async(fn:string,a:Row,ok:string)=>{const {error}=await supabase.rpc(fn,a);setMsg(error?.message??ok);ws.load()}
  const upd=async(t:string,id:string,p:Row,r:{load:()=>void})=>{const {error}=await supabase.from(t).update(p).eq('id',id);setMsg(error?.message??'');r.load()}
  return <><h1>Administración</h1><span className="err">{msg}</span>
  <div className="p"><h2>Clientes y usuarios</h2><AddRow ph="Nuevo cliente (espacio de trabajo)" go={n=>rpc('create_client',{n},'Cliente creado.')}/>
   <form className="row" onSubmit={e=>{e.preventDefault();rpc('add_member',{ws:sel,mail,r:rol},'Usuario añadido.');setMail('')}}><select value={sel} onChange={e=>setSel(e.target.value)} required aria-label="Cliente"><option value="">Cliente…</option>{ws.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
   <input type="email" value={mail} onChange={e=>setMail(e.target.value)} placeholder="Correo del usuario" required aria-label="Correo"/><select value={rol} onChange={e=>setRol(e.target.value)} aria-label="Rol"><option value="member">Miembro</option><option value="admin">Administrador de cliente</option></select><button className="b">Dar acceso</button></form>
   <small>El usuario debe estar invitado antes desde Authentication &gt; Users de Supabase. Sin alta aquí, ninguna empresa accede al portal.</small></div>
  <div className="p"><h2>Reglas de puntuación (transparentes y configurables)</h2><AddRow ph="Criterio, p. ej. «Sin presencia web»" go={t=>supabase.from('scoring_rules').insert({name:t,criterion:t}).then(()=>sr.load())}/>
   {sr.rows.length?sr.rows.map(r=><div className="row" key={r.id}><label><input type="checkbox" checked={r.active} onChange={e=>upd('scoring_rules',r.id,{active:e.target.checked},sr)}/> {r.criterion}</label>
   <input type="number" defaultValue={r.weight} style={{width:70}} aria-label="Peso" onBlur={e=>upd('scoring_rules',r.id,{weight:+e.target.value},sr)}/></div>):<Empty t="Sin reglas definidas."/>}</div>
  <div className="p"><h2>Integraciones</h2><small>Ninguna integración está implementada: este registro solo documenta su estado.</small>
   {ig.rows.map(i=><div className="row" key={i.id}>{i.name}<select value={i.status} aria-label="Estado" onChange={e=>upd('integrations',i.id,{status:e.target.value},ig)}>{['futura','requiere_configuracion','activa'].map(s=><option key={s} value={s}>{L(s)}</option>)}</select></div>)}</div></>
}
