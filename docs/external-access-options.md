# ts.net adresi, ücretsiz seçenekler ve doğrudan yayın

## ts.net linki ne zaman değişir veya çalışmaz?

Funnel adresi, rastgele her çalıştırmada yenilenen bir demo URL'si değildir; Tailscale cihaz adı ve tailnet DNS adına bağlıdır. Bununla birlikte süresiz hizmet/SLA sözü değildir. Cihaz/tailnet adı değişirse, cihaz silinip yeniden farklı adla eklenirse veya hesap/hizmet koşulları değişirse adres veya erişim etkilenebilir.

**Adres, cihaz kimliği, HTTPS sertifikası ve panel oturumu ayrı şeylerdir:**

- Node anahtarlarının varsayılan süresi 180 gündür; yeniden doğrulama gerekebilir. Tailscale cihaz ekranından süre takip edilir. Bu projede süre denetimi otomatik kapatılmadı.
- Funnel HTTPS sertifikalarını yönetir; bu, cihaz hesabının yeniden doğrulanmasına gerek olmadığı anlamına gelmez.
- Panel oturumu ayrıca sürelidir; yeniden giriş istenmesi linkin sona erdiği anlamına gelmez.
- Bilgisayar, Node sunucusu, loopback geçidi veya Tailscale kapalıysa adrese erişilemez.
- Raspberry Pi'ye taşınırken yeni cihaz adı farklıysa URL ve iPhone Push aboneliği yeniden ele alınır.

## Ücretsiz / düşük maliyetli alternatifler

| Yol | Alan adı / uygulama | Sınır ve kullanım |
| --- | --- | --- |
| Tailscale Funnel | Cihazın ts.net adresi; telefona Tailscale gerekmez | Kişisel ücretsiz planda kullanılabilir; bant genişliği sınırları/beta ve hesap koşulları geçerli. Bu projede kurulan yol. |
| Cloudflare Quick Tunnel | Alan adı/hesap gerektirmeyen geçici trycloudflare URL'si | Geliştirme/test; adres geçicidir, iPhone kalıcı kurulum ve push için uygun temel değildir. |
| Cloudflare named Tunnel | Genellikle kendi alan adınız ve hesabınız | Sunucuda tunnel ücretsiz planla kullanılabilir; alan adı ayrı maliyet olabilir, hizmet koşulları geçerli. Bu projede kurulmadı. |
| ngrok Free | Hesaba atanmış sabit geliştirme alan adı | Ücretsiz kota ve tarayıcı uyarı/interstitial sınırları vardır. Web/PWA/push davranışı ayrıca test edilmeli. Kurulmadı. |
| Public IP + reverse proxy | Gerçek public IP, modem yönlendirmesi ve tercihen alan adı/DDNS | Tünel sağlayıcısına bağımlılık azalır; güvenlik, TLS yenileme ve internet erişimini siz işletirsiniz. ISS statik IP ücret isteyebilir. Kurulmadı. |

Ücretsiz planlar değişebilir; kamera akışı gibi yüksek trafik için sınırsız kullanım varsayılmaz. Bir tünelden diğerine geçince HTTPS origin, CSRF izinleri, iPhone kısayolları ve push abonelikleri de güncellenir. Mevcut `public-proxy.mjs` varsayılan olarak yalnız ts.net kök origin'lerini doğrular; alternatif tünel için açık origin doğrulaması ayrıca geliştirilip test edilmelidir.

## Statik IP ile Raspberry Pi doğrudan yayın yapabilir mi?

**Evet, dışarıdan erişilebilir gerçek public IP varsa.** Yerel DHCP rezervasyonu tek başına bunu sağlamaz. CGNAT veya ISS gelen port engeli varsa yalnız modem port yönlendirmesi yeterli olmaz. Public IPv6 da ayrı bir seçenek olabilir; istemci/ağ erişimi ve güvenlik duvarı ayrıca doğrulanmalıdır.

Normal mimari: internet → modem/güvenlik duvarı 443 → Pi'de Caddy/Nginx gibi reverse proxy → yalnız yerel Node hizmeti. TLS ve sertifika yenilemesi otomatik işletilmeli; giriş/CSRF/rol kontrolü korunmalıdır. Özel cihaz portlarını, Vestel hesap bağlama ekranını veya düz Node 4173 portunu internete doğrudan açmayın. Mevcut Funnel geçidi alan adı doğrulamasının doğrudan-IP yayın için hazır olduğu varsayılmaz.

Domain/DDNS ile geçerli sertifika kullanmak yaygın yoldur. Kasım 2026 itibarıyla Let's Encrypt public IP adresleri için de kısa ömürlü sertifika sunmaktadır; uygun ACME istemcisi, doğrulama ve sık otomatik yenileme gerekir. Bu nedenle “HTTPS için her durumda ücretli alan adı zorunlu” doğru değildir. Yine de bu projede doğrudan IP sertifika/reverse proxy dağıtımı test edilmedi.

## Birincil kaynaklar

6 Kasım 2026 tarihinde kontrol edildi:

- [Funnel ve kısıtları](https://tailscale.com/docs/features/tailscale-funnel)
- [Cihaz anahtarı süresi](https://tailscale.com/docs/features/access-control/key-expiry)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [ngrok ücretsiz sınırları](https://ngrok.com/docs/pricing-limits/free-plan-limits)
- [Let's Encrypt kısa ömürlü/IP sertifikaları](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)
