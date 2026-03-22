const API = (() => {
  const BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000/api"
      : "https://tbfinance.onrender.com/api";

  function getStoredToken(endpoint = "") {
    const lowerEndpoint = endpoint.toLowerCase();

    if (lowerEndpoint.startsWith("/admin") || lowerEndpoint.startsWith("admin")) {
      return localStorage.getItem("admin_token");
    }

    return localStorage.getItem("token");
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const isFormData = options.body instanceof FormData;
    const token = getStoredToken(endpoint);

    const config = {
      method: options.method || "GET",
      body: options.body,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    };

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
    get(endpoint, headers = {}) {
      return request(endpoint, {
        method: "GET",
        headers,
      });
    },

    post(endpoint, body = {}, headers = {}) {
      return request(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      });
    },

    put(endpoint, body = {}, headers = {}) {
      return request(endpoint, {
        method: "PUT",
        body: JSON.stringify(body),
        headers,
      });
    },

    patch(endpoint, body = {}, headers = {}) {
      return request(endpoint, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers,
      });
    },

    delete(endpoint, headers = {}) {
      return request(endpoint, {
        method: "DELETE",
        headers,
      });
    },

    postForm(endpoint, formData, headers = {}) {
      return request(endpoint, {
        method: "POST",
        body: formData,
        headers,
      });
    },

    putForm(endpoint, formData, headers = {}) {
      return request(endpoint, {
        method: "PUT",
        body: formData,
        headers,
      });
    },
  };
})();