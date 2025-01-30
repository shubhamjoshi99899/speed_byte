const axios = require("axios");
const { OLA_MAPS_API_URL, API_KEY } = require("../config/olaApiConfig");

const getAddressFromCoordinates = async (lat, lng) => {
  try {
    const url = `${OLA_MAPS_API_URL}?latlng=${lat},${lng}&api_key=${API_KEY}`;
    const response = await axios.get(url);

    if (response.data.status !== "ok" || !response.data.results) {
      throw new Error("Invalid response from OlaMaps API");
    }

    let exactLocation = null;
    let region = null;

    for (const place of response.data.results) {
      const components = place.address_components;

      let neighborhood = components.find((c) =>
        c.types.includes("neighborhood")
      )?.long_name;
      let sublocality = components.find((c) =>
        c.types.includes("sublocality")
      )?.long_name;
      let locality = components.find((c) =>
        c.types.includes("locality")
      )?.long_name;
      let areaLevel3 = components.find((c) =>
        c.types.includes("administrative_area_level_3")
      )?.long_name;
      let areaLevel2 = components.find((c) =>
        c.types.includes("administrative_area_level_2")
      )?.long_name;
      let areaLevel1 = components.find((c) =>
        c.types.includes("administrative_area_level_1")
      )?.long_name;
      let country = components.find((c) =>
        c.types.includes("country")
      )?.long_name;
      let postalCode = components.find((c) =>
        c.types.includes("postal_code")
      )?.long_name;

      if (!exactLocation) {
        exactLocation = [
          neighborhood,
          sublocality,
          locality,
          postalCode,
          country,
        ]
          .filter(Boolean)
          .join(", ");
      }

      if (!region) {
        region = [areaLevel3, areaLevel2, locality].filter(Boolean).join(", ");
      }
    }

    return {
      exact_location: exactLocation || "Unknown",
      region: region || "Unknown",
    };
  } catch (error) {
    console.error("Error fetching address:", error.message);
    throw new Error("Failed to fetch address");
  }
};

module.exports = { getAddressFromCoordinates };
