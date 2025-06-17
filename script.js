const input = document.querySelector('#city_name');
const suggestionsList = document.querySelector('#suggestions');
const apiKey = 'ed8ade2170eb6bc6ef4d54e51f1bafb9';
const geoHeaders = {
    'X-RapidAPI-Key': 'fb04ad5159msh34748b843189f25p17534bjsn7e8ac75f369c',
    'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
};

let selectedCity = null;

// Autocomplete silencioso
input.addEventListener('input', async () => {
    const term = input.value.trim();
    if (term.length < 2) {
        suggestionsList.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(
            `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(term)}&limit=5&sort=-population`,
            { method: 'GET', headers: geoHeaders }
        );
        const data = await res.json();

        suggestionsList.innerHTML = '';

        if (!data.data || data.data.length === 0) return;

        data.data.forEach(city => {
            const li = document.createElement('li');
            li.textContent = `${city.city}, ${city.region}, ${city.country}`;
            li.addEventListener('click', () => {
                input.value = `${city.city}, ${city.region}, ${city.country}`;
                suggestionsList.innerHTML = '';
                selectedCity = city;
            });
            suggestionsList.appendChild(li);
        });
    } catch (err) {
        console.error('Erro no autocomplete:', err);
    }
});

// Botão buscar
document.querySelector('#search').addEventListener('submit', async event => {
    event.preventDefault();

    if (!input.value.trim()) {
        showAlert('Você precisa digitar uma cidade');
        clearInfo();
        return;
    }

    if (!selectedCity) {
        try {
            const res = await fetch(
                `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(input.value)}&limit=1`,
                { method: 'GET', headers: geoHeaders }
            );
            const data = await res.json();

            if (!data.data || data.data.length === 0) {
                showAlert('Cidade não encontrada.');
                clearInfo();
                return;
            }

            selectedCity = data.data[0];
        } catch (err) {
            console.error('Erro ao buscar cidade:', err);
            showAlert('Erro ao buscar cidade.');
            clearInfo();
            return;
        }
    }

    buscarCidadeCompleta(selectedCity);
});

// Busca clima + imagem
async function buscarCidadeCompleta(city) {
    try {
        const lat = city.latitude;
        const lon = city.longitude;
        const wikiId = city.wikiDataId;

        const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=pt_br`
        );
        const weather = await weatherRes.json();

        if (weather.cod !== 200) {
            showAlert('Erro ao buscar clima.');
            clearInfo();
            return;
        }

        showInfo({
            city: city.city,
            country: city.country,
            region: city.region,
            timezone: formatTimezone(weather.timezone),
            population: city.population,
            temp: weather.main.temp,
            tempMax: weather.main.temp_max,
            tempMin: weather.main.temp_min,
            description: weather.weather[0].description,
            tempIcon: weather.weather[0].icon,
            windSpeed: weather.wind.speed,
            humidity: weather.main.humidity
        });

        const imgUrl = await fetchWikidataImage(wikiId);
        document.querySelector('#city_image').innerHTML = imgUrl
            ? `<img src="${imgUrl}" alt="Imagem da cidade ${city.city}" class="cidade-img" />`
            : '';
    } catch (err) {
        console.error('Erro ao buscar dados:', err);
        showAlert('Erro ao buscar dados.');
        clearInfo();
    }
}

// Exibe clima + info cidade
function showInfo(json) {
    showAlert('');
    document.querySelector('#weather').classList.add('show');

    document.querySelector('#title').innerHTML = `${json.city}, ${json.country}`;
    document.querySelector('#temp_value').innerHTML = `${json.temp.toFixed(0)} <sup>°C</sup>`;
    document.querySelector('#temp_description').innerHTML = `${json.description}`;
    document.querySelector('#temp_img').setAttribute('src', `https://openweathermap.org/img/wn/${json.tempIcon}@2x.png`);
    document.querySelector('#temp_max').innerHTML = `${json.tempMax.toFixed(0)} <sup>°C</sup>`;
    document.querySelector('#temp_min').innerHTML = `${json.tempMin.toFixed(0)} <sup>°C</sup>`;
    document.querySelector('#humidade').innerHTML = `${json.humidity}%`;
    document.querySelector('#vento').innerHTML = `${json.windSpeed.toFixed(0)}km/h`;

    startClock(json.timezone);

    document.querySelector('#info-cidade').innerHTML = `
        <h2>${json.city}</h2>
        <p><strong>País:</strong> ${json.country}</p>
        <p><strong>Região:</strong> ${json.region}</p>
        <p><strong>Fuso horário:</strong> ${json.timezone}</p>
        <p><strong>População:</strong> ${json.population.toLocaleString('pt-BR')}</p>
        <p><strong>Hora local:</strong> <span id="local_time">--:--:--</span></p>
    `;
}

// Limpa tudo
function clearInfo() {
    document.querySelector('#weather').classList.remove('show');
    document.querySelector('#city_image').innerHTML = '';
    document.querySelector('#info-cidade').innerHTML = '';
    selectedCity = null;
}

// Alerta no topo
function showAlert(msg) {
    document.querySelector('#alert').innerHTML = msg;
}

// Busca imagem via WikiData
async function fetchWikidataImage(wikiId) {
    try {
        const url = `https://www.wikidata.org/wiki/Special:EntityData/${wikiId}.json`;
        const res = await fetch(url);
        const data = await res.json();
        const entity = data.entities[wikiId];

        if (entity?.claims?.P18) {
            const fileName = entity.claims.P18[0].mainsnak.datavalue.value.replace(/ /g, '_');
            const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&titles=File:${fileName}`;
            const commonsRes = await fetch(commonsUrl);
            const commonsData = await commonsRes.json();

            const pages = commonsData.query.pages;
            for (let key in pages) {
                if (pages[key].imageinfo) {
                    return pages[key].imageinfo[0].url;
                }
            }
        }
    } catch (err) {
        console.error('Erro ao buscar imagem:', err);
    }
    return null;
}

// Converte timezone em segundos para UTC±HH:MM
function formatTimezone(offsetInSeconds) {
    const sign = offsetInSeconds >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetInSeconds);
    const hours = String(Math.floor(absOffset / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((absOffset % 3600) / 60)).padStart(2, '0');
    return `UTC${sign}${hours}:${minutes}`;
}

let clockInterval;

function startClock(offsetInSeconds) {
    if (clockInterval) clearInterval(clockInterval);

    function updateClock() {
        const nowUTC = new Date(new Date().getTime() + new Date().getTimezoneOffset() * 60000);
        const localTime = new Date(nowUTC.getTime() + offsetInSeconds * 1000);

        const hours = String(localTime.getHours()).padStart(2, '0');
        const minutes = String(localTime.getMinutes()).padStart(2, '0');
        const seconds = String(localTime.getSeconds()).padStart(2, '0');

        const clockElement = document.querySelector('#local_time');
        if (clockElement) {
            clockElement.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }

    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}
