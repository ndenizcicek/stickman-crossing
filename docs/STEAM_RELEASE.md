# Steam'de yayınlama

Steam sürümü, telefondaki oyunun aynısını bir masaüstü uygulamasının (Electron) içinde çalıştırıyor.
Windows'ta ve Linux'ta (Steam Deck dahil) çalışıyor. Klavye, fare ve oyun kumandasıyla oynanıyor.

## Telefondan farkları

| | Telefon (iOS / Android) | Steam |
| --- | --- | --- |
| Para kazanma | Ücretsiz + AdMob reklamları | **Tek seferlik ücretli**, reklam yok |
| "Reklam izle, devam et" | Var | Yok |
| Şehir kilidi | 100 puan **veya** 5 reklam | Yalnızca 100 puan |
| Kontroller | Dokunma, kaydırma | Ok tuşları / WASD, fare, kumanda |
| Ekstra | Titreşim | Tam ekran (F11), Steam başarımları, Steam arayüzü (Shift+Tab) |

**Neden reklam yok?** Steam oyunlarda reklama izin vermiyor. Reklamla para kazanan oyunlar ve ödüllü
reklamlar ("reklam izle, ödül kazan") yasak. Steam'in önerdiği modeller: tek seferlik ücretli oyun ya da
isteğe bağlı satın alımlı ücretsiz oyun. Kod Steam'de çalıştığını kendisi anlıyor ve reklamla ilgili her
seçeneği gizliyor; ayrıca bir ayar yapmaya gerek yok.

## Kontroller

| İşlem | Klavye | Kumanda |
| --- | --- | --- |
| İleri | ↑, W, Boşluk, fare tıklaması | D-pad ↑, sol çubuk, A |
| Sol / sağ / geri | ←, →, ↓ / A, D, S | D-pad, sol çubuk |
| Duraklat | Esc, P | Start, B |
| Menüde gezinme | Ok tuşları, Enter, Esc | D-pad, A, B |
| Tam ekran | F11 (veya Ayarlar) | Ayarlar |

## Steam başarımları

Steamworks'te **App Admin → Stats & Achievements** bölümünde aşağıdaki başarımlar, **API Name** sütunu
birebir aynı olacak şekilde oluşturulmalı. Her başarım için 64×64 bir ikon da istenir (açık ve kilitli hali).

| API Name | Ad | Açıklama |
| --- | --- | --- |
| FIRST_CROSSING | First Steps | Score 10 points in any city. |
| HAND_IN_HAND | Hand in Hand | Have 3 friends in your chain at once. |
| HUMAN_TRAIN | Human Train | Have 8 friends in your chain at once. |
| CENTURY | Century | Score 100 points in one run. |
| MARATHON | Marathon | Score 250 points in one run. |
| GLOBETROTTER | Globetrotter | Unlock every city. |

Başarımlar `src/achievements.ts` dosyasında tanımlı; yeni bir başarım eklemek için oraya ekleyip Steamworks'te
aynı API adıyla oluşturmak yeterli.

## Yayın adımları

### 1. Steamworks hesabı (bir kez)
partner.steamgames.com adresinden kayıt olunuyor. İstenenler:
- Gizlilik ve dağıtım sözleşmelerinin elektronik imzası.
- Kimlik bilgileri.
- **Banka hesabı: hesap sahibinin adı, kayıttaki adla aynı olmalı.**
- Vergi formu. Doğrulaması 2–7 iş günü sürebiliyor.
- Oyun başına **100 dolar** Steam Direct ücreti. Oyun Steam'de 1.000 dolar brüt gelire ulaşınca bu ücret geri ödeniyor.

Ücret ödendikten sonra, ilk oyunlar için oyunun yayınlanabilmesi en az **30 gün** sürüyor.

### 2. App ID
Ücret ödenince Steam oyuna bir **App ID** veriyor. Bunu:
- `desktop/steam_appid.txt` dosyasına yaz (şu an 480 yazıyor; bu, Valve'ın test uygulaması).
- `steam/app_build.vdf` ve `steam/depot_*.vdf` dosyalarındaki `0000000` / `0000001` / `0000002` yerlerine
  App ID'yi ve Steamworks'ün verdiği depo (depot) numaralarını yaz. Windows için bir depo, Linux için bir depo.

### 3. Oyunu derle
GitHub'da depo sayfası → **Actions** → **Steam build** → **Run workflow**. Birkaç dakika sonra çalışmanın sayfasında
iki indirilebilir klasör çıkıyor: `crosswalk-crew-windows` ve `crosswalk-crew-linux`.

Kendi bilgisayarında denemek için: `npm install`, sonra `npm run desktop` (Steam açıksa başarımlar test
uygulamasına gider).

### 4. Steam'e yükle (SteamPipe)
Steamworks SDK'sını indir (partner.steamgames.com → Downloads). İçindeki `tools/ContentBuilder` klasöründe:
1. `scripts` içine bu depodaki `steam/` klasörünün dosyalarını kopyala.
2. `content/windows/` içine Windows derlemesini, `content/linux/` içine Linux derlemesini aç.
3. Windows'ta SDK'daki **SteamPipe GUI** aracıyla ya da `steamcmd +login <kullanıcı> +run_app_build ..\scripts\app_build.vdf +quit`
   komutuyla yükle.
4. Steamworks'te **SteamPipe → Builds** sayfasında derlemeyi "default" dalına al.

Steamworks'te başlatma ayarları (**Installation → General**):
- Windows: `Crosswalk Crew.exe`
- Linux: `crosswalk-crew`

### 5. Mağaza sayfası
Gereken görseller:

| Görsel | Boyut |
| --- | --- |
| Header Capsule | 920 × 430 |
| Small Capsule | 462 × 174 |
| Main Capsule | 1232 × 706 |
| Vertical Capsule | 748 × 896 |
| Library Capsule | 600 × 900 |
| Library Header | 920 × 430 |
| Library Hero | 3840 × 1240 |
| Library Logo | 1280 genişlik ve/veya 720 yükseklik, şeffaf arka plan |
| Ekran görüntüleri | En az 5 adet, en az 1920 × 1080, 16:9 |

Ayrıca açıklama metinleri, etiketler (Casual, Arcade, Endless, Cute, Singleplayer…), sistem gereksinimleri ve
fiyat. Fiyat için bu türde kısa arcade oyunlar genelde düşük fiyatlı oluyor; karar size ait.

### 6. İnceleme ve yayın
- Mağaza sayfası incelemesi genelde **3–5 iş günü** sürüyor; Steam yayından en az 7 gün önce göndermeyi öneriyor.
- Mağaza sayfası onaylanınca derleme incelemeye gönderiliyor.
- Oyun yayınlanmadan önce en az **2 hafta** "Coming Soon" (Yakında) olarak Steam'de görünmeli. Bu süre
  istek listesi (wishlist) toplamak için en iyi zaman.

## İsteğe bağlı: Steam Cloud
Rekorlar ve açılan şehirler bilgisayarda saklanıyor. Başka bilgisayarda devam edilmesini istersen Steamworks'te
**Steam Cloud → Auto-Cloud** ile Electron'un kayıt klasörü eklenebilir
(Windows: `%APPDATA%/Crosswalk Crew/Local Storage`, Linux: `~/.config/Crosswalk Crew/Local Storage`).
