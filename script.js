const UI = {
    grid: null,
    contextMenu: null,
    copyCoordinatesItem: null,
    dateInput: null,
    currentTarget: null,
    trendBanner: null,
}

const Config = {
    coordinatesDecimals: 4,
    cacheExpirationTime_ms: 3600000,
    maxForecastDays: 10,
    cacheWeatherDataPrefix: "climbweatherapp-v1-",
    savedLocationsPrefix: "climbweatherapp-locations-v1",
}

let locations = [
    {name: "Chamonix", lat: 45.9237, lon: 6.8694},
    {name: "Verdon", lat: 43.7697, lon: 6.3594},
    {name: "Calanque sormiou", lat: 43.2143, lon: 5.4196},
    {name: "Crept", lat: 45.7871, lon: 5.4914},
    {name: "Seynes", lat: 44.1186, lon: 4.2799},
    {name: "Buoux", lat: 43.8233, lon: 5.3811},
    {name: "Gorges de la Jonte", lat: 44.1917, lon: 3.2050},
    {name: "Omblèze", lat: 44.8336, lon: 5.1950},
    {name: "Doizieux", lat: 45.4101, lon: 4.5796},
    {name: "Saou", lat: 44.6508, lon: 5.0728},
    {name: "Presles", lat: 45.0705, lon: 5.4194},
    {name: "Vergisson", lat: 46.3141, lon: 4.7160}
];

function initApp() {
    UI.grid = document.getElementById('weatherGrid');
    UI.contextMenu = document.getElementById('contextMenu');
    UI.copyCoordinatesItem = document.getElementById('copyCoordinates');
    UI.dateInput = document.getElementById('dateInput');
    UI.trendBanner = document.getElementById('trendBanner');

    lucide.createIcons();

    const savedLocations = localStorage.getItem(Config.savedLocationsPrefix);
    if (savedLocations) {
        locations = JSON.parse(savedLocations);
    }
    setupDateInput();

    // reload the weather data every time the date is changed
    UI.dateInput.addEventListener('change', loadWeather);
    UI.dateInput.addEventListener('change', updateNavButtonEnabledState);

    // We show a custom right click menu when clicking on weather cards from the grid
    UI.grid.addEventListener('contextmenu', onRightClickOnWeatherGrid);

    // Copy value to clipboard when menu item is clicked
    UI.copyCoordinatesItem.addEventListener('click', onCopyCoordinatesClicked);

    // process keyboard shortcuts, such as changing date with arrow keys
    document.addEventListener('keydown', onKeyDown, false);

    // prevent keyboard shortcuts when an input is selected
    document.querySelectorAll('input').forEach(
        el => el.addEventListener('keydown', e => {
            e.stopPropagation();
        })
    )

    // Hide right click menu when clicking anywhere else
    document.addEventListener('click', () => {
        UI.contextMenu.classList.remove('visible');
        UI.currentTarget = null;
    });

    // Hide menu on scroll
    document.addEventListener('scroll', () => {
        UI.contextMenu.classList.remove('visible');
        UI.currentTarget = null;
    });

    cleanupExpiredCache();
    loadWeather();

}


/**
 * Process key shortcuts
 */
function onKeyDown(e) {
    if (e.defaultPrevented) {
        return; // Do nothing if the event was already processed
    }
    switch (e.key) {
        case "ArrowLeft":
            moveDateBackward();
            break;
        case "ArrowRight":
            moveDateForward();
            break;
    }
}

/**
 * Disable relevant nav buttons based on date range limits
 */
function updateNavButtonEnabledState() {
    const backButton = document.getElementById('dateNavBackButton');
    const forwardButton = document.getElementById('dateNavForwardButton');
    switch (UI.dateInput.value) {
        case UI.dateInput.min:
            backButton.disabled = true;
            break;
        case UI.dateInput.max:
            forwardButton.disabled = true;
            break;
        default:
            backButton.disabled = false;
            forwardButton.disabled = false;

    }
}

/**
 * Configure the date input with date range and default selected date
 */
function setupDateInput() {
    const today = new Date();
    UI.dateInput.min = today.toISOString().split('T')[0];

    const defaultSelectedDate = new Date()
    defaultSelectedDate.setDate(today.getDate() + 1);
    UI.dateInput.value = defaultSelectedDate.toISOString().split('T')[0];

    const maxDate = new Date();
    maxDate.setDate(today.getDate() + Config.maxForecastDays);
    UI.dateInput.max = maxDate.toISOString().split('T')[0];
}

/**
 * Save the list of locations to local storage
 */
function saveLocations() {
    localStorage.setItem(Config.savedLocationsPrefix, JSON.stringify(locations));
}

/**
 * Add a new location to the list of saved locations
 */
