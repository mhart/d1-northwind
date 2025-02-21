import http from "k6/http";

const UPDATE_ENDPOINT = "https://queue2.cf-northwind.com";
const MAX_PRODUCT_ID = 77;

export default function () {
  const data = {
    // Choose a random product
    productId: 1 + Math.floor(Math.random() * MAX_PRODUCT_ID),

    // And update its inventory randomly between -50 and +50
    updateInventoryBy: 50 - Math.floor(Math.random() * 100),
  };
  http.post(UPDATE_ENDPOINT, JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

export const options = {
  scenarios: {
    ramping_load: {
      executor: "ramping-arrival-rate",
      preAllocatedVUs: 150,

      stages: [
        // Ramp up to 1,200 / sec in the first minute
        { target: 1200, duration: "1m" },

        // Then hold for the next minute
        { target: 1200, duration: "1m" },
      ],
    },
  },
  cloud: {
    // Distribute between 8 locations globally
    distribution: {
      usEast1: { loadZone: "amazon:us:ashburn", percent: 15 },
      usEast2: { loadZone: "amazon:us:columbus", percent: 15 },
      usWest1: { loadZone: "amazon:us:palo alto", percent: 15 },
      usWest2: { loadZone: "amazon:us:portland", percent: 15 },
      eu1: { loadZone: "amazon:de:frankfurt", percent: 10 },
      eu2: { loadZone: "amazon:ie:dublin", percent: 10 },
      eu3: { loadZone: "amazon:gb:london", percent: 10 },
      eu4: { loadZone: "amazon:fr:paris", percent: 10 },
    },
  },
};
