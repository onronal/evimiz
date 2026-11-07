# Vestel / Akıllı Yaşam bağlantısı

## Yetki hangi sayfadan verilir?

Bu entegrasyonda Tuya benzeri geliştirici QR izin sayfası yoktur. Önce kendi Vestel Akıllı Yaşam hesabınızda Wi-Fi makineleri eşleştirin. Ardından Evimiz'i çalıştıran bilgisayarda yönetici olarak **http://127.0.0.1:4173/vestel-setup** ekranını açıp kendi hesabınızla giriş yapın. Bu özel hesap bağlama ekranı Funnel üzerinden dışarıya kapalıdır.

1. Telefonda resmî **Vestel Akıllı Yaşam** uygulamasında cihazların göründüğünü ve durumunun güncellendiğini doğrulayın.
2. Bu bağlayıcı e-posta/parola girişini kullanır. Yalnız sosyal girişle açılmış bir hesap için uygulamanın kendi desteklediği e-posta/parola yöntemini hazırlamanız gerekebilir; panel sosyal giriş parolasını dönüştürmez.
3. Servis istemcisi yapılandırması ayrıca gereklidir: yerel Vestel bağlantısı ekranının **1. Servis bağlantısı** adımına kendi yetkili Client ID ve Client Secret bilgilerinizi girip kaydedin. Dosya düzenlemeniz gerekmez. Alternatif olarak `VESTEL_CLIENT_ID` / `VESTEL_CLIENT_SECRET` ortam değişkenleri kullanılabilir; bu durumda web formu değişikliğe kapatılır. Repo bu değerleri dağıtmaz; kullanıcı parolasıyla aynı bilgi değildir.
4. Yerel kurulum ekranından hesabı bağlayın. Parola kalıcı saklanmaz; yenileme oturumu `data/vestel-session.json` içindedir.
5. Yönetimden çamaşır/bulaşık kaydı oluşturup her örneği doğru fiziksel cihaz kimliğiyle eşleştirin. Kayıt oluşturmak hesabı otomatik bağlamaz.
6. Cihaz sayfasında durum, program ve kalan süreyi kontrol edin. Bu bağlayıcı salt okunurdur; yıkama başlatmaz.

## Sınırlar

Yeni bir kullanıcıya ortak hesabımız veya servis anahtarımız verilmez. Vestel'in herkese açık, bu proje için otomatik bir üçüncü taraf OAuth izin sihirbazı uygulanmış değildir. Servis istemcisi erişimi olmayan kurulum tam bağlanamaz; bu adım tamamlanmış gibi gösterilmemelidir. Endpoint ve ürün şemaları değişirse bakım gerekir. Yenileme oturumu iptal olursa yerel ekrandan tekrar giriş yapılır.

Gözlemler yaklaşık dakikada birdir; uygulamadaki her eski bildirim otomatik indirilen geçmiş değildir. İki okuma arasındaki kısa işler kaçabilir. Başlangıç/bitiş zamanı kesin cihaz olayı değil, gözlem zamanı olabilir.

Resmî uygulama ve eşleştirme bilgileri:

- [Vestel Akıllı Yaşam](https://www.vestel.com.tr/content/akilli-yasam)
- [Resmî hesap/eşleştirme kılavuzu](https://destekmerkezi.vestel.com.tr/storage/EVC/evc04-smart-akilli-yasam-uygulamasi-eslestirme.pdf)

## Panelden servis bilgilerini kaydetme

Yönetim → Entegrasyonlar → Vestel → **Bu bilgisayarda hesap bağla** yolu iki adımı açar: servis bilgileri ve Akıllı Yaşam hesabı. Ekran yalnız sunucuda `http://127.0.0.1:4173/vestel-setup` adresinde yöneticiye açıktır; Funnel üzerinden servis bilgisi kaydedilemez. Client ID/Secret `data/vestel-client.json` içinde yalnız kullanıcı erişimiyle saklanır, okuma API’sine ve forma geri verilmez. Güncelleme yeniden başlatma gerektirmez. Farklı servis bilgileri kaydedildiğinde eski Vestel yenileme oturumu ve durum önbelleği kaldırılır; kullanıcı yeniden giriş yapar. Temizlik geçmişi silinmez.

Form, yetkili servis istemcisi erişimini kendiliğinden sağlamaz. Bu bilgilere sahip olmayan kullanıcı için Vestel yetkilendirme ön gereksinimi hâlâ geçerlidir. Mevcut bilgilerin üzerine yeni kurulum için ortak/gömülü anahtar dağıtılmaz.
