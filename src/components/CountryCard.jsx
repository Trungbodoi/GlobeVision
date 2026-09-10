import { useEffect, useState } from "react";
import "./CountryCard.css";

function AnimatedNumber({ value, duration = 1200 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value == null || value === "") {
      setDisplayValue(0);
      return;
    }

    const target = Number(value);

    if (!Number.isFinite(target)) {
      setDisplayValue(0);
      return;
    }

    let startTime = null;
    let frameId;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = easeOutCubic(progress);

      setDisplayValue(target * easedProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{Math.round(displayValue).toLocaleString("vi-VN")}</>;
}

function CountryCard({ country, loading, onClose }) {
  if (!country) return null;

  const data = country.apiData;

  const currencies = data?.currencies
    ?.map((item) => {
      if (item.symbol) {
        return `${item.name} (${item.code}, ${item.symbol})`;
      }

      return `${item.name} (${item.code})`;
    })
    .join(", ");

  const languages = data?.languages
    ?.map((item) => item.name)
    .join(", ");

  return (
    <div className="country-card">

      {/* Nút đóng */}
      <button
        type="button"
        className="country-card-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        aria-label="Đóng"
      >
        ×
      </button>

      {/* Header */}
      <div className="country-card-header">

        {data?.flags?.svg && (
          <img
            className="country-flag"
            src={data.flags.svg}
            alt={`Quốc kỳ ${country.name}`}
          />
        )}

        <h1 className="country-title">
          {data?.name || country.name}
        </h1>

        <div className="country-code">
          {data?.alpha2Code || "--"}
          {" · "}
          {data?.alpha3Code || country.code || "--"}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="country-loading">
          <div className="loading-spinner"></div>
          <span>Đang tải thông tin...</span>
        </div>
      ) : (
        <div className="country-info">

          <InfoItem
            label="Thủ đô"
            value={data?.capital}
          />

          <InfoItem
            label="Dân số"
            value={
              data?.population != null ? (
                <>
                  <AnimatedNumber value={data.population} />
                  <span className="unit"> người</span>
                </>
              ) : null
            }
          />

          <InfoItem
            label="Diện tích"
            value={
              data?.area != null ? (
                <>
                  <AnimatedNumber value={data.area} />
                  <span className="unit"> km²</span>
                </>
              ) : null
            }
          />

          <InfoItem
            label="Khu vực"
            value={data?.region}
          />

          <InfoItem
            label="Tiểu khu vực"
            value={data?.subregion}
          />

          <InfoItem
            label="Tiền tệ"
            value={currencies}
          />

          <InfoItem
            label="Ngôn ngữ"
            value={languages}
          />

          <InfoItem
            label="Múi giờ"
            value={data?.timezones?.join(", ")}
          />

          <InfoItem
            label="Mật độ dân số"
            value={
              data?.populationDensity != null ? (
                <>
                  <AnimatedNumber
                    value={data.populationDensity}
                  />
                  <span className="unit"> người/km²</span>
                </>
              ) : null
            }
          />

          <InfoItem
            label="Tên bản địa"
            value={data?.nativeName}
          />

        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="country-info-item">

      <div className="country-info-label">
        {label}
      </div>

      <div className="country-info-value">
        {value || "Chưa có dữ liệu"}
      </div>

    </div>
  );
}

export default CountryCard;