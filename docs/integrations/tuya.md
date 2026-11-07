# Smart Life / Tuya: başka bir evde kurulum

Bu projede bizim evimiz için verilen yetkiler başka kullanıcıya aktarılmaz. Her kurulum kendi Smart Life hesabını, Tuya projesini ve cihaz anahtarlarını kullanır. Repo’da ortak kullanıcı hesabı, Access Secret veya local key dağıtılmaz.

## İki ayrı adım

1. **Bulut yetkilendirmesi / anahtarı edinme:** cihazın kimliğini ve yerel bağlantı anahtarını kullanıcının kendi hesabından almak.
2. **Yerel kontrol:** panelde kaydedilen IP, cihaz kimliği ve local key ile Wi-Fi üzerinden komut göndermek. Bu panelin ampul kontrolü bulut API'sini her komutta çağırmaz.

Cihazın protokolü, modeli ve DP alanları uyumlu olmalıdır; marka adı tek başına yeterli değildir.

## Kullanıcının izleyeceği yol

1. Ampulü kendi Smart Life veya Tuya Smart uygulamasına ekle; uygulamadan çalıştığını doğrula.
2. [Tuya Developer Platform](https://platform.tuya.com/) üzerinde kendi geliştirici hesabını aç. Hesap/sözleşme adımlarını kendin tamamla.
3. Smart Home / Smart Home PaaS geliştirme yöntemiyle kendi bulut projesini oluştur. Projenin veri merkezi, uygulama hesabının bölgesine hizmet vermeli; ülke etiketinden rastgele veri merkezi tahmin etme.
4. Projenin API servislerini yetkilendir. Mevcut kurulumda IoT Core, Authorization Token Management ve Smart Home Basic Service kullanıldı. Portalın güncel gereksinimlerini ve paket süresini kontrol et; ücretli paket seçmek zorunluymuş gibi ilerleme.
5. Projede **Devices → Link App Account → Add App Account / Tuya App Account Authorization** akışını aç. QR kodunu kendi Smart Life hesabınla tarayıp yalnız bağlamak istediğin cihazlara izin ver.
6. Cihaz listesinde doğru ampulü bul. Yetkili cihaz ayrıntısı sorgusundan cihaz ID ve `local_key` bilgisini edin. Bazı API/paket/sürüm kombinasyonları bu alanı vermeyebilir; doğru API ve yetki kapsamını doğrula. Boş anahtarı tahmin ederek kullanma.
7. Modemin cihaz listesinden veya yerel keşiften ampulün yerel IP adresini belirle. Mümkünse DHCP rezervasyonu yap.
8. Evimiz'e yönetici olarak gir → **Yönetim → Cihaz ekle → Smart Life / Tuya ampul**. İsim/model/oda kaydını oluştur.
9. Kaydın **Bağlantıyı yapılandır** bölümüne IP, cihaz kimliği, 16 bayt local key ve protokol sürümünü gir. Bu alanlar Smart Life hesap parolası değildir. Bağlantıyı kaydet; cihaz sayfasından durumunu oku.
10. Desteklenen DP eşlemesini doğruladıktan sonra kendi ampulünde aç/kapat ve renk ayarını dene. Uyumsuz bir ürün için [docs/device-integration.md](../device-integration.md) üzerinden model eşlemesi geliştirilir.

Proje Access ID/Secret bilgileri kullanıcıya özeldir. Bunları issue, ekran görüntüsü, README veya GitHub commit'ine ekleme. Bu sürüm, Tuya bulut proje/QR adımlarını otomatik yöneten bir web sihirbazı içermez; rehber ve yerel bağlantı formu vardır.

## Sıfırlama, paket ve bağlantı sorunları

- Cihaz yeniden eşleştirilirse yerel anahtar değişebilir; yeni anahtarı tekrar edinip bağlantıyı güncelle.
- Yanlış veri merkezinde proje hesabı/cihazı görünmeyebilir.
- API izni, bulut paketinin süresi ve yerel ağ erişimi ayrı sorunlardır. Bulut paketlerinin sürekli ücretsiz kalacağı sözü verilmez. Yeni anahtar edinme gereksinimi bulut erişimine bağlı olabilir.
- Yerel anahtarla çalışan panel, yalnız anahtarı almak için kullanılan proje iznini başkasının kurulumunda kullanamaz.
- Mümkün olan alternatif, kullanıcı tarafından zaten edinilmiş geçerli local key'i doğrudan forma girmektir; bu durumda panel için tekrar ortak bir bulut projesi gerekmez. Anahtar edinmenin her cihazda bulutsuz mümkün olduğu varsayılmaz.

## Birincil kaynaklar

6 Kasım 2026 tarihinde kontrol edildi; portal ekran/plan adları değişebilir:

- [Tuya Cloud API anahtarı ve uygulama hesabı bağlama](https://developer.tuya.com/en/docs/developer/apply-cloud-api-key?id=Kff30z8sv62ah)
- [Smart Home PaaS yapılandırma sihirbazı](https://developer.tuya.com/en/docs/iot/Platform_Configuration_smarthome?id=Kamcgamwoevrx)
- [Projeler ve API servisleri](https://developer.tuya.com/en/docs/iot/manage-projects?id=Ka49p0n8vkzm6)
- [Cihaz yönetimi ve local_key alanı](https://developer.tuya.com/en/docs/cloud/device-management?id=K9g6rfntdz78a)

## Tek bağlantı formu

Yönetim → Entegrasyonlar → Smart Life / Tuya → **Bu bilgisayarda cihaz bağla**, sunucuda `/integration-setup?brand=tuya` ekranını açar. Cihaz adı, oda, yerel IP, cihaz kimliği, local key ve protokol sürümü tek formda girilir; dosya düzenlemek gerekmez. Cihaz kaydı ile özel bağlantısı birlikte oluşturulur, anahtarlar geri döndürülmez. Bu form Smart Life parolası veya Tuya proje Access Secret istemez; portal/QR yetkilendirmesiyle local key edinme adımları yukarıdaki rehberde kalır. Kaydetmek ampulü açıp kapatmaz. Sonra canlı durum okunmalıdır.
