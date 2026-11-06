const API_BASE_URL = "http://127.0.0.1:8000";

async function apiRequest(path, token, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Authentication
export function loginUser(email, password) {
  return apiRequest("/api/auth/login", null, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export function registerUser(name, email, password) {
  return apiRequest("/api/auth/register", null, {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });
}

export function getMe(token) {
  return apiRequest("/api/auth/me", token);
}

// Content
export function getContent(token) {
  return apiRequest("/api/content/", token);
}

// Watchlist
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

// Reviews
export function getReviews(token, contentId) {
  return apiRequest(`/api/reviews/content/${contentId}`, token);
}

export function getReviewSummary(token, contentId) {
  return apiRequest(`/api/reviews/content/${contentId}/summary`, token);
}

export function getMyReviews(token) {
  return apiRequest("/api/reviews/my", token);
}

export function createReview(token, contentId, rating, reviewText) {
  return apiRequest("/api/reviews/", token, {
    method: "POST",
    body: JSON.stringify({
      content_id: contentId,
      rating,
      review_text: reviewText || null,
    }),
  });
}

export function updateReview(token, reviewId, rating, reviewText) {
  return apiRequest(`/api/reviews/${reviewId}`, token, {
    method: "PUT",
    body: JSON.stringify({
      rating,
      review_text: reviewText || null,
    }),
  });
}

export function deleteReview(token, reviewId) {
  return apiRequest(`/api/reviews/${reviewId}`, token, {
    method: "DELETE",
  });
}