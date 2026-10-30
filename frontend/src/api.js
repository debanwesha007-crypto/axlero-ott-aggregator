const API_BASE_URL = "http://127.0.0.1:8000";

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the default message if the response has no JSON body.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getContent(token) {
  return apiRequest("/api/content/", token);
}

export function getWatchlist(token) {
  return apiRequest("/api/watchlist/", token);
}

export function addToWatchlist(token, contentId) {
  return apiRequest("/api/watchlist/", token, {
    method: "POST",
    body: JSON.stringify({ content_id: contentId }),
  });
}

export function removeFromWatchlist(token, contentId) {
  return apiRequest(`/api/watchlist/${contentId}`, token, {
    method: "DELETE",
  });
}