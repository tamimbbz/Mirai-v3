async function $(sel){ return document.querySelector(sel); }

const statusEl = document.getElementById('status');
const activateBtn = document.getElementById('activate');
const stopBtn = document.getElementById('stop');
const toast = document.getElementById('toast');

function showToast(msg, ok=true){
  toast.textContent = msg;
  toast.style.color = ok ? '#b7ffc6' : '#ffb3b3';
}

async function refreshStatus(){
  try{
    const r = await fetch('/status');
    const j = await r.json();
    if(j.status === 'running'){ statusEl.textContent = 'ONLINE'; statusEl.className='status on'; }
    else { statusEl.textContent = 'OFFLINE'; statusEl.className='status off'; }
  }catch(e){ statusEl.textContent = 'OFFLINE'; statusEl.className='status off'; }
}

activateBtn.addEventListener('click', async ()=>{
  const name = document.getElementById('name').value.trim();
  const prefix = document.getElementById('prefix').value.trim();
  const adminUID = document.getElementById('admin').value.trim();
  const appstate = document.getElementById('appstate').value.trim();

  if(!name || !prefix || !adminUID || !appstate){
    showToast('Fill all fields (AppState required)', false); return;
  }

  showToast('Activating...');
  try{
    const resp = await fetch('/activate', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ name, prefix, adminUID, appstate })
    });
    const j = await resp.json();
    if(resp.ok) { showToast('Bot started (pid: '+ j.pid +')'); }
    else { showToast(j.error || 'Failed to start', false); }
  }catch(e){ showToast(e.message, false); }
  setTimeout(refreshStatus, 800);
});

stopBtn.addEventListener('click', async ()=>{
  showToast('Stopping...');
  try{
    const resp = await fetch('/stop', { method:'POST' });
    const j = await resp.json();
    if(resp.ok) showToast('Bot stopped'); else showToast(j.error || 'Stop failed', false);
  }catch(e){ showToast(e.message, false); }
  setTimeout(refreshStatus, 600);
});

// initial
refreshStatus();
setInterval(refreshStatus, 5000);
```
