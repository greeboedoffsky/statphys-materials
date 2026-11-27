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
const foldersCount = n => plural(n, 'раздел', 'раздела', 'разделов');
const bytes = n => n < 1024 ? `${n} Б` : n < 1024 ** 2 ? `${(n / 1024).toLocaleString('ru', {maximumFractionDigits: 1})} КБ` : `${(n / 1024 ** 2).toLocaleString('ru', {maximumFractionDigits: 1})} МБ`;
const norm = str => str.toLocaleLowerCase('ru').replaceAll('ё', 'е');
const icons = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h7l2 2h9v13H3z"/></svg>',
  hero:'<svg class="hero-graphic" viewBox="0 0 290 240" fill="none" stroke="#c4e4d9" aria-hidden="true"><g transform="translate(165 120)"><ellipse rx="108" ry="52" transform="rotate(30)"/><ellipse rx="108" ry="52" transform="rotate(-30)"/><ellipse rx="108" ry="52" transform="rotate(90)"/><circle r="83" stroke-dasharray="2 7"/><circle r="6" fill="#c4e4d9"/><circle cx="-65" cy="-63" r="4" fill="#c4e4d9"/><circle cx="89" cy="-10" r="4" fill="#c4e4d9"/><circle cx="22" cy="95" r="4" fill="#c4e4d9"/></g></svg>'
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
  if (['PDF','PNG','JPG','JPEG','GIF','WEBP'].includes(file.type)) { a.target='_blank'; a.rel='noopener noreferrer'; }
  else a.download = file.name;
  const info = el('span','file-main');
  info.append(el('strong','',file.name), el('small','',`${file.type} · ${bytes(file.bytes)}${showPath ? ' · ' + displayPath(node) : ''}`));
  a.append(el('span','file-icon',file.type.slice(0,5)),info,el('span','download',a.hasAttribute('download') ? 'Скачать ↓' : 'Открыть ↗'));
  return a;
}
function folderRow(node, showPath=false) {
  const a = link('',route(node.path),'folder');
  const icon = el('span','file-icon'); icon.innerHTML = icons.folder;
  const info = el('span','file-main'); info.append(el('strong','',node.name),el('small','',`${filesCount(node.count)} · ${foldersCount(node.folders.length)}${showPath ? ' · ' + displayPath(node) : ''}`));
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
    const dd=folders.filter(node=>!categoryNames.has(node.name) && !materialNames.has(node.name) && match(displayPath(node)));
    results.append(heading('Результаты поиска',`${foldersCount(dd.length)} · ${filesCount(ff.length)}`));
    if (!ff.length && !dd.length) { results.append(el('div','empty','Ничего не найдено. Попробуйте другое название или формат файла.')); return; }
    if(dd.length){const list=el('div','folder-list');dd.forEach(node=>list.append(folderRow(node,true)));results.append(list);}
    if(ff.length){const list=el('div','file-list');ff.forEach(({file,node})=>list.append(fileRow(file,node,true)));if(dd.length)list.style.marginTop='12px';results.append(list);}
  });
}
function manage(node) {
  const panel=el('section','manage'); panel.append(el('h2','','Пополнение каталога'));
  if(!repo){panel.append(el('p','','В локальном режиме добавляйте файлы и папки в materials/ и пересобирайте сайт. После публикации здесь появятся ссылки на GitHub.'));return panel;}
  const dir='materials'+(node?'/'+node.path:'');
  const tail=encodeURIComponent(data.branch)+'/'+enc(dir);
  panel.append(el('p','','Для участников с правом записи в репозиторий. После сохранения изменений каталог обновится автоматически.'));
  const actions=el('div','manage-actions');
  actions.append(external('Загрузить файлы ↗',`${repo}/upload/${tail}`),external('Создать раздел ↗',`${repo}/new/${tail}`),external('Открыть папку ↗',`${repo}/tree/${tail}`));
  panel.append(actions,el('p','results-note','Для нового раздела в GitHub укажите имя файла в виде «Название раздела/.gitkeep».'));
  return panel;
}
const categoryNames = new Set(['Базовая часть','Статистическая физика — профильные дисциплины по выбору','Общие дисциплины по выбору','Практика и НИР','Итоговая аттестация']);
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
  copy.append(el('p','eyebrow','Образовательный архив / 3–6 курс'),el('h1','','Учебные материалы'),el('p','','Лекции, семинары, задачи и литература для студентов кафедры статистической физики. Выберите семестр или найдите нужный материал.'));
  hero.append(copy); hero.insertAdjacentHTML('beforeend',icons.hero); content.append(hero);
  const normal=el('div'); const nodes=Object.values(data.courses);
  normal.append(heading('Выберите семестр',filesCount(nodes.reduce((sum,n)=>sum+n.count,0))+' в архиве'));
  const grid=el('div','course-grid');
  for (const [year,node] of Object.entries(data.courses)) {
    const card=el('section','course-card'), top=el('div','card-top');
    top.append(el('span','course-num',year.padStart(2,'0')),el('span','meta',filesCount(node.count)));
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
  const details=el('details','subject-card');details.dataset.available=String(node.count>0);
  const summary=el('summary','subject-summary');summary.append(el('span','subject-name',node.name),el('span','meta',filesCount(node.count)));details.append(summary);
  const body=el('div','subject-body');if(!fileList(body,node))body.append(el('p','results-note','Материалы пока не добавлены.'));
  const actions=el('div','subject-actions');actions.append(link('Ссылка на раздел',route(node.path)));
  if(repo){const tail=encodeURIComponent(data.branch)+'/materials/'+enc(node.path);actions.append(external('Добавить материалы ↗',`${repo}/tree/${tail}`));}
  body.append(actions);details.append(body);return details;
}
function semesterContent(node) {
  const normal=el('div','semester-content');
  const controls=el('div','flat-controls');const label=el('label','available-filter');const check=el('input');check.type='checkbox';label.append(check,document.createTextNode('Только разделы с файлами'));controls.append(label);normal.append(controls);
  const groups=el('div','subject-groups');normal.append(groups);
  if(node.files.length){const block=el('section','subject-group');block.append(heading('Файлы семестра'));fileList(block,node,false);groups.append(block);}
  const direct=node.folders.filter(n=>!categoryNames.has(n.name) && !materialNames.has(n.name));
  for(const cat of node.folders.filter(n=>categoryNames.has(n.name))){
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
    empty.hidden=!(check.checked&&node.count===0);});
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
  const head=el('header','pagehead');head.append(el('p','eyebrow',`${root.name} курс / учебные материалы`),el('h1','',isSemester?`${root.name} курс`:isCourse?`${root.name} курс`:target.name),el('p','',filesCount(target.count)+' в разделе'));content.append(head);
  if(orderedSemesters(root).length)content.append(semesterLinks(root,selected));
  let normal;
  if(isSemester){normal=semesterContent(target);
    if(isCourse){const extra=root.folders.filter(n=>!orderedSemesters(root).includes(n));if(root.files.length||extra.length){const group=el('section','subject-group');group.append(heading('Общие материалы курса'));fileList(group,root,false);extra.forEach(n=>group.append(subjectCard(n)));normal.append(group);}}
  }else{normal=el('div');if(!fileList(normal,target))normal.append(el('div','empty','В этом разделе пока нет учебных материалов.'));if(target.folders.length){normal.append(heading('Подразделы'));const list=el('div','folder-list');target.folders.forEach(n=>list.append(folderRow(n)));normal.append(list);}}
  searchBox([isCourse?root:target],normal,isCourse?'Поиск по обоим семестрам курса…':'Название дисциплины, файла или формат…');
  const admin=el('details','admin-panel');admin.append(el('summary','','Управление материалами'),manage(target));content.append(admin);
}
function render() {
  if(location.hash==='#main'){document.getElementById('main').focus();return;}
  let parts;try{parts=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);}catch{parts=['invalid'];}
  content.replaceChildren();
  const year=parts[0];
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===(year||'home'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(!year){document.title='Учебные материалы — Статистическая физика';home();return;}
  let node=Object.hasOwn(data.courses,year)?data.courses[year]:null;const ancestors=node?[node]:[];
  for(const part of parts.slice(1)){node=node?.folders.find(n=>n.name===part);if(!node)break;ancestors.push(node);}
  if(!node){content.append(el('h1','','Раздел не найден'),el('p','','Возможно, он был перемещён или удалён.'),link('Вернуться к списку курсов','#/'));return;}
  document.title=`${displayPath(node)} — Статистическая физика`;course(node,ancestors);
}
if(repo){const a=document.getElementById('repo-link');a.href=repo;a.hidden=false;}
try {const saved=localStorage.getItem('statphys-theme');if(['dark','light'].includes(saved))document.documentElement.dataset.theme=saved;}catch{}
const theme=document.getElementById('theme');
function themeState(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function themeLabel(){theme.setAttribute('aria-label',themeState()==='dark'?'Включить светлую тему':'Включить тёмную тему');theme.title=theme.getAttribute('aria-label');}
theme.addEventListener('click',()=>{const value=themeState()==='dark'?'light':'dark';document.documentElement.dataset.theme=value;try{localStorage.setItem('statphys-theme',value);}catch{}themeLabel();});themeLabel();
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();document.getElementById('main').focus();});
window.addEventListener('hashchange',()=>{render();if(location.hash!=='#main')window.scrollTo(0,0);});render();
