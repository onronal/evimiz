# HTTPS, dış erişim ve iPhone kurulumu

Panel, oturum korumalı HTTPS üzerinden dış erişimi ve iPhone Web Push'u destekler. Her kurulum sahibi kendi Tailscale hesabını ve cihaz adresini kullanır. Gerçek evin adresi kaynak kodda dağıtılmaz.

## Yerel kurulum önce tamamlanır

1. `npm ci` ve `npm start` ile paneli çalıştırın.
2. Sunucunun kendi ekranında `http://127.0.0.1:4173` üzerinden ilk parolayı değiştirin.
3. Kullanıcıları ve cihaz bağlantılarını kurun. Hesap/sertifika bağlama uçlarının bazıları yalnız loopback'ten açılır.
4. Yönetici parolasının değiştiğini ve oturumsuz cihaz API'sinin 401 verdiğini doğrulayın.

## Tailscale Funnel

Tailscale'i resmî kaynaktan kurun ve kendi hesabınızla uygulamanın içinden giriş yapın. Sadece web hesabı oluşturmak bilgisayarı bağlamaz. Funnel'ın gerektirdiği DNS/HTTPS/politika adımlarını hesabınızda tamamlayın. Plan, kota ve özellik koşullarını [Tailscale Funnel belgelerinden](https://tailscale.com/kb/1223/funnel) kontrol edin.

1. `tailscale status --json` ile sunucunuzun Tailscale DNS adını bulun.
2. Özel `data/public-access.json` dosyasına kendi HTTPS kök adresinizi yazın:

   ```json
   { "origin": "https://YOUR_DEVICE.YOUR_TAILNET.ts.net" }
   ```

3. Paneli yeniden başlatın. Alternatif olarak panel için `PUBLIC_ORIGIN` ortam değişkeni vardır; geçit adresi özel yapılandırmadan okunur.
4. Ayrı süreçte `npm run public` çalıştırın. Geçit yalnız `127.0.0.1:4174` üzerinde dinler.
5. `tailscale funnel --bg 4174` ile **4174 geçidini** hedefleyin. Modemden 4173 portunu internete yönlendirmeyin.
6. Dış HTTPS adresinde oturumsuz cihaz API'si 401, özel kurulum uçları 403 vermeli; giriş sonrası normal panel çalışmalıdır. Mobil internetten de deneyin.

macOS CLI yolu dağıtıma göre değişebilir; resmî uygulamada `/Applications/Tailscale.app/Contents/MacOS/Tailscale` kullanılabilir. Funnel'ın arka planda çalışması Node sunucusunu veya geçidi otomatik başlatmaz. Sunucu, geçit ve Tailscale birlikte açık kalmalıdır. Mac'in uyuması yeni okumaları ve bildirim gönderimini durdurur.

Geçit POST origin kontrolü uygular; yerel hesap/servis kurulum uçlarını dışarı kapatır. SSE canlı ekran bağlantısının kapanışı iç sunucuya aktarılır. HTTPS ve Tailscale, uygulamanın parola/rol kontrolünün yerine geçmez.

## iPhone

HTTPS adresini Safari'de açın, giriş yapın ve Paylaş → Ana Ekrana Ekle kullanın. Uygulamayı simgeden açıp Bildirimler sayfasından izin ve test adımlarını tamamlayın. [Bildirim rehberi](notifications.md)

## Adres değişimi ve taşıma

Sabit adres rastgele demo tüneli değildir; cihaz/tailnet adı, cihaz anahtarı, hesap koşulları ve sunucu erişilebilirliği ayrı konulardır. [Adres ömrü ve alternatifler](external-access-options.md)

Yeni sunucuya kaynakları ve `package-lock.json` dosyasını taşıyıp bağımlılıkları yeniden kurun. Özel `data/` ve anahtarlar Git üzerinden taşınmaz; güvenli yedekten ayrıca aktarılır. Aynı origin/VAPID bilgisi korunmuyorsa iPhone uygulaması veya bildirim aboneliğini yenilemek gerekebilir. Python sanal ortamını Mac'ten kopyalamayın.
