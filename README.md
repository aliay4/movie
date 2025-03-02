# Movie Watch Party

Film izleme partileri oluşturabileceğiniz ve arkadaşlarınızla birlikte senkronize şekilde film izleyebileceğiniz bir web uygulaması.

## Özellikler

- Parti oluşturma ve katılma
- Video paylaşımı (YouTube ve URL desteği)
- Gerçek zamanlı sohbet
- Senkronize video oynatma

## Teknolojiler

- **Frontend**: HTML, CSS, JavaScript, React
- **Backend**: Node.js, Express.js
- **Veritabanı**: MongoDB
- **Deployment**: Railway

## Kurulum

### Gereksinimler

- Node.js
- MongoDB

### Yerel Geliştirme

1. Repoyu klonlayın:
   ```
   git clone https://github.com/aliay4/movie.git
   cd project-movie
   ```

2. Bağımlılıkları yükleyin:
   ```
   npm install
   ```

3. `.env` dosyası oluşturun:
   ```
   MONGODB_URI=mongodb+srv://kullaniciadi:sifre@cluster.mongodb.net/movie-party
   ```

4. Uygulamayı başlatın:
   ```
   npm start
   ```

5. Tarayıcınızda `http://localhost:3000` adresine gidin.

## Kullanım

1. Ana sayfada adınızı girin ve "Create Party" butonuna tıklayın.
2. Oluşturulan parti kodunu arkadaşlarınızla paylaşın.
3. Video URL'si girin veya YouTube videosu seçin.
4. Sohbet bölümünden arkadaşlarınızla mesajlaşın.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. 
