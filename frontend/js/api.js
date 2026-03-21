const API = (() => {
  const BASE_URL = "https://your-production-backend.com/api" || "http://localhost:8000/api";

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const config = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    };

    if (config.body instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || `Request failed with status ${response.status}`
        );
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  return {
    get: (endpoint, headers = {}) =>
      request(endpoint, { method: "GET", headers }),

    post: (endpoint, body = {}, headers = {}) =>
      request(endpoint, { method: "POST", body: JSON.stringify(body), headers }),

    put: (endpoint, body = {}, headers = {}) =>
      request(endpoint, { method: "PUT", body: JSON.stringify(body), headers }),

    patch: (endpoint, body = {}, headers = {}) =>
      request(endpoint, { method: "PATCH", body: JSON.stringify(body), headers }),

    delete: (endpoint, headers = {}) =>
      request(endpoint, { method: "DELETE", headers }),

    postForm: (endpoint, formData, headers = {}) =>
      request(endpoint, { method: "POST", body: formData, headers }),

    putForm: (endpoint, formData, headers = {}) =>
      request(endpoint, { method: "PUT", body: formData, headers }),
  };
})();