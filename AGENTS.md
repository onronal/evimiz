# Bu projede çalışan AI ve geliştiriciler için

Önce `README.md`, yeni cihaz/marka/protokol eklemeden önce **`docs/device-integration.md`** oku. Adaptör sözleşmesi, rol sınırları, özel veri dizini ve test koşulları bu belgede tanımlıdır.

- Kullanıcı anahtarları, IP/adresler, oturumlar, kullanıcı listesi, ev haritası ve gerçek çalışma geçmişi yalnız gitignore kapsamındaki `data/` içinde kalır. Bunları çıktıya veya örnek dosyalara kopyalama.
- Cihaz örneği kimliği ile cihaz türünü ayır. İkinci cihazı birincinin bağlantısına yönlendirme.
- Yönetim yetkisini yalnız arayüzde gizleme; API'de rol ve CSRF denetimini koru.
- Durum okuması, kayıt oluşturma ve fiziksel komut ayrı işlemlerdir. Test için izinsiz cihaz çalıştırma; kod ve izole fixture testlerini kullan.
- Bilinmeyen durumu tamamlandı/kapalı/başarılı sayma. Bağlantı dosyasının varlığı çevrimiçi olma kanıtı değildir.
- Uyumluluk sınırlarını README'de güncelle. Yeni bir model fiziksel olarak doğrulanmadıysa açık belirt.
- İlgili birim testlerini ve HTTP testlerini çalıştır. Özel ev verisini test fixture'ı yapma.
