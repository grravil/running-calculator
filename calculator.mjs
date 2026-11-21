const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });
const secondsText = seconds => window.PaceMath.format(seconds);
const clock = seconds => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(total % 60).padStart(2, '0');
};
const distances = [[3, '3 км'], [5, '5 км'], [10, '10 км'], [21.0975, 'Полумарафон'], [42.195, 'Марафон']];
const distance = { id: 'distance', label: 'Дистанция', unit: 'км', value: '5', presets: distances, min: .001, max: 10000 };
const pace = { id: 'pace', label: 'Темп', value: '5:00', parts: [['мин', 999], ['сек', 59]] };
const duration = { id: 'time', label: 'Время', value: '25:00', parts: [['ч', 999], ['мин', 59], ['сек', 59]] };
const speed = seconds => number.format(Math.round(36000 / seconds) / 10) + ' км/ч';
const gradeText = grade => (grade > 0 ? '+' : '') + number.format(grade) + '%';
const amount = (value, unit, note) => ({ value, unit, note });

function splits({ lap, distance, pace }) {
  const metres = Math.round(distance * 1000);
  const count = Math.ceil(metres / lap);
  if (count > 1000) return { problem: 'Сократите дистанцию или увеличьте длину круга. Максимум 1000 отсечек.' };
  const rows = Array.from({ length: count }, (_, index) => {
    const start = index * lap;
    const end = Math.min(start + lap, metres);
    return { end, elapsed: clock(end * pace / 1000), leg: clock((end - start) * pace / 1000), partial: end - start < lap };
  });
  return { ...amount(clock(metres * pace / 1000), '', number.format(distance) + ' км · ' + count + ' отсечек'), rows };
}

// Register a tool here to give it a route, fields and results in the shared layout.
const tools = {
  tempo: {
    tab: 'Темп', title: 'Средний темп', description: 'Рассчитайте темп и скорость по дистанции и времени.',
    result: 'Темп', fields: [distance, duration],
    calculate: ({ distance, time }) => amount(secondsText(time / distance), 'мин/км', speed(time / distance) + ' · ' + number.format(distance) + ' км за ' + clock(time))
  },
  time: {
    tab: 'Время', title: 'Время финиша', description: 'Узнайте, за сколько пробежите дистанцию в заданном темпе.',
    result: 'Время на дистанции', fields: [distance, pace],
    calculate: ({ distance, pace }) => amount(clock(distance * pace), '', number.format(distance) + ' км по ' + secondsText(pace) + ' мин/км · ' + speed(pace))
  },
  splits: {
    tab: 'Отсечки', title: 'Отсечки по кругам', description: 'Получите время каждого круга и отсечки от старта.',
    result: 'Время финиша', fields: [
      { id: 'lap', label: 'Длина круга', unit: 'м', value: '400', min: 1, max: 100000, integer: true, presets: [[200, '200 м'], [250, '250 м'], [400, '400 м']] },
      distance, { ...pace, label: 'Целевой темп' }
    ], calculate: splits
  },
  gap: {
    tab: 'GAP', title: 'Темп с поправкой на уклон', description: 'Сравните бег в гору или со спуска с тем же усилием на равнине.',
    result: 'Темп на ровной дороге', fields: [
      { ...pace, label: 'Темп на склоне' },
      { id: 'gradient', label: 'Уклон', unit: '%', value: '4', min: -45, max: 45, slider: true, presets: [[-5, '−5%'], [0, 'Ровно'], [5, '+5%'], [10, '+10%']] }
    ],
    calculate: ({ pace, gradient }) => amount(secondsText(window.PaceMath.gap(pace, gradient)), 'мин/км', secondsText(pace) + ' мин/км при уклоне ' + gradeText(gradient)),
    details: true
  }
};
const defaults = Object.fromEntries(Object.entries(tools).map(([key, config]) => [key, Object.fromEntries(config.fields.map(field => [field.id, field.value]))]));
const values = structuredClone(defaults);
const links = {};
let active;
let currentResult;

function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function route(key) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  if (key !== 'tempo') url.searchParams.set('tab', key);
  if (key === 'gap') {
    url.searchParams.set('pace', values.gap.pace);
    url.searchParams.set('gradient', values.gap.gradient);
  }
  return url;
}

function fromLocation() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  if (tab === 'gap') {
    const savedPace = params.get('pace');
    const oldMilePace = params.get('unit') === '/mi' && savedPace ? window.PaceMath.parsePace(savedPace) : null;
    if (savedPace !== null) {
      const imported = window.PaceMath.parsePace(savedPace);
      values.gap.pace = oldMilePace ? secondsText(oldMilePace / 1.609344)
        : imported ? secondsText(imported) : defaults.gap.pace;
    }
    if (params.has('gradient')) values.gap.gradient = params.get('gradient');
  }
  return Object.hasOwn(tools, tab) ? tab : 'tempo';
}

