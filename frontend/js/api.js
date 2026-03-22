const API = (() => {
  const BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000/api"
      : "https://tbfinance.onrender.com/api";

  function getStoredToken(endpoint = "") {
    const lowerEndpoint = endpoint.toLowerCase();
    const isAdminLoggedIn = localStorage.getItem("admin_token") !== null;
    const isUserLoggedIn = localStorage.getItem("token") !== null;
    
    // If admin is logged in, use admin token for ALL requests
    // This ensures admin can access both admin and regular user endpoints
    if (isAdminLoggedIn) {
      return localStorage.getItem("admin_token");
    }
    
    // If admin is not logged in, check for regular user token
    // For admin endpoints (like registration/login), use admin_token if available
    if (lowerEndpoint.startsWith("/admin") || lowerEndpoint.startsWith("admin")) {
      return localStorage.getItem("admin_token");
    }
    
    // Default to regular user token
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

      // Handle unauthorized errors - clear admin token if it's invalid
      if (response.status === 401) {
        const errorMessage = data?.message || data?.error || "";
        if (errorMessage.includes("admin") && isAdminLoggedIn()) {
          // If admin token is invalid, clear it and redirect to login
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin");
          if (window.location.pathname.includes("admin-panel")) {
            window.location.href = "admin-login.html";
          }
        }
      }

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

  // Helper function to check if admin is logged in
  function isAdminLoggedIn() {
    return localStorage.getItem("admin_token") !== null;
  }

  // Helper function to check if user is logged in
  function isUserLoggedIn() {
    return localStorage.getItem("token") !== null;
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

    // Helper methods to check auth status
    isAdminLoggedIn,
    isUserLoggedIn,
    
    // Method to logout admin
    adminLogout: async () => {
      try {
        await API.post("/admin/logout");
      } finally {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin");
      }
    },
    
    // Method to logout user
    userLogout: async () => {
      try {
        await API.post("/logout");
      } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    },
  };
})();