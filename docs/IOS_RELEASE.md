# iOS'ta yayınlama (Mac olmadan)

Oyun Codemagic'in bulut Mac'lerinde derlenip imzalanıyor ve TestFlight'a yükleniyor. Senin bilgisayarında
Xcode veya Mac gerekmiyor. Bu adımlar Apple Developer üyeliğin **aktif** olduktan sonra yapılır.

## Şu an hazır olanlar
- `capacitor.config.ts`: uygulama adı ve paket kimliği (`com.stickmancrossing.game`). Mağazaya çıktıktan sonra değiştirilemez; değiştirmek istersen şimdi söyle.
- `src/ads-admob.ts`: AdMob reklamları (geçiş + ödüllü), Avrupa için izin formu, iOS takip izni penceresi. Şu an Google'ın **test** reklam kimlikleri takılı.
- `scripts/ios-configure.sh`: iOS ayarlarını (AdMob kimliği, takip izni metni, dikey ekran, şifreleme beyanı) otomatik yapar.
- `codemagic.yaml`: bulut derleme tarifi.
- `assets/`: uygulama ikonu ve açılış ekranı (tüm boyutlar derlemede otomatik üretilir).
- `public/privacy.html`: gizlilik politikası. İçindeki `{{SUPPORT_EMAIL}}` yerine destek e-postası yazılacak.
- `docs/APP_STORE_LISTING.md`: mağaza metinleri.

## Hesap aktif olunca yapılacaklar

### 1. App Store Connect'te uygulamayı oluştur
appstoreconnect.apple.com → Apps → "+" → New App
- Platform: iOS
- Name: Stickman Crossing
- Bundle ID: önce developer.apple.com → Identifiers bölümünde `com.stickmancrossing.game` kimliğini oluştur, sonra listeden seç.
- SKU: `stickman-crossing`

Oluşunca App Information sayfasındaki **Apple ID** numarasını `codemagic.yaml` içindeki `APP_STORE_APPLE_ID` alanına yaz.

### 2. App Store Connect API anahtarı oluştur
App Store Connect → Users and Access → Integrations → App Store Connect API → "+"
- Erişim: App Manager
- `.p8` dosyasını indir (yalnızca bir kez indirilebilir, sakla). Issuer ID ve Key ID'yi not al.

Codemagic sertifika ve profil işlerini bu anahtarla kendisi hallediyor, Mac'te imzalama dosyası üretmen gerekmiyor.

### 3. Kodu GitHub'a koy
Codemagic projeyi bir Git deposundan okuyor. GitHub'da gizli (private) bir depo aç ve proje klasörünü yükle.

### 4. Codemagic'i bağla
codemagic.io → GitHub ile giriş → depoyu ekle
- Team settings → Integrations → Developer Portal: 2. adımdaki anahtarı ekle, adını **StickmanASC** koy.
- Build → `codemagic.yaml` kullan → "ios-release" iş akışını başlat.

İlk derleme yaklaşık 15–25 dakika sürer. Bitince uygulama TestFlight'a düşer; iPhone'una TestFlight uygulamasını kurup oyunu gerçek telefonda deneyebilirsin. Test reklamları "Test Ad" etiketiyle görünür.

### 5. AdMob hesabı ve gerçek reklam kimlikleri
admob.google.com → Apps → Add app → iOS
- 2 reklam birimi oluştur: **Interstitial** ve **Rewarded**.
- `src/ads-admob.ts` içindeki `AD_UNITS.ios` alanına gerçek kimlikleri yaz, `TESTING = false` yap.
- `codemagic.yaml` içindeki `ADMOB_IOS_APP_ID` alanına uygulama kimliğini (`~` içeren) yaz.
- Uygulama mağazaya çıkınca AdMob'da mağaza bağlantısını ekle; reklamlar ondan sonra tam açılır.

Kendi gerçek reklamlarına asla tıklama, hesap askıya alınabilir. Kendi telefonunu AdMob'a test cihazı olarak ekle.

### 6. Mağaza sayfası ve inceleme
- `docs/APP_STORE_LISTING.md` metinlerini kopyala.
- Gizlilik politikası sayfasını yayına al ve adresini gir.
- Ekran görüntülerini yükle, yaş derecelendirmesi ve App Privacy formlarını doldur.
- Build'i seç → Submit for Review. Apple incelemesi genelde birkaç gün içinde sonuçlanıyor.

## İsteğe bağlı
- Yazı tipi şu an Google Fonts'tan yükleniyor; internet yokken iOS'un "Chalkboard SE" yazı tipi kullanılıyor, oyun yine çalışıyor. İstersen Patrick Hand'i projeye gömeriz.
- Android için de aynı proje kullanılır: `npm run android:sync`, sonra Android Studio.
