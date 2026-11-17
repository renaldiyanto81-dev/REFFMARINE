import React, { useEffect, useMemo, useState } from 'react';
import {
  Anchor, LayoutDashboard, Package, ShoppingCart, Truck, Users, Wallet,
  Settings, LogOut, Menu, X, Search, Plus, RefreshCw, Snowflake, Fish,
  ArrowDownToLine, ArrowUpFromLine, AlertCircle, CheckCircle2
} from 'lucide-react';
import { isConfigured, supabase } from './supabase';

const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const nav = [
  ['dashboard','Dashboard',LayoutDashboard],['inventory','Persediaan',Package],
  ['purchases','Pembelian',ArrowDownToLine],['sales','Penjualan / POS',ShoppingCart],
  ['partners','Nelayan & Pelanggan',Users],['finance','Keuangan',Wallet],['settings','Pengaturan',Settings]
];

export default function App(){
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [page,setPage] = useState('dashboard');
  const [mobileNav,setMobileNav] = useState(false);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [stats,setStats] = useState({products:0,kg:0,purchases:0,sales:0});
  const [products,setProducts] = useState([]);
  const [batches,setBatches] = useState([]);
  const [freezers,setFreezers] = useState([]);
  const [search,setSearch] = useState('');
  const [modal,setModal] = useState('');
  const [form,setForm] = useState({});
  const [saving,setSaving] = useState(false);

  useEffect(()=>{
    if(!isConfigured){setLoading(false);return;}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);});
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session) {setProfile(null);return;}
    loadProfile();
  },[session]);

  async function loadProfile(){
    const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error) setNotice('Profil belum tersedia. Minta Admin menyiapkan akun dan peran Anda.');
    setProfile(data||null);
    await loadData();
  }
  async function loadData(){
    const [p,b,f,pu,sa] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('stock_batches').select('*, products(name), freezers(name)').order('received_at',{ascending:false}),
      supabase.from('freezers').select('*').order('name'),
      supabase.from('purchases').select('id',{count:'exact',head:true}),
      supabase.from('sales').select('id',{count:'exact',head:true})
    ]);
    if(p.error) setNotice(p.error.message);
    setProducts(p.data||[]); setBatches(b.data||[]); setFreezers(f.data||[]);
    setStats({
      products:(p.data||[]).length,
      kg:(b.data||[]).reduce((a,x)=>a+Number(x.remaining_kg||0),0),
      purchases:pu.count||0,sales:sa.count||0
    });
  }
  async function signIn(e){
    e.preventDefault();setSaving(true);setNotice('');
    const {error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password});
    if(error)setNotice(error.message);
    setSaving(false);
  }
  async function signOut(){await supabase.auth.signOut();setPage('dashboard');}
  async function saveMaster(e){
    e.preventDefault();setSaving(true);setNotice('');
    const table=modal;
    const payload=table==='products'
      ? {name:form.name,sku:form.sku||null,unit:'kg',selling_price:Number(form.selling_price||0),active:true}
      : {name:form.name,notes:form.notes||null};
    const {error}=await supabase.from(table).insert(payload);
    if(error)setNotice(error.message);else{setNotice('Data berhasil disimpan.');setModal('');setForm({});await loadData();}
    setSaving(false);
  }
  const filtered = useMemo(()=>products.filter(p=>(p.name||'').toLowerCase().includes(search.toLowerCase())||(p.sku||'').toLowerCase().includes(search.toLowerCase())),[products,search]);

  if(loading)return <div className="center"><div className="loader"/>Memuat REFFMARINE…</div>;
  if(!isConfigured)return <SetupScreen/>;
  if(!session)return <Login onSubmit={signIn} form={form} setForm={setForm} saving={saving} notice={notice}/>;

  return <div className="app-shell">
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="brand"><div className="brand-mark"><Fish size={23}/></div><div><b>REFFMARINE</b><small>MANAGEMENT SYSTEM</small></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="workspace"><span className="online-dot"/> GUDANG PUSAT <small>Operasional</small></div>
      <div className="nav-label">MENU UTAMA</div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>{setPage(id);setMobileNav(false);}}><Icon size={18}/><span>{label}</span>{id==='inventory'&&<em>{stats.products}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{(profile?.full_name||session.user.email||'A').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name||session.user.email}</b><small>{profile?.role||'Menunggu peran'}</small></div></div><button className="logout" onClick={signOut}><LogOut size={17}/> Keluar</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="hamb" onClick={()=>setMobileNav(true)}><Menu/></button><div><span className="crumb">REFFMARINE</span><span className="slash">/</span><b>{nav.find(x=>x[0]===page)?.[1]}</b></div><div className="top-right"><span className="secure"><span className="online-dot"/> DATABASE ONLINE</span><button className="icon-btn" onClick={loadData} title="Muat ulang"><RefreshCw size={17}/></button></div></header>
      <section className="content">
        {notice&&<div className="notice"><AlertCircle size={17}/>{notice}<button onClick={()=>setNotice('')}>×</button></div>}
        {page==='dashboard'&&<Dashboard stats={stats} batches={batches} products={products} profile={profile}/>}
        {page==='inventory'&&<Inventory products={filtered} batches={batches} freezers={freezers} search={search} setSearch={setSearch} onAdd={()=>{setModal('products');setForm({});}}/>}
        {page==='purchases'&&<Coming title="Pembelian dari Nelayan" desc="Pencatatan pembelian, harga beli, berat bersih, batch, dan penempatan freezer."/>}
        {page==='sales'&&<Coming title="Penjualan / POS" desc="Keranjang multi-ikan, harga jual aktif, pembayaran tunai/transfer/tempo, dan pengurangan stok otomatis."/>}
        {page==='partners'&&<Coming title="Nelayan & Pelanggan" desc="Data pemasok nelayan, pelanggan, kontak, dan riwayat transaksi."/>}
        {page==='finance'&&<Coming title="Keuangan" desc="Kas masuk/keluar, transfer, piutang pelanggan, utang pemasok, dan ringkasan laba rugi."/>}
        {page==='settings'&&<SettingsPage profile={profile} freezers={freezers} onAdd={()=>{setModal('freezers');setForm({});}}/>}
      </section>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal('')}><form className="modal" onSubmit={saveMaster}><div className="modal-head"><h3>{modal==='products'?'Tambah jenis ikan':'Tambah freezer'}</h3><button type="button" onClick={()=>setModal('')}>×</button></div><label>Nama</label><input required value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder={modal==='products'?'Contoh: Tuna':'Contoh: Freezer A'}/>{modal==='products'?<><label>Kode / SKU (opsional)</label><input value={form.sku||''} onChange={e=>setForm({...form,sku:e.target.value})}/><label>Harga jual per kg (Rp)</label><input type="number" min="0" required value={form.selling_price||''} onChange={e=>setForm({...form,selling_price:e.target.value})}/></>:<><label>Catatan (opsional)</label><input value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></>}<button className="primary full" disabled={saving}>{saving?'Menyimpan…':'Simpan data'}</button></form></div>}
  </div>;
}

