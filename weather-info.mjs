import {readFile} from 'node:fs/promises';
const provinces=JSON.parse(await readFile(new URL('./mgm-provinces.json',import.meta.url),'utf8'));
const normalize=s=>s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();
export function provinceFor(place){const parts=String(place?.label||'').split('/').map(normalize);return Object.entries(provinces).find(([name])=>parts.includes(normalize(name)))||null;}
export function selectWeatherAlerts(rows,place,now=Date.now()){
 if(!Array.isArray(rows))throw Error('MGM veri biçimi değişti.');const province=provinceFor(place);if(!province)return {province:null,alerts:[]};const alerts=[];
 for(const row of rows){const begin=Date.parse(row.begin),end=Date.parse(row.end);if(!Number.isFinite(begin)||!Number.isFinite(end)||end<now||begin>now+86400000)continue;for(const [color,label]of [['red','Kırmızı'],['orange','Turuncu'],['yellow','Sarı']]){if(row.towns?.[color]?.some(code=>Math.floor(Number(code)/100)===province[1])&&typeof row.text?.[color]==='string'){alerts.push({id:String(row.alertNo||row._id)+':'+color,color,label,text:row.text[color].slice(0,2500),begin:new Date(begin).toISOString(),end:new Date(end).toISOString(),province:province[0],url:'https://www.mgm.gov.tr/meteouyari/turkiye.aspx?Gun=1'});break;}}}
 return {province:province[0],alerts};
}
export async function fetchWeatherAlertRows(){const all=await Promise.all(['today','tomorrow'].map(async day=>{const r=await fetch('https://servis.mgm.gov.tr/web/meteoalarm/'+day,{headers:{Origin:'https://www.mgm.gov.tr',Referer:'https://www.mgm.gov.tr/'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('MGM yanıt vermedi.');const rows=await r.json();if(!Array.isArray(rows))throw Error('MGM veri biçimi değişti.');return rows;}));return [...new Map(all.flat().map(r=>[r.alertNo||r._id,r])).values()];}
export function weatherAdvice(data,now=Date.now()){
 if(!data.weather||!Number.isFinite(data.weather.temperature_2m)||!Number.isFinite(data.weather.weather_code)||!Number.isFinite(Date.parse(data.weatherAt))||now-Date.parse(data.weatherAt)>30*60000)return 'Güncel hava verisi bekleniyor.';
 const w=data.weather,code=w.weather_code;
 if(code>=95)return 'Gök gürültülü hava görünüyor; dışarı çıkmadan önce MGM uyarılarını kontrol edin.';
 if(w.wind_gusts_10m>=50)return 'Rüzgâr kuvvetli görünüyor; balkon ve açık pencereleri kontrol edin.';
 if([71,73,75,77,85,86].includes(code))return 'Kar yağışı görünüyor; dışarı çıkarken ulaşım koşullarını kontrol edin.';
 if(code>=51&&code<=82)return 'Yağış görünüyor; dışarı çıkarken şemsiye almayı düşünebilirsiniz.';
 if(w.temperature_2m>=30)return 'Dışarısı sıcak; güneş alan perdeleri kapatmak içerinin serin kalmasına yardımcı olabilir.';
 if(w.temperature_2m<=5)return 'Dışarısı soğuk; havalandırmayı kısa tutmayı düşünebilirsiniz.';
 return 'Hava koşulları sakin görünüyor; kısa bir havalandırma için iç ve dış sıcaklığı karşılaştırabilirsiniz.';
}
