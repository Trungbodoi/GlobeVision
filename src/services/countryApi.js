export async function getCountryInfo(code) {
  if (!code) {
    console.error("Không có mã quốc gia để gọi API");
    return null;
  }

  try {
    const response = await fetch(
      `https://countries.dev/alpha/${code}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    console.log("Dữ liệu quốc gia:", data);

    return data;
  } catch (error) {
    console.error(
      "Không lấy được dữ liệu quốc gia:",
      error
    );

    return null;
  }
}
