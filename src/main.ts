import './style.css';
import { icon } from './ui/icons';
import type { ReaderController, ReaderState } from './core/document-controller';
import { pickFiles, downloadPdf, printPdf, reservePrintWindow, getRecent, rememberRecent, clearRecent } from './platform/browser';

const app = document.querySelector<HTMLDivElement>('#app')!;
const btn = (id: string, glyph: string, label: string, extra = '') => `<button id="${id}" class="icon-button ${extra}" title="${label}" aria-label="${label}">${icon(glyph)}</button>`;
app.innerHTML = `
<div class="app-shell">
 <header class="topbar">
  <div class="brand"><span class="brand-mark">${icon('file')}</span>folio<span class="offscreen"> PDF reader</span></div>
  <div class="brand-divider"></div><span class="workspace-label">Your document workspace</span>
  <div class="top-spacer"></div><span class="privacy-pill top-privacy">${icon('shield')} On your device. Always yours.</span>
  ${btn('help','help','Keyboard shortcuts and help','help-top')}
  <button id="open" class="button primary">${icon('plus')}<span>Open PDF</span></button>
 </header>
 <main id="welcome" class="welcome">
  <div class="welcome-content">
   <div class="eyebrow">A little less friction. A little more focus.</div>
   <h1>A clear space for<br>your documents.</h1>
   <p class="intro">Read, find, and make your mark. Your PDFs stay on your device, with everything you need to get straight to the page.</p>
   <div class="welcome-grid">
    <section id="drop-zone" class="drop-zone" aria-label="Open a local PDF">
     <div class="document-stack">${icon('file')}</div><h2>Bring a document into focus</h2><p>Drop a PDF here, or choose one from your device.</p>
     <button id="choose" class="button primary">${icon('open')} Choose a PDF</button><small>No upload. No account. Just your document.</small>
    </section>
    <section class="demo-card"><div class="eyebrow">Take a look around</div><h2>Meet your new<br>reading space.</h2><p>Try our four-page field guide. Explore the reader, add a note, or fill out a form.</p><button id="demo" class="text-button">Open the field guide ${icon('arrow')}</button></section>
   </div>
   <div class="welcome-features">
    <div class="feature">${icon('shield')}<div><h3>Private by default</h3><p>Local processing. Your document stays with you.</p></div></div>
    <div class="feature">${icon('highlight')}<div><h3>Make it your own</h3><p>Highlight, draw, add text, and fill forms.</p></div></div>
    <div class="feature">${icon('download')}<div><h3>Keep the original</h3><p>Export your changes as a separate PDF.</p></div></div>
   </div>
   <section aria-labelledby="recent-heading"><div class="recent-heading"><h2 id="recent-heading">Recently opened</h2><button id="clear-recent" class="text-button">Clear history</button></div><div id="recents"></div></section>
   <p class="footer-note">FOLIO · A quieter way to work with PDFs</p>
  </div>
 </main>
 <main id="reader" class="reader" hidden>
  <div id="tabs" class="tabbar" role="tablist" aria-label="Open documents"></div>
  <div class="toolbar" role="toolbar" aria-label="Document tools">
   <div class="tool-group">${btn('toggle-sidebar','pages','Show page navigation')}${btn('toggle-search','search','Find in document (Ctrl or Command F)')}</div>
   <div class="tool-separator mobile-tool-separator"></div>
   <div class="tool-group edit-group">
    ${btn('tool-select','cursor','Select text','active')}${btn('tool-highlight','highlight','Highlight text')}${btn('tool-text','text','Add text')}${btn('tool-draw','draw','Draw')}
    <div class="tool-separator"></div>${btn('undo','undo','Undo (Ctrl or Command Z)')}${btn('redo','redo','Redo')}
   </div>
   <div class="toolbar-spacer"></div>
   <div class="tool-group zoom-group">${btn('zoom-out','minus','Zoom out')}<select id="scale" class="scale-select" aria-label="Zoom level"><option value="page-width">Fit width</option><option value="page-fit">Fit page</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select>${btn('zoom-in','plus','Zoom in')}</div>
   <div class="tool-group desktop-tools">${btn('rotate','rotate','Rotate view clockwise')}<select id="view-mode" class="view-select" aria-label="Reading mode"><option value="continuous">Scroll pages</option><option value="page">One page</option></select>${btn('properties','info','Document properties')}${btn('print','print','Open a print copy')}</div>
   <div class="tool-separator desktop-tools"></div><button id="export" class="button accent" title="Export a PDF copy (Ctrl or Command S)">${icon('download')}<span class="save-label">Export copy</span><span class="offscreen">Export PDF copy</span></button>
  </div>
  <div id="searchbar" class="searchbar" hidden><div class="search-field"><input id="search-input" type="search" placeholder="Find a word or phrase…" aria-label="Search document" autocomplete="off"></div><span id="search-status" class="search-status" aria-live="polite">Type to search</span>${btn('search-prev','chevron','Previous search result','previous-icon')}${btn('search-next','chevron','Next search result')}${btn('search-close','close','Close search')}</div>
  <div id="notice" class="notice-bar" role="status" hidden></div><div id="tool-hint" class="tool-hint" hidden></div>
  <div class="reader-body">
   <aside id="sidebar" class="sidebar" aria-label="Document navigation"><div class="sidebar-tabs">${btn('nav-pages','pages','Page thumbnails','active')}${btn('nav-outline','outline','Document outline')}${btn('nav-info','info','Document information')}${btn('sidebar-close','close','Hide navigation')}</div><div id="sidebar-content" class="sidebar-content"></div></aside>
   <section id="stage" class="stage" aria-label="PDF pages"><div id="loading" class="loading-overlay" hidden><span class="spinner"></span><span>Opening your document…</span></div></section>
  </div>
  <footer class="statusbar"><div class="page-control">${btn('page-prev','chevron','Previous page','previous-icon')}<label for="page-number" class="offscreen">Page number</label><input id="page-number" class="page-input" type="number" min="1" value="1"><span id="page-total">of 1</span>${btn('page-next','chevron','Next page')}</div><span class="privacy-pill">${icon('shield')} Local document</span><span id="status-detail" class="status-detail">Ready</span>${btn('mobile-more','info','Document actions')}</footer>
 </main>
</div>
<div id="toast" class="toast" role="status" hidden></div>
<dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title"></h2><button class="icon-button" id="dialog-close" aria-label="Close dialog">${icon('close')}</button></div><div id="dialog-body"></div><div id="dialog-actions" class="dialog-actions"></div></dialog>
<div id="drag-overlay" class="drag-overlay" hidden>Drop a PDF to open it</div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Session = { id: number; name: string; file: File; host: HTMLDivElement; controller: ReaderController; state?: ReaderState };
const sessions: Session[] = [];
let activeId = 0;
let nextId = 1;
let navMode: 'pages' | 'outline' | 'info' = 'pages';
let sidebarToken = 0;
let thumbnailObserver: IntersectionObserver | undefined;
let lastNotice = '';
let toastTimer: ReturnType<typeof setTimeout>;
let searchTimer: ReturnType<typeof setTimeout>;
let opening = false;
let exporting = false;
let cancelDialog: (()=>void)|undefined;
const active = () => sessions.find(s => s.id === activeId);
const errorText = (e: unknown) => e instanceof Error ? e.message : 'The operation could not be completed. Please try again.';
function toast(message: string, error = false) {
 clearTimeout(toastTimer); const el = $('toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
 toastTimer = setTimeout(() => { el.hidden = true; }, error ? 10000 : 6500);
}
function on(id: string, fn: () => unknown) { $(id).addEventListener('click', () => { Promise.resolve().then(fn).catch(e => toast(errorText(e), true)); }); }
function dialog(title: string, body: HTMLElement, actions: {label: string; value: string; primary?: boolean}[]): Promise<string> {
 const el = $<HTMLDialogElement>('dialog'); cancelDialog?.();
 $('dialog-title').textContent = title; $('dialog-body').replaceChildren(body); $('dialog-actions').replaceChildren();
 return new Promise(resolve => {
  let settled = false;
  const finish = (value: string) => { if(settled) return; settled = true; el.close(); el.removeEventListener('cancel', cancel); $('dialog-close').onclick = null; cancelDialog=undefined; resolve(value); };
  const cancel = (event: Event) => { event.preventDefault(); finish('cancel'); };
  el.addEventListener('cancel', cancel); $('dialog-close').onclick = () => finish('cancel');
  cancelDialog=()=>finish('cancel');
  for(const a of actions){ const b=document.createElement('button'); b.className=`button ${a.primary?'primary':''}`; b.textContent=a.label; b.onclick=()=>finish(a.value); $('dialog-actions').append(b); }
  el.showModal();
 });
}
const copy = (text: string) => { const p = document.createElement('p'); p.className='dialog-copy'; p.textContent=text; return p; };
async function askPassword(reason: number) {
 const body = document.createElement('div'); body.append(copy(reason === 2 ? 'That password was not accepted. Try again to open this document.' : 'This PDF is password protected. Its password stays on this device.'));
 const label=document.createElement('label');label.className='dialog-label';label.textContent='Document password';
 const input=document.createElement('input');input.className='dialog-input';input.type='password';input.autocomplete='off';label.append(input);body.append(label);
 const promise=dialog('Unlock your PDF',body,[{label:'Cancel',value:'cancel'},{label:'Open document',value:'open',primary:true}]);
 input.focus();input.addEventListener('keydown',e=>{if(e.key==='Enter')($('dialog-actions').lastElementChild as HTMLButtonElement)?.click();});
 return await promise==='open'?input.value:null;
}
function renderRecents() {
 const holder=$('recents');holder.replaceChildren();
 try {
  const recent=getRecent();$('clear-recent').hidden=!recent.length;
  if(!recent.length){const p=document.createElement('p');p.className='recent-empty';p.textContent='Your recent filenames will appear here. Document contents are never stored in history.';holder.append(p);return;}
  for(const file of recent.slice(0,5)) { const row=document.createElement('div');row.className='recent-row';const glyph=document.createElement('span');glyph.innerHTML=icon('file');glyph.style.flex='0';const title=document.createElement('span');title.textContent=file.name;const note=document.createElement('small');note.textContent='Select again to reopen';const button=document.createElement('button');button.className='text-button';button.textContent='Browse';button.onclick=()=>void choose();row.append(glyph,title,note,button);holder.append(row); }
 }catch(e){holder.append(copy('Recent history is unavailable in this browser. You can still open and read PDFs.'));}
}
function renderTabs() {
 const holder=$('tabs');holder.replaceChildren();
 for(const s of sessions){const tab=document.createElement('div');tab.className=`tab ${s.id===activeId?'active':''}`;const b=document.createElement('button');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(s.id===activeId));b.setAttribute('aria-controls',`document-${s.id}`);b.id=`tab-${s.id}`;b.tabIndex=s.id===activeId?0:-1;b.textContent=s.name;b.title=s.name;b.onclick=()=>activate(s.id);b.onkeydown=e=>{const index=sessions.indexOf(s);const target=e.key==='ArrowRight'?sessions[(index+1)%sessions.length]:e.key==='ArrowLeft'?sessions[(index-1+sessions.length)%sessions.length]:e.key==='Home'?sessions[0]:e.key==='End'?sessions.at(-1):undefined;if(target){e.preventDefault();activate(target.id);$(`tab-${target.id}`).focus();}};tab.append(b);
 if(s.controller.dirty){const dot=document.createElement('span');dot.className='dirty-dot';dot.title='Changes not confirmed saved';dot.setAttribute('aria-label','Unsaved changes');tab.append(dot);}
 const close=document.createElement('button');close.className='icon-button';close.setAttribute('aria-label',`Close ${s.name}`);close.disabled=!!s.state?.loading;close.innerHTML=icon('close');close.onclick=()=>void closeSession(s.id).catch(e=>toast(errorText(e),true));tab.append(close);holder.append(tab);}
}
function applyState(session: Session, state: ReaderState) {
 session.state=state; if(session.id!==activeId)return;
 $('loading').hidden=!state.loading;
 $<HTMLInputElement>('page-number').value=String(state.page||1);$<HTMLInputElement>('page-number').max=String(state.pages||1);$('page-total').textContent=`of ${state.pages||'…'}`;
 $<HTMLButtonElement>('page-prev').disabled=state.page<=1;$<HTMLButtonElement>('page-next').disabled=state.page>=state.pages;
 $<HTMLButtonElement>('undo').disabled=!state.canUndo;$<HTMLButtonElement>('redo').disabled=!state.canRedo;
 for(const tool of ['highlight','text','draw'])$<HTMLButtonElement>(`tool-${tool}`).disabled=!!state.readOnlyReason||state.loading;
 $<HTMLButtonElement>('print').disabled=state.canPrint===false;
 $('notice').hidden=!state.readOnlyReason;$('notice').textContent=state.readOnlyReason||'';
  $('search-status').textContent=state.searchCount?`${state.searchCurrent||0} of ${state.searchCount}`:$<HTMLInputElement>('search-input').value?'No results':'Type to search';
 setToolUI(state.tool);
 const scale=$<HTMLSelectElement>('scale');const scaleValue=session.controller.viewer?.currentScaleValue;
 if(scaleValue==='page-width'||scaleValue==='page-fit')scale.value=scaleValue;
 else if(state.scale){let option=scale.querySelector<HTMLOptionElement>('[data-custom]');if(!option){option=document.createElement('option');option.dataset.custom='true';scale.append(option);}option.value=String(state.scale);option.textContent=`${Math.round(state.scale*100)}%`;scale.value=option.value;}
 $<HTMLSelectElement>('view-mode').value=session.controller.viewer?.scrollMode===3?'page':'continuous';
 if(state.notice&&state.notice!==lastNotice){lastNotice=state.notice;toast(state.notice);}
 $('status-detail').textContent=state.dirty?'Changes not confirmed saved':state.renderMs?`Ready · first page ${Math.round(state.renderMs)} ms`:'Ready';
 if(state.error)toast(state.error,true);
 for(const el of document.querySelectorAll<HTMLButtonElement>('.thumb-button'))el.classList.toggle('active',Number(el.dataset.page)===state.page);
 renderTabs();
}
function activate(id: number) {
 const previous=active();if(previous)previous.controller.setTool('select');
 activeId=id; const current=active();
 $('welcome').hidden=!!current;$('reader').hidden=!current;
 // PDF.js form widgets resolve some fields through document-wide queries.
 // Keep only one document DOM attached, so identical PDF field IDs cannot cross tabs.
 for(const s of sessions){if(s.id===id){s.host.hidden=false;if(!s.host.isConnected)$('stage').prepend(s.host);}else{s.host.remove();}}
 renderTabs();
 if(current){current.controller.refresh();if(current.state)applyState(current,current.state);void renderSidebar(); document.title=`${current.name} — Folio`;}
 else{document.title='Folio — your documents, your space';renderRecents();}
 $('tool-hint').hidden=true;
 $<HTMLInputElement>('search-input').value='';current?.controller.clearSearch();
 setToolUI('select');
}
async function choose() { try { const files=await pickFiles();await openFiles(files); }catch(e){toast(errorText(e),true);} }
async function openFiles(files: File[]) {
 if(opening){toast('Wait for the current document to finish opening.');return;}
 opening=true;
 try { const {ReaderController}=await import('./core/document-controller');for(const file of files){
  if(!/\.pdf$/i.test(file.name)){toast('Choose a PDF file to open in Folio.',true);continue;}
  if(sessions.length>=3){toast('Up to three documents can stay open. Close a tab before opening another.',true);break;}
  const id=nextId++;const host=document.createElement('div');host.className='document-host viewer-container';host.id=`document-${id}`;host.tabIndex=0;host.setAttribute('role','tabpanel');host.setAttribute('aria-labelledby',`tab-${id}`);$('stage').prepend(host);
  const s={} as Session;Object.assign(s,{id,name:file.name,file,host});
  s.controller=new ReaderController(host,state=>{if(s.controller)applyState(s,state);});sessions.push(s);activate(id);$('loading').hidden=false;
  try { await s.controller.open(file,askPassword);try{rememberRecent(file);}catch(e){toast(errorText(e),true);}await renderSidebar(); }
  catch(e){const index=sessions.indexOf(s);if(index>=0)sessions.splice(index,1);await s.controller.destroy();host.remove();activate(sessions.at(-1)?.id||0);toast(errorText(e),true);}
  finally{$('loading').hidden=true;}
 }}finally{opening=false;}
}
async function closeSession(id: number) {
 const s=sessions.find(x=>x.id===id);if(!s)return;
 s.controller.flushPendingEdits();
 if(s.controller.dirty){const answer=await dialog('Keep your changes?',copy('This document has changes that you have not confirmed saved. Export a PDF copy before closing, or explicitly discard the changes.'),[{label:'Keep open',value:'cancel'},{label:'Discard changes',value:'discard'},{label:'Export copy',value:'export',primary:true}]);if(answer==='export'){activate(id);await exportCopy();return;}if(answer!=='discard')return;}
 sessions.splice(sessions.indexOf(s),1);await s.controller.destroy();s.host.remove();if(id===activeId)activate(sessions.at(-1)?.id||0);else renderTabs();
}
function setToolUI(tool: string) {for(const name of ['select','highlight','text','draw']){const b=$(`tool-${name}`);b.classList.toggle('active',name===tool);b.setAttribute('aria-pressed',String(name===tool));}}
function setTool(tool:'select'|'highlight'|'text'|'draw') {const s=active();if(!s)return;s.controller.setTool(tool);setToolUI(tool);const hints={select:'',highlight:'Select text on the page to highlight it. Choose Select text to return to reading.',text:'Click or tap the page to add text. Use the editor controls to change size and color.',draw:'Draw on the page with a pointer or stylus. Switch to Select text to scroll normally.'};$('tool-hint').textContent=hints[tool];$('tool-hint').hidden=!hints[tool];}
async function renderSidebar() {
 thumbnailObserver?.disconnect();thumbnailObserver=undefined;
 const token=++sidebarToken;const s=active();const content=$('sidebar-content');for(const canvas of content.querySelectorAll('canvas')){canvas.width=0;canvas.height=0;}content.replaceChildren();if(!s||!s.controller.pageCount||$('sidebar').hidden)return;
 for(const [id,mode] of [['nav-pages','pages'],['nav-outline','outline'],['nav-info','info']])$(id).classList.toggle('active',navMode===mode);
 const title=document.createElement('h2');title.className='sidebar-title';title.textContent=navMode==='pages'?`${s.controller.pageCount} pages`:navMode==='outline'?'Document outline':'Document details';content.append(title);
 if(navMode==='pages'){
  const observer=thumbnailObserver=new IntersectionObserver(entries=>{for(const entry of entries){const b=entry.target as HTMLButtonElement;const canvas=b.querySelector('canvas')!;b.dataset.visible=String(entry.isIntersecting);if(!entry.isIntersecting){if(!b.dataset.rendering){canvas.width=0;canvas.height=0;}continue;}if(b.dataset.rendering||canvas.width)continue;b.dataset.rendering='true';void s.controller.renderThumbnail(Number(b.dataset.page),canvas).catch(()=>{b.title='Preview unavailable; select to navigate';}).finally(()=>{delete b.dataset.rendering;if(token!==sidebarToken||b.dataset.visible!=='true'){canvas.width=0;canvas.height=0;}});}},{root:content,rootMargin:'150px'});
  for(let p=1;p<=s.controller.pageCount;p++){if(token!==sidebarToken){observer.disconnect();return;}const b=document.createElement('button');b.className='thumb-button';b.style.minHeight='207px';b.dataset.page=String(p);b.setAttribute('aria-label',`Go to page ${p}`);const c=document.createElement('canvas');c.width=0;c.height=0;c.style.width='140px';c.style.height='175px';const label=document.createElement('span');label.textContent=String(p);b.append(c,label);b.onclick=()=>{s.controller.goToPage(p);if(innerWidth<760){$('sidebar').hidden=true;s.controller.refresh();}};content.append(b);observer.observe(b);}
 }else if(navMode==='outline'){
  const outline=await s.controller.getOutline();if(token!==sidebarToken)return;
  const add=(items: typeof outline,level=0)=>{for(const item of items||[]){const b=document.createElement('button');b.className='outline-item';b.style.paddingLeft=`${8+Math.min(level,5)*12}px`;b.textContent=item.title||'Untitled section';b.onclick=()=>{if(item.dest)void s.controller.goToDestination(item.dest);if(innerWidth<760)$('sidebar').hidden=true;};content.append(b);if(item.items?.length)add(item.items,level+1);}};
  if(outline?.length)add(outline);else{const p=copy('This PDF has no outline. Use page thumbnails or search to find your place.');p.className='sidebar-empty';content.append(p);}
 }else{
  content.append(copy(s.name));content.append(copy(`${s.controller.pageCount} pages · ${(s.file.size/1024).toFixed(0)} KB`));const b=document.createElement('button');b.className='button';b.textContent='View properties';b.onclick=()=>void showProperties();content.append(b);
 }
}
async function showProperties() {
 const s=active();if(!s)return;const metadata=await s.controller.getMetadata();const body=document.createElement('div');const dl=document.createElement('dl');dl.className='property-list';
 const info=(metadata?.info||{}) as unknown as Record<string,unknown>;
 const pairs=[['File',s.name],['Pages',String(s.controller.pageCount)],['Size',`${(s.file.size/1024).toFixed(1)} KB`],['Title',String(info.Title||'Not set')],['Author',String(info.Author||'Not set')],['Producer',String(info.Producer||'Not set')],['PDF version',String(info.PDFFormatVersion||'Unknown')],['Processing','Local — no document upload'],['Edits',s.state?.readOnlyReason||'Supported forms and annotations']];
 for(const [key,value]of pairs){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=value;dl.append(dt,dd);}body.append(dl);
 await dialog('Document properties',body,[{label:'Done',value:'done',primary:true}]);
}
async function exportCopy() {
 const s=active();if(!s||exporting)return;exporting=true;$<HTMLButtonElement>('export').disabled=true;
 try { const bytes=await s.controller.exportBytes();const result=downloadPdf(bytes,s.name);const answer=await dialog('Your PDF copy is ready',copy(`${result.message} Your original is unchanged. Confirm only after you have checked that the copy was saved.`),[{label:'Keep changes marked',value:'cancel'},{label:'I saved the copy',value:'saved',primary:true}]);if(answer==='saved')s.controller.markExported();renderTabs(); }
 catch(e){toast(`Export failed. Your changes remain open. ${errorText(e)}`,true);}
 finally{exporting=false;$<HTMLButtonElement>('export').disabled=false;}
}
async function printCopy() {
 const s=active();if(!s||exporting)return;if(s.state?.canPrint===false){toast('This PDF does not permit printing.',true);return;}exporting=true;
 let reserved:Window|undefined;
 try{reserved=reservePrintWindow();const bytes=await s.controller.exportBytes();const result=printPdf(bytes,s.name,reserved);toast(result.message);}catch(e){reserved?.close();toast(errorText(e),true);}finally{exporting=false;}
}
function toggleSearch(show=!$('searchbar').hidden?false:true){$('searchbar').hidden=!show;if(show)$<HTMLInputElement>('search-input').focus();else{$<HTMLInputElement>('search-input').value='';active()?.controller.clearSearch();}}
function runSearch(previous=false){const query=$<HTMLInputElement>('search-input').value;active()?.controller.search(query,previous);}
on('open',choose);on('choose',choose);on('clear-recent',()=>{clearRecent();renderRecents();});
on('demo',async()=>{const r=await fetch(`${import.meta.env.BASE_URL}demo.pdf`);if(!r.ok)throw new Error('The field guide could not load. You can open a local PDF instead.');await openFiles([new File([await r.blob()],'Folio field guide.pdf',{type:'application/pdf'})]);});
on('toggle-sidebar',()=>{$('sidebar').hidden=!$('sidebar').hidden;active()?.controller.refresh();void renderSidebar();});on('sidebar-close',()=>{$('sidebar').hidden=true;active()?.controller.refresh();});
on('nav-pages',()=>{navMode='pages';return renderSidebar();});on('nav-outline',()=>{navMode='outline';return renderSidebar();});on('nav-info',()=>{navMode='info';return renderSidebar();});
on('toggle-search',()=>toggleSearch());on('search-close',()=>toggleSearch(false));on('search-next',()=>runSearch());on('search-prev',()=>runSearch(true));
$('search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{try{runSearch();}catch(e){toast(errorText(e),true);}},180);});
$('search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch(e.shiftKey);}if(e.key==='Escape')toggleSearch(false);});
for(const tool of ['select','highlight','text','draw'] as const)on(`tool-${tool}`,()=>setTool(tool));
on('undo',()=>active()?.controller.undo());on('redo',()=>active()?.controller.redo());on('zoom-in',()=>active()?.controller.zoomIn());on('zoom-out',()=>active()?.controller.zoomOut());on('rotate',()=>active()?.controller.rotate());
$('scale').addEventListener('change',()=>{const v=$<HTMLSelectElement>('scale').value;active()?.controller.setScale(v==='page-width'||v==='page-fit'?v:Number(v));});
$('view-mode').addEventListener('change',()=>active()?.controller.setScrollMode($<HTMLSelectElement>('view-mode').value as 'continuous'|'page'));
on('page-prev',()=>{const c=active()?.controller;if(c)c.goToPage(c.currentPage-1);});on('page-next',()=>{const c=active()?.controller;if(c)c.goToPage(c.currentPage+1);});
$('page-number').addEventListener('change',()=>{const c=active()?.controller;if(c)c.goToPage(Number($<HTMLInputElement>('page-number').value));});
on('properties',showProperties);on('export',exportCopy);
// Printing must reserve its tab directly in the user's gesture before PDF serialization.
$('print').addEventListener('click',()=>void printCopy());
on('mobile-more',async()=>{const body=document.createElement('div');body.append(copy('Choose a document action. Printing opens a local PDF copy in your browser.'));
 const actions=[{label:'Rotate view',value:'rotate'},{label:'Properties',value:'properties'},{label:'Reading mode',value:'mode'},{label:'Print copy',value:'print'}];
 const result=await dialog('Document actions',body,actions);if(result==='rotate')active()?.controller.rotate();if(result==='properties')await showProperties();if(result==='mode'){const mode=$<HTMLSelectElement>('view-mode');mode.value=mode.value==='continuous'?'page':'continuous';active()?.controller.setScrollMode(mode.value as 'continuous'|'page');}if(result==='print')await printCopy();});
on('help',async()=>{const body=document.createElement('div');body.innerHTML='<p class="dialog-copy">Local PDFs stay on your device. Export creates a separate PDF; the original is never overwritten. Supported text fields and checkboxes can be filled directly on the page. Recent history stores filenames only.</p><div class="shortcut-list"><kbd>Ctrl / ⌘ O</kbd> Open a PDF<br><kbd>Ctrl / ⌘ F</kbd> Find in document<br><kbd>Ctrl / ⌘ S</kbd> Export copy<br><kbd>Ctrl / ⌘ Z</kbd> Undo annotation<br><kbd>Ctrl / ⌘ Shift Z</kbd> Redo annotation<br><kbd>Alt +</kbd> / <kbd>Alt −</kbd> Document zoom<br><kbd>Alt 0</kbd> Fit width<br><kbd>Page Up / Down</kbd> Navigate pages</div><p class="dialog-copy">Browser zoom and print shortcuts remain available. Touch: pinch to magnify the browser view; use Fit width or the zoom controls for document scale. PDF JavaScript, OCR and certificate signing are not enabled.</p>';await dialog('A few useful shortcuts',body,[{label:'Got it',value:'done',primary:true}]);});
document.addEventListener('keydown',e=>{
 if($<HTMLDialogElement>('dialog').open)return;const target=e.target as HTMLElement;const editing=target.matches('input,textarea,select,[contenteditable="true"]')||target.closest('[contenteditable="true"]');const mod=e.ctrlKey||e.metaKey;
 if(mod&&e.key.toLowerCase()==='o'){e.preventDefault();void choose();return;}
 const s=active();if(!s)return;
 if(mod&&e.key.toLowerCase()==='f'){e.preventDefault();toggleSearch(true);return;}
 if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();void exportCopy();return;}
 if(mod&&e.key.toLowerCase()==='p'){e.preventDefault();void printCopy();return;}
 if(editing)return;
 if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)s.controller.redo();else s.controller.undo();}
 else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();s.controller.redo();}
 else if(e.altKey&&['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='-')s.controller.zoomOut();else if(e.key==='0')s.controller.setScale('page-width');else s.controller.zoomIn();}
 else if(e.key==='PageDown'){e.preventDefault();s.controller.goToPage(s.controller.currentPage+1);}
 else if(e.key==='PageUp'){e.preventDefault();s.controller.goToPage(s.controller.currentPage-1);}
 else if(e.key==='Home'&&!mod){e.preventDefault();s.controller.goToPage(1);}
 else if(e.key==='End'&&!mod){e.preventDefault();s.controller.goToPage(s.controller.pageCount);}
});
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragDepth++;$('drag-overlay').hidden=false;}});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drag-overlay').hidden=true;});
document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drag-overlay').hidden=true;if(e.dataTransfer?.files.length)void openFiles([...e.dataTransfer.files]);});
window.addEventListener('beforeunload',e=>{for(const s of sessions)s.controller.flushPendingEdits();if(sessions.some(s=>s.controller.dirty)){e.preventDefault();e.returnValue='';}});
window.addEventListener('resize',()=>active()?.controller.refresh());
matchMedia('(max-width: 900px)').addEventListener('change',event=>{if(event.matches){$('sidebar').hidden=true;active()?.controller.refresh();void renderSidebar();}});
if(innerWidth<900)$('sidebar').hidden=true;
renderRecents();
if(import.meta.env.PROD&&'serviceWorker'in navigator)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>toast('Offline app caching is unavailable. Local PDF reading still works in this open tab.'));
