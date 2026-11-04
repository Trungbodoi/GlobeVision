# GlobeVision

Ứng dụng web khám phá các quốc gia trên mô hình địa cầu 3D, dành cho học sinh, giáo viên và người yêu thích địa lý.

Bản chạy thử: https://trungbodoi.github.io/GlobeVision/

Trang gốc mở trang chủ song ngữ; chọn **Khám phá địa cầu 3D** để vào ứng dụng địa cầu. Các trang dùng định tuyến hash (`#/` và `#/globe`), còn liên kết chia sẻ cũ như `?country=VN` và `?compare=VN,JP,FR` vẫn mở thẳng địa cầu.

## Tính năng

- **Trang chủ riêng:** tìm nhanh quốc gia, truy cập theo nhóm chức năng, tiếp tục các quốc gia gần đây và mở một quốc gia ngẫu nhiên.
- **Điều hướng nhẹ:** trang chủ và địa cầu 3D dùng hash routing, hỗ trợ Back/Forward và giữ tương thích với liên kết trạng thái cũ.
- **Địa cầu 3D tương tác:** xoay, phóng to/thu nhỏ, rê chuột để xem tên quốc gia.
- **Tìm kiếm quốc gia** theo tên tiếng Việt, tiếng Anh, tên thông dụng (vd. "Mỹ", "UK") hoặc mã ISO; điều khiển được bằng bàn phím.
- **Thẻ thông tin quốc gia:** quốc kỳ, thủ đô, giờ địa phương tại thủ đô, dân số, diện tích, mật độ dân số, khu vực, tiền tệ, ngôn ngữ, múi giờ, mã điện thoại, tên bản địa.
- **Quốc gia láng giềng:** liệt kê và tô sáng trên địa cầu; bấm để chuyển sang nước đó.
- **So sánh tối đa 3 quốc gia:** bấm "+ So sánh" trên thẻ thông tin; bảng so sánh gồm biểu đồ cột (dân số, diện tích, mật độ) và bảng số liệu; các nước được tô màu tương ứng trên địa cầu. Chia sẻ bằng liên kết dạng `?compare=VN,JP,FR`.
- **Học địa lý:** quiz nhận diện quốc kỳ, thủ đô, quốc gia láng giềng và tìm nước trên địa cầu; có bộ câu hỏi hằng ngày 5 câu, lọc châu lục/khu vực và ba cấp độ khó.
- **Thẻ ghi nhớ & tiến độ:** ôn tập theo Leitner SRS, theo dõi độ chính xác/chuỗi ngày/huy hiệu, sao lưu hoặc nhập lại tiến độ JSON lưu trên thiết bị.
- **Hành trình khám phá:** các tuyến ASEAN, quốc gia không giáp biển, quốc đảo Thái Bình Dương, Mekong và Danube; liên kết quiz/hành trình có thể chia sẻ qua URL.
- **Lớp bản đồ & khám phá:** choropleth dân số/mật độ và chỉ số World Bank (GDP/người, tuổi thọ, CO₂ tương đương/người); lớp sông, hồ, dãy núi, thủ đô, đường đổi ngày và ngày/đêm; lọc nhóm quốc gia, giờ thế giới, đo khoảng cách đường cung lớn và dữ kiện dân số.
- **Chia sẻ liên kết:** quốc gia đang xem nằm trên URL (vd. `?country=VN`), dùng được nút Back/Forward và nút "Sao chép liên kết".
- **PWA & ngoại tuyến:** có thể cài GlobeVision; app shell và ba tệp GeoJSON được lưu cache để mở lại bản đồ khi offline. Dữ liệu API và tiến độ học đã tải được giữ trong cache cục bộ / `localStorage`.
- **Hoạt động ổn định khi API lỗi:** dữ liệu đã tải được lưu lại; khi mất kết nối, ứng dụng hiển thị dữ liệu đã lưu hoặc dữ liệu cơ bản từ bản đồ, kèm nút "Thử lại".
- **Tiếng Việt / English:** chuyển ngôn ngữ bằng nút VI/EN, lựa chọn được ghi nhớ.
- **Ghi chú trung lập** cho các vùng có vị thế chính trị hoặc ranh giới đang tranh chấp.

## Công nghệ

