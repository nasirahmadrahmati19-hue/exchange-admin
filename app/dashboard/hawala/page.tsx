"use client";

import { useState, type ChangeEvent } from "react";

// لیست ۳۴ ولایت افغانستان
const provinces = [
  "هرات",
  "ارزگان",
  "بادغیس",
  "بدخشان",
  "بامیان",
  "بغلان",
  "بلخ",
  "پکتیا",
  "پکتیکا",
  "پنجشیر",
  "پروان",
  "تخار",
  "جوزجان",
  "خوست",
  "دایکندی",
  "زابل",
  "سرپل",
  "سمنگان",
  "فاریاب",
  "فراه",
  "غزنی",
  "غور",
  "کابل",
  "کندهار",
  "کاپیسا",
  "قندوز",
  "کنر",
  "لغمان",
  "لوگر",
  "میدان وردک",
  "ننگرهار",
  "نیمروز",
  "نورستان",
  "هلمند"
] as const;

// فقط ولسوالی‌های هرات
const heratDistricts = [
  "گلران",
  "مرکز هرات",
  "ادرسکن",
  "چشت شریف",
  "فارسی",
  "غوریان",
  "گذره",
  "انجیل",
  "کرخ",
  "کوهسان",
  "کشک",
  "کشک کهنه",
  "اوبه",
  "پشتون زرغون",
  "شیندند",
  "زنده جان"
] as const;

const DEFAULT_PROVINCE = "هرات";
const DEFAULT_DISTRICT = "گلران";

export default function HawalaPage() {
  const [province, setProvince] = useState<string>(DEFAULT_PROVINCE);
  const [district, setDistrict] = useState<string>(DEFAULT_DISTRICT);

  const isHerat = province === "هرات";

  const handleProvinceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedProvince = event.target.value;
    setProvince(selectedProvince);

    if (selectedProvince === "هرات") {
      setDistrict(DEFAULT_DISTRICT);
    } else {
      // برای ولایت‌های دیگر فقط نام ولایت استفاده می‌شود
      setDistrict(selectedProvince);
    }
  };

  const handleDistrictChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setDistrict(event.target.value);
  };

  const destinationText = isHerat
    ? `${province} — ${district}`
    : province;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: "20px",
        fontFamily: "Tahoma, Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "500px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #dddddd",
          borderRadius: "12px",
          padding: "20px"
        }}
      >
        <h1
          style={{
            fontSize: "20px",
            marginBottom: "20px",
            fontWeight: "bold"
          }}
        >
          🏦 تب حواله‌جات
        </h1>

        <h2
          style={{
            fontSize: "16px",
            marginBottom: "15px",
            fontWeight: "bold"
          }}
        >
          📍 مقصد حواله
        </h2>

        {/* انتخاب ولایت */}
        <div style={{ marginBottom: "15px" }}>
          <label
            htmlFor="province"
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            ولایت
          </label>

          <select
            id="province"
            value={province}
            onChange={handleProvinceChange}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #cccccc",
              fontSize: "14px",
              backgroundColor: "#ffffff"
            }}
          >
            {provinces.map(provinceName => (
              <option key={provinceName} value={provinceName}>
                {provinceName}
              </option>
            ))}
          </select>
        </div>

        {/* انتخاب ولسوالی فقط برای هرات */}
        <div style={{ marginBottom: "15px" }}>
          <label
            htmlFor="district"
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            ولسوالی
          </label>

          {isHerat ? (
            <select
              id="district"
              value={district}
              onChange={handleDistrictChange}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cccccc",
                fontSize: "14px",
                backgroundColor: "#ffffff"
              }}
            >
              {heratDistricts.map(districtName => (
                <option key={districtName} value={districtName}>
                  {districtName}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={province}
              disabled
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #dddddd",
                fontSize: "14px",
                backgroundColor: "#eeeeee",
                color: "#555555"
              }}
            />
          )}
        </div>

        {/* نمایش مقصد نهایی */}
        <div
          style={{
            padding: "12px",
            backgroundColor: "#f0f8ff",
            border: "1px solid #cde4f5",
            borderRadius: "8px",
            fontSize: "14px"
          }}
        >
          مقصد نهایی: <strong>{destinationText}</strong>
        </div>

        {/* دکمه نمونه */}
        <button
          type="button"
          onClick={() => {
            alert(`مقصد انتخاب شد: ${destinationText}`);
          }}
          style={{
            marginTop: "15px",
            width: "100%",
            padding: "10px",
            backgroundColor: "#16a34a",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            cursor: "pointer"
          }}
        >
          ثبت مقصد
        </button>
      </div>
    </div>
  );
}