function addLocation() {
    const name = document.getElementById('spotName').value.trim();
    const lat = parseFloat(document.getElementById('spotLat').value).toFixed(Config.coordinatesDecimals);
    const lon = parseFloat(document.getElementById('spotLon').value).toFixed(Config.coordinatesDecimals);

    if (!name || isNaN(lat) || isNaN(lon)) {
        alert('Veuillez remplir tous les champs correctement');
        return;
    }

    locations.push({name, lat, lon});
    saveLocations();

    document.getElementById('spotName').value = '';
    document.getElementById('spotLat').value = '';
    document.getElementById('spotLon').value = '';

    loadWeather();
}

/**
 * Delete a location from the list of saved locations
 */
function deleteLocation(index) {
    if (confirm(`Supprimer ${locations[index].name} ?`)) {
        locations.splice(index, 1);
        saveLocations();
        loadWeather();
    }
}

/**
 * Move the selected date 1 day backward
 */
function moveDateBackward() {
    UI.dateInput.stepDown();
    UI.dateInput.dispatchEvent(new Event('change'));
}

/**
 * Move the selected date 1 day forward
 */
function moveDateForward() {
    UI.dateInput.stepUp();
    UI.dateInput.dispatchEvent(new Event('change'));
}

/**
 * Get the current condition (bad, average, good) from the weather data
 */
function getWeatherCondition(maxTemp, precipSum, windSpeed, weatherCode) {
    const tempScore = getTempScore(maxTemp);
    const windScore = getWindScore(windSpeed);
    const precipScore = getPrecipScore(precipSum);
    if (Math.min(tempScore, windScore, precipScore) < 0.2) {
        return 'bad';
    }
    const goodWeatherCode = weatherCode < 4;
    if ((Math.min(tempScore, windScore, precipScore) < 0.5) || !goodWeatherCode) {
        return 'average';
    }
    return 'good';
}

/**
 * Get the weather icon from the weather code (sun, rain, cloud, etc.)
 */
function getWeatherIcon(weatherCode) {
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌦️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
        71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
        80: '🌦️', 81: '🌧️', 82: '⛈️',
        85: '🌨️', 86: '🌨️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[weatherCode] || '🌤️';
}

/**
 * Get the weather description from the weather code
 */
function getWeatherDescription(weatherCode) {
    const descriptions = {
        0: 'Ensoleillé',
        1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
        45: 'Brouillard', 48: 'Brouillard givrant',
        51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
        61: 'Pluie faible', 63: 'Pluie modérée', 65: 'Pluie forte',
        66: 'Pluie verglaçante', 67: 'Pluie verglaçante forte',
        71: 'Neige faible', 73: 'Neige modérée', 75: 'Neige forte', 77: 'Grésil',
        80: 'Averses faibles', 81: 'Averses modérées', 82: 'Averses fortes',
        85: 'Averses de neige faibles', 86: 'Averses de neige fortes',
        95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent avec grêle'
    };
    return descriptions[weatherCode] || 'Variable';
}

/**
 * Get the wind arrow and label from the wind direction value
 */
function windDirToArrow(deg) {
    const toDeg = (deg + 180) % 360;
    const arrows = ['↑ S', '↗ SW', '→ W', '↘ NW', '↓ N', '↙ NE', '← E', '↖ SE'];
    const index = Math.round(toDeg / 45) % 8;
    return arrows[index];
}

/**
 * Update the link to the MeteoBlue webpage with the correct date
 */
function updateMeteoBlueLinkDate(daysDiff) {
    const meteoBlueLink = document.getElementById("meteo-blue-link");
    const link = meteoBlueLink.getAttribute("href").split("?")[0];
    meteoBlueLink.setAttribute("href", link + "?day=" + daysDiff);
}

/**
 * Show the right clic menu at the mouse location when clicking a location card in the grid
 */
function onRightClickOnWeatherGrid(e) {
    // Check if the clicked element or its parent has the grid-item class
    const gridItem = e.target.closest('.location-card');

    if (gridItem) {
        e.preventDefault();
        UI.currentTarget = gridItem;

        // Position the menu at mouse location
        UI.contextMenu.style.left = e.clientX + 'px';
        UI.contextMenu.style.top = e.clientY + 'px';
        UI.contextMenu.classList.add('visible');

        const lat = UI.currentTarget.getAttribute('lat');
        const latDir = lat > 0 ? "N" : "S";
        const lon = UI.currentTarget.getAttribute('lon');
        const lonDir = lon > 0 ? "E" : "W";

        const meteoBlueLink = document.getElementById("meteo-blue-link");
        const suffix = meteoBlueLink.getAttribute("href").split("?")[1];
        meteoBlueLink.setAttribute("href", "https://www.meteoblue.com/fr/meteo/semaine/" + lat + latDir + lon + lonDir + "?" + suffix);
    }
}

