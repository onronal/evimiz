# Barındırma kararları

Güncel çalışma şekli Node.js sunucusu + loopback HTTPS geçidi + isteğe bağlı Tailscale Funnel'dır. Web Push ve PWA uygulanmıştır; sunucu süreçleri durursa yeni olay takibi ve bildirim gönderimi de durur.

## Bilgisayarda başlangıç

Mevcut Mac kurulumu geliştirme ve kullanım içindir. Uyku, kapak kapanması, Wi-Fi değişimi ve yeniden başlatma erişimi etkiler. Boşta uyumayı önlemek sürekli hizmet yönetimi yerine geçmez. Kaynak ve özel `data/` yedeği ayrı ele alınır.

## Modem USB neden tek başına yetmez?

Normal USB dosya paylaşımı bu Node.js/Python süreçlerini çalıştırmaz. Modemin işletim sistemi, işlemcisi ve paket çalıştırma desteği doğrulanmadan USB flash bellek sunucu olarak kabul edilemez. DHCP rezervasyonu ise modem üzerinde bağımsız yapılabilen yararlı bir ağ ayarıdır.

## Dış erişim

HTTPS için [Funnel kurulumu](remote-access.md), alan adı/statik dış IP/alternatifler için [karşılaştırma](external-access-options.md) kullanılır. Yerel statik IP rezervasyonu internetten erişilen statik dış IP hizmetiyle aynı şey değildir. Kaynak kod doğrudan herkese açık statik web barındırmasına yüklenerek cihaz adaptörleri çalıştırılamaz; ev ağına erişen bir sunucu gerekir.
