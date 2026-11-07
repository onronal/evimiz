# Yerel adresler: DHCP rezervasyonu ve otomatik kurtarma

İki yöntem birbirini tamamlar. DHCP rezervasyonu modemde her cihazın MAC adresine aynı yerel IP'yi ayırır. Paneldeki kurtarma ise IP yine değişirse bağlantıyı yenilemeyi dener. İnternet sağlayıcısının dış/statik IP hizmetiyle ilişkili değildir; bu özellik için ücretli statik IP gerekmez.

## Modemde DHCP rezervasyonu

1. Evin Wi-Fi ağına bağlıyken modeminizin yerel yönetim adresini açın. Adres, işletim sisteminde ağ geçidi/yönlendirici olarak görünür.
2. Modem yönetim hesabıyla giriş yapın. Wi-Fi parolası ve modem yönetim parolası farklı olabilir. Yönetim parolası bilinmiyorsa cihaz etiketini/kendi kayıtlarınızı kontrol edin veya sağlayıcıdan erişim desteği alın. Rezervasyon için fabrika ayarlarına sıfırlamak zorunlu değildir.
3. LAN / DHCP bölümünde “Adres rezervasyonu”, “Statik DHCP” veya benzer menüyü bulun. Menü adı modem modeline göre değişir.
4. Panelin Ev ağı listesi ve modemin istemci listesini karşılaştırın. TV, klima, ampul, robot, airfryer ve panel sunucusunun gerçek MAC adreslerini doğrulayın. Sırf üretici adına bakarak cihaz seçmeyin.
5. Her MAC için mevcut ve çakışmayan IP'yi rezerve edin. Adres modem tarafından izin verilen DHCP aralığında olmalıdır. Aynı adresi iki MAC'e vermeyin.
6. Kaydedip rezervasyon tablosunda doğrulayın. Mevcut IP'leri korumak kesinti ihtiyacını azaltır. Sonraki DHCP yenilemesinde adres korunur. Kayıt için gerekmiyorsa modem/cihaz yeniden başlatmayın.

Kullanıcı adı/parola, gerçek evin IP/MAC listesi veya modem ayar yedeğini GitHub'a eklemeyin. Modem parolası olmadan panel bu ayarı uygulayamaz.

## Panelde otomatik kurtarma

- **Xiaomi robot/airfryer:** Durum okuması zaman aşımından sonra miIO keşfi; kayıtlı DID tek eşleşmeli olmalı ve mevcut token ile yeni adreste okuma doğrulanmalı.
- **Tuya ampul:** Durum okuması başarısızsa cihazın kayıtlı kimliğiyle UDP keşfi yapılır. Bulunan adreste mevcut local key ile okuma başarılı olursa yalnız o cihazın IP'si değiştirilir.
- **LG TV:** Mevcut bağlantı MAC adresi veya başarılı okumadan öğrenilen MAC kullanılır. SSDP keşfiyle ağ komşuları güncellenir; aynı MAC tek adreste bulunmalı ve mevcut eşleştirmeyle durum okunmalıdır. Otomatik yeniden eşleştirme yapılmaz. TV kapalıysa bulunamayabilir.
- **Samsung klima:** Başarılı yerel okumada öğrenilen MAC kullanılır. Bağlantı kaybında aynı MAC ağ komşularında aranır. Gerekirse doğrudan bağlı özel `/24` ağındaki en çok 254 adrese sınırlı ping gönderilerek komşu tablosu güncellenir; port taranmaz. Başka ağlar/VLAN'lar taranmaz. Adayda salt okunur klima sorgusu başarılı olmalıdır. MAC eşlemesi kimlik doğrulamasının kriptografik alternatifi değildir.
- **Vestel:** Bulut bağlantısı yerel IP kullanmaz.

Her cihaz için keşif en fazla iki dakikada bir denenir; eşzamanlı okumalar birleştirilir. Kimlik bilinmiyor, birden fazla aday var, okuma doğrulanmıyor veya bağlantı dosyası bu sırada değişmişse adres kaydedilmez. Kapalı cihaz açık sayılmaz. Fiziksel komutlar otomatik tekrarlanmaz. Kurtarma sırasında normalden uzun bekleme olabilir; sonraki okuma yeni adresi kullanır.

LG/Samsung için ilk MAC kaydı cihaz eski adresinde erişilebilirken öğrenilmelidir. Bağlantıyı yönetimden yeniden kaydetmek öğrenilen kimliği temizler. DHCP rezervasyonu özellikle ilk kurulum ve keşfi engelleyen ağlarda önerilir. Başka alt ağlar, istemci izolasyonu, `/24` dışı Samsung ağları ve MAC değişimi otomatik kurtarmayı sınırlayabilir.

Öğrenilen MAC'ler `data/address-identities.json`, güncel adresler cihazların özel bağlantı dosyalarında tutulur; hepsi Git dışında kalır. İzole testlerle kimlik eşleştirme, yanlış cihaz reddi, doğrulama başarısızlığı ve yerel ağ sınırları kontrol edilir. Canlı ağda fiziksel cihazın IP'sini zorla değiştirme testi henüz yapılmamıştır.
