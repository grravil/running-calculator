const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
$('pace').value=params.get('pace')??'5:00';
// Preserve the meaning of previously shared mile links, then normalize to km.
if(params.get('unit')==='/mi'){const oldPace=PaceMath.parsePace($('pace').value);if(oldPace)$('pace').value=PaceMath.format(oldPace/1.609344);}
$('gradient').value=params.get('gradient')??'4';
function render(){
  const seconds=PaceMath.parsePace($('pace').value),raw=$('gradient').value,grade=raw.trim()===''?NaN:Number(raw),validGrade=Number.isFinite(grade)&&Math.abs(grade)<=45;
  document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.grade)===grade)));
  const error=!seconds?'Введите темп в формате м:сс, например 5:00. Темп должен быть больше нуля.':!validGrade?'Введите уклон от −45 до +45%.':'';
  $('error').hidden=!error;$('error').textContent=error;$('pace').setAttribute('aria-invalid',String(!seconds));$('gradient').setAttribute('aria-invalid',String(!validGrade));$('share').disabled=!!error;
  if(error){$('gap').value='—';$('comparison').textContent='Проверьте введённые значения.';$('hill-area').setAttribute('d','');$('hill-line').setAttribute('d','');$('hill-point').style.display='none';$('terrain-label').textContent='Нет расчёта';return;}
  $('hill-point').style.display='';$('slider').value=grade;
  const adjusted=PaceMath.gap(seconds,grade),diff=Math.round(seconds-adjusted),suffix='км';
  $('gap').value=PaceMath.format(adjusted);document.querySelector('.result-unit').textContent='/ '+suffix;
  $('comparison').textContent=diff===0?'Совпадает с фактическим темпом':`На ${Math.abs(diff)} сек/${suffix} ${diff>0?'быстрее':'медленнее'} фактического темпа`;
  const signed=(grade>0?'+':'')+grade.toLocaleString('ru-RU');$('grade-hint').textContent=grade===0?'Ровная поверхность — поправка не нужна.':`${signed}% — это ${Math.abs(grade).toLocaleString('ru-RU')} м ${grade>0?'подъёма':'спуска'} на 100 м по горизонтали.`;
  const rise=Math.max(-75,Math.min(75,grade*4)),y1=70+rise/2,y2=70-rise/2;
  $('hill-area').setAttribute('d',`M20 ${y1}L400 ${y2}L400 115L20 115Z`);$('hill-line').setAttribute('d',`M20 ${y1}L400 ${y2}`);$('hill-point').setAttribute('cy',70);
  $('terrain-label').textContent=grade===0?'Ровная поверхность':`${grade>0?'Подъём':'Спуск'} ${signed}%`;
  const url=new URL(location.href);url.searchParams.set('pace',$('pace').value);url.searchParams.set('unit','/km');url.searchParams.set('gradient',String(grade));try{history.replaceState(null,'',url);}catch{}
}
$('form').addEventListener('submit',e=>e.preventDefault());['pace','gradient'].forEach(id=>$(id).addEventListener('input',render));
$('slider').addEventListener('input',()=>{$('gradient').value=$('slider').value;render();});
document.querySelectorAll('[data-grade]').forEach(b=>b.addEventListener('click',()=>{$('gradient').value=b.dataset.grade;render();}));
$('form').addEventListener('reset',e=>{e.preventDefault();$('pace').value='5:00';$('gradient').value='4';$('share-status').textContent='';render();});
$('share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('share-status').textContent='Ссылка на расчёт скопирована.';}catch{$('share-status').textContent='Скопируйте ссылку из адресной строки браузера.';}});
render();
