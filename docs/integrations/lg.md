# LG webOS TV — temiz kurulum

LG hesabı, ThinQ bulut projesi veya ortak erişim anahtarı gerekmez. Panel, TV'nin yerel webOS SSAP arayüzünü kullanır. Her TV, kumandayla onaylanan kendi eşleştirme anahtarını verir. 65QNED86T6A üzerinde güvenli eşleştirme, güç durumu ve ses/sessiz okuması doğrulandı. Güç/ses değiştirme ve Wake-on-LAN komutları henüz fiziksel olarak test edilmedi; diğer model/firmware uyumluluğu ayrıca doğrulanmalıdır.

## Gereksinimler

- Node.js 22.12 veya üstü ve `npm ci` (Raspberry Pi dahil; yerel derleme bağımlılığı gerekmez).
- Panel sunucusu ile TV aynı erişilebilir yerel ağda; misafir Wi-Fi/istemci izolasyonu kapalı olmalı.
- TV açık olmalı. Menü adları yıla göre değişebilir: LG Connect Apps, Mobil cihazla TV'yi aç veya IP kontrolü.
- Eşleştirme isteğini TV ekranında kullanıcı onaylar. Panel izin istemini otomatik kabul etmez.

## Yönetim akışı

1. Panelin çalıştığı bilgisayarda `http://127.0.0.1:4173` adresinde yönetici hesabıyla giriş yapın.
2. Yönetim → Entegrasyonlar → LG → **Bu bilgisayarda TV eşleştir** (`/lg-setup`). Bu yerel ekrandaki işlem TV eşleştirmesidir, LG hesabı girişi değildir.
3. **Ağdaki LG TV'leri bul** düğmesine basın. SSDP yayınıyla bulunan IP'yi seçin. Sonuç yoksa açık TV'nin Ağ ayarlarındaki yerel IP'yi girin. Keşif yanıtı tek başına model veya bağlantı başarısı kanıtı değildir.
4. İsim, model ve oda seçip bağlantıyı kaydedin. Mevcut TV kaydını seçerek IP/MAC bilgisini de güncelleyebilirsiniz. MAC kaydetmeden ağdan açma kullanılamaz.
5. Yeni TV'lerde **güvenli webOS / 3001** seçin. TLS bağlantısında lgtv2'nin LG sertifika zinciri pin kontrolü kullanılır; genel sertifika kontrolü tüm uygulama için kapatılmaz. Eski TV'ler için açıkça seçilen 3000 seçeneği şifresiz yerel bağlantıdır. Otomatik şifresiz geri dönüş yapılmaz. LG'nin ortak sertifika zinciri TV'nin tekil kimliği değildir; TV ekranındaki fiziksel onayı doğru cihazda verin.
6. **Eşleştirme isteği gönder** düğmesine basıp TV ekranında izin verin. Sonuç ekranda görünür. Bu işlem TV'nin gücünü/sesini değiştirmez.
7. Cihazlar sayfasından durumu okuyun. Güç, ses seviyesi (0–100) ve sessiz kontrolleri sunulur. Bütün webOS modellerinde tüm durum alanları bulunmayabilir; bilinmeyen değer kapalı sayılmaz.

Kurulum uçları yalnız yerel yöneticiye açıktır; Funnel üzerinden `/lg-setup` ve `/api/lg/*` engellenir. Sonradan eşleştirilmiş TV'nin günlük kontrolleri mevcut kullanıcı/CSRF denetimiyle panelden kullanılabilir. LG, bu sürümde otomasyon komut listesine eklenmemiştir. Tatil modunda doğrulanabilen açık durum gözlemi bildirim kapsamındadır; normal aç/kapat aktivite bildirimi gönderilmez.

## Açma ve kapatma farklıdır

