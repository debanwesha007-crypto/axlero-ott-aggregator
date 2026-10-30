const API_BASE_URL = "http://127.0.0.1:8000";

export async function getContent(token) {
  const response = await fetch(`${API_BASE_URL}/api/content/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.status}`);
  }

  return response.json();
}