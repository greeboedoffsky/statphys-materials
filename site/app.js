'use strict';
const data = JSON.parse(document.getElementById('catalog').textContent);
const content = document.getElementById('content');
const repo = data.repository ? `https://github.com/${data.repository}` : '';
const enc = path => path.split('/').map(encodeURIComponent).join('/');
const route = path => '#/' + enc(path);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
function link(text, href, cls) {
  const a = el('a', cls, text); a.href = href; return a;
}
function external(text, href) {
  const a = link(text, href); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
const plural = (n, one, few, many) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many}`;
const filesCount = n => plural(n, 'файл', 'файла', 'файлов');
const bytes = n => n < 1024 ? `${n} Б` : n < 1024 ** 2 ? `${(n / 1024).toLocaleString('ru', {maximumFractionDigits: 1})} КБ` : `${(n / 1024 ** 2).toLocaleString('ru', {maximumFractionDigits: 1})} МБ`;
const norm = str => str.toLocaleLowerCase('ru').replaceAll('ё', 'е');
const icons = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h7l2 2h9v13H3z"/></svg>',
  hero:''
};
function allFiles(node) {
  return [...node.files.map(file => ({file, node})), ...node.folders.flatMap(allFiles)];
}
function allFolders(node) { return node.folders.flatMap(child => [child, ...allFolders(child)]); }
function displayPath(node) { const [year,...rest] = node.path.split('/'); return [`${year} курс`, ...rest].join(' / '); }
function heading(title, meta) {
  const head = el('div','section-head'); head.append(el('h2','',title));
  if (meta) head.append(el('span','',meta)); return head;
}
function fileRow(file, node, showPath=false) {
  const a = link('', file.url, 'file');
  // Only PDF and common raster images are opened inline; all other types download.
  if (file.shared || ['PDF','PNG','JPG','JPEG','GIF','WEBP'].includes(file.type)) { a.target='_blank'; a.rel='noopener noreferrer'; }
  else a.download = file.name;
  const info = el('span','file-main');
  info.append(el('strong','',file.name), el('small','',`${file.type} · ${bytes(file.bytes)}${showPath ? ' · ' + displayPath(node) : ''}`));
  a.append(el('span','file-icon',file.type.slice(0,5)),info,el('span','download',a.hasAttribute('download') ? 'Скачать ↓' : 'Открыть ↗'));
  return a;
}
function folderRow(node, showPath=false) {
  const a = link('',route(node.path),'folder');
  const icon = el('span','file-icon'); icon.innerHTML = icons.folder;
  const info = el('span','file-main'); info.append(el('strong','',node.name));
  if(showPath) info.append(el('small','',displayPath(node)));
  a.append(icon,info,el('span','arrow','→')); return a;
}
function searchBox(nodes, normalContent, placeholder) {
  const search = el('div','search'); const label = el('label','','Поиск по материалам'); label.htmlFor='query';
  const box = el('div','searchbox'); box.innerHTML = icons.search;
  const input=el('input'); input.id='query'; input.type='search'; input.placeholder=placeholder; input.autocomplete='off';
  box.append(input); search.append(label,box); content.append(search);
  const results=el('div'); results.hidden=true; content.append(normalContent,results);
  const files=nodes.flatMap(allFiles), folders=nodes.flatMap(allFolders);
  input.addEventListener('input',()=>{
    const terms=norm(input.value.trim()).split(/\s+/).filter(Boolean);
    normalContent.hidden=terms.length>0; results.hidden=terms.length===0; results.replaceChildren();
    if (!terms.length) return;
    const match=s=>terms.every(t=>norm(s).includes(t));
    const ff=files.filter(({file,node})=>match(file.name+' '+displayPath(node)+' '+file.type));
    const dd=folders.filter(node=>!isCategory(node) && !materialNames.has(node.name) && match(displayPath(node)));
    results.append(heading('Результаты поиска'));
    if (!ff.length && !dd.length) { results.append(el('div','empty','Ничего не найдено. Попробуйте другое название или формат файла.')); return; }
    if(dd.length){const list=el('div','folder-list');dd.forEach(node=>list.append(folderRow(node,true)));results.append(list);}
    if(ff.length){const list=el('div','file-list');ff.forEach(({file,node})=>list.append(fileRow(file,node,true)));if(dd.length)list.style.marginTop='12px';results.append(list);}
  });
}
const upstream = data.upstream || '';
const materialRoot = data.materialRoot;
const department = data.department;
const isCategory = node => categoryNames.has(node.name) || node.name.endsWith(' — профильные дисциплины по выбору');
const shared = node => node && (department.id !== 'common' && data.sharedCategories.includes(node.path.split('/')[2]));
const sharedURL = node => upstream + route(node.path);
function sharedNotice(node) {
  const block=el('div','shared-origin');
  block.append(el('p','','Общие материалы кафедр. Для пополнения перейдите в единый архив.'));
  if(upstream) block.append(external('Открыть в общем архиве ↗',sharedURL(node)));
  else block.append(el('p','shared-status','Общий архив не настроен.'));
  return block;
}

const canUpload = node => !!node && (department.id==='common' ? data.sharedCategories.includes(node.path.split('/')[2]) : !shared(node));
// Upload to the current repository only. Credentials never leave this form except
// in the Authorization header of a request to api.github.com.
const uploadExtensions = new Set('pdf djvu djv doc docx odt ppt pptx odp xls xlsx ods txt md tex ipynb py c cpp h csv zip 7z rar tar gz png jpg jpeg webp gif mp3 mp4 wav m4a webm epub'.split(' '));
const uploadLimit = 25 * 1024 * 1024;
function uploadFileError(file) {
  if (!file.name || file.name.startsWith('.') || /[/\\\x00-\x1f\x7f]/.test(file.name) || !uploadExtensions.has(file.name.split('.').pop().toLowerCase()) || !file.name.includes('.')) return 'Недопустимое имя или формат файла.';
  if (file.size > uploadLimit) return 'Файл больше 25 МиБ.';
  return '';
}
function uploadBase64(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=()=>reject(new Error('Не удалось прочитать файл.')); reader.readAsDataURL(file);});
}
async function uploadToGitHub(folder,file,token) {
  const path=materialRoot+'/'+folder+'/'+file.name;
  const response=await fetch('https://api.github.com/repos/'+data.repository+'/contents/'+enc(path),{
    method:'PUT', credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer',
    headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
    body:JSON.stringify({message:'Add учебный материал: '+file.name,content:await uploadBase64(file),branch:data.branch})
  });
  if(response.status===201) return;
  const messages={401:'Токен недействителен или истёк.',403:'Недостаточно прав, ограничение GitHub API или защищённая ветка.',404:'Репозиторий недоступен: проверьте права токена.',409:'Конфликт изменений. Повторите позже.',422:'Файл уже существует либо GitHub отклонил путь или данные.',429:'Превышен лимит запросов GitHub.'};
  throw new Error(messages[response.status]||`GitHub вернул HTTP ${response.status}.`);
}
function uploadButton(node) {
  const button=el('button','upload-open','Загрузить файлы ↑');button.type='button';
  button.addEventListener('click',()=>openUpload(node));return button;
}
function openUpload(node) {
  if(!repo || !node || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(data.repository))return;
  const destinations=[node,...allFolders(node)].filter(n=>canUpload(n));
  if(!destinations.length)return;
  const dlg=el('dialog','upload-dialog');dlg.setAttribute('aria-labelledby','upload-title');
  const form=el('form','upload-form'); const title=el('h2','','Загрузка учебных материалов');title.id='upload-title';
  const select=el('select'); select.id='upload-folder';
  for(const n of destinations){const option=el('option','',n===node?'Текущая папка — '+n.name:n.path.slice(node.path.length+1));option.value=n.path;select.append(option);}
  const label=(text,id)=>{const a=el('label','upload-label',text);a.htmlFor=id;return a;};
  const path=el('p','upload-path');
  const native=external('Загрузить через GitHub без токена ↗',repo);
  function destinationChanged(){path.textContent=materialRoot+'/'+select.value; native.href=repo+'/upload/'+encodeURIComponent(data.branch)+'/'+enc(materialRoot)+'/'+enc(select.value);}
  select.addEventListener('change',destinationChanged);destinationChanged();
  const input=el('input');input.type='file';input.id='upload-files';input.multiple=true;input.required=true;input.accept=[...uploadExtensions].map(s=>'.'+s).join(',');
  const drop=el('div','upload-drop');drop.append(el('p','','Перетащите файлы сюда или выберите их'),input);
  let selected=[]; const queue=el('ul','upload-queue'); const status=el('p','upload-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  function setFiles(files){selected=Array.from(files);input.required=!selected.length;queue.replaceChildren();for(const f of selected){const err=uploadFileError(f);queue.append(el('li','',`${f.name} · ${bytes(f.size)}${err?' — '+err:''}`));}status.textContent='';}
  input.addEventListener('change',()=>setFiles(input.files));
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragging');});drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragging');input.value='';setFiles(e.dataTransfer.files);});
  const token=el('input');token.type='password';token.id='upload-token';token.autocomplete='off';token.spellcheck=false;token.required=true;token.placeholder='Fine-grained personal access token';
  const help=el('p','results-note','Токен нужен только для прямой записи в GitHub: Contents — Read and write, доступ к этому репозиторию. Не сохраняется в браузере. Для входа обычным аккаунтом используйте ссылку GitHub выше.');
  const create=external('Создать токен на GitHub ↗','https://github.com/settings/personal-access-tokens/new');
  const buttons=el('div','upload-buttons');const submit=el('button','upload-submit','Загрузить');submit.type='submit';const close=el('button','upload-open','Закрыть');close.type='button';buttons.append(submit,close);
  const progress=el('progress');progress.hidden=true;progress.value=0;
  form.append(title,label('Папка назначения','upload-folder'),select,path,native, label('Файлы (до 25 МиБ каждый)','upload-files'),drop,queue,label('Токен GitHub','upload-token'),token,help,create,buttons,progress,status);
  dlg.append(form);document.body.append(dlg);let busy=false;
  const clear=()=>{token.value='';selected=[];input.value='';dlg.remove();};
  dlg.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dlg.addEventListener('close',clear);
  close.addEventListener('click',()=>{if(!busy)dlg.close();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    if(!destinations.some(n=>n.path===select.value)||!selected.length||!token.value.trim())return;
    const invalid=selected.find(f=>uploadFileError(f));if(invalid){status.textContent=invalid.name+': '+uploadFileError(invalid);return;}
    if(new Set(selected.map(f=>f.name)).size!==selected.length){status.textContent='Выбраны файлы с одинаковыми именами.';return;}
    const folder=select.value;let secret=token.value.trim();token.value='';const batch=[...selected];busy=true;
    for(const control of [select,input,token,submit,close])control.disabled=true;drop.style.pointerEvents='none';progress.hidden=false;progress.max=batch.length;progress.value=0;let ok=0;const failed=[];
    try{for(const f of batch){status.textContent=`Загрузка ${progress.value+1} из ${batch.length}: ${f.name}`;try{await uploadToGitHub(folder,f,secret);ok++;}catch(error){failed.push(`${f.name}: ${error.message||'Ошибка сети.'}`);}progress.value++;}}
    finally{secret='';busy=false;for(const control of [select,input,token,submit,close])control.disabled=false;drop.style.pointerEvents='';setFiles([]);input.value='';status.textContent=`Загружено: ${ok} из ${batch.length}. ${ok?'Файлы появятся после успешной сборки GitHub Actions. ':''}${failed.length?'Ошибки:\n'+failed.join('\n'):''}`;}
  });
  dlg.showModal();
}

function manage(node) {
  if(shared(node)) return sharedNotice(node);
  const panel=el('section','manage'); panel.append(el('h2','','Пополнение каталога'));
  if(department.id==='common' && !canUpload(node)){panel.append(el('p','','Откройте плашку дисциплины или её подраздел для загрузки в общую папку.'));return panel;}
  if(!repo){panel.append(el('p','','В локальном режиме добавляйте файлы и папки в materials/ и пересобирайте сайт. После публикации здесь появятся ссылки на GitHub.'));return panel;}
  const dir=materialRoot+(node?'/'+node.path:'');
  const tail=encodeURIComponent(data.branch)+'/'+enc(dir);
  panel.append(el('p','','Для участников с правом записи в репозиторий. После сохранения изменений каталог обновится автоматически.'));
  const actions=el('div','manage-actions');
  if(node) actions.append(uploadButton(node));
  actions.append(external('Загрузить через GitHub ↗',`${repo}/upload/${tail}`),external('Создать раздел ↗',`${repo}/new/${tail}`),external('Открыть папку ↗',`${repo}/tree/${tail}`));
  panel.append(actions,el('p','results-note','Для нового раздела в GitHub укажите имя файла в виде «Название раздела/.gitkeep».'));
  return panel;
}
const categoryNames = new Set(['Базовая часть','Квантовая механика — профильные дисциплины по выбору','Общие дисциплины по выбору','Практика и НИР','Итоговая аттестация']);
const materialNames = new Set(['Лекции','Семинары и задачи','Литература']);
const orderedSemesters = node => [...node.folders].filter(n=>/^\d+ семестр/.test(n.name)).sort((a,b)=>parseInt(a.name)-parseInt(b.name));
function semesterLinks(course, selected) {
  const bar=el('nav','semester-links');bar.setAttribute('aria-label','Семестры');
  for(const sem of orderedSemesters(course)) {
    const a=link(sem.name,route(sem.path),'semester-link');
    if(selected?.path===sem.path)a.setAttribute('aria-current','page');
    bar.append(a);
  }
  return bar;
}
function home() {
  const hero=el('section','hero'); const copy=el('div','hero-copy');
  copy.append(el('p','eyebrow','Образовательный архив / 3–6 курс'),el('h1','','Учебные материалы'),el('p','','Лекции, семинары, задачи и литература. Выберите семестр или найдите нужный материал.'));
  hero.append(copy); if(department.id!=='statphys'){const image=el('img','hero-graphic');image.src=data.assetPrefix+'art/'+department.id+'.svg';image.alt=department.id==='quantum'?'Стационарное уравнение Шрёдингера: H с крышкой, пси равно E пси':'';hero.append(image);} content.append(hero);
  const normal=el('div'); const nodes=Object.values(data.courses);
  normal.append(heading('Выберите семестр'));
  const grid=el('div','course-grid');
  for (const [year,node] of Object.entries(data.courses)) {
    const card=el('section','course-card'), top=el('div','card-top');
    top.append(el('span','course-num',year.padStart(2,'0')));
    const h=el('h3');h.append(link(`${year} курс`,route(year)));card.append(top,h,semesterLinks(node));grid.append(card);
  }
  normal.append(grid); searchBox(nodes,normal,'Название файла, дисциплины или формат…');
}
function fileList(container,node,recursive=true) {
  const entries=recursive?allFiles(node):node.files.map(file=>({file,node}));
  const groups=new Map();
  for(const entry of entries){const name=entry.node.path===node.path?'':entry.node.path.slice(node.path.length+1);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(entry);}
  for(const [name,items] of groups){if(name)container.append(el('h4','material-label',name.replaceAll('/',' · ')));const list=el('div','file-list');items.forEach(({file,node})=>list.append(fileRow(file,node)));container.append(list);}
  return entries.length;
}
function subjectCard(node) {
  const details=el('details','subject-card');details.dataset.available=String(node.count>0 || (shared(node)&&!data.sharedSynced));
  const summary=el('summary','subject-summary');summary.append(el('span','subject-name',node.name),el('span','meta',shared(node)&&!data.sharedSynced?'Общий архив':filesCount(node.count)));details.append(summary);
  const body=el('div','subject-body');if(shared(node))body.append(sharedNotice(node));if(!fileList(body,node)&&(!shared(node)||data.sharedSynced))body.append(el('p','results-note','Материалы пока не добавлены.'));
  const actions=el('div','subject-actions');actions.append(link('Ссылка на раздел',route(node.path)));
  if(repo&&canUpload(node)){const tail=encodeURIComponent(data.branch)+'/'+enc(materialRoot)+'/'+enc(node.path);actions.append(uploadButton(node),external('Открыть папку GitHub ↗',`${repo}/tree/${tail}`));}
  body.append(actions);details.append(body);return details;
}
function semesterContent(node) {
  const normal=el('div','semester-content');
  const controls=el('div','flat-controls');const label=el('label','available-filter');const check=el('input');check.type='checkbox';label.append(check,document.createTextNode('Только разделы с файлами'));controls.append(label);normal.append(controls);
  const groups=el('div','subject-groups');normal.append(groups);
  if(node.files.length){const block=el('section','subject-group');block.append(heading('Файлы семестра'));fileList(block,node,false);groups.append(block);}
  const direct=node.folders.filter(n=>!isCategory(n) && !materialNames.has(n.name));
  for(const cat of node.folders.filter(n=>isCategory(n))){
    const group=el('section','subject-group');group.append(heading(cat.name));
    if(cat.files.length)fileList(group,cat,false);
    for(const subject of cat.folders)group.append(subjectCard(subject));
    if(!cat.files.length&&!cat.folders.length)group.append(subjectCard(cat));
    groups.append(group);
  }
  const other=[...direct,...node.folders.filter(n=>materialNames.has(n.name)&&n.count>0)];
  if(other.length){const group=el('section','subject-group');group.append(heading('Другие материалы'));other.forEach(n=>group.append(subjectCard(n)));groups.append(group);}
  const empty=el('div','empty','В этом семестре пока нет загруженных файлов.');empty.hidden=true;normal.append(empty);
  check.addEventListener('change',()=>{groups.querySelectorAll('.subject-card').forEach(d=>d.hidden=check.checked&&d.dataset.available==='false');groups.querySelectorAll('.subject-group').forEach(g=>g.hidden=check.checked&&!g.querySelector('.file, .subject-card:not([hidden])')); // direct file rows and nonempty cards
    // Empty cards have no file rows; keep a group only if any visible card or a direct file exists.
    empty.hidden=!(check.checked&&!groups.querySelector('.subject-card:not([hidden]), .file'));});
  return normal;
}
function course(node, ancestors) {
  const root=ancestors[0];const isCourse=ancestors.length===1;
  const selected=isCourse?orderedSemesters(root)[0]:ancestors[1];
  const isSemester=!!selected&&(isCourse||ancestors.length===2)&&/^\d+ семестр/.test(selected.name);
  const target=isSemester?selected:node;
  const crumb=el('nav','breadcrumb');crumb.setAttribute('aria-label','Хлебные крошки');crumb.append(link('Все материалы','#/'),el('span','','/'),link(`${root.name} курс`,route(root.path)));
  if(selected&&!isSemester)crumb.append(el('span','','/'),link(selected.name,route(selected.path)));
  content.append(crumb);
  const head=el('header','pagehead');head.append(el('p','eyebrow',`${root.name} курс / учебные материалы`),el('h1','',isSemester?`${root.name} курс`:isCourse?`${root.name} курс`:target.name));content.append(head);
  if(orderedSemesters(root).length)content.append(semesterLinks(root,selected));
  let normal;
  if(isSemester){normal=semesterContent(target);
    if(isCourse){const extra=root.folders.filter(n=>!orderedSemesters(root).includes(n));if(root.files.length||extra.length){const group=el('section','subject-group');group.append(heading('Общие материалы курса'));fileList(group,root,false);extra.forEach(n=>group.append(subjectCard(n)));normal.append(group);}}
  }else{normal=el('div');if(shared(target))normal.append(sharedNotice(target));if(!fileList(normal,target)&&(!shared(target)||data.sharedSynced))normal.append(el('div','empty','В этом разделе пока нет учебных материалов.'));if(target.folders.length){normal.append(heading('Подразделы'));const list=el('div','folder-list');target.folders.forEach(n=>list.append(folderRow(n)));normal.append(list);}}
  searchBox([isCourse?root:target],normal,isCourse?'Поиск по обоим семестрам курса…':'Название дисциплины, файла или формат…');
  const admin=el('details','admin-panel');admin.append(el('summary','','Управление материалами'),manage(target));content.append(admin);
}
function render() {
  if(location.hash==='#main'){document.getElementById('main').focus();return;}
  let parts;try{parts=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);}catch{parts=['invalid'];}
  content.replaceChildren();
  const year=parts[0];
  document.querySelector('.layout').classList.toggle('home-layout', !year);
  document.querySelector('.sidebar').hidden = !year;
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===(year||'home'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(!year){document.title='Учебные материалы — '+department.name;home();return;}
  let node=Object.hasOwn(data.courses,year)?data.courses[year]:null;const ancestors=node?[node]:[];
  for(const part of parts.slice(1)){node=node?.folders.find(n=>n.name===part);if(!node)break;ancestors.push(node);}
  if(!node){content.append(el('h1','','Раздел не найден'),el('p','','Возможно, он был перемещён или удалён.'),link('Вернуться к списку курсов','#/'));return;}
  document.title=`${displayPath(node)} — ${department.name}`;course(node,ancestors);
}
const switcher=document.getElementById('archives'); for(const archive of data.archives){const a=link(archive.name,archive.url,'archive-link');if(archive.id===department.id)a.setAttribute('aria-current','page');switcher.append(a);}
if(repo){const a=document.getElementById('repo-link');a.href=repo;a.hidden=false;}
try {const saved=localStorage.getItem('physics-engine-theme');if(['dark','light'].includes(saved))document.documentElement.dataset.theme=saved;}catch{}
const theme=document.getElementById('theme');
function themeState(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function themeLabel(){theme.setAttribute('aria-label',themeState()==='dark'?'Включить светлую тему':'Включить тёмную тему');theme.title=theme.getAttribute('aria-label');}
theme.addEventListener('click',()=>{const value=themeState()==='dark'?'light':'dark';document.documentElement.dataset.theme=value;try{localStorage.setItem('physics-engine-theme',value);}catch{}themeLabel();});themeLabel();
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();document.getElementById('main').focus();});
window.addEventListener('hashchange',()=>{render();if(location.hash!=='#main')window.scrollTo(0,0);});render();
