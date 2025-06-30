const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cliProgress = require('cli-progress');

const API_BASE_URL = 'https://crmexchange.klinikon.ru/api/v2/visit';
const DATE_FROM = '2025-06-25'; // сюда дату начала периода 
const DATE_TILL = '2025-06-25'; // cюда дату окончания периода
const TOKEN = 'Bearer токен для авторизации';
const PER_PAGE = 100;
const START_PAGE = 1;

(async () => {
  let page = START_PAGE;
  let lastPage = 1;
  let allVisits = [];
  let times = [];

  const progressBar = new cliProgress.SingleBar({
    format: 'Загрузка визитов |{bar}| {percentage}% | Страница: {value}/{total} | ETA: {eta_formatted}',
    hideCursor: true,
    clearOnComplete: false,
  }, cliProgress.Presets.shades_classic);

  const firstUrl = `${API_BASE_URL}?dateFrom=${DATE_FROM}&dateTill=${DATE_TILL}&page=${page}&perPage=${PER_PAGE}`;
  let firstResponse = await fetch(firstUrl, { headers: { Authorization: TOKEN } });
  if (!firstResponse.ok) {
    console.error(`Ошибка при запросе первой страницы: ${firstResponse.status}`);
    return;
  }
  let firstData = await firstResponse.json();

  if (!firstData.meta || !firstData.data) {
    console.error('⚠️ Неверный ответ от API: отсутствует meta или data');
    return;
  }

  lastPage = firstData.meta.lastPage;
  allVisits.push(...firstData.data);

  progressBar.start(lastPage, page);

  page++;

  while (page <= lastPage) {
    const url = `${API_BASE_URL}?dateFrom=${DATE_FROM}&dateTill=${DATE_TILL}&page=${page}&perPage=${PER_PAGE}`;
    const startTime = Date.now();
    const res = await fetch(url, { headers: { Authorization: TOKEN } });
    if (!res.ok) {
      console.error(`\nОшибка при запросе страницы ${page}: ${res.status}`);
      break;
    }
    const data = await res.json();

    if (!data.meta || !data.data) {
      console.error('\n⚠️ Неверный ответ от API: отсутствует meta или data');
      break;
    }

    allVisits.push(...data.data);

    const endTime = Date.now();
    times.push((endTime - startTime) / 1000);

    progressBar.update(page);

    page++;
  }

  progressBar.stop();

  console.log(`\n✅ Всего визитов: ${allVisits.length}`);

  if (allVisits.length === 0) {
    console.log('❗ Нет данных для экспорта, проверь параметры запроса.');
    return;
  }

  const csvRows = [
    `"Дата","Время начала","Время окончания","ID врача","Комментарий","Статус","Услуги","ID пациента"`
  ];

  for (const visit of allVisits) {
    const dt = new Date(visit.datetime);
    const date = dt.toLocaleDateString('ru-RU');
    const start = dt.toTimeString().slice(0, 5);
    const end = new Date(dt.getTime() + 30 * 60000).toTimeString().slice(0, 5);
    const doctor = visit.resourceId;
    const comment = (visit.comment || "").replace(/"/g, '""');
    const status = visit.deleted ? "Отменен" : "Завершен";
    const client = visit.client;
    const services = (visit.services || []).map(s =>
  `${s.id}, ${s.amount}, ${Math.floor(Number(s.price))}, ${s.discount}`
).join(' & ');


    csvRows.push(`"${date}","${start}","${end}","${doctor}","${comment}","${status}","${services}","${client}"`);
  }

  fs.writeFileSync('visits.csv', csvRows.join('\n'), 'utf-8');
  console.log('📁 Файл visits.csv успешно сохранён!');
})();
