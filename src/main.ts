import './style.css';
import { icon } from './ui/icons';
import type { ReaderController, ReaderState } from './core/document-controller';
import { pickFiles, downloadPdf, exportedPdfName, printPdf, reservePrintWindow, getRecent, rememberRecent, clearRecent } from './platform/browser';
import { saveNativePdfCopy } from './platform/native-save';
import { createDeviceLibrary } from './features/device-library';
import { createDocumentTools } from './features/document-tools';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { registerNativeCloseGuard } from './platform/native-close';

const app = document.querySelector<HTMLDivElement>('#app')!;
const btn = (id: string, glyph: string, label: string, extra = '') => `<button id="${id}" class="icon-button ${extra}" title="${label}" aria-label="${label}">${icon(glyph)}</button>`;
app.innerHTML = `
<div class="app-shell">
 <a class="skip-link" href="#welcome">Skip to workspace</a>
 <header class="topbar">
  <div class="brand"><span class="brand-mark">${icon('file')}</span>folio<span class="offscreen"> PDF reader</span></div>
  <div class="brand-divider"></div><span class="workspace-label">Your document workspace</span>
  <div class="top-spacer"></div><span class="privacy-pill top-privacy">${icon('shield')} On your device. Always yours.</span>
  ${btn('help','help','Keyboard shortcuts and help','help-top')}
  ${btn('library','open','Device library')}${btn('account','account','Account')}
  <button id="open" class="button primary">${icon('plus')}<span>Open PDF</span></button>
 </header>
 <main id="welcome" class="welcome" tabindex="-1">
  <div class="welcome-content">
   <div class="eyebrow">A little less friction. A little more focus.</div>
   <h1>A clear space for<br>your documents.</h1>
   <p class="intro">Read, find, and make your mark. Your PDFs stay on your device, with everything you need to get straight to the page.</p>
   <div class="welcome-grid">
    <section id="drop-zone" class="drop-zone" aria-label="Open a local PDF">
     <div class="document-stack">${icon('file')}</div><h2>Bring a document into focus</h2><p>Drop a PDF here, or choose one from your device.</p>
     <button id="choose" class="button primary">${icon('open')} Choose a PDF</button><small>Read without an account. Store a copy on this device when you choose.</small>
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
  <div class="tab-strip"><div id="tabs" class="tabbar" role="tablist" aria-label="Open documents"></div>${btn('close-active-document','close','Close active document')}</div>
  <div class="toolbar" role="group" aria-label="Document tools">
   <div class="tool-group">${btn('toggle-sidebar','pages','Show page navigation')}${btn('toggle-search','search','Find in document (Ctrl or Command F)')}</div>
   <div class="tool-separator mobile-tool-separator"></div>
   <div class="tool-group edit-group">
    ${btn('tool-select','cursor','Select text','active')}${btn('tool-highlight','highlight','Highlight text')}${btn('tool-text','text','Add text')}${btn('tool-draw','draw','Draw')}
    <div class="tool-separator"></div>${btn('undo','undo','Undo (Ctrl or Command Z)')}${btn('redo','redo','Redo')}${btn('store-local','open','Store on this device')}${btn('document-tools','info','More document tools')}
   </div>
   <div class="toolbar-spacer"></div>
   <div class="tool-group zoom-group">${btn('zoom-out','minus','Zoom out')}<span class="select-shell"><select id="scale" class="scale-select" aria-label="Zoom level"><option value="page-width">Fit width</option><option value="page-fit">Fit page</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select></span>${btn('zoom-in','plus','Zoom in')}</div>
   <div class="tool-group desktop-tools">${btn('rotate','rotate','Rotate view clockwise')}<span class="select-shell view-mode-control"><select id="view-mode" class="view-select" aria-label="Reading mode"><option value="continuous">Scroll pages</option><option value="page">One page</option></select></span>${btn('properties','info','Document properties')}${btn('print','print','Open a print copy')}</div>
   <div class="tool-separator desktop-tools"></div><button id="export" class="button accent" title="Export a PDF copy (Ctrl or Command S)">${icon('download')}<span class="save-label">Export copy</span><span class="offscreen">Export PDF copy</span></button>
  </div>
  <div id="searchbar" class="searchbar" hidden><div class="search-field"><input id="search-input" type="search" placeholder="Find a word or phrase…" aria-label="Search document" autocomplete="off"></div><span id="search-status" class="search-status" aria-live="polite">Type to search</span>${btn('search-prev','chevron','Previous search result','previous-icon')}${btn('search-next','chevron','Next search result')}${btn('search-close','close','Close search')}</div>
  <div id="notice" class="notice-bar" role="status" hidden></div><div id="tool-hint" class="tool-hint" role="status" hidden></div><div id="recovery-status" class="recovery-status" role="status" aria-live="polite" hidden></div>
  <div class="reader-body">
   <aside id="sidebar" class="sidebar" aria-label="Document navigation"><div class="sidebar-tabs">${btn('nav-pages','pages','Page thumbnails','active')}${btn('nav-outline','outline','Document outline')}${btn('nav-info','info','Document information')}${btn('sidebar-close','close','Hide navigation')}</div><div id="sidebar-content" class="sidebar-content"></div></aside>
   <section id="stage" class="stage" aria-label="PDF pages" tabindex="-1"><div id="loading" class="loading-overlay" hidden><span class="spinner"></span><span>Opening your document…</span></div></section>
  </div>
  <footer class="statusbar"><div class="page-control">${btn('page-prev','chevron','Previous page','previous-icon')}<label for="page-number" class="offscreen">Page number</label><input id="page-number" class="page-input" type="number" min="1" value="1"><span id="page-total">of 1</span>${btn('page-next','chevron','Next page')}</div><span class="privacy-pill">${icon('shield')} Local document</span><span id="status-detail" class="status-detail">Ready</span>${btn('mobile-more','info','Document actions')}</footer>
 </main>
</div>
<div id="toast" class="toast" aria-hidden="true" hidden></div>
<div id="notification-status" class="offscreen" role="status" aria-atomic="true"></div>
<div id="reader-status" class="offscreen" role="status" aria-atomic="true"></div>
<span id="unsaved-description" class="offscreen">Changes not confirmed saved</span>
<dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><h2 id="dialog-title"></h2><button class="icon-button" id="dialog-close" aria-label="Close dialog">${icon('close')}</button></div><div id="dialog-body"></div><div id="dialog-actions" class="dialog-actions"></div></dialog>
<div id="drag-overlay" class="drag-overlay" hidden>Drop a PDF to open it</div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Session = { id: number; name: string; file: File; panel: HTMLDivElement; host: HTMLDivElement; controller: ReaderController; state?: ReaderState; closing?: boolean; position?: { page: number; top: number; left: number; width: number } };
const sessions: Session[] = [];
const tabElements = new Map<number, HTMLDivElement>();
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
let closingApplication = false;
let cancelDialog: (()=>void)|undefined;
const active = () => sessions.find(s => s.id === activeId);
const errorText = (e: unknown) => e instanceof Error ? e.message : 'The operation could not be completed. Please try again.';
function setText(id: string, text: string) { const el=$(id);if(el.textContent!==text)el.textContent=text; }
function focusWorkspace() { if(!$<HTMLDialogElement>('dialog').open)(active()?.host||$('choose')).focus(); }
function canFocus(el: HTMLElement | null): el is HTMLElement { return !!el?.isConnected&&el.getClientRects().length>0&&!el.closest('[hidden],[inert]')&&!el.matches(':disabled'); }
function toast(message: string, error = false) {
 clearTimeout(toastTimer); const el = $('toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
 setText('notification-status',message);
 toastTimer = setTimeout(() => { el.hidden = true; }, error ? 10000 : 6500);
}
function on(id: string, fn: () => unknown) { $(id).addEventListener('click', () => { Promise.resolve().then(fn).catch(e => toast(errorText(e), true)); }); }
function dialog(title: string, body: HTMLElement, actions: {label: string; value: string; primary?: boolean}[], origin?: HTMLElement): Promise<string> {
 const el = $<HTMLDialogElement>('dialog'); cancelDialog?.();
 // WebKit on macOS does not focus buttons on pointer activation. Preserve the
 // actual initiating control explicitly instead of inferring it from focus.
 const returnFocus=origin||(document.activeElement instanceof HTMLElement?document.activeElement:null);
 $('dialog-title').textContent = title; $('dialog-body').replaceChildren(body); $('dialog-actions').replaceChildren();
 return new Promise(resolve => {
  let settled = false;
  const finish = (value: string) => { if(settled) return; settled = true; el.close(); el.removeEventListener('cancel', cancel); $('dialog-close').onclick = null; cancelDialog=undefined;if(canFocus(returnFocus))returnFocus.focus();else focusWorkspace();resolve(value); };
  const cancel = (event: Event) => { event.preventDefault(); finish('cancel'); };
  el.addEventListener('cancel', cancel); $('dialog-close').onclick = () => finish('cancel');
  cancelDialog=()=>finish('cancel');
  for(const a of actions){ const b=document.createElement('button'); b.className=`button ${a.primary?'primary':''}`; b.textContent=a.label; b.onclick=()=>finish(a.value); $('dialog-actions').append(b); }
  el.showModal();
 });
}
const copy = (text: string) => { const p = document.createElement('p'); p.className='dialog-copy'; p.textContent=text; return p; };
const featureHooks = {
 active, sessions: () => sessions,
 async openFile(file: File) { await openFiles([file]); return sessions.find(session => session.file === file); },
 activate, dialog, dismissDialog: () => cancelDialog?.(), toast,
 refreshStatus() { const s=active(); const text=s ? deviceLibrary.status(s.id) : ''; $('recovery-status').hidden=!text;setText('recovery-status',text); },
};
const deviceLibrary = createDeviceLibrary(featureHooks);
const documentTools = createDocumentTools(featureHooks);
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
 const holder=$('tabs');
 // Keep tab buttons mounted: PDF rendering/search emits frequent state updates.
 for(const [id,tab] of tabElements)if(!sessions.some(s=>s.id===id)){tab.remove();tabElements.delete(id);}
 for(const s of sessions){
  let tab=tabElements.get(s.id);
  if(!tab){
   tab=document.createElement('div');tab.setAttribute('role','presentation');
   const b=document.createElement('button');b.setAttribute('role','tab');b.setAttribute('aria-controls',`document-${s.id}`);b.id=`tab-${s.id}`;b.textContent=s.name;b.title=s.name;
   b.onclick=()=>activate(s.id);
   b.onkeydown=e=>{const index=sessions.indexOf(s);const target=e.key==='ArrowRight'?sessions[(index+1)%sessions.length]:e.key==='ArrowLeft'?sessions[(index-1+sessions.length)%sessions.length]:e.key==='Home'?sessions[0]:e.key==='End'?sessions.at(-1):undefined;if(target){e.preventDefault();activate(target.id);$(`tab-${target.id}`).focus();}};
   tab.append(b);holder.append(tab);tabElements.set(s.id,tab);
  }
  tab.className=`tab ${s.id===activeId?'active':''}`;
  const b=tab.firstElementChild as HTMLButtonElement;b.setAttribute('aria-selected',String(s.id===activeId));b.tabIndex=s.id===activeId?0:-1;
  if(s.controller.dirty)b.setAttribute('aria-describedby','unsaved-description');else b.removeAttribute('aria-describedby');
  const dot=tab.querySelector('.dirty-dot');
  if(s.controller.dirty&&!dot){const marker=document.createElement('span');marker.className='dirty-dot';marker.title='Changes not confirmed saved';marker.setAttribute('aria-hidden','true');tab.append(marker);}else if(!s.controller.dirty)dot?.remove();
 }
 const current=active();const close=$<HTMLButtonElement>('close-active-document');close.disabled=!current||!!current.state?.loading||!!current.closing||opening||exporting||closingApplication;close.setAttribute('aria-label',current?`Close ${current.name}`:'Close active document');
}
function applyState(session: Session, state: ReaderState) {
 session.state=state; deviceLibrary.onState(session,state); if(session.id!==activeId)return;
 $('loading').hidden=!state.loading;
 $<HTMLInputElement>('page-number').value=String(state.page||1);$<HTMLInputElement>('page-number').max=String(state.pages||1);$('page-total').textContent=`of ${state.pages||'…'}`;
 $<HTMLButtonElement>('page-prev').disabled=state.page<=1;$<HTMLButtonElement>('page-next').disabled=state.page>=state.pages;
 $<HTMLButtonElement>('undo').disabled=!state.canUndo;$<HTMLButtonElement>('redo').disabled=!state.canRedo;
 for(const tool of ['highlight','text','draw'])$<HTMLButtonElement>(`tool-${tool}`).disabled=!!state.readOnlyReason||state.loading;
 $<HTMLButtonElement>('print').disabled=state.canPrint===false;
 $('notice').hidden=!state.readOnlyReason;setText('notice',state.readOnlyReason||'');
 setText('search-status',state.searchCount?`${state.searchCurrent||0} of ${state.searchCount}`:$<HTMLInputElement>('search-input').value?'No results':'Type to search');
 setToolUI(state.tool);
 const scale=$<HTMLSelectElement>('scale');const scaleValue=session.controller.viewer?.currentScaleValue;
 if(scaleValue==='page-width'||scaleValue==='page-fit')scale.value=scaleValue;
 else if(state.scale){let option=scale.querySelector<HTMLOptionElement>('[data-custom]');if(!option){option=document.createElement('option');option.dataset.custom='true';scale.append(option);}option.value=String(state.scale);option.textContent=`${Math.round(state.scale*100)}%`;scale.value=option.value;}
 $<HTMLSelectElement>('view-mode').value=session.controller.viewer?.scrollMode===3?'page':'continuous';
 if(state.notice&&state.notice!==lastNotice){lastNotice=state.notice;toast(state.notice);}
 $('status-detail').textContent=state.dirty?'Changes not confirmed saved':state.renderMs?`Ready · first page ${Math.round(state.renderMs)} ms`:'Ready';
 if(state.error)toast(state.error,true);
 for(const el of document.querySelectorAll<HTMLButtonElement>('.thumb-button')){const selected=Number(el.dataset.page)===state.page;el.classList.toggle('active',selected);if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
 if(!state.loading&&state.pages)setText('reader-status',`${session.name}. Page ${state.page} of ${state.pages}.${state.dirty?' Changes not confirmed saved.':''}`);
 renderTabs();
 featureHooks.refreshStatus();
}
function activate(id: number) {
 const previous=active();if(previous){if(previous.id!==id)previous.position={page:previous.controller.currentPage,top:previous.host.scrollTop,left:previous.host.scrollLeft,width:previous.host.clientWidth};previous.controller.setTool('select');}
 activeId=id; const current=active();
 $('welcome').hidden=!!current;$('reader').hidden=!current;
 const skip=document.querySelector<HTMLAnchorElement>('.skip-link');if(skip)skip.href=current?'#stage':'#welcome';
 // PDF.js form widgets resolve some fields through document-wide queries.
 // Keep only one document DOM attached, so identical PDF field IDs cannot cross tabs.
 for(const s of sessions){s.panel.hidden=s.id!==id;if(s.id!==id)s.host.remove();}
 if(current){current.host.hidden=false;if(!current.host.isConnected)current.panel.append(current.host);}
 renderTabs();
 if(current){current.controller.refresh();if(current.position){const position=current.position;current.controller.goToPage(position.page);if(current.host.clientWidth===position.width){current.host.scrollTop=position.top;current.host.scrollLeft=position.left;}current.controller.refresh();}if(current.state)applyState(current,current.state);void renderSidebar(); document.title=`${current.name} — Folio`;}
 else{document.title='Folio — your documents, your space';setText('reader-status','No document open.');renderRecents();}
 $('tool-hint').hidden=true;
 $<HTMLInputElement>('search-input').value='';current?.controller.clearSearch();
 setToolUI('select');
 featureHooks.refreshStatus();
}
function fileTaskBusy() { return closingApplication||opening||exporting||sessions.some(s=>s.closing)||$<HTMLDialogElement>('dialog').open; }
async function choose() {
 if(fileTaskBusy()){toast('Finish or cancel the current task before opening another PDF.');return;}
 // Reserve before awaiting the OS picker, including its cancellation path.
 opening=true;renderTabs();
 try { await loadSelectedFiles(await pickFiles()); }catch(e){toast(errorText(e),true);}
 finally{opening=false;renderTabs();}
}
async function openFiles(files: File[]) {
 if(fileTaskBusy()){toast('Finish or cancel the current task before opening another PDF.');return;}
 opening=true;renderTabs();
 try { await loadSelectedFiles(files); }finally{opening=false;renderTabs();}
}
async function loadSelectedFiles(files: File[]) {
 if(!files.length)return;
 const {ReaderController}=await import('./core/document-controller');for(const file of files){
  if(!/\.pdf$/i.test(file.name)){toast('Choose a PDF file to open in Folio.',true);continue;}
  if(sessions.length>=3){toast('Up to three documents can stay open. Close a tab before opening another.',true);break;}
  const id=nextId++;const panel=document.createElement('div');panel.className='document-panel';panel.id=`document-${id}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`tab-${id}`);
  const host=document.createElement('div');host.className='document-host viewer-container';host.tabIndex=0;host.setAttribute('role','document');host.setAttribute('aria-label',`${file.name}, PDF pages`);panel.append(host);$('stage').prepend(panel);
  const s={} as Session;Object.assign(s,{id,name:file.name,file,panel,host});
  s.controller=new ReaderController(host,state=>{if(s.controller)applyState(s,state);});sessions.push(s);activate(id);$('loading').hidden=false;
  try { await s.controller.open(file,askPassword);try{rememberRecent(file);}catch(e){toast(errorText(e),true);}await renderSidebar();if(activeId===id&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))focusWorkspace(); }
  catch(e){const index=sessions.indexOf(s);if(index>=0)sessions.splice(index,1);await s.controller.destroy();panel.remove();activate(sessions.at(-1)?.id||0);focusWorkspace();toast(errorText(e),true);}
  finally{$('loading').hidden=true;}
 }
}
async function closeSession(id: number, fromApplication = false) {
 const s=sessions.find(x=>x.id===id);if(!s||s.closing)return;
 if(opening||exporting||sessions.some(x=>x.closing)||(!fromApplication&&closingApplication)||$<HTMLDialogElement>('dialog').open){toast('Finish or cancel the current task before closing this PDF.');return;}
 // Reserve before the unsaved dialog so duplicate close requests cannot replace it.
 s.closing=true;renderTabs();
 try {
  s.controller.flushPendingEdits();
  let discard=false;
  if(s.controller.dirty){const answer=await dialog('Keep your changes?',copy('Export a PDF copy or keep your validated changes in the device library. Discard restores the version opened in this tab.'),[{label:'Keep open',value:'cancel'},{label:'Discard changes',value:'discard'},...(deviceLibrary.isStored(s.id)?[{label:'Keep in library',value:'library'}]:[]),{label:'Export copy',value:'export',primary:true}]);if(answer==='export'){activate(id);s.closing=false;await exportCopy(true);return;}if(answer!=='discard'&&answer!=='library')return;discard=answer==='discard';}
  s.host.inert=true;
  await deviceLibrary.beforeClose(s,discard);
  // Keep the live session available if worker cleanup fails.
  await s.controller.destroy();
  sessions.splice(sessions.indexOf(s),1);s.host.remove();s.panel.remove();if(id===activeId){activate(sessions.at(-1)?.id||0);if(active())$(`tab-${activeId}`).focus();else focusWorkspace();}else renderTabs();
 }finally{if(sessions.includes(s)){s.closing=false;s.host.inert=false;}renderTabs();}
}
async function prepareNativeClose(): Promise<boolean> {
 if(opening||exporting||sessions.some(s=>s.closing)||$<HTMLDialogElement>('dialog').open){toast('Finish or cancel the current task before closing Folio.');return false;}
 closingApplication=true;
 try {
  for(const session of [...sessions]){
   activate(session.id); // Show the document whose edits the close dialog describes.
   await closeSession(session.id,true);
   if(sessions.includes(session))return false; // Cancel/export keeps the native app open.
  }
  return sessions.length===0;
 }finally{if(sessions.length)closingApplication=false;renderTabs();}
}
if(isTauri())registerNativeCloseGuard(window,prepareNativeClose,()=>invoke<void>('finish_close'),error=>{closingApplication=false;toast(`Folio remains open. ${errorText(error)}`,true);});
function setToolUI(tool: string) {for(const name of ['select','highlight','text','draw']){const b=$(`tool-${name}`);b.classList.toggle('active',name===tool);b.setAttribute('aria-pressed',String(name===tool));}}
function setTool(tool:'select'|'highlight'|'text'|'draw') {const s=active();if(!s)return;s.controller.setTool(tool);setToolUI(tool);const hints={select:'',highlight:'Select text on the page to highlight it. Choose Select text to return to reading.',text:'Click or tap the page to add text. Use the editor controls to change size and color.',draw:'Draw on the page with a pointer or stylus. Switch to Select text to scroll normally.'};$('tool-hint').hidden=!hints[tool];setText('tool-hint',hints[tool]);}
function setSidebar(show: boolean, focus: 'toggle'|'document'|'navigation'|false = false) {
 $('sidebar').hidden=!show;$('toggle-sidebar').setAttribute('aria-expanded',String(show));$('toggle-sidebar').setAttribute('aria-controls','sidebar');
 $('toggle-sidebar').setAttribute('aria-label',show?'Hide page navigation':'Show page navigation');
 $('toggle-sidebar').title=show?'Hide page navigation':'Show page navigation';
 active()?.controller.refresh();
 if(focus==='toggle')$('toggle-sidebar').focus();else if(focus==='document')focusWorkspace();else if(focus==='navigation')$(`nav-${navMode==='pages'?'pages':navMode==='outline'?'outline':'info'}`).focus();
}
async function renderSidebar() {
 thumbnailObserver?.disconnect();thumbnailObserver=undefined;
 const token=++sidebarToken;const s=active();const content=$('sidebar-content');for(const canvas of content.querySelectorAll('canvas')){canvas.width=0;canvas.height=0;}content.replaceChildren();if(!s||!s.controller.pageCount||$('sidebar').hidden)return;
 for(const [id,mode] of [['nav-pages','pages'],['nav-outline','outline'],['nav-info','info']]){$(id).classList.toggle('active',navMode===mode);$(id).setAttribute('aria-pressed',String(navMode===mode));}
 const title=document.createElement('h2');title.className='sidebar-title';title.textContent=navMode==='pages'?`${s.controller.pageCount} pages`:navMode==='outline'?'Document outline':'Document details';content.append(title);
 if(navMode==='pages'){
  const observer=thumbnailObserver=new IntersectionObserver(entries=>{for(const entry of entries){const b=entry.target as HTMLButtonElement;const canvas=b.querySelector('canvas')!;b.dataset.visible=String(entry.isIntersecting);if(!entry.isIntersecting){if(!b.dataset.rendering){canvas.width=0;canvas.height=0;}continue;}if(b.dataset.rendering||canvas.width)continue;b.dataset.rendering='true';void s.controller.renderThumbnail(Number(b.dataset.page),canvas).catch(()=>{b.title='Preview unavailable; select to navigate';}).finally(()=>{delete b.dataset.rendering;if(token!==sidebarToken||b.dataset.visible!=='true'){canvas.width=0;canvas.height=0;}});}},{root:content,rootMargin:'150px'});
  for(let p=1;p<=s.controller.pageCount;p++){if(token!==sidebarToken){observer.disconnect();return;}const b=document.createElement('button');b.className='thumb-button';b.style.minHeight='207px';b.dataset.page=String(p);b.setAttribute('aria-label',`Go to page ${p}`);if(p===s.controller.currentPage){b.classList.add('active');b.setAttribute('aria-current','page');}const c=document.createElement('canvas');c.width=0;c.height=0;c.style.width='140px';c.style.height='175px';c.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=String(p);b.append(c,label);b.onclick=()=>{s.controller.goToPage(p);if(innerWidth<760)setSidebar(false,'document');};content.append(b);observer.observe(b);}
 }else if(navMode==='outline'){
  const outline=await s.controller.getOutline();if(token!==sidebarToken)return;
  const add=(items: typeof outline,level=0)=>{for(const item of items||[]){const b=document.createElement('button');b.className='outline-item';b.style.paddingLeft=`${8+Math.min(level,5)*12}px`;b.textContent=item.title||'Untitled section';b.onclick=()=>{if(item.dest)void s.controller.goToDestination(item.dest);if(innerWidth<760)setSidebar(false,'document');};content.append(b);if(item.items?.length)add(item.items,level+1);}};
  if(outline?.length)add(outline);else{const p=copy('This PDF has no outline. Use page thumbnails or search to find your place.');p.className='sidebar-empty';content.append(p);}
 }else{
  content.append(copy(s.name));content.append(copy(`${s.controller.pageCount} pages · ${(s.file.size/1024).toFixed(0)} KB`));const b=document.createElement('button');b.className='button';b.textContent='View properties';b.onclick=()=>void showProperties(b);content.append(b);
 }
}
async function showProperties(origin: HTMLElement = $('properties')) {
 const s=active();if(!s)return;const metadata=await s.controller.getMetadata();const body=document.createElement('div');const dl=document.createElement('dl');dl.className='property-list';
 const info=(metadata?.info||{}) as unknown as Record<string,unknown>;
 const pairs=[['File',s.name],['Pages',String(s.controller.pageCount)],['Size',`${(s.file.size/1024).toFixed(1)} KB`],['Title',String(info.Title||'Not set')],['Author',String(info.Author||'Not set')],['Producer',String(info.Producer||'Not set')],['PDF version',String(info.PDFFormatVersion||'Unknown')],['Processing','Local — no document upload'],['Edits',s.state?.readOnlyReason||'Supported forms and annotations']];
 for(const [key,value]of pairs){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=value;dl.append(dt,dd);}body.append(dl);
 await dialog('Document properties',body,[{label:'Done',value:'done',primary:true}],origin);
}
async function exportCopy(fromClose = false) {
 const s=active();if(!s||exporting||opening||sessions.some(x=>x.closing)||(!fromClose&&closingApplication)||$<HTMLDialogElement>('dialog').open)return;exporting=true;$<HTMLButtonElement>('export').disabled=true;renderTabs();
 try {
  const bytes=await s.controller.exportBytes();
  if(isTauri()){
   const receipt=await saveNativePdfCopy(bytes,exportedPdfName(s.name),invoke);
   if(receipt){s.controller.markExported();toast(`Saved new PDF copy: ${receipt.filename}. Your original is unchanged.`);}
   else toast('Save As cancelled. Your changes remain open.');
  }else{
   const result=downloadPdf(bytes,s.name);const answer=await dialog('Your PDF copy is ready',copy(`${result.message} Your original is unchanged. Confirm only after you have checked that the copy was saved.`),[{label:'Keep changes marked',value:'cancel'},{label:'I saved the copy',value:'saved',primary:true}]);if(answer==='saved')s.controller.markExported();
  }
  renderTabs();
 }
 catch(e){toast(`Export failed. Your changes remain open. ${errorText(e)}`,true);}
 finally{exporting=false;$<HTMLButtonElement>('export').disabled=false;renderTabs();}
}
async function printCopy() {
 const s=active();if(!s||fileTaskBusy())return;if(s.state?.canPrint===false){toast('This PDF does not permit printing.',true);return;}exporting=true;renderTabs();
 let reserved:Window|undefined;
 try{reserved=reservePrintWindow();const bytes=await s.controller.exportBytes();const result=printPdf(bytes,s.name,reserved);toast(result.message);}catch(e){reserved?.close();toast(errorText(e),true);}finally{exporting=false;renderTabs();}
}
function toggleSearch(show=!$('searchbar').hidden?false:true){clearTimeout(searchTimer);$('searchbar').hidden=!show;$('toggle-search').setAttribute('aria-expanded',String(show));if(show)$<HTMLInputElement>('search-input').focus();else{$<HTMLInputElement>('search-input').value='';active()?.controller.clearSearch();$('toggle-search').focus();}}
function runSearch(previous=false){const query=$<HTMLInputElement>('search-input').value;active()?.controller.search(query,previous);}
on('open',choose);on('choose',choose);on('clear-recent',()=>{clearRecent();renderRecents();});
function startFeature(task: () => unknown) { if(fileTaskBusy()){toast('Finish or cancel the current task first.');return;}return task(); }
on('library',()=>startFeature(()=>deviceLibrary.showLibrary($('library'))));on('account',()=>startFeature(()=>deviceLibrary.showAccount($('account'))));on('store-local',()=>startFeature(()=>deviceLibrary.storeActive($('store-local'))));on('document-tools',()=>startFeature(()=>documentTools.showTools()));
on('close-active-document',async()=>{const s=active();if(s)await closeSession(s.id);});
on('demo',async()=>{const r=await fetch(`${import.meta.env.BASE_URL}demo.pdf`);if(!r.ok)throw new Error('The field guide could not load. You can open a local PDF instead.');await openFiles([new File([await r.blob()],'Folio field guide.pdf',{type:'application/pdf'})]);});
on('toggle-sidebar',()=>{const show=!!$('sidebar').hidden;setSidebar(show,show?'navigation':'toggle');return renderSidebar();});on('sidebar-close',()=>setSidebar(false,'toggle'));
$('sidebar').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();setSidebar(false,'toggle');}});
$('stage').addEventListener('focusin',()=>{if(innerWidth<760&&!$('sidebar').hidden)setSidebar(false);});
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
 const actions=[{label:'Rotate view',value:'rotate'},{label:'Properties',value:'properties'},{label:'Reading mode',value:'mode'},{label:'Print copy',value:'print'},{label:'Keyboard shortcuts and help',value:'help'}];
 const result=await dialog('Document actions',body,actions,$('mobile-more'));if(result==='rotate')active()?.controller.rotate();if(result==='properties')await showProperties($('mobile-more'));if(result==='mode'){const mode=$<HTMLSelectElement>('view-mode');mode.value=mode.value==='continuous'?'page':'continuous';active()?.controller.setScrollMode(mode.value as 'continuous'|'page');}if(result==='print')await printCopy();if(result==='help')await showHelp($('mobile-more'));});
