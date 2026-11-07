# Tapo C200: isteğe bağlı yerel görüntü

Bu sürümde C200 için RTSP → sunucu FFmpeg → oturum korumalı MJPEG görüntü katmanı hazırlanmıştır. Gerçek C200 bağlantısında RTSP üzerinden alınan görüntünün sunucudan MJPEG karesi olarak aktarıldığı doğrulandı. Analog kol üzerinden gönderilen ONVIF yön komutlarının kamerayı fiziksel olarak hareket ettirdiği de doğrulandı.

## 1. Kameranın hesabını oluşturun

1. Tapo uygulamasında C200 kartına dokunup canlı görüntüyü açın.
2. Sağ üst dişli → **Gelişmiş ayarlar → Kamera hesabı** yolunu açın.
3. Üreticinin kamera hesabı açıklamasını okuyup kabulünü kendiniz tamamlayın. 6–32 karakterlik kullanıcı adı ve ayrı güçlü parola oluşturun.
4. Bu, Tapo bulut hesabınızdan farklıdır. Parolayı sohbete, GitHub'a veya issue'ya koymayın.
5. Kamera ayarları → Cihaz bilgileri bölümünden IP adresini bulun. Ağ keşfi yalnız adayları bulur; görünen adresin kendi kameranız olduğunu doğrulayın.

[TP-Link'in resmî RTSP/ONVIF ve kamera hesabı rehberi](https://www.tp-link.com/us/support/faq/2680/)

## 2. Sunucu ve panel

Sunucuda FFmpeg kurulu ve PATH içinde olmalıdır. Alternatif olarak `FFMPEG_PATH` ortam değişkeniyle sunucudaki yürütülebilir dosya yolunu belirleyin; tarayıcıdan yürütülebilir yol alınmaz. Mac'te [FFmpeg'in resmî indirme seçeneklerinden](https://ffmpeg.org/download.html) uygun dağıtımı kurun.

Yönetim → Cihaz ekle → **Tapo C200 kamera** seçin. Ardından Cihaz ayarları → Bağlantıyı yapılandır bölümüne IP ve ayrı kamera hesabınızı girin. **Ağda kamera ara** ONVIF adaylarını döndürür; bu kimlik veya parola doğrulaması değildir. Bilgiler yalnız `data/device-connections/<id>.json` içinde saklanır, API'ye/forma geri verilmez.

Cihazlar kartındaki **Canlı görüntüyü aç** ile izleyin. Görüntü yalnız yöneticiye açıktır; üye hesap API'den de reddedilir. İlk çerçeve gelmeden kamera çevrimiçi kabul edilmez. Kamera kapalı/uykuda veya RTSP hesabı yanlışsa hata gösterilir.

## Çalışma ve sınırlar

- C200'ün yerel `stream2` akışı ve TCP/554 kullanılır; keyfî URL/port alınmaz.
- Sunucu en fazla 640 piksel genişlikte, 4 kare/sn JPEG üretir. Ses, kayıt, arşiv ve görüntü analizi yoktur. Canlı görüntü açıldığında analog yön kolu görünür. Kol basılı tutulduğunda kısa yön komutları sırayla gönderilir. Kamera kartı Tam ekran düğmesiyle büyütülebilir. Sunucu, aynı kamera hesabıyla yerel ONVIF TCP/2020 üzerinden kısa pan/tilt komutu gönderir. Kamera yazılımının ONVIF yön komutlarını desteklemesi gerekir.
- Aynı kamera için tek FFmpeg süreci paylaşılır; kamera başına en fazla 4 izleyici ve toplam en fazla 2 aktif kamera vardır.
- Son izleyici çıktığında süreç kapanır. Sayfa gizlendiğinde tarayıcı görüntüyü kapatır. Son kare yalnız aktif süreç belleğindedir; dosyaya kaydedilmez.
- Her çerçevede oturum/rol/etkin cihaz kontrolü yapılır. Kare gelmezse en geç yaklaşık 15 saniyede akış bırakılır; geçici tampon baskısında yeni kareler biriktirilmez, drain beklenir; baskı 15 saniyeyi aşarsa istemci kapatılır.
- RTSP giriş bilgisi FFmpeg komut satırına/URL query'sine verilmez; stdin üzerinden doğrulanmış ffconcat girdisi kullanılır. FFmpeg stderr'i yanıta veya loga aktarılmaz.
- Yerel RTSP şifreli bağlantı değildir; yalnız güvenilen ev ağında kullanın. İnternete kamera portu açılmaz; telefon sadece panelin HTTPS adresinden izler.
- Tapo için otomatik IP kurtarma bu sürümde yoktur; DHCP rezervasyonu önerilir. Hesap oluşturmak veya config kaydetmek gerçek görüntü başarısı sayılmaz.
