const express = require('express');
const path = require('path');
const app = express();

const serverConfig = {
  "twcApiKey": "e1f10a1e78da46f5b10a1e78da96f525",
  "units": "m",

  "webPort": 3000,

  "locationIndex": {
    "locations": [
      "Saskatoon",
      "Regina",
      "Edmonton",
      "Calgary",
      "Vancouver"
    ],
    "ldlLocations": [
      "Saskatoon, SK",
      "Outlook, SK",
      "Rosetown, SK",
      "Melfort, SK",
      "North Battleford, SK",
      "Lloydminster, AB",
      "Regina, SK"
    ],
  },
}

let allWeather = {};
let ldlWeather = {};

async function getWeather(lat, lon, countryCode) { // credit to Dalk
  // theres definitely a better approach to this
  // its like 1 am and im way too lazy to think of that better approach
  const currentUrl = await fetch(`https://api.weather.com/v3/wx/observations/current?geocode=${lat},${lon}&units=${serverConfig.units}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const weeklyUrl = await fetch(`https://api.weather.com/v3/wx/forecast/daily/7day?geocode=${lat},${lon}&format=json&units=${serverConfig.units}&language=en-US&apiKey=${serverConfig.twcApiKey}`);
  const alertsUrl = await fetch(`https://api.weather.com/v3/alerts/headlines?geocode=${lat},${lon}&format=json&language=en-US&apiKey=${serverConfig.twcApiKey}`);
  const radarUrl = await fetch(`https://api.weather.com/v2/maps/dynamic?geocode=${lat.toFixed(1)}0,${lon.toFixed(1)}0&h=320&w=568&lod=8&product=twcRadarHcMosaic&map=dark&language=en-US&format=png&apiKey=${serverConfig.twcApiKey}&a=0`)
  const aqiUrl = await fetch(`https://api.weather.com/v3/wx/globalAirQuality?geocode=${lat},${lon}&language=en-US&scale=EPA&format=json&apiKey=${serverConfig.twcApiKey}`);
  const pollenUrl = await fetch(`https://api.weather.com/v2/indices/pollen/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
/*   const runningUrl = await fetch(`https://api.weather.com/v2/indices/runWeather/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const frostUrl = await fetch(`https://api.weather.com/v2/indices/frost/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const skiUrl = await fetch(`https://api.weather.com/v2/indices/ski/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const mosquitoUrl = await fetch(`https://api.weather.com/v2/indices/mosquito/daily/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const golfUrl = await fetch(`https://api.weather.com/v2/indices/golf/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const heatingUrl = await fetch(`https://api.weather.com/v2/indices/heatCool/daypart/3day?geocode=${lat},${lon}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`); */
  const current = await currentUrl.json();
  const weekly = await weeklyUrl.json();

  let alerts = []
  let alertDetails = []

  try {
    if (alertsUrl.status === 204) {
      console.info(`No alerts in effect for ${lat}, ${lon}`);
      alerts = [];
    } else {
      alerts = await alertsUrl.json();
      console.info(`Fetched alerts for ${lat}, ${lon}:`);

      if (alerts.alerts && alerts.alerts.length > 0) {
        const alertId = alerts.alerts[0].detailKey;
        const alertDetailsUrl = await fetch(`https://api.weather.com/v3/alerts/detail?alertId=${alertId}&format=json&language=en-US&apiKey=${serverConfig.twcApiKey}`);
        
        if (alertDetailsUrl.ok) {
          alertDetails = await alertDetailsUrl.json();
        } else {
          console.error(`Failed to fetch alert details: ${alertDetailsUrl.status} ${alertDetailsUrl.statusText}`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching weather alerts:', error);
  }
  const radar = radarUrl.url;
  const aqi = await aqiUrl.json();
  const pollen = await pollenUrl.json();
  /* const running = await runningUrl.json();
  const frost = await frostUrl.json();
  const ski = await skiUrl.json();
  const mosquito = await mosquitoUrl.json();
  const golf = await golfUrl.json();
  const heating = await heatingUrl.json(); */

  console.log(`[server.js] | ${new Date().toLocaleString()} | Successfully saved current weather conditions`)

  const weatherData = {
    current: current,
    weekly: weekly,
    alerts: alerts,
    alertDetails: alertDetails,
    radar: radar,
    special: { aqi: aqi, pollen: pollen },
/*     indices: { 
      spring: { running: running, mosquito: mosquito, golf: golf },
      winter: { heating: heating, frost: frost, ski: ski }
    } */
  };

  return weatherData;
}

async function getWeatherCoordinates(location) {
  const coordinatesUrl = await fetch(`https://api.weather.com/v3/location/search?query=${location}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const coordinates = await coordinatesUrl.json();
  const locationData = coordinates.location;
  
  if (!locationData) {
    throw new Error(`Location data not found for ${location}`);
  }

  console.log(`[server.js] | ${new Date().toLocaleString()} | Successfully retrieved weather coordinates for ${location}`);
  
  return {
    lat: locationData.latitude[0], 
    lon: locationData.longitude[0], 
    country: locationData.countryCode[0], 
    adminDistrictCode: locationData.adminDistrictCode[0],
    postalKey: locationData.postalKey[0],
    ianaTimeZone: locationData.ianaTimeZone[0]
  };
}

let currentCity = 0

async function loadAllCities() {
  for (const location of serverConfig.locationIndex.locations) {
    try {
      const coordinates = await getWeatherCoordinates(location);

      // Reset structure for each location
      allWeather[location] = {
        coordinates: coordinates,
      };

      const weather = await getWeather(
        coordinates.lat,
        coordinates.lon,
        coordinates.country
      );

      // Directly assign properties without nested indexes
      Object.assign(allWeather[location], {
        current: weather.current,
        weekly: weather.weekly,
        alerts: weather.alerts,
        alertDetails: weather.alertDetails,
        radar: weather.radar,
        special: weather.special,
        indices: weather.indices
      });

      console.log(`Processed ${location}`);
    } catch (error) {
      console.error(`Error processing ${location}: ${error.message}`);
    }
  }
}

async function getLDLWeather(lat, lon, countryCode) { // credit to Dalk for the twc api stuff
  const ldlCurrentUrl = await fetch(`https://api.weather.com/v3/wx/observations/current?geocode=${lat},${lon}&units=${serverConfig.units}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
  const ldlWeeklyUrl = await fetch(`https://api.weather.com/v3/wx/forecast/daily/7day?geocode=${lat},${lon}&format=json&units=${serverConfig.units}&language=en-US&apiKey=${serverConfig.twcApiKey}`);
  const ldlAlertsUrl = await fetch(`https://api.weather.com/v3/alerts/headlines?countryCode=${countryCode}&format=json&language=en-US&apiKey=${serverConfig.twcApiKey}`);
  const ldlAqiUrl = await fetch(`https://api.weather.com/v3/wx/globalAirQuality?geocode=${lat},${lon}&language=en-US&scale=EPA&format=json&apiKey=${serverConfig.twcApiKey}`);
  const ldlAlmanacUrl = await fetch(`https://api.weather.com/v3/wx/almanac/monthly/1month?geocode=${lat},${lon}&format=json&units=${serverConfig.units}&month=1&apiKey=${serverConfig.twcApiKey}`)
  const ldlCurrent = await ldlCurrentUrl.json();
  const ldlWeekly = await ldlWeeklyUrl.json();
  const ldlAlerts = await ldlAlertsUrl.json();
  const ldlAqi = await ldlAqiUrl.json();
  const ldlAlmanac = await ldlAlmanacUrl.json();

  console.log(`[server.js] | ${new Date().toLocaleString()} | Saved data for display on LDL`)

  return {
      ldlCurrent: ldlCurrent,
      ldlWeekly: ldlWeekly,
      ldlAlerts: ldlAlerts,
      ldlAqi: ldlAqi,
      ldlAlmanac: ldlAlmanac,
      }
}

async function getLDLWeatherCoordinates(location) {
const coordinatesUrl = await fetch(`https://api.weather.com/v3/location/search?query=${location}&language=en-US&format=json&apiKey=${serverConfig.twcApiKey}`);
const coordinates = await coordinatesUrl.json();
const locationData = coordinates.location;

if (!locationData) {
  throw new Error(`Location data not found for ${location}`);
}

console.log(`[server.js] | ${new Date().toLocaleString()} | Successfully retrieved weather coordinates for ${location}`);


return {
  lat: locationData.latitude[0], 
  lon: locationData.longitude[0], 
  country: locationData.countryCode[0], 
  adminDistrictCode: locationData.adminDistrictCode[0]
};
}

let currentLDLCity = 0

async function loadAllLDLCities() {
  for (const location of serverConfig.locationIndex.ldlLocations) {
    try {
      const coordinates = await getLDLWeatherCoordinates(location);

      // Reset structure for each LDL location
      ldlWeather[location] = {
        coordinates: coordinates,
      };

      const weather = await getLDLWeather(
        coordinates.lat,
        coordinates.lon,
        coordinates.country
      );

      // Directly assign properties without nested indexes
      Object.assign(ldlWeather[location], {
        current: weather.ldlCurrent,
        alerts: weather.ldlAlerts,
        forecast: weather.ldlWeekly,
        aqi: weather.ldlAqi,
        almanac: weather.ldlAlmanac
      });

      console.log(`Processed ${location}`);
    } catch (error) {
      console.error(`Error processing ${location}: ${error.message}`);
    }
  }
}

async function runDataInterval() {
  await loadAllCities();
  await loadAllLDLCities();
  console.log("Ran data and text generation intervals.");
  console.log("============================================");
  console.log(`### WEATHER HTML DISPLAY SYSTEM ###`);
  console.log(`Created by SSPWXR and ScentedOrange`);
  console.log(`Server is running on http://localhost:${serverConfig.webPort}`);
  console.log("Memory usage:", Math.round(process.memoryUsage().rss / 1024 / 1024), "MB");

  if (serverConfig.twcApiKey.length === 0) {
    console.error(`NO API KEY PRESENT! PLEASE ENTER A WEATHER.COM API KEY...`);
  }
}

runDataInterval()
setInterval(runDataInterval, 480000)

app.use(express.static(path.join(__dirname, 'public')));

app.listen(serverConfig.webPort, () => {});

app.get('/locations', (req, res) => {
  res.json({
    locationIndex: serverConfig.locationIndex,
    })
})

app.get('/data', (req, res) => {
  res.json({
    mainPresentation: allWeather,
    ldlPresentation: ldlWeather,
    units: serverConfig.units
    })
})

process.on('SIGINT', () => {console.log("Exiting WeatherHDS daemon"); process.exit();});
process.on('SIGUSR2', () => {console.log("Exiting WeatherHDS daemon"); process.exit();});
