# GlobeVision

Ứng dụng web khám phá các quốc gia trên mô hình địa cầu 3D, dành cho học sinh, giáo viên và người yêu thích địa lý.

Bản chạy thử: https://trungbodoi.github.io/GlobeVision/

## Tính năng

- **Địa cầu 3D tương tác:** xoay, phóng to/thu nhỏ, rê chuột để xem tên quốc gia.
- **Tìm kiếm quốc gia** theo tên tiếng Việt, tiếng Anh, tên thông dụng (vd. "Mỹ", "UK") hoặc mã ISO; điều khiển được bằng bàn phím.
- **Thẻ thông tin quốc gia:** quốc kỳ, thủ đô, giờ địa phương tại thủ đô, dân số, diện tích, mật độ dân số, khu vực, tiền tệ, ngôn ngữ, múi giờ, mã điện thoại, tên bản địa.
- **Quốc gia láng giềng:** liệt kê và tô sáng trên địa cầu; bấm để chuyển sang nước đó.
- **Chia sẻ liên kết:** quốc gia đang xem nằm trên URL (vd. `?country=VN`), dùng được nút Back/Forward và nút "Sao chép liên kết".
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
| `npm run data:build` | Tạo lại dữ liệu quốc gia chuẩn hóa (xem bên dưới) |

## Dữ liệu

| Nguồn | Dùng cho | Giấy phép |
| --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) | Hình dạng, đường biên giới, tên quốc gia, dân số ước tính (năm 2011–2020 tùy nước) | Public domain |
| [countries.dev](https://countries.dev/) (dữ liệu GeoNames) | Thông tin chi tiết, quốc gia láng giềng, múi giờ thủ đô | CC BY 4.0 |

### Chuẩn hóa dữ liệu quốc gia

Dữ liệu gốc nằm trong `data/source/`. Script `scripts/build-country-data.mjs` chuẩn hóa và ghi ra `public/data/`:

- Thống nhất khóa thuộc tính (Natural Earth dùng lẫn `NAME_VI` và `name_vi`).
- Mỗi quốc gia có `id` ổn định: mã ISO alpha-2, hoặc mã ADM0 cho vùng không có mã ISO (Northern Cyprus, Somaliland).
- Sửa mã không khớp với API (Đài Loan `CN-TW` → `TW`).
- Đánh dấu các vùng có tranh chấp để hiển thị ghi chú trung lập.
- Làm tròn tọa độ đến 4 chữ số thập phân (~11 m) và bỏ thuộc tính không dùng: dữ liệu bản đồ giảm từ ~6,8 MB xuống ~0,7 MB.

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
  components/          WorldGlobe, CountryCard, CountrySearch, LoadingScreen
  data/countries.js    Tải, lập chỉ mục và tìm kiếm quốc gia
  i18n/                Chuỗi giao diện tiếng Việt / tiếng Anh
  services/            Gọi API countries.dev, có cache
  utils/               Các lớp hiển thị 3D, đồng bộ URL
```

## Triển khai

Mỗi lần push lên nhánh `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự build và đưa lên GitHub Pages.