/**
 * Copy the coordinate to the clipboard
 */
function onCopyCoordinatesClicked() {
    if (UI.currentTarget) {
        const value = "" + UI.currentTarget.getAttribute('lat') + ", " + UI.currentTarget.getAttribute('lon');

        navigator.clipboard.writeText(value).then(() => {
            alert(`Copied: ${value}`);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    UI.contextMenu.classList.remove('visible');
    UI.currentTarget = null;
}

/**
 * Save the data to localStorage with the given key
 */
function savetoCache(key, data) {
    const cachedWeatherData = {
        timestamp: Date.now(),
        value: data
    };
    localStorage.setItem(key, JSON.stringify(cachedWeatherData));
}

/**
 * Retrieve the data from localStorage with the given key
 */
function getFromCache(key) {
    removeFromCacheIfExpired(key);
    const jsonString = localStorage.getItem(key);
    if (!jsonString) {
        return null;
    }
    const cachedWeatherData = JSON.parse(jsonString);
    return cachedWeatherData.value;
}

/**
 * Remove expired weather data item cached in local storage from key
 */
function removeFromCacheIfExpired(key) {
    const jsonString = localStorage.getItem(key);
    if (!jsonString) return;
    const cachedWeatherData = JSON.parse(jsonString);
    const dataAge = Date.now() - cachedWeatherData.timestamp;
    if (dataAge > Config.cacheExpirationTime_ms) {
        localStorage.removeItem(key);
    }
}

/**
 * Remove all expired weather data cached in local storage
 */
function cleanupExpiredCache() {
    const keystoCheck = [];
    for (let keyIndex = 0; keyIndex < localStorage.length; keyIndex++) {
        const key = localStorage.key(keyIndex);
        if (key.startsWith(Config.cacheWeatherDataPrefix)) {
            keystoCheck.push(key);
        }
    }
    keystoCheck.forEach((key) => {
        removeFromCacheIfExpired(key);
    });
}

/**
 * Fetch the weather data from remote weather service for a given location and date
 */
async function fetchWeatherData(isTrend, location, selectedDate) {
    const apiBase = isTrend ? '' : 'models=meteofrance_seamless';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,` +
        `weather_code,precipitation_hours,precipitation_sum,wind_direction_10m_dominant,` +
        `&${apiBase}&timezone=Europe/Paris&start_date=${selectedDate}&end_date=${selectedDate}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Erreur API');
    }

    const data = await response.json();

    if (!data.daily) {
        throw new Error('Données non disponibles');
    }

    if (data.daily.weather_code[0] === null) {
        throw new Error('Données non valides');
    }
    return data;
}

/**
 * Fetch the weather data with a caching mechanism to reduce api calls
 */
async function fetchWeatherDataCached(isTrend, location, selectedDate) {
    const key = Config.cacheWeatherDataPrefix + location.name.split(' ').join('_') + "-" + selectedDate;
    let data = getFromCache(key);
    if (data === null) {
        data = await fetchWeatherData(isTrend, location, selectedDate);
        savetoCache(key, data)
    }
    return data;
}

/**
 * Process the API data into data usable to create the weather cards (icons and descriptions)
 */
function processWeatherData(data) {
    const tempMax = Math.round(data.daily.temperature_2m_max[0]);
    const tempMin = Math.round(data.daily.temperature_2m_min[0]);
    let precipProba = data.daily.precipitation_probability_max[0];
    precipProba = precipProba === null ? "" : "(" + precipProba + "% prob)";
    const precipHours = data.daily.precipitation_hours[0];
    const precipSum = data.daily.precipitation_sum[0];
    const windSpeed = Math.round(data.daily.wind_speed_10m_max[0]);
    const windDir = windDirToArrow(data.daily.wind_direction_10m_dominant[0]);
    const weatherCode = data.daily.weather_code[0];

    return {
        condition: getWeatherCondition(tempMax, precipSum, windSpeed, weatherCode),
        weatherIcon: getWeatherIcon(weatherCode),
        weathertext: getWeatherDescription(weatherCode),
        tempIcon: '🌡️',
        tempText: `${tempMin}°C - ${tempMax}°C`,
        precipIcon: '💧',
        precipText: `${precipSum}mm, ${precipHours}h ${precipProba}`,
        windIcon: '💨',
        windText: `${windDir} ${windSpeed} km/h`
    };
}

function computeLinearRating(inputValue, bestValue, worstValue) {
    return Math.max(Math.min(1 - (inputValue - bestValue) / ((worstValue - bestValue)), 1), 0);
}

// Compute a score between 0 and 1 for wind conditions
function getWindScore(windSpeed) {
    // we want a rating of zero if speed is above 50 km/h, 1 if wind is below 10 km/h
    const best = 10;
    const worst = 50;
    return computeLinearRating(windSpeed, best, worst);
}

// Compute a score between 0 and 1 precipitation
function getPrecipScore(precipSum) {
    // we want a rating of zero if speed is above 50 km/h, 1 if wind is below 10 km/h
    const best = 0;
    const worst = 10;
    return computeLinearRating(precipSum, best, worst);
}

// Compute a score between 0 and 1 for temperature
function getTempScore(maxTemp) {
    // ideal temperature is when max temperature is between 10 and 20
    if (maxTemp < 10) {
        const best = 10;
        const worst = 0;
        return computeLinearRating(maxTemp, best, worst);

    }
    if (maxTemp > 20) {
        const best = 20;
        const worst = 35;
        return computeLinearRating(maxTemp, best, worst);
    }
    return 1;
}

/**
 * Create an item row for the weather card with an icon and description
 */
function createWeatherItem(icon, text) {
    const item = document.createElement('div');
    item.className = 'weather-item';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'weather-icon';
    iconSpan.textContent = icon;

    const textSpan = document.createElement('span');
    textSpan.textContent = text;

    item.appendChild(iconSpan);
    item.appendChild(textSpan);
    return item;
}

/**
 * Create a weather card for a given location
 */
function createWeatherCard(viewModel, trendClass, location, index) {
    const spotCard = document.createElement('div');
    const condition = viewModel !== null ? viewModel.condition : "";
    spotCard.className = `location-card ${condition} ${trendClass}`;
    spotCard.setAttribute('lat', location.lat);
    spotCard.setAttribute('lon', location.lon);

    const header = document.createElement('div');
    header.className = 'location-header';

    const locationNameEl = document.createElement('div');
    locationNameEl.className = 'location-name';
    locationNameEl.setAttribute('translate', 'no')
    locationNameEl.textContent = location.name;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.onclick = () => {
        deleteLocation(index)
    };
    deleteButton.innerHTML = `<i data-lucide="x"></i>`;
    header.appendChild(locationNameEl);
    header.appendChild(deleteButton);

    spotCard.appendChild(header);
    return spotCard;
}

/**
 * Populate the weather grid with cards containing the data for each saved location
 */
async function loadWeather() {
    const grid = UI.grid;
    const banner = UI.trendBanner;
    const selectedDate = UI.dateInput.value;

    if (!selectedDate) return;

    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((selectedDateObj - today) / (1000 * 60 * 60 * 24)) + 1;
    const isTrend = daysDiff > 4;

    updateMeteoBlueLinkDate(daysDiff);

    const forecastType = isTrend ? 'trend' : 'precise';
    const forecastLabel = isTrend ? '⚠️ Prévision indicative (précision réduite)' : 'Prévision précise';
    const trendClass = isTrend ? 'trend' : '';

    banner.innerHTML = `<div class="forecast-type ${forecastType}">${forecastLabel}</div>`

    grid.innerHTML = '<div class="loading">Chargement des prévisions météo...</div>';

    const weatherCards = await Promise.all(locations.map(async (location, index) => {
        try {
            // Utilise meteofrance pour J+1 à J+4, forecast générique pour J+5 à J+10
            const data = await fetchWeatherDataCached(isTrend, location, selectedDate);

            const viewModel = processWeatherData(data);
            const weatherCard = createWeatherCard(viewModel, trendClass, location, index);

            const content = document.createElement('div');
            content.className = 'weather-info';
            content.appendChild(createWeatherItem(viewModel.weatherIcon, viewModel.weathertext));
            content.appendChild(createWeatherItem(viewModel.tempIcon, viewModel.tempText));
            content.appendChild(createWeatherItem(viewModel.precipIcon, viewModel.precipText));
            content.appendChild(createWeatherItem(viewModel.windIcon, viewModel.windText));

            weatherCard.appendChild(content);
            return weatherCard;
        } catch (error) {
            console.error(`Erreur pour ${location.name}:`, error);
            const viewModel = null;
            const weatherCard = createWeatherCard(viewModel, trendClass, location, index);

            const content = document.createElement('div')
            content.className = 'error';
            content.textContent = 'Erreur : données indisponibles pour ce spot';

            weatherCard.appendChild(content);
            return weatherCard;
        }
    }));

    grid.innerHTML = '';
    weatherCards.forEach(card => {
        grid.appendChild(card)
    });
    lucide.createIcons();
}

// For testing with node/jest
if (typeof module !== 'undefined') {
    module.exports = {getTempScore, getWindScore, getPrecipScore, computeLinearRating, getWeatherCondition};
}