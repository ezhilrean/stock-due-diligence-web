(() => {
  const config = window.SUPABASE_CONFIG || {};
  const $ = id => document.getElementById(id);
  const ready = !!(window.supabase && config.url && config.anonKey &&
    !config.url.includes("YOUR_PROJECT_REF") && !config.anonKey.includes("YOUR_SUPABASE"));
  let client = null, user = null, documents = [], mode = "login", saveQueue = Promise.resolve();
  const defaultStocks = () => [
    {ticker:'MSFT',name:'Microsoft',sector:'Technology',price:428.5,change:1.2,pe:35.2,growth:15,score:91},
    {ticker:'AAPL',name:'Apple',sector:'Technology',price:213.4,change:-.4,pe:31.5,growth:6,score:84},
    {ticker:'NVDA',name:'NVIDIA',sector:'Technology',price:142.7,change:2.6,pe:42.8,growth:38,score:88},
    {ticker:'JPM',name:'JPMorgan Chase',sector:'Financials',price:276.2,change:.7,pe:12.8,growth:8,score:82},
    {ticker:'LLY',name:'Eli Lilly',sector:'Healthcare',price:793.1,change:-1.1,pe:54.3,growth:22,score:79},
    {ticker:'COST',name:'Costco',sector:'Consumer',price:958.2,change:.3,pe:52.4,growth:9,score:85}
  ];
  function message(text, error=false) {
    const el=$('auth-message'); if(el){el.textContent=text;el.style.color=error?'var(--red)':'var(--accent)';}
  }
  function showAuth() {
    document.body.classList.remove('authenticated');
    $('auth-screen').hidden=false;$('app-shell').hidden=true;
  }
  function showApp() {
    document.body.classList.add('authenticated');
    $('auth-screen').hidden=true;$('app-shell').hidden=false;
    $('account-email').textContent=user?.email||'Signed in';
  }
  function setMode(next) {
    mode=next;
    const signup=mode==='signup';
    $('auth-title').textContent=signup?'Create your account':'Welcome back';
    $('auth-subtitle').textContent=signup?'Create a private workspace for your investment research.':'Sign in to access your saved watchlist, valuations, notes, and reports.';
    $('auth-name-wrap').hidden=!signup;
    $('auth-name').required=signup;
    $('auth-password').autocomplete=signup?'new-password':'current-password';
    $('auth-submit').textContent=signup?'Create account':'Sign in';
    $('auth-toggle').textContent=signup?'I already have an account':'Create an account';
    $('auth-reset').hidden=signup;
    message('');
  }
  function fail(error) { message(error?.message || 'Something went wrong. Please try again.',true); }
  function save(operation) {
    if(!user || !client) return Promise.resolve();
    saveQueue=saveQueue.then(operation).catch(e=>console.error('Supabase save failed:',e));
    return saveQueue;
  }
  async function persistWatchlist() {
    if(!user) return;
    const rows=stocks.map(s=>({user_id:user.id,ticker:s.ticker,name:s.name,sector:s.sector,price:s.price,daily_change:s.change,pe_ratio:s.pe,revenue_growth:s.growth,quality_score:s.score}));
    const {error:delError}=await client.from('watchlist').delete().eq('user_id',user.id);
    if(delError) throw delError;
    if(rows.length){const {error}=await client.from('watchlist').insert(rows);if(error)throw error;}
  }
  async function persistChecklist() {
    const rows=tasks.map((task,i)=>({user_id:user.id,task_key:String(i),completed:done.has(i)}));
    const {error}=await client.from('checklist_progress').upsert(rows,{onConflict:'user_id,task_key'});
    if(error)throw error;
  }
  async function persistDcf() {
    const values={fcf:$('fcf').value,growth:$('growth').value,wacc:$('wacc').value,terminal:$('terminal').value,cash:$('cash').value,shares:$('shares').value,market:$('market').value};
    const {error}=await client.from('dcf_models').upsert({user_id:user.id,model_key:'default',assumptions:values,updated_at:new Date().toISOString()},{onConflict:'user_id,model_key'});
    if(error)throw error;
  }
  async function loadWorkspace() {
    const [watch,checks,dcf,docs]=await Promise.all([
      client.from('watchlist').select('*').order('created_at',{ascending:true}),
      client.from('checklist_progress').select('*'),
      client.from('dcf_models').select('*').eq('model_key','default').maybeSingle(),
      client.from('research_documents').select('*').order('updated_at',{ascending:false})
    ]);
    for(const result of [watch,checks,dcf,docs]) if(result.error) throw result.error;
    if(watch.data.length) {
      stocks=watch.data.map(s=>({ticker:s.ticker,name:s.name,sector:s.sector,price:Number(s.price),change:Number(s.daily_change),pe:Number(s.pe_ratio),growth:Number(s.revenue_growth),score:Number(s.quality_score)}));
    } else {
      stocks=defaultStocks();
      await persistWatchlist();
    }
    done.clear();
    (checks.data||[]).forEach(c=>{if(c.completed){const i=Number(c.task_key);if(Number.isInteger(i)&&i>=0&&i<tasks.length)done.add(i);}});
    if(dcf.data?.assumptions) {
      const a=dcf.data.assumptions;
      for(const id of ['fcf','growth','wacc','terminal','cash','shares','market']) if(a[id]!==undefined) $(id).value=a[id];
    } else await persistDcf();
    documents=docs.data||[];
    overview();renderStocks();renderChecks();calc();renderDocuments();populateDocumentCompanies();
  }
  async function enterSession(nextUser) {
    user=nextUser;showApp();
    try { await loadWorkspace(); }
    catch(e) { console.error(e); alert('Signed in, but workspace data could not load. Check that the Supabase SQL schema has been applied. '+(e.message||'')); }
  }
  function populateDocumentCompanies() {
    const select=$('doc-company'); if(!select)return;
    const old=select.value;
    select.innerHTML=stocks.map(s=>'<option value="'+String(s.ticker).replace(/["&<>]/g,'')+'">'+String(s.ticker).replace(/[&<>]/g,'')+' — '+String(s.name).replace(/[&<>]/g,'')+'</option>').join('');
    if(old && stocks.some(s=>s.ticker===old))select.value=old;
  }
  function renderDocuments() {
    $('doc-count').textContent=documents.length+' document'+(documents.length===1?'':'s');
    $('doc-list').innerHTML=documents.length?documents.map(d=>'<article class="doc-item"><h3>'+esc(d.title)+' · '+esc(d.ticker)+'</h3><p>'+esc(d.content)+'</p><small>'+esc(d.document_type)+' · Updated '+new Date(d.updated_at).toLocaleString()+'</small> <button class="btn" data-delete-doc="'+d.id+'">Delete</button></article>').join(''):'<p class="muted">No saved notes yet. Add a research note or company report above.</p>';
    $('doc-list').querySelectorAll('[data-delete-doc]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete this saved document?'))return;
      const {error}=await client.from('research_documents').delete().eq('id',b.dataset.deleteDoc).eq('user_id',user.id);
      if(error){alert(error.message);return;} documents=documents.filter(d=>d.id!==b.dataset.deleteDoc);renderDocuments();
    });
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function start() {
    if(!ready) {
      showAuth();setMode('login');
      message('Setup required: add your Supabase Project URL and anon/publishable key to supabase-config.js, then apply supabase/schema.sql.',true);
      $('auth-form').onsubmit=e=>{e.preventDefault();message('Configure Supabase first. Follow SETUP.md in the GitHub repository.',true);};
      $('google-signin').onclick=()=>message('Configure Supabase first. Follow SETUP.md in the GitHub repository.',true);
      $('auth-toggle').onclick=()=>setMode(mode==='login'?'signup':'login');
      $('auth-reset').onclick=()=>message('Configure Supabase first, then use password reset.');
      return;
    }
    client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('auth-toggle').onclick=()=>setMode(mode==='login'?'signup':'login');
    $('auth-reset').onclick=async()=>{
      const email=$('auth-email').value.trim();if(!email){message('Enter your email first.',true);return;}
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      error?fail(error):message('If an account exists for that email, a password-reset link has been sent.');
    };
    $('auth-form').onsubmit=async e=>{
      e.preventDefault();const email=$('auth-email').value.trim(),password=$('auth-password').value;
      $('auth-submit').disabled=true;message(mode==='signup'?'Creating account…':'Signing in…');
      try {
        if(mode==='signup') {
          const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:$('auth-name').value.trim()},emailRedirectTo:location.origin+location.pathname}});
          if(error)throw error;
          if(data.session) await enterSession(data.user);
          else message('Account created. Check your email to confirm the address, then sign in.');
        } else {
          const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await enterSession(data.user);
        }
      } catch(err){fail(err);} finally {$('auth-submit').disabled=false;}
    };
    $('google-signin').onclick=async()=>{
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)fail(error);
    };
    $('sign-out').onclick=async()=>{await client.auth.signOut();user=null;showAuth();setMode('login');};
    $('research-form').onsubmit=async e=>{
      e.preventDefault();if(!user)return;
      $('doc-status').textContent='Saving…';
      const row={user_id:user.id,ticker:$('doc-company').value,document_type:$('doc-type').value,title:$('doc-title').value.trim(),content:$('doc-body').value.trim()};
      const {data,error}=await client.from('research_documents').insert(row).select().single();
      if(error){$('doc-status').textContent=error.message;return;}
      documents.unshift(data);renderDocuments();$('doc-title').value='';$('doc-body').value='';$('doc-status').textContent='Saved to your account.';
    };
    $('add-form').addEventListener('submit',()=>setTimeout(()=>save(persistWatchlist),0));
    $('reset').addEventListener('click',()=>save(persistChecklist));
    $('checks').addEventListener('change',()=>save(persistChecklist));
    $('quick').addEventListener('change',()=>save(persistChecklist));
    ['fcf','growth','wacc','terminal','cash','shares','market'].forEach(id=>$(id).addEventListener('change',()=>save(persistDcf)));
    const {data:{session},error}=await client.auth.getSession();if(error){fail(error);showAuth();return;}
    if(session)await enterSession(session.user);else showAuth();
    client.auth.onAuthStateChange((event,session)=>{if(session&&(!user||user.id!==session.user.id))setTimeout(()=>enterSession(session.user),0);else if(!session){user=null;showAuth();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();