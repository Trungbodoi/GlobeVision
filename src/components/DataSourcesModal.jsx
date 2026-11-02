import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/useI18n";
import "./DataSourcesModal.css";

const DATA_SOURCES = [
  {
    name: "Natural Earth",
    descVi: "Hình dạng địa lý, đường biên giới quốc gia, tọa độ nhãn và dân số ước tính cơ sở.",
    descEn: "Geographic vector boundaries, country polygons, label coordinates and baseline population.",
    license: "Public Domain",
    url: "https://www.naturalearthdata.com/",
  },
  {
    name: "GeoNames / countries.dev",
    descVi: "Thông tin chi tiết quốc gia, quốc kỳ SVG, múi giờ IANA, tiền tệ, ngôn ngữ, mã gọi và quốc gia láng giềng.",
    descEn: "Detailed country facts, SVG flags, IANA capital timezones, currencies, languages, calling codes, and border neighbors.",
    license: "Creative Commons Attribution 4.0 (CC BY 4.0)",
    url: "https://countries.dev/",
  },
  {
    name: "Wikipedia REST API",
    descVi: "Mô tả bách khoa toàn thư tóm tắt (tiếng Việt ưu tiên, tiếng Anh dự phòng), ảnh đại diện và bài viết gốc.",
    descEn: "Encyclopedic summary text (Vietnamese preferred, English fallback), thumbnail image and article link.",
    license: "Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)",
    url: "https://www.wikimedia.org/",
  },
  {
    name: "World Bank Open Data",
    descVi: "Chỉ số kinh tế - xã hội nhiều năm: GDP bình quân đầu người, tuổi thọ kỳ vọng, tỷ lệ đô thị hóa, phát thải CO2, tỷ lệ biết chữ.",
    descEn: "Multi-year indicators: GDP per capita, life expectancy, urbanization rate, CO2 emissions, literacy rate.",
    license: "Creative Commons Attribution 4.0 (CC BY 4.0)",
    url: "https://data.worldbank.org/",
  },
  {
    name: "Open-Meteo",
    descVi: "Dữ liệu thời tiết thời gian thực tại thủ đô: nhiệt độ, nhiệt độ cảm nhận, độ ẩm, tốc độ gió và mã thời tiết WMO.",
    descEn: "Real-time capital weather: current temperature, apparent temperature, relative humidity, wind speed and WMO code.",
    license: "Creative Commons Attribution 4.0 (CC BY 4.0)",
    url: "https://open-meteo.com/",
  },
  {
    name: "Nager.Date",
    descVi: "Danh sách và thông tin các ngày lễ quốc gia sắp tới của từng quốc gia trong năm.",
    descEn: "Upcoming public and national holidays schedule per country.",
    license: "Open Data / Public Domain",
    url: "https://date.nager.at/",
  },
  {
    name: "Wikimedia Commons",
    descVi: "Kho ảnh tư liệu địa danh, danh lam thắng cảnh và di sản văn hóa kèm tác giả và giấy phép riêng từng ảnh.",
    descEn: "Documentary photography of landmarks and landscapes with specific author and license attribution.",
    license: "CC BY-SA / Public Domain",
    url: "https://commons.wikimedia.org/",
  },
];

function DataSourcesModal({ isOpen, onClose }) {
  const { lang, t } = useI18n();
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sources-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sources-modal-container">
        <header className="sources-modal-header">
          <div>
            <h2 id="sources-modal-title">
              {lang === "vi" ? "Nguồn dữ liệu & Giấy phép" : "Data Sources & Licenses"}
            </h2>
            <p className="sources-modal-subtitle">
              {lang === "vi"
                ? "Dữ liệu được khai thác từ các tổ chức quốc tế mở và dịch vụ không thu phí."
                : "Information sourced from open international organizations and free APIs."}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="sources-modal-close"
            onClick={onClose}
            aria-label={t("card.close")}
          >
            ×
          </button>
        </header>

        <div className="sources-modal-body">
          <section className="sources-list" aria-label="Sources list">
            {DATA_SOURCES.map((src) => (
              <article key={src.name} className="source-item">
                <div className="source-item-header">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="source-name"
                  >
                    {src.name} ↗
                  </a>
                  <span className="source-license">{src.license}</span>
                </div>
                <p className="source-desc">
                  {lang === "vi" ? src.descVi : src.descEn}
                </p>
              </article>
            ))}
          </section>

          <div className="sources-disputed-statement">
            <h4>
              {lang === "vi"
                ? "Ghi chú trung lập về vùng tranh chấp"
                : "Neutral Statement on Disputed Territories"}
            </h4>
            <p>
              {lang === "vi"
                ? "GlobeVision là nền tảng giáo dục trung lập. Đường biên giới và các thông tin thể hiện trên bản đồ tuân thủ quy ước dữ liệu mở quốc tế (Natural Earth) và không thể hiện bất kỳ quan điểm chính trị nào về chủ quyền quốc gia hoặc vùng lãnh thổ."
                : "GlobeVision is an impartial educational platform. Geographic boundaries and displayed facts adhere to international open data standards (Natural Earth) and do not imply any political stance or recognition regarding territorial sovereignty."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataSourcesModal;
