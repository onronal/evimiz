# iPhone ve Web Push bildirimleri

Bildirimler standart Web Push ile gönderilir. Ayrı ücretli bildirim ürünü veya Apple Developer üyeliği bu akışın gereği değildir. Push servis sağlayıcısı tarayıcı tarafından seçilir; iPhone Apple Push Notification service kullanır. İnternet ve kullanıcı izni gerekir.

## iPhone'da açma

1. Panelin sabit **HTTPS** adresini Safari'de açın ve hesabınızla giriş yapın.
2. Paylaş → Ana Ekrana Ekle. Eski yerel HTTP kısayolu yerine HTTPS uygulamasını kullanın.
3. Uygulamayı ana ekran simgesinden açın.
4. Bildirimler → **Bildirimleri aç** düğmesine dokunun; iOS izin penceresini kendiniz onaylayın.
5. **Test bildirimi gönder** düğmesine basın. Sunucu yaklaşık 30 saniye içinde göndermeyi dener. Gerekirse uygulamayı arka plana alıp kilit ekranında kontrol edin.

iOS/iPadOS 16.4+ ana ekran web uygulaması ve desteklenen güncel tarayıcı gerekir. Normal Safari sekmesinde Push API sunulmayabilir. Bildirim izni kullanıcı dokunuşuyla istenir; panel otomatik izin veremez. Ret durumunda iPhone bildirim ayarlarını kontrol edin.

## Hangi olaylar?

- Çamaşır, bulaşık, robot ve airfryer: gözlenen çalıştırıldı/tamamlandı.
- Kullanılmama: son kayıt üzerinden ilgili eşik aşılınca bir kez; yeni çalışma yeni hatırlatma dönemi açar.
- İnternet: ilk kötü veya başarısız ölçümde bir kez; normalleşip yeniden kötüleşirse yeni dönem.
- Ampul/klima için aç/kapat olay bildirimi üretilmez.

Abone olmadan önceki cihaz olayları telefona topluca gönderilmez. Her telefon kendi iznini verir. Çıkış yapınca o tarayıcının aboneliği kapatılır. Hesabı devre dışı bırakılan kullanıcının abonelikleri temizlenir. Kilit ekranı metinleri cihaz adı/aktivite içerebilir; görünürlüğü telefonunuzdan yönetin.

## Saklama ve teslim sınırları

`data/push.json` VAPID özel anahtarı, kullanıcıya bağlı abonelik uçları ve gönderim kuyruğunu tutar. Bu dosya Git'e gönderilmez. API yalnız genel VAPID anahtarını ve o kullanıcının abonelik sayısını döndürür. Süresi biten abonelikler 404/410 yanıtıyla silinir. Geçici hata kontrollü tekrar denenir; aynı olay kuyrukta tekrar üretilmez. İnternet düzeldiyse bekleyen kötüleşme uyarısı, hatırlatma geçersiz olduysa bekleyen hatırlatma iptal edilir.

Sunucu açıkken çalışır. Ev interneti tamamen kesildiğinde Apple/Google/Mozilla servisine ulaşılamaz; bağlantı dönene kadar gönderim yapılamaz. Teslim hizmetinin komutu kabul etmesi ekranda gösterildiğinin kesin kanıtı değildir. VAPID anahtarı veya HTTPS origin değişirse telefonların yeniden abone olması gerekebilir. Yedek, özel verilerle korunmalıdır.

Kaynak: [WebKit — iOS ana ekran Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push kitaplığı](https://github.com/web-push-libs/web-push).

Bu geliştirmede mevcut iPhone ana ekran uygulamasına test bildiriminin ulaştığı kullanıcı tarafından doğrulandı. Başka telefon/kurulum için aynı test ayrıca yapılır.

## Yönetimden bildirim tercihleri

**Yönetim → Bildirim ayarları** ev genelinde internet kötüleşmesi, temizlik hatırlatmaları ve tatil etkinliği bildirimlerini açıp kapatır. Cihaz kartları katalogdaki bildirim yeteneklerinden dinamik üretilir: destekleyen cihazlarda çalıştırıldı/tamamlandı ayrı seçilir; temizlik cihazında hatırlatma ve gün eşiği cihaz örneğine özeldir. Yeni cihaz eklendiğinde seçenekleri görünür. Ampul/klima için normal aç/kapat olayı sunulmaz. Hesap devre dışı bırakılmış veya cihaz kaydı kapatılmışsa bildirim gönderilmez.

Bu ayarlar kayıt toplamayı durdurmaz ve geçmişi silmez. Kapatılan olayların bekleyen push tekrarları sonraki bildirim taramasında iptal edilir. Her telefonun tarayıcı izni ayrıca gerekir; yönetici uzaktan telefon izni veremez. Tercihler `data/state.json` içinde özel tutulur; yalnız yönetici değiştirebilir. Yeni kurulumda varsayılan olarak desteklenen bildirimler açıktır.

Ölçüm sıklığı **Yönetim → İnternet ölçümü** üzerinden seçilir. 3 dakikalık aralık test başına yaklaşık 6 MB ile günde 2.880 MB kullanır; ilk kötü veya başarısız ölçümde uyarı üretilir (3 dakikalık aralıkta sonraki ölçüme kadar yaklaşık 0–3 dakika, ayrıca push tarama/teslim gecikmesi). Tek test sürerken ikinci test başlamaz. Ölçümler kısa örneklemdir ve evin diğer trafiğinden etkilenir. Saklanan son 96 ölçüm, 3 dakikalık aralıkta yaklaşık 4 saat 48 dakikalık geçmiş demektir.

## Yakın deprem bildirimi

Yönetim → Deprem takibi, AFAD olayları için büyüklük ve mesafe filtresini ve bu bildirimlerin etkinliğini yönetir. Varsayılan >3 ve 100 km, sorgu iki dakikadır. Bu bölüm temizlik hatırlatmalarından bağımsızdır. Ayrıntı ve sınırlar: [hava ve deprem bilgileri](environment-alerts.md).

## Tahmini yıkama bitişi

Vestel'in kalan süre alanı sabit kalabildiğinden panel, son bildirilen süreyi gözlenen çalışma boyunca azaltır. Sayaç sıfıra indiğinde bildirim “tahmini süreye göre tamamlandı” der; cihazın gerçek bitiş onayı değildir. Sonraki gerçek bitiş aynı olay kimliğini onaylar ve ikinci bildirim oluşturmaz. Başlangıç ve bitiş geçmişte tek çalışma olarak görünür. Bu sayaç fiziksel komut göndermez.