React 19, Vite, [globe.gl](https://github.com/vasturiano/globe.gl) / Three.js.

## Chạy dự án

Yêu cầu Node.js 20.19+ hoặc 22.12+ (theo yêu cầu của Vite 8).

```bash
npm install
npm run dev
```

Mở http://localhost:5173/GlobeVision/

Các lệnh khác:

| Lệnh | Tác dụng |
| --- | --- |
| `npm run build` | Build bản production vào `dist/` |
| `npm run preview` | Chạy thử bản đã build |
| `npm run lint` | Kiểm tra code bằng ESLint |
| `npm test` | Chạy Vitest cho API cache/retry, tìm kiếm, quiz/SRS, URL, i18n và dữ liệu địa lý |
| `npm run data:build` | Tạo lại dữ liệu quốc gia chuẩn hóa (xem bên dưới) |
| `npm run data:build:geography` | Tạo các lớp địa lý Natural Earth vào `public/data/geography.geojson` |

## Dữ liệu

| Nguồn | Dùng cho | Giấy phép |
| --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) | Hình dạng, đường biên giới, tên quốc gia, dân số ước tính (năm 2011–2020 tùy nước) | Public domain |
| [countries.dev](https://countries.dev/) (dữ liệu GeoNames) | Thông tin chi tiết, quốc gia láng giềng, múi giờ thủ đô | CC BY 4.0 |
| [Wikipedia REST API](https://www.wikimedia.org/) | Tóm tắt bách khoa, ảnh thu nhỏ và liên kết bài viết | CC BY-SA 4.0 |
| [World Bank Open Data](https://data.worldbank.org/) | Chỉ số kinh tế - xã hội dùng trong hồ sơ quốc gia và bản đồ choropleth | CC BY 4.0 |
| [Open-Meteo](https://open-meteo.com/) | Thời tiết tại thủ đô | CC BY 4.0 |
| [Nager.Date](https://date.nager.at/) | Ngày lễ quốc gia sắp tới | Open Data / Public Domain |

### Chuẩn hóa dữ liệu quốc gia

Dữ liệu gốc nằm trong `data/source/`. Script `scripts/build-country-data.mjs` chuẩn hóa và ghi ra `public/data/`:

- Thống nhất khóa thuộc tính (Natural Earth dùng lẫn `NAME_VI` và `name_vi`).
- Mỗi quốc gia có `id` ổn định: mã ISO alpha-2, hoặc mã ADM0 cho vùng không có mã ISO (Northern Cyprus, Somaliland).
- Sửa mã không khớp với API (Đài Loan `CN-TW` → `TW`).
- Đánh dấu các vùng có tranh chấp để hiển thị ghi chú trung lập.
- Làm tròn tọa độ đến 4 chữ số thập phân (~11 m) và bỏ thuộc tính không dùng: dữ liệu bản đồ giảm từ ~6,8 MB xuống ~0,7 MB.

Các lớp sông, hồ, dãy núi, đỉnh núi, thủ đô và đường đổi ngày được rút gọn từ Natural Earth 1:110m. Dữ liệu đã sinh được phục vụ cùng ứng dụng; chỉ tải lười khi mở công cụ khám phá. Natural Earth là Public Domain. Dữ liệu kinh tế/xã hội choropleth được lấy theo yêu cầu từ World Bank Open Data và lưu cache trên thiết bị; chỉ số CO₂ tương đương/người dùng mã WDI `EN.GHG.CO2.PC.CE.AR5`.

### PWA và triển khai

Web App Manifest, biểu tượng PNG 192×192 / 512×512 và Service Worker nằm trong `public/`. Trong bản production, build manifest liệt kê các chunk và Service Worker lưu app shell, JavaScript/CSS, manifest và các tệp GeoJSON (bao gồm ranh giới). Điều hướng khi offline dùng `index.html` đã cache; các phản hồi World Bank/countries.dev đã tải được cache ở `localStorage`, còn tiến độ học lưu hoàn toàn trên thiết bị. Lần đầu truy cập cần có mạng để cài Service Worker và tải cache ban đầu.

Các thẻ Open Graph/Twitter trong `index.html` dùng URL triển khai GitHub Pages và ảnh xem trước tĩnh. Máy chủ tĩnh không thể tạo metadata riêng theo query string; liên kết quốc gia, quiz, hành trình và lớp bản đồ vẫn giữ trạng thái qua URL khi mở ứng dụng.

Sau khi sửa dữ liệu trong `data/source/`, chạy lại:

```bash
npm run data:build
```

## Cấu trúc thư mục

```
data/source/           Dữ liệu GeoJSON gốc (không phục vụ trực tiếp)
public/data/           Dữ liệu đã chuẩn hóa mà ứng dụng tải
scripts/               Script xử lý dữ liệu
src/
  components/           Trang chủ, địa cầu 3D, thẻ quốc gia, học tập, so sánh, ...
  config/features.js    Registry chức năng trang chủ
  data/                 Lập chỉ mục quốc gia, nhóm quốc gia, cấu hình so sánh
  education/            Câu hỏi, Leitner SRS, tiến độ và lộ trình học
  i18n/                 Chuỗi giao diện tiếng Việt / tiếng Anh
  services/             API ngoài, tải GeoJSON và API client dùng chung
  utils/                Xử lý địa lý, hiển thị 3D, URL và lịch sử gần đây
```

## Triển khai

Mỗi lần push lên nhánh `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự build và đưa lên GitHub Pages.
