# Xiaomi / Mi Home bağlantısı

## Yetki nereden verilir?

Kendi Mi Home hesabınızla **yerel QR oturumu** açılır. Genel bir “bizim uygulamamıza herkese ortak yetki ver” bağlantısı yoktur. Her kullanıcı kendi hesabını ve kendi cihaz token'larını kullanır. Panelin bağlantı formu QR oturumunu henüz otomatik başlatmaz; yardımcı CLI kullanılır.

Önce Mi Home içinde cihazların kendi hesabınızda göründüğünü kontrol edin. Uygulamada gösterilen ülke ile gerçek bulut bölgesi farklı olabilir; doğru veri merkezini doğrulayın, rastgele her bölgeye hesap verisi göndermeyin.

```sh
python3 -m venv data/xiaomi-venv
data/xiaomi-venv/bin/pip install mihome-ctl==0.7.0
data/xiaomi-venv/bin/python xiaomi-setup.py extract --help
# Kendi doğru bölgenizi kullanın; aşağıdaki sg yalnız komut örneğidir:
MIHOME_CTL_HOME="$PWD/data/xiaomi" data/xiaomi-venv/bin/python xiaomi-setup.py extract --server sg --out data/xiaomi/mi-tokens.json
```

Araç bir QR gösterir; Mi Home'da kendi hesabınızla onaylayın. `xiaomi-setup.py` yardımcı QR sunucusunu yalnız `127.0.0.1` üzerinde tutar. Çıktıda token bulunabilir; terminal çıktısını issue veya GitHub'a kopyalamayın. Dosyalar `data/xiaomi/` altında kalır. Gerekirse kütüphanenin kendi `--help` seçeneklerini izleyin.

Sonra Evimiz → Yönetim → Cihaz ekle: desteklenen robot veya airfryer kaydını oluşturun. Bağlantısına IP, DID, token ve model kodunu girin. Yeni örnekler birbirinin token veya haritasını kullanmaz.

## Harita ve oda temizliği

Mevcut ev robotunun kayıtlı haritası okunmuştur. Robot kartından oda adları yönetilir. Otomasyonda “Seçilen odaları temizle” seçeneği yalnız o robot için kayıtlı harita/odalar varsa çıkar. Kural harita kimliğini saklar; uyuşmazlıkta komut reddedilir.

Yeni bir robot için harita edinme henüz tek düğmelik sihirbaz değildir. Yeni model eklenirken harita okuyucu/parçalayıcı robot örneğine özel geliştirilmelidir. Harita isteği buluta yükleme tetikleyebiliyorsa ev sahibinin harita paylaşımı onayı alınmalıdır. Gerçek harita public fixture yapılmaz. Harita değişince eski otomasyon oda seçimi yeniden doğrulanır.

Mevcut cihazda oda komutunun temizliği başlattığı kullanıcı tarafından gözlendi; seçilen her odanın fiilen tamamlanması ayrı doğrulanmadı. Kod, doğru kimlikleri seçme ve başka robotun haritasını kullanmama kontrollerine sahiptir; bu, fiziksel doğrulamanın yerine geçmez.

Destek: `dreame.vacuum.p2140p`, `careli.fryer.maf02`. Mi Home'daki her ürün desteklenmez. Airfryer yalnız okunur. Yeniden eşleştirme sonrası token değişebilir.

Kaynak: [mihome-ctl](https://github.com/daviddwlee84/mihome-ctl). Yardımcı aracın lisansını ve kullanılan sürümün belgelerini inceleyin.

## Dosya düzenlemeden bağlantı

Yönetim → Entegrasyonlar → Xiaomi → **Bu bilgisayarda cihaz bağla**, sunucuda `/integration-setup?brand=xiaomi` ekranını açar. Desteklenen tür, isim, oda, IP, DID, token ve model aynı formda kaydedilir; cihaz kaydı ile özel bağlantı dosyası birlikte oluşturulur. Form Mi Home hesabının parolasını istemez. Token/DID edinmek için yukarıdaki QR yardımcı aracı hâlâ gereklidir; web QR oturum sihirbazı uygulanmış değildir. Anahtarlar API'den geri okunmaz. Kaydetmek temizlik veya pişirme başlatmaz; canlı durum cihazlar sayfasından okunur.

## Oda komutu uyumluluk düzeltmesi

`dreame.vacuum.p2140p` için oda temizliği, modelde kullanılan genişletilmiş `action 4.1` ile çalışma modu 18 ve `selects` parametreleri üzerinden gönderilir. [Model için birincil uygulama örneği](https://github.com/rytilahti/python-miio/issues/1412). Önceden kullanılan `2.3` / Room IDs isteğinin kabul yanıtı robotun hareket ettiğini doğrulamıyordu. Yeni gövde robotun güncel emiş (4.4) ve su (4.5) değerlerini okuyup korur; okunamazsa komut göndermez. Tek geçiş ve seçilen oda sırası kullanılır. Harita kimliği ve odalar eylemden önce doğrulanır; seçimsiz veya yanlış oda durumunda tüm evi temizlemeye geri dönüş yapılmaz.

Bu gövde sentetik testle doğrulanır; fiziksel oda temizliği ayrıca ev sahibinin seçtiği odada test edilmelidir. Komut kabulü “temizlik başladı” diye sunulmaz. Oda adları, harita ve temizlik modu ayrı kavramlardır; yanlış fiziksel odaya eşlenmiş isimler yönetimden kontrol edilmelidir.

Aynı yerel IP'ye giden miIO istekleri sunucuda sıraya alınır. `get_properties` zaman aşımı bir kez yeniden denenir; eylem/temizlik komutu otomatik tekrarlanmaz. UDP sorgu çakışması ve aralıklı erişim sorunları komut biçiminden ayrı değerlendirilmelidir. Son teşhiste robot şarjda/hatasız okunmuş; arka plan sorgularından ayrı emiş/su okuması başarılı olmuştur. Fiziksel oda hareketi kabul yanıtından çıkarılamaz.

Son düzeltmeler sonrasında kullanıcı, oda seçimiyle robotun çalışmaya başladığını doğruladı. Doğru fiziksel odaya varış ayrıca gözlemlenmelidir. Bu sonuç, aralıklı erişimin uyku modundan kaynaklandığını tek başına kanıtlamaz; ayrı bir uyandırma eylemi eklenmemiştir.