Kapatma, TV'nin SSAP komutuyla yapılır. Açma için isteğe bağlı **MAC adresi**, TV'de ağdan uyandırma desteği ve ağın Wake-on-LAN yayınlarını geçirmesi gerekir. Wi-Fi, derin bekleme ve firmware bu özelliği sınırlayabilir. Uyandırma paketi gönderilmesi “TV açıldı” diye raporlanmaz; durum ayrıca okunmalıdır. MAC adresini TV'nin kullanılan ağ arayüzünden alın. Eşleştirmede TV’nin ağ bilgi servisi IP ile eşleşen arayüzün MAC adresini döndürürse özel `data/lg/<device-id>/wake.json` içine kaydedilir. Eşleşme yoksa MAC elle girilmelidir. Mevcut ev TV’sinin MAC bilgisi, eşleştirmeyle doğrulanan IP’nin yerel ARP kaydından ayrıca edinilmiştir; temiz kurulum bu özel bilgiyi içermez.

## Özel veriler

Cihaz adı/model/oda `data/state.json`, IP/bağlantı/MAC `data/device-connections/<device-id>.json`, eşleştirme anahtarı `data/lg/<device-id>/client.key` içinde tutulur. Anahtar dosyası 0600, dizin 0700 izinleriyle oluşturulur. Başka TV kaydı aynı anahtarı kullanmaz. Anahtarlar forma/API durum yanıtına verilmez ve Git'e eklenmez. Temiz kurulum bu dosyaları içermez. TV eşleştirmeyi unutursa yönetimden yeniden eşleştirin; normal durum okuması kendiliğinden yeni erişim onayı istemez.

## Kaynak ve sınırlar