for (const [key, config] of Object.entries(tools)) {
  const link = node('a', config.tab, { class: 'tab', href: route(key) });
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (key === active) return;
    history.pushState(null, '', route(key));
    show(key);
  });
  links[key] = link;
  $('tabs').append(link);
}

function numeric(initial) {
  const clean = initial.trim().replace(',', '.').replace('−', '-');
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(clean) ? Number(clean) : NaN;
}

function fieldNode(field) {
  const group = node('div', undefined, { class: 'field', 'data-field': field.id });
  const error = node('p', undefined, { class: 'error', id: field.id + '-error', hidden: '' });
  const update = raw => {
    values[active][field.id] = raw;
    render();
  };
  const createInput = (id, caption, raw, keyboard) => {
    const wrapper = node('div', undefined, { class: 'number' });
    const input = node('input', undefined, { id, type: 'text', inputmode: keyboard, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': error.id });
    input.value = raw;
    wrapper.append(input, node('span', caption, { 'aria-hidden': 'true' }));
    return { wrapper, input };
  };
  let setInput;
  if (field.parts) {
    const label = node('div', field.label + (field.id === 'pace' ? ', мин/км' : ''), { class: 'field-label', id: field.id + '-label' });
    const row = node('div', undefined, { class: 'duration-fields', role: 'group', 'aria-labelledby': label.id });
    const bits = values[active][field.id].split(':');
    while (bits.length < field.parts.length) bits.unshift('0');
    const names = { ч: 'часы', мин: 'минуты', сек: 'секунды' };
    const inputs = field.parts.map(([caption, max], index) => {
      const { wrapper, input } = createInput(field.id + '-' + index, caption, bits[index], 'numeric');
      input.maxLength = String(max).length;
      input.setAttribute('aria-label', field.label + ', ' + names[caption]);
      row.append(wrapper);
      return input;
    });
    inputs.forEach(input => input.addEventListener('input', () => update(inputs.map(i => i.value.trim()).join(':'))));
    group.append(label, row);
  } else {
    const { wrapper, input } = createInput(field.id, field.unit, values[active][field.id], field.integer ? 'numeric' : 'decimal');
    setInput = raw => { input.value = raw; update(raw); };
    input.addEventListener('input', () => update(input.value));
    group.append(node('label', field.label, { for: field.id, class: 'field-label' }), wrapper);
  }
  if (field.slider) {
    const slider = node('input', undefined, { id: 'slope', class: 'slope', type: 'range', min: '-45', max: '45', step: '0.1', 'aria-label': 'Уклон, проценты' });
    slider.addEventListener('input', () => setInput(slider.value));
    const scale = node('div', undefined, { class: 'slope-scale', 'aria-hidden': 'true' });
    for (const text of ['−45% · спуск', '0', '+45% · подъём']) scale.append(node('span', text));
    group.append(slider, scale);
  }
  if (field.presets) {
    const row = node('div', undefined, { class: 'preset-row' });
    for (const [value, label] of field.presets) {
      const button = node('button', label, { class: 'preset', type: 'button', 'data-value': value, 'aria-pressed': 'false' });
      button.addEventListener('click', () => setInput(String(value)));
      row.append(button);
    }
    group.append(row);
  }
  group.append(error);
  return group;
}

function read(field) {
  const raw = values[active][field.id];
  const group = $('fields').querySelector('[data-field="' + field.id + '"]');
  let value;
  let message = '';
  if (field.parts) {
    const bits = raw.split(':');
    while (bits.length < field.parts.length) bits.unshift('0');
    const invalid = bits.map((bit, index) => bit !== '' && (!/^\d+$/.test(bit) || Number(bit) > field.parts[index][1]));
    value = bits.reduce((sum, bit) => sum * 60 + Number(bit), 0);
    if (invalid.some(Boolean)) message = 'Проверьте формат и значения времени.';
    else if (value <= 0) message = 'Введите значение больше нуля.';
    group.querySelectorAll('input').forEach((input, index) => input.setAttribute('aria-invalid', String(invalid[index] || value <= 0)));
  } else {
    value = numeric(raw);
    if (!Number.isFinite(value) || value < field.min || value > field.max || (field.integer && !Number.isInteger(value))) {
      message = 'Введите ' + (field.integer ? 'целое число' : 'число') + ' от ' + number.format(field.min) + ' до ' + number.format(field.max) + ' ' + field.unit + '.';
    }
    $(field.id).setAttribute('aria-invalid', String(Boolean(message)));
    if (field.slider && !message) {
      $('slope').value = value;
      $('slope').setAttribute('aria-valuetext', gradeText(value));
    }
  }
  group.querySelectorAll('[data-value]').forEach(button => button.setAttribute('aria-pressed', String(value === Number(button.dataset.value))));
  const error = $(field.id + '-error');
  error.hidden = !message;
  error.textContent = message;
  return message ? null : value;
}

function renderTable(rows) {
  const table = node('table', undefined, { class: 'split-table', 'aria-label': 'План отсечек' });
  const head = table.createTHead().insertRow();
  for (const label of ['Круг', 'Дистанция', 'За круг', 'От старта']) head.append(node('th', label, { scope: 'col' }));
  const body = table.createTBody();
  rows.forEach((row, index) => {
    const line = body.insertRow();
    if (row.partial) line.classList.add('partial');
    line.append(node('th', String(index + 1) + (row.partial ? ' · неполный' : ''), { scope: 'row' }));
    for (const text of [number.format(row.end) + ' м', row.leg, row.elapsed]) line.append(node('td', text));
  });
  return table;
}

function render() {
  const config = tools[active];
  const input = Object.fromEntries(config.fields.map(field => [field.id, read(field)]));
  const valid = Object.values(input).every(value => value !== null);
  const result = valid ? config.calculate(input) : {};
  currentResult = valid && !result.problem ? result : null;
  const resultText = result.value ?? '—';
  if ($('result').value !== resultText) $('result').value = resultText;
  $('unit').textContent = result.unit ?? '';
  $('context').textContent = result.note ?? result.problem ?? 'Проверьте введённые значения.';
  $('status').hidden = true;
  $('actions').hidden = !currentResult;
  $('copy').textContent = active === 'gap' ? 'Скопировать ссылку' : 'Скопировать результат';
  $('telegram').hidden = active === 'gap';
  if (currentResult && active !== 'gap') {
    const share = new URL('https://t.me/share/url');
    share.searchParams.set('url', String(route(active)));
    share.searchParams.set('text', exportText());
    $('telegram').href = share;
  }
  if (!config.details) {
    $('below').replaceChildren();
    $('below').hidden = !result.rows;
    if (result.rows) $('below').append(node('h2', 'План отсечек'), renderTable(result.rows));
  }
  if (active === 'gap' && valid) {
    const url = route(active);
    url.searchParams.set('pace', secondsText(input.pace));
    url.searchParams.set('gradient', String(input.gradient));
    if (url.href !== location.href) history.replaceState(null, '', url);
    links.gap.href = url;
  }
}

function show(key) {
  active = key;
  const config = tools[key];
  for (const [id, link] of Object.entries(links)) {
    if (id === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  $('title').textContent = config.title;
  $('description').textContent = config.description;
  $('result-label').textContent = config.result;
  document.title = config.title + ' · Беговой калькулятор';
  $('fields').replaceChildren(...config.fields.map(fieldNode));
  $('below').replaceChildren();
  if (config.details) {
    const details = node('details');
    const source = node('a', 'Исследование Minetti et al.', { href: 'https://doi.org/10.1152/japplphysiol.01177.2001' });
    const reference = node('a', 'Калькулятор Runalyze', { href: 'https://runalyze.com/tools/grade-adjusted-pace-calculator' });
    details.append(node('summary', 'Как считается GAP'), node('p', 'GAP = темп × (C(0) / C(уклона))^0,83, где C — энергозатраты по модели Minetti. Измерения относятся к постоянному уклону. На результат реальной пробежки также влияют покрытие, ветер и усталость.'), source, document.createTextNode(' · '), reference);
    $('below').append(details);
    $('below').hidden = false;
  }
  render();
}

function exportText() {
  const { value, unit, note, rows } = currentResult;
  const lines = [tools[active].result + ': ' + [value, unit].filter(Boolean).join(' '), note];
  if (rows) rows.forEach(row => lines.push(number.format(row.end) + ' м — ' + row.elapsed));
  return lines.join('\n');
}

$('entry').addEventListener('submit', event => event.preventDefault());
$('entry').addEventListener('reset', event => {
  event.preventDefault();
  values[active] = { ...defaults[active] };
  show(active);
  $('entry').querySelector('input').focus();
});
$('copy').addEventListener('click', async () => {
  if (!currentResult) return;
  const text = active === 'gap' ? location.href : exportText();
  const status = $('status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Скопировано';
  } catch {
    status.textContent = text;
  }
  status.hidden = false;
});
window.addEventListener('popstate', () => show(fromLocation()));
show(fromLocation());
