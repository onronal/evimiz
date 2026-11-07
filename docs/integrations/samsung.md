# Samsung yerel bağlantısı

Panelin /api/climate uçları artık local-climate.mjs üzerinden samsung-local.py dosyasını çalıştırır. SmartThings bulutuna veya kişisel erişim anahtarına otomatik dönüş yapılmaz. Eski SmartThings kurulum dosyaları korunur ancak panelin yerel bağlantısı bunları kullanmaz.

Doğrulanan cihaz: AR70F18C1DBNSK, UDP 49154. Önceki bağlantının IP adresi data/samsung-local/connection.json içinde; yeni örnekler yönetimden kendi IP adresini alır. IP değişirse özel bağlantı dosyası güncellenmeli; modem erişimi sağlandığında DHCP rezervasyonu önerilir.

Python ve bağımlılıklar data/python ve data/samsung-venv içinde. Özel anahtar data/samsung-local/client.key içinde, yalnızca kullanıcıya okunabilir. data dizini ağdan sunulmaz ve Git tarafından izlenmez. Bu dizini herkese açık repo’ya veya yedeğe koymayın.

Bağımlılık: smartthings-local 0.1.24 (PyPI). Protokol kaynakları: https://github.com/QuiteYellow/SmartThings-Local ve https://github.com/mbillow/localthings . Kullanıcı bu cihazda yerel sertifika yöntemine açık onay verdi. Güvenlik kaynaklarına yazma ve sahiplik değişikliği uygulanmaz.

Sıcaklık, güç ve mod /device/0 üzerinden okunur. Komutlar yalnızca ilgili alanı yazar; sonuç ilgili kaynaktan geri okunur. Komut alındısı tek başına başarı sayılmaz. Güncel ölçüm zamanı, yerel okuma zamanıdır.

Kurulum başka bir cihaza taşınırken sanal ortamı kopyalamak yerine yeni Python ortamı oluşturulmalı ve smartthings-local==0.1.24 kurulmalı. Klima adresi, sertifika ve özel anahtar korunmalı. Aylık ücret veya 24 saatlik SmartThings erişim anahtarı gerekmez; firmware güncellemeleri yerel uyumluluğu etkileyebilir.

## Başka bir kullanıcı nasıl yetkilendirir?

İki farklı yol birbirine karıştırılmamalıdır:

- **Bu projenin yerel yolu:** cihazın yerel CoAP-DTLS arayüzüne uygun sertifika ve özel anahtar gerekir. SmartThings web sitesindeki bir “yetki ver” düğmesi bu sertifikayı otomatik sağlamaz. Mevcut kurulumda ev sahibinin onayıyla denenmiş model/firmware yöntemi kullanıldı; bu onay başka evin cihazlarına aktarılmaz. Sertifikalar repo’da dağıtılmaz. Yeni kurulumda cihazın gerçekten güvendiği yerel kimlik ve model uyumu sağlanmalıdır; bunun yönetim sihirbazı henüz tamamlanmadı.
- **Resmî SmartThings bulut yolu:** kendi Samsung hesabı, uygun OAuth uygulama kaydı ve yetki kapsamları gerekir. PAT kısa ömürlüdür; kalıcı ürün entegrasyonunda OAuth/yenileme akışı ele alınmalıdır. Güncel API Access App kaydı plan gereksinimlerine tabi olabilir. Bu proje bulut OAuth akışını tamamlanmış/ücretsiz alternatif olarak sunmaz; eski PAT ekranı etkin yerel bağlantının yerine geçmez.

Yerel kurulum için ortamı kurup yalnız kendi sertifika/anahtarınızı özel `data/samsung-local/` altına yerleştirin; yönetimden ayrı klima kaydı ve IP ekleyin. İlk adım yalnız durum okuma olmalı. Tanınmayan cihazda erişim listesini/sahipliği değiştiren otomatik eşleştirme yapılmaz.

- [SmartThings yetkilendirme ve PAT süresi](https://developer.smartthings.com/docs/getting-started/authorization-and-permissions)
- [Resmî OAuth uygulama kaydı](https://developer.smartthings.com/docs/service-integrations/app-setup)
- [Kullanılan yerel kitaplığın kurulum/sertifika belgeleri](https://github.com/QuiteYellow/SmartThings-Local)

Modelin yerel sertifikası edinilemiyorsa yeni kurulum hazır değildir. Kullanıcıya sadece IP formunu doldurunca kesin çalışacağı söylenmemelidir.
