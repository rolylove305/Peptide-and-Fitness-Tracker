(() => {
  const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();

  ready(() => {
    if (!document.getElementById('dailyV2Styles')) {
      const style = document.createElement('style');
      style.id = 'dailyV2Styles';
      style.textContent = `
        #daily > .card:not(.daily2-hero){display:none!important}
        #daily > .bar h2{font-size:0}
        #daily > .bar h2:after{content:'Daily 2.0';font-size:26px}
        #daily > .bar{align-items:center;margin-bottom:10px}
        .daily2-wrap{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:14px;align-items:start}
        .daily2-hero{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:0!important}
        .daily2-hero .bar{align-items:start;gap:10px}
        .daily2-date{width:100%;max-width:100%;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:16px;box-sizing:border-box;text-align:left;min-height:54px}
        .daily2-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .daily2-summary .metric{min-width:0}
        .daily2-summary .metric h3{font-size:22px;word-break:break-word}
        .daily2-card{border:1px solid var(--line);border-radius:18px;padding:14px;background:var(--card);margin:0 0 10px;box-sizing:border-box;max-width:100%}
        .daily2-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
        .daily2-top h3{margin:0 0 4px}
        .daily2-check{min-width:54px;height:54px;border-radius:18px;border:1px solid var(--line);font-size:24px;background:var(--soft);color:var(--text)}
        .daily2-check.done{background:linear-gradient(135deg,#14b8a6,#22c55e);color:white;border:0}
        .daily2-grid{display:grid;grid-template-columns:1fr 110px;gap:10px;margin-top:12px}
        .daily2-grid input,.daily2-grid select,.daily2-notes input{width:100%;box-sizing:border-box}
        .daily2-notes{margin-top:10px;display:block}
        .daily2-actions{display:flex;gap:10px;margin-top:12px}
        .daily2-actions button{flex:1}
        .daily2-empty{text-align:center;padding:18px}
        @media(max-width:760px){
          #daily > .bar h2:after{font-size:28px}
          #days{padding-bottom:90px}
          .daily2-wrap{grid-template-columns:1fr;gap:12px}
          .daily2-hero{padding:16px!important;border-radius:22px}
          .daily2-hero .bar{display:grid;grid-template-columns:1fr auto;align-items:start}
          .daily2-hero .bar h2{font-size:28px;line-height:1.05;margin:0 0 8px}
          .daily2-hero .bar p.muted{font-size:15px;line-height:1.35}
          .daily2-date{font-size:17px;text-align:center;padding:16px;min-height:60px}
          .daily2-summary{grid-template-columns:1fr 1fr 1fr;gap:8px}
          .daily2-summary .metric{padding:12px!important;border-radius:18px}
          .daily2-summary .metric p{font-size:12px}
          .daily2-summary .metric h3{font-size:18px}
          .dailygrid{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .dailygrid label.full{grid-column:1/-1}
          .daily2-card{padding:16px;border-radius:22px;margin-bottom:12px}
        }
        @media(max-width:430px){
          .daily2-hero .bar{grid-template-columns:1fr}
          #dailyGoToday{width:100%}
          .daily2-summary{grid-template-columns:1fr}
          .dailygrid{grid-template-columns:1fr!important}
          .daily2-grid{grid-template-columns:1fr 96px}
          .daily2-actions{flex-direction:column}
        }
      `;
      document.head.appendChild(style);
    }

    window.dailyV2Date = window.dailyV2Date || (typeof iso === 'function' ? iso(new Date()) : new Date().toISOString().slice(0,10));

    window.daily = function dailyV2() {
      const box = document.getElementById('days');
      if (!box || typeof S === 'undefined') return;
      const title = document.querySelector('#daily > .bar h2');
      if (title) title.textContent = 'Daily 2.0';
      const oldCard = box.previousElementSibling;
      if (oldCard && oldCard.classList.contains('card')) oldCard.style.display = 'none';

      const date = window.dailyV2Date || iso(new Date());
      const d = new Date(date + 'T00:00:00');
      const day = dow(d);
      const ts = tasks(day);
      const doneCount = ts.filter(t => logFor(date, t.name)?.status === 'Done').length;
      const metrics = metricsFor(date) || {};

      box.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'daily2-wrap';
      const hero = document.createElement('div');
      hero.className = 'card daily2-hero';
      hero.innerHTML = `
        <div class="bar"><div><p class="eyebrow">Daily 2.0</p><h2>Today / Selected Day</h2><p class="muted">Edit dose, mark done, and save progress in one place.</p></div><button id="dailyGoToday" class="smallbtn">Today</button></div>
        <input id="dailyDatePick" class="daily2-date" type="date" value="${date}">
        <div class="daily2-summary">
          <div class="metric"><p>Day</p><h3>${day}</h3></div>
          <div class="metric"><p>Done</p><h3>${doneCount}/${ts.length}</h3></div>
          <div class="metric"><p>Scheduled</p><h3>${ts.length}</h3></div>
        </div>
        <div class="dailygrid">
          <label>Weight<input id="d2Weight" type="number" step="0.1" value="${metrics.weight || ''}"></label>
          <label>Waist<input id="d2Waist" type="number" step="0.1" value="${metrics.waist || ''}"></label>
          <label>Sleep<input id="d2Sleep" type="number" step="0.1" value="${metrics.sleep_hours || ''}"></label>
          <label>Water L<input id="d2Water" type="number" step="0.1" value="${metrics.water_l || ''}"></label>
          <label>Protein g<input id="d2Protein" type="number" value="${metrics.protein_g || ''}"></label>
          <label>Energy<input id="d2Energy" type="number" value="${metrics.mood_energy || ''}"></label>
          <label class="full">Daily notes<input id="d2Notes" value="${(metrics.daily_notes || '').replace(/"/g,'&quot;')}"></label>
        </div>
        <button id="d2SaveMetrics" class="primary">Save day progress</button>
      `;
      wrap.appendChild(hero);

      const list = document.createElement('div');
      list.className = 'list daily2-list';
      if (!ts.length) {
        list.innerHTML = '<div class="card daily2-empty"><h3>No peptides scheduled</h3><p class="muted">Go to Peptides / Reminders to add or edit schedule days.</p></div>';
      } else {
        ts.forEach(item => list.appendChild(dailyV2Row(date, item)));
      }
      wrap.appendChild(list);
      box.appendChild(wrap);

      document.getElementById('dailyDatePick').onchange = e => { window.dailyV2Date = e.target.value; daily(); };
      document.getElementById('dailyGoToday').onclick = () => { window.dailyV2Date = iso(new Date()); daily(); };
      document.getElementById('d2SaveMetrics').onclick = async () => {
        const payload = {
          weight: +document.getElementById('d2Weight').value || null,
          waist: +document.getElementById('d2Waist').value || null,
          sleep_hours: +document.getElementById('d2Sleep').value || null,
          water_l: +document.getElementById('d2Water').value || null,
          protein_g: +document.getElementById('d2Protein').value || null,
          mood_energy: +document.getElementById('d2Energy').value || null,
          daily_notes: document.getElementById('d2Notes').value || ''
        };
        await saveMetrics(date, payload);
        await load();
      };
    };

    window.dailyV2Row = function dailyV2Row(date, item) {
      const l = logFor(date, item.name) || {};
      const done = l.status === 'Done';
      const dose = l.dose_amount ?? item.dose_amount ?? '';
      const unit = l.dose_unit || item.dose_unit || 'mg';
      const div = document.createElement('div');
      div.className = 'daily2-card ' + (done ? 'done' : '');
      div.innerHTML = `
        <div class="daily2-top">
          <div><h3>${item.name}</h3><p class="muted small">Suggested: ${item.dose_amount || '-'} ${item.dose_unit || ''} • ${item.route || ''} • ${item.time_of_day || ''}</p></div>
          <button class="daily2-check ${done ? 'done' : ''}" type="button">${done ? '✓' : '○'}</button>
        </div>
        <div class="daily2-grid">
          <label>Dose taken<input class="d2dose" type="number" step="0.001" value="${dose}"></label>
          <label>Unit<select class="d2unit"><option ${unit==='mg'?'selected':''}>mg</option><option ${unit==='mcg'?'selected':''}>mcg</option><option ${unit==='units'?'selected':''}>units</option><option ${unit==='mL'?'selected':''}>mL</option><option ${unit==='N/A'?'selected':''}>N/A</option></select></label>
        </div>
        <label class="daily2-notes">Notes<input class="d2note" value="${(l.notes || '').replace(/"/g,'&quot;')}"></label>
        <div class="daily2-actions"><button class="smallbtn d2save" type="button">Save</button><button class="smallbtn d2toggle" type="button">${done ? 'Mark pending' : 'Mark done'}</button></div>
      `;
      const save = async (status) => {
        await saveDaily(date, item, {
          status,
          dose_amount: +div.querySelector('.d2dose').value || null,
          dose_unit: div.querySelector('.d2unit').value,
          notes: div.querySelector('.d2note').value || ''
        });
        await load();
      };
      div.querySelector('.daily2-check').onclick = () => save(done ? 'Pending' : 'Done');
      div.querySelector('.d2toggle').onclick = () => save(done ? 'Pending' : 'Done');
      div.querySelector('.d2save').onclick = () => save('Done');
      return div;
    };

    const refresh = document.getElementById('refreshDaily');
    if (refresh) refresh.onclick = () => daily();
  });
})();