function SetupScreen(){return <div className="setup-wrap"><div className="setup-card"><div className="brand-mark big"><Fish size={30}/></div><p className="eyebrow">PERSIAPAN APLIKASI</p><h1>REFFMARINE</h1><p className="muted">Aplikasi sudah disiapkan. Hubungkan database Supabase untuk mengaktifkan login dan penyimpanan online.</p><ol><li>Buat project Supabase.</li><li>Jalankan file <b>supabase/schema.sql</b> di SQL Editor.</li><li>Salin URL project dan anon/public key ke file <b>.env.local</b>.</li><li>Jalankan aplikasi atau deploy ke Cloudflare Pages.</li></ol><div className="code-hint">VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_ANON_KEY=…</div><p className="tiny">Jangan pernah memasukkan service_role key ke aplikasi frontend.</p></div></div>}
function Login({onSubmit,form,setForm,saving,notice}){return <div className="login-wrap"><div className="login-art"><div className="art-circle"/><div className="art-content"><div className="brand-mark big"><Fish size={32}/></div><p className="eyebrow">FROZEN FISH DISTRIBUTION</p><h1>Kelola bisnis ikan<br/><i>lebih terarah.</i></h1><p>Satu sistem untuk stok, pembelian, penjualan, dan keuangan.</p><div className="art-foot">REFFMARINE • MANAGEMENT SYSTEM</div></div></div><div className="login-panel"><div className="login-box"><p className="eyebrow">SELAMAT DATANG</p><h2>Masuk ke akun</h2><p className="muted">Gunakan akun yang diberikan Admin.</p>{notice&&<div className="notice">{notice}</div>}<form onSubmit={onSubmit}><label>Email</label><input type="email" required placeholder="nama@email.com" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/><label>Password</label><input type="password" required placeholder="Masukkan password" value={form.password||''} onChange={e=>setForm({...form,password:e.target.value})}/><button className="primary full" disabled={saving}>{saving?'Memeriksa…':'Masuk'}</button></form><p className="tiny">Akses hanya untuk pengguna terdaftar.</p></div></div></div>}
function Dashboard({stats,batches,products,profile}){const low=batches.filter(b=>Number(b.remaining_kg)<10&&Number(b.remaining_kg)>0);return <><div className="page-heading"><div><p className="eyebrow">RINGKASAN OPERASIONAL</p><h1>Dashboard</h1><p className="muted">Pantau kondisi gudang dan aktivitas REFFMARINE.</p></div><span className="date-chip">GUDANG PUSAT</span></div><div className="welcome"><div><span>HALO, {profile?.full_name?.toUpperCase()||'TIM REFFMARINE'}</span><h2>Operasional lebih rapi,<br/>bisnis lebih terkendali.</h2><p>Semua data tersimpan dalam satu database terpusat.</p></div><div className="welcome-icon"><Anchor size={62}/></div></div><div className="stat-grid"><Stat icon={Package} label="Jenis ikan" value={stats.products} suffix="jenis" tone="blue"/><Stat icon={Snowflake} label="Total stok tersedia" value={stats.kg.toLocaleString('id-ID')} suffix="kg" tone="cyan"/><Stat icon={ArrowDownToLine} label="Transaksi pembelian" value={stats.purchases} suffix="transaksi" tone="orange"/><Stat icon={ShoppingCart} label="Transaksi penjualan" value={stats.sales} suffix="transaksi" tone="green"/></div><div className="panel-grid"><div className="panel"><div className="panel-title"><div><h3>Stok per batch</h3><p className="muted">Ringkasan stok berdasarkan penerimaan</p></div><span className="tag">LIVE DATA</span></div>{batches.length?<div className="table-wrap"><table><thead><tr><th>Jenis ikan</th><th>Batch</th><th>Freezer</th><th>Sisa stok</th></tr></thead><tbody>{batches.slice(0,6).map(b=><tr key={b.id}><td><b>{b.products?.name||'—'}</b></td><td>{b.batch_code||'—'}</td><td>{b.freezers?.name||'—'}</td><td><b>{Number(b.remaining_kg).toLocaleString('id-ID')} kg</b></td></tr>)}</tbody></table></div>:<Empty text="Belum ada data batch. Catat pembelian untuk mulai mengisi stok."/>}</div><div className="panel"><div className="panel-title"><div><h3>Perlu diperhatikan</h3><p className="muted">Peringatan stok</p></div><AlertCircle size={19} color="#d28b37"/></div>{low.length?<div className="alert-list">{low.map(b=><div className="alert-row" key={b.id}><span className="alert-icon"><AlertCircle/></span><div><b>{b.products?.name}</b><small>{b.freezers?.name||'Freezer belum ditentukan'}</small></div><strong>{b.remaining_kg} kg</strong></div>)}</div>:<Empty text="Belum ada peringatan stok menipis."/>}</div></div></>}
function Stat({icon:Icon,label,value,suffix,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div><p>{label}</p><div className="stat-value">{value}<small>{suffix}</small></div></div></div>}
function Inventory({products,batches,freezers,search,setSearch,onAdd}){return <><div className="page-heading"><div><p className="eyebrow">GUDANG PUSAT</p><h1>Persediaan ikan</h1><p className="muted">Pantau jenis ikan, batch, dan lokasi freezer.</p></div><button className="primary" onClick={onAdd}><Plus size={17}/> Jenis ikan</button></div><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Cari nama ikan atau SKU…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{products.length} jenis ikan</span></div><div className="panel"><div className="panel-title"><div><h3>Daftar jenis ikan</h3><p className="muted">Harga jual aktif per kilogram</p></div></div>{products.length?<div className="table-wrap"><table><thead><tr><th>Nama ikan</th><th>SKU</th><th>Harga jual / kg</th><th>Status</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku||'—'}</td><td>{money(p.selling_price)}</td><td><span className="status">Aktif</span></td></tr>)}</tbody></table></div>:<Empty text="Belum ada jenis ikan. Tambahkan data jenis ikan terlebih dahulu."/>}</div><div className="panel batch-panel"><div className="panel-title"><div><h3>Stok berdasarkan batch & freezer</h3><p className="muted">Sisa stok fisik per lokasi penyimpanan</p></div><span className="tag">{freezers.length} FREEZER</span></div>{batches.length?<div className="table-wrap"><table><thead><tr><th>Jenis ikan</th><th>Kode batch</th><th>Freezer</th><th>Berat tersisa</th><th>Tanggal masuk</th></tr></thead><tbody>{batches.map(b=><tr key={b.id}><td>{b.products?.name||'—'}</td><td>{b.batch_code||'—'}</td><td>{b.freezers?.name||'—'}</td><td><b>{b.remaining_kg} kg</b></td><td>{b.received_at?new Date(b.received_at).toLocaleDateString('id-ID'):'—'}</td></tr>)}</tbody></table></div>:<Empty text="Belum ada batch stok. Stok akan tercatat setelah transaksi pembelian dimasukkan."/>}</div></>}
function SettingsPage({profile,freezers,onAdd}){return <><div className="page-heading"><div><p className="eyebrow">KONFIGURASI</p><h1>Pengaturan</h1><p className="muted">Informasi akun dan gudang.</p></div></div><div className="panel settings-panel"><h3>Profil pengguna</h3><div className="setting-line"><span>Nama</span><b>{profile?.full_name||'Belum diatur'}</b></div><div className="setting-line"><span>Peran</span><b>{profile?.role||'Belum ditetapkan'}</b></div><div className="setting-line"><span>Gudang</span><b>Gudang Pusat</b></div></div><div className="panel settings-panel"><div className="panel-title"><div><h3>Daftar freezer</h3><p className="muted">Lokasi penyimpanan di gudang pusat.</p></div><button className="secondary" onClick={onAdd}><Plus size={16}/> Tambah freezer</button></div>{freezers.length?freezers.map(f=><div className="setting-line" key={f.id}><span><Snowflake size={15}/> {f.name}</span><b>{f.notes||'Aktif'}</b></div>):<Empty text="Belum ada freezer terdaftar."/>}</div></>}
function Coming({title,desc}){return <><div className="page-heading"><div><p className="eyebrow">MODUL REFFMARINE</p><h1>{title}</h1><p className="muted">{desc}</p></div></div><div className="panel coming"><div className="coming-icon"><CheckCircle2 size={28}/></div><h3>Modul masuk dalam tahap pembangunan</h3><p className="muted">Struktur database dan alur transaksi disiapkan bertahap agar pencatatan stok dan keuangan tetap konsisten.</p></div></>}
function Empty({text}){return <div className="empty"><Package size={25}/><p>{text}</p></div>}
