// An artistic seasonal sun path, not an address-based solar calculation.
export const DEFAULT_LIGHTING = { time: 14, season: 'summer', weather: 'sunny', direction: 0, intensity: 1, altitude: null };
export const SEASONS = [
  { id: 'spring', name: '春季', dayLength: 12, altitude: 55 },
  { id: 'summer', name: '夏季', dayLength: 14.5, altitude: 74 },
  { id: 'autumn', name: '秋季', dayLength: 12, altitude: 49 },
  { id: 'winter', name: '冬季', dayLength: 9.5, altitude: 31 },
];
export const WEATHER = [
  { id: 'sunny', name: '晴天', direct: 1, ambient: 1, sky: '#e7edf7', shadows: true },
  { id: 'cloudy', name: '多云', direct: .5, ambient: .9, sky: '#d3dce8', shadows: true },
  { id: 'overcast', name: '阴天', direct: .06, ambient: .7, sky: '#b8c1ce', shadows: false },
  { id: 'rain', name: '雨天', direct: .02, ambient: .45, sky: '#8795aa', shadows: false },
];
export function timePresets(settings) {
  const { sunrise, sunset } = sunState(settings);
  const quarter = value => Math.round(value*4)/4;
  return [{name:'清晨',time:quarter(sunrise+.5)}, {name:'正午',time:12}, {name:'黄昏',time:quarter(sunset-.5)}, {name:'夜晚',time:21}];
}
export function timeLabel(value) {
  const minutes = Math.round(value * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
}
export function validLighting(value) {
  return value && SEASONS.some(s=>s.id===value.season) && WEATHER.some(w=>w.id===value.weather)
    && Number.isFinite(value.time) && value.time>=0 && value.time<=24
    && Number.isFinite(value.direction) && value.direction>=0 && value.direction<=360
    && Number.isFinite(value.intensity) && value.intensity>=0 && value.intensity<=2
    && (value.altitude == null || (Number.isFinite(value.altitude) && value.altitude>=-35 && value.altitude<=90));
}
export function sunState(settings) {
  const season = SEASONS.find(s=>s.id===settings.season) || SEASONS[1];
  const weather = WEATHER.find(w=>w.id===settings.weather) || WEATHER[0];
  const sunrise = 12-season.dayLength/2, sunset = 12+season.dayLength/2;
  const progress = (settings.time-sunrise)/season.dayLength;
  const scheduledDay = progress>0 && progress<1;
  const automaticAltitude = scheduledDay ? Math.sin(progress*Math.PI)*season.altitude : -Math.min(35,Math.min(Math.abs(settings.time-sunrise),Math.abs(settings.time-sunset))*10);
  const manual = settings.altitude != null;
  const altitude = manual ? settings.altitude : automaticAltitude;
  const day = manual ? altitude>0 : scheduledDay;
  const daylight = Math.max(0,Math.min(1,(altitude+8)/22));
  const sunlight = Math.max(0,Math.min(1,altitude/15));
  const warmth = day ? Math.max(0,1-altitude/30) : 0;
  const azimuth = (progress*Math.PI-Math.PI/2) + settings.direction*Math.PI/180;
  const elevation = altitude*Math.PI/180;
  return {sunrise,sunset,day,altitude,daylight,warmth,weather,
    position:[-Math.sin(azimuth)*Math.cos(elevation)*24,Math.sin(elevation)*24,Math.cos(azimuth)*Math.cos(elevation)*24],
    direct:6.4*sunlight*weather.direct*settings.intensity,
    ambient:.06+.52*daylight*weather.ambient,
    fill:.015+.12*daylight*weather.ambient,
    period:manual?(day?'手动日照':daylight>0?'暮光':'夜晚'):day?(altitude<20?(settings.time<12?'清晨':'黄昏'):'白天'):(daylight>0?'暮光':'夜晚'),
  };
}