async function showHelp(origin: HTMLElement = $('help')) {const body=document.createElement('div');body.innerHTML='<p class="dialog-copy">Local PDFs stay on your device. Export creates a separate PDF; the original is never overwritten. Supported text fields and checkboxes can be filled directly on the page. Recent history stores filenames only. Choose Keep on this device to enable a local library and recovery copies. Export important work regularly; clearing browser data removes local files.</p><div class="shortcut-list"><kbd>Ctrl / ⌘ O</kbd> Open a PDF<br><kbd>Ctrl / ⌘ F</kbd> Find in document<br><kbd>Ctrl / ⌘ S</kbd> Export copy<br><kbd>Ctrl / ⌘ Z</kbd> Undo annotation<br><kbd>Ctrl / ⌘ Shift Z</kbd> Redo annotation<br><kbd>Alt +</kbd> / <kbd>Alt −</kbd> Document zoom<br><kbd>Alt 0</kbd> Fit width<br><kbd>Page Up / Down</kbd> Navigate pages</div><p class="dialog-copy">In Safari on Mac, Option-Tab includes links; enable “Press Tab to highlight each item on a webpage” in Safari settings for full Tab navigation. Browser zoom remains available; Ctrl/Command P opens a local print copy. Touch: pinch to magnify the browser view; use Fit width or the zoom controls for document scale. Document tools include local English OCR, safe page organization and certificate signing. Signing checks document integrity; certificate trust and revocation are not verified. PDF JavaScript remains disabled.</p>';await dialog('A few useful shortcuts',body,[{label:'Got it',value:'done',primary:true}],origin);}
on('help',()=>showHelp());
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||$<HTMLDialogElement>('dialog').open)return;const target=e.target as HTMLElement;const editing=target.matches('input,textarea,select,[contenteditable="true"]')||target.closest('[contenteditable="true"]');const mod=e.ctrlKey||e.metaKey;
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
matchMedia('(max-width: 900px)').addEventListener('change',event=>{if(event.matches){setSidebar(false,$('sidebar').contains(document.activeElement)?'toggle':false);void renderSidebar();}});
setSidebar(innerWidth>900);
$('toggle-search').setAttribute('aria-expanded','false');$('toggle-search').setAttribute('aria-controls','searchbar');
renderRecents();
if(isTauri()){$('export').querySelector('.save-label')!.textContent='Save As';$('export').title='Save a new PDF copy (Ctrl or Command S)';}
void deviceLibrary.initialize().catch(e=>toast(errorText(e),true));
if(import.meta.env.PROD&&'serviceWorker'in navigator)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>toast('Offline app caching is unavailable. Local PDF reading still works in this open tab.'));