[lgtv2 2.1.0](https://github.com/hobbyquaker/lgtv2), MIT lisansı. Paket sürümü sabitlenmiştir; kurulum `npm ci` ile yapılır. Kontrol portları 3001 (wss) / 3000 (ws), keşif SSDP/UDP 1900, uyandırma UDP 9'dur. Gerçek QNED86 için eşleştirme, durum, ses ve güç işlemleri ayrı fiziksel doğrulamalar gerektirir. Sentetik testler bu doğrulamanın yerine geçmez. IP için modemden DHCP rezervasyonu önerilir.

## Oynat / Duraklat

Cihazlar → LG TV kartında **Oynat** ve **Duraklat** düğmeleri bulunur. TV'de açık uygulamanın mevcut oynatıcısını kontrol eder; kumandayla bir içerik seçilmiş olmalıdır. İmleç ve kumanda açılır bölümünde analog kol, tıklama, yön, Tamam, Geri ve Ana ekran kontrolleri bulunur. Uygulama listesi ayrı açılır bölümdedir; yalnız kullanıcı Uygulamaları yükle düğmesine bastığında okunur. Uygulama/içerik seçimi TV uygulamasının kumanda ve imleç desteğine bağlıdır. Medya desteği uygulamaya ve firmware'e bağlıdır; SSAP komutunun kabulü görüntünün değiştiğini tek başına kanıtlamaz.

Panel güç/ses kontrolü, güç/ağ durumu, `CONTROL_INPUT_MEDIA_PLAYBACK`, `CONTROL_MOUSE_AND_KEYBOARD`, kurulu uygulamaları okuma ve uygulama başlatma izinlerini ister. Önceden eşleştirilen TV'de medya kontrolü reddedilirse yönetimden yeniden eşleştirin; TV ekranında kullanıcı onayı gerekir. Eski anahtar, yeni eşleştirme başarıyla kaydedilene kadar korunur. Protokol uçları: [aiowebostv kaynakları](https://github.com/home-assistant-libs/aiowebostv/blob/main/aiowebostv/endpoints.py). Oynat/duraklat komutları sentetik istemciyle test edilir; gerçek oynatma içeriği test için değiştirilmez.

## İmleç bağlantısı

Telefondaki imleç alanında kaydırma göreli hareket, kısa dokunma tıklama gönderir. Yön tuşları, Tamam, Geri ve Ana ekran alternatif kumanda kontrolleridir. TV'nin döndürdüğü özel imleç adresi yalnız eşleştirilmiş TV'nin aynı IP/protokol/portuna kabul edilir; güvenli bağlantıda LG sertifika zinciri ayrıca kontrol edilir. Soket 30 saniye hareketsizlikten sonra kapanır. İstemci hareketleri birleştirir ve aynı anda tek hareket isteği tutar; sunucu delta ve tuşları izin listesiyle sınırlar. Gelişigüzel tuş metni veya URL kabul edilmez.

Özel imleç soketine bağlantının kurulabilmesi, her TV uygulamasının tüm hareketleri desteklediği anlamına gelmez. Netflix gibi uygulamalarda yön/Tamam düğmeleri daha kullanışlı olabilir. Medya, imleç ve uygulama başlatma komutları yalnız kullanıcı dokunuşuyla gönderilir; sayfa açıldığında fiziksel hareket/oynatma komutu üretilmez.

## Hızlı durum ve metin girişi

TV güç/ses değişiklikleri abonelikle ortak duruma iletilir; yaklaşık 30 saniyelik sunucu okuması yedek olarak sürer. Telefonlar tek canlı bağlantı üzerinden güncellenir. Aktif imleç sürüklemesinde arayüz güncellemesi ertelenir. Aynı TV için eşzamanlı durum okumaları birleştirilir; sunucuda 1 saniyelik kısa durum önbelleği vardır. Kontrol bağlantısı her okumada yeniden kurulmaz; 90 saniye kullanılmazsa kapanır. İmleç bağlantısı ayrı kalır, durum okumasının komut kuyruğunda beklemez. İmleç paneli açıldığında giriş komutu göndermeden soket hazırlanır. Hareketler yaklaşık 32 ms asgari aralıkla, aynı anda tek ağ isteğiyle birleştirilir; gerçek hız ağ gecikmesine bağlıdır. Hassasiyet telefondaki kaydırıcıyla ayarlanır.

**Klavye / Arama:** önce TV uygulamasındaki metin alanını seçin. Telefona metni yazıp **Metni gönder** kullanın. Varsayılan eklemedir; **TV’deki mevcut metni değiştir** açıkça seçilirse odaklanmış alanın metni değiştirilir. **Ara / Enter** ve **Son karakteri sil** ayrı düğmelerdir. webOS IME desteği uygulamaya göre değişebilir; her YouTube/Netflix sürümünde veya özel ekran klavyesinde çalışacağı garanti edilmez. Metinler çalışma geçmişine, yapılandırmaya veya loga kaydedilmez. En fazla 500 karakter ve izin listeli eylemler kabul edilir.

Metin girişi `CONTROL_INPUT_TEXT` izni gerektirir; eski eşleştirmede yönetimden yeniden izin alınır. Bu geliştirmede testler sahte istemciyle metin/Enter/sil komutlarını ve bağlantı tekrar kullanımını doğrular. Gerçek TV’ye test metni gönderilmez.

## Duruma göre kontroller

TV açıkken açma düğmesi gizlenir. Kapalı veya durum bilinmiyorsa ses, medya, imleç ve klavye kontrolleri gizlenir; açma ve durumu yenile seçenekleri kalır. Bilinmeyen bağlantı kapalı diye raporlanmaz.

## Harici ses çıkışı ve analog kol

Durum okuması TV'nin ses çıkışını da sorgular. Harici çıkışta 0–100 mutlak ses alanı gizlenir; `audio/volumeUp` ve `audio/volumeDown` uçlarıyla göreli Ses + / Ses − sunulur. HDMI ARC/CEC veya soundbar eşleştirmesinin buna cevap vermesi garanti edilmez. Ses çıkışı otomatik değiştirilmez; harici çıkış biliniyorsa mutlak ses yazımı sunucuda reddedilir. Başarılı komut yanıtı gerçek soundbar etkisi sayılmaz. Referans: [aiowebostv uçları](https://github.com/home-assistant-libs/aiowebostv/blob/main/aiowebostv/endpoints.py).

İmleç analog kolla kontrol edilir. TV kartı Tam ekran düğmesiyle büyütülebilir. Analog kol Pointer Events ile yerel arayüzde uygulanır; yeni bir üçüncü taraf paket veya CDN gerektirmez. Parmak bırakma, iptal, pencere odağı kaybı, gizlenme veya kumandayı kapatma hareket üretimini durdurur. Tek devam eden komut ve sınırlı hareket kuyruğu korunur; son gönderilmiş paket geri alınamaz. Bu bir PlayStation/Gamepad donanım entegrasyonu değildir.
