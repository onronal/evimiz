# Hava notu, MGM uyarıları ve yakın deprem kayıtları

## Hava bilgisi

Ana sayfadaki kısa cümle güncel Open-Meteo ölçüm/tahmin verisinden deterministik kurallarla üretilir. LLM veya ücretli AI API'si kullanılmaz; “AI yorumu” olarak sunulmaz. Gök gürültüsü, rüzgâr hamlesi, kar, yağış, sıcak ve soğuk koşullarına uygun kısa bir öneri seçilir. Eski/eksik veriden öneri üretilmez. Bu bölüm cihazları otomatik çalıştırmaz.

MGM uyarıları ayrı gösterilir. Kaynak, MGM'nin MeteoUYARI sayfasının kullandığı `https://servis.mgm.gov.tr/web/meteoalarm/today` ve `tomorrow` uçlarıdır. Türkiye geneli veri sunucuda 15 dakika önbelleklenir; ev konumu MGM'ye gönderilmez. `mgm-provinces.json` MGM il kodu/adı eşlemesidir; kaynak [MGM il listesi](https://www.mgm.gov.tr/meteouyari/Scripts/ilInfo.js). Ev konumunun etiketindeki il adıyla eşleşir. Bir ilçede uyarı bulunması ilin kartında gösterilebilir: panel açıkça **il düzeyinde** olduğunu belirtir; bu, evin ilçesinin mutlaka etkilendiği anlamına gelmez. Geçerlilik zamanı, renk, kaynak ve son kontrol zamanı gösterilir. İl bulunamazsa veya kaynak hata verirse “uyarı yok” denmez. Resmî ayrıntı [MGM MeteoUYARI](https://www.mgm.gov.tr/meteouyari/turkiye.aspx?Gun=1) sayfasından kontrol edilir. Hava bağlantısı, mevcut konum paylaşım ayarına bağlıdır.

Bu servis MGM sitesinin kullandığı web servisidir; garantili üçüncü taraf API sözleşmesi varsayılmaz. Şema/erişim değişirse bağlayıcı güncellenmelidir. Bu sürüm MGM uyarılarını bilgi kartı olarak gösterir; meteorolojik push bildirimi eklenmemiştir.

## Deprem takibi

[AFAD olay servisi](https://deprem.afad.gov.tr/event-service) iki dakikada bir son 48 saat için sorgulanır. Türkiye ve çevresi sabit sınırları (30–45°N, 25–47°E) kullanılır; ev koordinatları AFAD'a gönderilmez. Veri kaynağı dış IP adresini görür. Bu kapsam dışında yaşayan kullanıcı için farklı kaynak/bölge adaptörü gerekir. AFAD'ın UTC olay zamanı yerel görüntüleme saatine dönüştürülür.

Varsayılan filtre büyüklük **> 3**, eve kuş uçuşu **100 km** uzaklıktır. “Büyüklük” yerelde hissedilen “şiddet” değildir. Yönetim → Deprem takibi üzerinden 3–9 büyüklük eşiği ve 10–500 km sınırı seçilebilir; sınır büyüklüğü hariçtir (3 seçilirse tam 3.0 bildirilmez). Konum seçilmeden takip açılamaz. Konumu olan mevcut kurulumda ilk sürüm varsayılanlarıyla takip açılır; boş kurulumda konum ve takip ayrıca ayarlanır.

Yakın olaylar özel `data/earthquakes.json` içinde tutulur (en yeni 1.000). Ana sayfa son üçünü, Deprem kayıtları sayfası 20'şer sayfalar halinde gösterir. Ayarlar özel `data/state.json` içindedir. Kaynak hata verirse eski kayıtlar korunur ve son başarılı kontrol zamanı/hata gösterilir. Eski kayıtlar ilk kurulumda topluca push edilmez. Yeni yayımlanan, takip başlangıcından sonraki eşleşen olaylar AFAD olay kimliğiyle bir kez bildirilir. Büyüklük revizyonu aynı olayı tekrar tekrar bildirmez. Ayar değişiminde takip başlangıcı yenilenir.

Bu sistem erken deprem uyarısı değildir: olayın meydana gelmesi, AFAD tarafından yayımlanması, panelin sorgulaması ve Web Push teslimi sonrasında bildirim gelir. İnternet/sunucu kesintisi veya kaynak gecikmesi teslimi geciktirebilir ya da kaçırabilir. Resmî güvenlik sisteminin yerine geçmez. Bildirim izni her telefonda ayrıca verilmelidir. Tatil modu deprem bildirimlerini durdurmaz. Takibi kapatmak kayıtları silmez; bekleyen bildirimler sonraki push taramasında iptal edilir.

Geliştirme doğrulaması: mesafe, büyüklük sınırı, eski olayları bildirmeme, tekrarları önleme, kaynak kesintisi, MGM il/zaman eşlemesi ve yönetici/üye HTTP denetimleri sentetik verilerle test edilir. Gerçek bir deprem meydana getirme veya gerçek uyarı push testi yapılmaz.
