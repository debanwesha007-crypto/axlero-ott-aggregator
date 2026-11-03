import { useState, useEffect, useMemo, useRef } from "react";
import {
  getContent,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getReviews,
  getReviewSummary,
  getMyReviews,
  createReview,
  updateReview,
  deleteReview,
} from "./api";
import "./App.css";

// --------------------------------------------------
// Movie card styles
// --------------------------------------------------

const getMovieStyle = (title) => {
  const styles = {
    Interstellar: {
      emoji: "🚀",
      color: "linear-gradient(135deg, #111827, #374151)",
    },
    Inception: {
      emoji: "🌀",
      color: "linear-gradient(135deg, #312e81, #1e1b4b)",
    },
    "The Office": {
      emoji: "🏢",
      color: "linear-gradient(135deg, #64748b, #334155)",
    },
    "Stranger Things": {
      emoji: "👾",
      color: "linear-gradient(135deg, #7f1d1d, #450a0a)",
    },
    "The Dark Knight": {
      emoji: "🦇",
      color: "linear-gradient(135deg, #1f2937, #030712)",
    },
    "Breaking Bad": {
      emoji: "🧪",
      color: "linear-gradient(135deg, #365314, #1a2e05)",
    },
  };

  return (
    styles[title] || {
      emoji: "🎬",
      color: "linear-gradient(135deg, #334155, #0f172a)",
    }
  );
};

// --------------------------------------------------
// Main App
// --------------------------------------------------

function App() {
  // Content and search
  const [movies, setMovies] = useState([]);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  // Navigation and filters
  const [category, setCategory] = useState("All");
  const [activePage, setActivePage] = useState("Home");

  // Watchlist
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState("");
  const [updatingMovieId, setUpdatingMovieId] = useState(null);

  // Selected movie
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Backend authentication
  const [token, setToken] = useState(
    () => localStorage.getItem("axlero_token") || ""
  );

  // Content loading and errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [myReviewId, setMyReviewId] = useState(null);

  // --------------------------------------------------
  // Keyboard shortcut: Ctrl/Cmd + K
  // --------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setSelectedMovie(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // --------------------------------------------------
  // Load content from backend
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

     const loadContent = async () => {
      if (!token) {
        setMovies([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await getContent(token);

        const content = Array.isArray(response)
          ? response
          : response?.items || response?.content || [];

        const formattedMovies = content.map((item) => ({
          ...item,
          year: item.release_year || item.year || "N/A",
          platform: item.platform_name || item.platform || "Unknown",
          type: item.content_type || item.type || "Movie",
          style: getMovieStyle(item.title),
        }));

        if (!cancelled) {
          setMovies(formattedMovies);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              err.message ||
              "Failed to load content."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // --------------------------------------------------
  // Load watchlist
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadWatchlist = async () => {
      if (!token) {
        setWatchlist([]);
        return;
      }

      try {
        setWatchlistLoading(true);
        setWatchlistError("");

        const response = await getWatchlist(token);

        const items = Array.isArray(response)
          ? response
          : response?.items || response?.watchlist || [];

        const ids = items.map((item) =>
          typeof item === "object"
            ? item.content_id ?? item.id
            : item
        );

        if (!cancelled) {
          setWatchlist(ids);
        }
      } catch (err) {
        if (!cancelled) {
          setWatchlistError(
            err?.response?.data?.detail ||
              err.message ||
              "Failed to load watchlist."
          );
        }
      } finally {
        if (!cancelled) {
          setWatchlistLoading(false);
        }
      }
    };

    loadWatchlist();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // --------------------------------------------------
  // Load reviews for selected movie
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadReviews = async () => {
      if (!selectedMovie || !token) {
        setReviews([]);
        setReviewSummary(null);
        setReviewsError("");
        setMyReviewId(null);
        setEditingReviewId(null);
        setReviewText("");
        setReviewRating(5);
        setReviewsLoading(false);
        return;
      }

      try {
        setReviewsLoading(true);
        setReviewsError("");

        const [reviewItems, summary, myReviews] = await Promise.all([
          getReviews(token, selectedMovie.id),
          getReviewSummary(token, selectedMovie.id),
          getMyReviews(token),
        ]);

        if (!cancelled) {
          setReviews(Array.isArray(reviewItems) ? reviewItems : []);
          setReviewSummary(summary);

          const ownReview = myReviews.find(
            (review) =>
              Number(review.content_id) === Number(selectedMovie.id)
          );

          setMyReviewId(ownReview?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setReviewsError(
            err.message || "Failed to load reviews."
          );
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [selectedMovie, token]);

  // --------------------------------------------------
  // Refresh reviews
  // --------------------------------------------------

  const refreshReviews = async () => {
    if (!selectedMovie || !token) return;

    try {
      setReviewsLoading(true);
      setReviewsError("");

      const [reviewItems, summary, myReviews] = await Promise.all([
        getReviews(token, selectedMovie.id),
        getReviewSummary(token, selectedMovie.id),
        getMyReviews(token),
      ]);

      setReviews(Array.isArray(reviewItems) ? reviewItems : []);
      setReviewSummary(summary);

      const ownReview = myReviews.find(
        (review) =>
          Number(review.content_id) === Number(selectedMovie.id)
      );

      setMyReviewId(ownReview?.id ?? null);
    } catch (err) {
      setReviewsError(
        err.message || "Failed to refresh reviews."
      );
    } finally {
      setReviewsLoading(false);
    }
  };

  // --------------------------------------------------
  // Submit review
  // --------------------------------------------------

  const submitReview = async (event) => {
    event.preventDefault();
  if (!selectedMovie || !token) return;

  try {
    setReviewSubmitting(true);
    setReviewsError("");

    const rating = Number(reviewRating);
    const reviewTextValue = reviewText.trim();

    if (editingReviewId) {
      await updateReview(
        token,
        editingReviewId,
        rating,
        reviewTextValue
      );
    } else {
      await createReview(
        token,
        selectedMovie.id,
        rating,
        reviewTextValue
      );
    }

    setReviewText("");
    setReviewRating(5);
    setEditingReviewId(null);

    await refreshReviews();
  } catch (err) {
    setReviewsError(
      err.message || "Failed to submit review."
    );
  } finally {
    setReviewSubmitting(false);
  }
};


  // --------------------------------------------------
  // Delete review
  // --------------------------------------------------

  const removeReview = async (reviewId) => {
    if (!reviewId || !token) return;

  try {
    setReviewsError("");

    await deleteReview(token, reviewId);

    setMyReviewId(null);
    setEditingReviewId(null);
    setReviewText("");
    setReviewRating(5);

    await refreshReviews();
  } catch (err) {
    setReviewsError(
      err.message || "Failed to delete review."
    );
  }
};

  // --------------------------------------------------
  // Edit review
  // --------------------------------------------------
  const beginEditReview = (review) => {
  setEditingReviewId(review.id);
  setReviewRating(Number(review.rating) || 5);
  setReviewText(review.review_text || "");
  };
  // --------------------------------------------------
  // Categories
  // --------------------------------------------------

  const categories = useMemo(() => {
    const allGenres = movies.flatMap((movie) =>
      (movie.genre || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean)
    );

    return ["All", ...new Set(allGenres)];
  }, [movies]);

  // --------------------------------------------------
  // Filter movies
  // --------------------------------------------------

  const filteredMovies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return movies.filter((movie) => {
      const matchesSearch =
        !query ||
        movie.title?.toLowerCase().includes(query) ||
        movie.description?.toLowerCase().includes(query) ||
        movie.genre?.toLowerCase().includes(query) ||
        movie.platform?.toLowerCase().includes(query);

      const matchesCategory =
        category === "All" ||
        (movie.genre || "")
          .toLowerCase()
          .split(",")
          .map((genre) => genre.trim())
          .includes(category.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [movies, search, category]);

  // --------------------------------------------------
  // Recommendations based on watchlist genres
  // --------------------------------------------------

  const recommendedMovies = useMemo(() => {
    const savedIds = new Set(watchlist.map(Number));

    const savedMovies = movies.filter((movie) =>
      savedIds.has(Number(movie.id))
    );

    const savedGenres = new Set(
      savedMovies.flatMap((movie) =>
        (movie.genre || "")
          .split(",")
          .map((genre) => genre.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const candidates = movies.filter(
      (movie) => !savedIds.has(Number(movie.id))
    );

    // If the user has no saved genres, show some available content.
    if (savedGenres.size === 0) {
      return candidates.slice(0, 8);
    }

    return candidates
      .map((movie) => {
        const movieGenres = (movie.genre || "")
          .split(",")
          .map((genre) => genre.trim().toLowerCase())
          .filter(Boolean);

        const score = movieGenres.reduce(
          (total, genre) =>
            total + (savedGenres.has(genre) ? 1 : 0),
          0
        );

        return {
          ...movie,
          recommendationScore: score,
        };
      })
      .filter((movie) => movie.recommendationScore > 0)
      .sort(
        (a, b) =>
          b.recommendationScore - a.recommendationScore
      )
      .slice(0, 8);
  }, [movies, watchlist]);

  // --------------------------------------------------
  // Hero movie
  // --------------------------------------------------

  const heroMovie = useMemo(() => {
    return movies[0] || null;
  }, [movies]);

  // --------------------------------------------------
  // Backend connection
  // --------------------------------------------------

  const connectBackend = (newToken) => {
    if (!newToken) return;

    localStorage.setItem("axlero_token", newToken);
    setToken(newToken);
  };

  const disconnectBackend = () => {
    localStorage.removeItem("axlero_token");
    setToken("");
    setWatchlist([]);
  };

  // --------------------------------------------------
  // Toggle watchlist
  // --------------------------------------------------

  const toggleWatchlist = async (movie) => {
    if (!token || !movie) return;

    const movieId = Number(movie.id);

    try {
      setUpdatingMovieId(movieId);
      setWatchlistError("");

      const isSaved = watchlist.some(
        (id) => Number(id) === movieId
      );

      if (isSaved) {
        await removeFromWatchlist(token, movieId);

        setWatchlist((previous) =>
          previous.filter((id) => Number(id) !== movieId)
        );
      } else {
        await addToWatchlist(token, movieId);

        setWatchlist((previous) => [
          ...previous,
          movieId,
        ]);
      }
    } catch (err) {
      setWatchlistError(
        err?.response?.data?.detail ||
          err.message ||
          "Failed to update watchlist."
      );
    } finally {
      setUpdatingMovieId(null);
    }
  };

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  const navigateTo = (page) => {
    setActivePage(page);
    setCategory("All");
    setSearch("");
  };

  const pageTitle =
    activePage === "Home"
      ? "Explore"
      : activePage === "Discover"
      ? "Discover"
      : activePage === "Watchlist"
      ? "My Watchlist"
      : "Recommendations";

  // --------------------------------------------------
  // Part 2 starts here: return (...)
  // --------------------------------------------------
    return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">A</span>
          <span className="logo-text">Axlero</span>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">MENU</p>

          <button
            className={`nav-item ${
              activePage === "Home" ? "active" : ""
            }`}
            onClick={() => navigateTo("Home")}
          >
            <span>⌂</span>
            <span>Home</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Discover" ? "active" : ""
            }`}
            onClick={() => navigateTo("Discover")}
          >
            <span>⌕</span>
            <span>Discover</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Watchlist" ? "active" : ""
            }`}
            onClick={() => navigateTo("Watchlist")}
          >
            <span>♡</span>
            <span>Watchlist</span>
            <span className="nav-count">{watchlist.length}</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Recommendations" ? "active" : ""
            }`}
            onClick={() => navigateTo("Recommendations")}
          >
            <span>✦</span>
            <span>Recommendations</span>
          </button>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">PLATFORMS</p>

          {["Netflix", "Prime Video", "Max"].map((platform) => (
            <button
              key={platform}
              className="nav-item"
              onClick={() => {
                setActivePage("Discover");
                setSearch(platform);
                setCategory("All");
              }}
            >
              <span className="platform-dot" />
              <span>{platform}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          {token ? (
            <>
              <p className="connection-status">
                <span className="status-dot connected" />
                Backend connected
              </p>

              <button
                className="nav-item"
                onClick={disconnectBackend}
              >
                <span>↪</span>
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <p className="connection-status">
              <span className="status-dot disconnected" />
              Not connected
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            <span>Axlero</span>
            <span className="breadcrumb-divider">/</span>
            <span>{pageTitle}</span>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <span className="search-icon">⌕</span>

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search movies, shows..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {search && (
                <button
                  className="search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}

              <span className="search-shortcut">⌘ K</span>
            </div>
          </div>
        </header>

        {/* Welcome section */}
        <section className="welcome-section">
          <div>
            <p className="welcome-eyebrow">YOUR STREAMING HUB</p>
            <h1>{pageTitle}</h1>
            <p className="welcome-description">
              Find your next favourite movie or show.
            </p>
          </div>
        </section>

        {/* Backend connection message */}
        {!token && (
          <div className="backend-notice">
            <div>
              <strong>Connect your account</strong>
              <p>
                Sign in to use your watchlist and submit reviews.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                const newToken = window.prompt(
                  "Enter your backend access token:"
                );

                if (newToken) {
                  connectBackend(newToken.trim());
                }
              }}
            >
              Connect
            </button>
          </div>
        )}

        {/* Home hero */}
        {activePage === "Home" && heroMovie && !search && (
          <section className="hero-section">
            <div
              className="hero-background"
              style={{
                background:
                  heroMovie.style?.color ||
                  "linear-gradient(135deg, #1e293b, #020617)",
              }}
            >
              <div className="hero-overlay">
                <div className="hero-content">
                  <span className="hero-badge">
                    FEATURED
                  </span>

                  <h2>{heroMovie.title}</h2>

                  <div className="hero-meta">
                    <span>{heroMovie.year}</span>
                    <span>•</span>
                    <span>{heroMovie.type}</span>
                    <span>•</span>
                    <span>{heroMovie.platform}</span>
                  </div>

                  <p>
                    {heroMovie.description ||
                      "Discover this title on Axlero."}
                  </p>

                  <div className="hero-actions">
                    <button
                      className="primary-button"
                      onClick={() => setSelectedMovie(heroMovie)}
                    >
                      View Details
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => toggleWatchlist(heroMovie)}
                      disabled={
                        !token ||
                        updatingMovieId === Number(heroMovie.id)
                      }
                    >
                      {watchlist.some(
                        (id) => Number(id) === Number(heroMovie.id)
                      )
                        ? "✓ In Watchlist"
                        : "+ Add to Watchlist"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Error messages */}
        {error && (
          <div className="error-message">
            <strong>Unable to load content</strong>
            <p>{error}</p>
          </div>
        )}

        {watchlistError && (
          <div className="error-message">
            <p>{watchlistError}</p>
          </div>
        )}

        {/* Catalog */}
        <section className="catalog-section">
          <div className="catalog-header">
            <div>
              <h2>
                {activePage === "Watchlist"
                  ? "Your Saved Titles"
                  : activePage === "Recommendations"
                  ? "Picked For You"
                  : activePage === "Discover"
                  ? "Discover Content"
                  : "Trending Now"}
              </h2>

              <p>
                {activePage === "Recommendations"
                  ? "Based on the genres in your watchlist."
                  : activePage === "Watchlist"
                  ? "Everything you have saved."
                  : "Explore movies and shows across platforms."}
              </p>
            </div>

            <span className="results-count">
              {activePage === "Recommendations"
                ? recommendedMovies.length
                : activePage === "Watchlist"
                ? movies.filter((movie) =>
                    watchlist.some(
                      (id) => Number(id) === Number(movie.id)
                    )
                  ).length
                : filteredMovies.length}{" "}
              titles
            </span>
          </div>

          {/* Category filters */}
          {activePage !== "Watchlist" &&
            activePage !== "Recommendations" && (
              <div className="category-list">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`category-chip ${
                      category === item ? "active" : ""
                    }`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

          {/* Loading */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Loading content...</p>
            </div>
          )}

          {/* Movie grid */}
          {!loading && (
            <div className="movie-grid">
              {(activePage === "Recommendations"
                ? recommendedMovies
                : activePage === "Watchlist"
                ? movies.filter((movie) =>
                    watchlist.some(
                      (id) => Number(id) === Number(movie.id)
                    )
                  )
                : filteredMovies
              ).map((movie) => {
                const saved = watchlist.some(
                  (id) => Number(id) === Number(movie.id)
                );

                return (
                  <article
                    className="movie-card"
                    key={movie.id}
                  >
                    <div
                      className="movie-poster"
                      style={{
                        background:
                          movie.style?.color ||
                          "linear-gradient(135deg, #334155, #0f172a)",
                      }}
                      onClick={() => setSelectedMovie(movie)}
                    >
                      {movie.poster_url ? (
                        <img
                          src={movie.poster_url}
                          alt={movie.title}
                          className="poster-image"
                        />
                      ) : (
                        <div className="poster-fallback">
                          <span className="poster-emoji">
                            {movie.style?.emoji || "🎬"}
                          </span>

                          <span className="poster-title">
                            {movie.title}
                          </span>

                          <span className="poster-year">
                            {movie.year}
                          </span>
                        </div>
                      )}

                      <span className="poster-type">
                        {movie.type}
                      </span>

                      <button
                        className={`watchlist-button ${
                          saved ? "saved" : ""
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleWatchlist(movie);
                        }}
                        disabled={
                          !token ||
                          updatingMovieId === Number(movie.id)
                        }
                        aria-label={
                          saved
                            ? "Remove from watchlist"
                            : "Add to watchlist"
                        }
                      >
                        {saved ? "♥" : "♡"}
                      </button>

                      <div className="poster-hover">
                        <button
                          className="view-details-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMovie(movie);
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>

                    <div className="movie-info">
                      <div className="movie-title-row">
                        <h3>{movie.title}</h3>
                        <span className="movie-year">
                          {movie.year}
                        </span>
                      </div>

                      <p className="movie-genre">
                        {movie.genre || movie.type}
                      </p>

                      <div className="movie-platform">
                        <span className="platform-dot" />
                        <span>{movie.platform}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Empty states */}
          {!loading &&
            (activePage === "Recommendations"
              ? recommendedMovies.length === 0
              : activePage === "Watchlist"
              ? !movies.some((movie) =>
                  watchlist.some(
                    (id) => Number(id) === Number(movie.id)
                  )
                )
              : filteredMovies.length === 0) && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  {activePage === "Recommendations"
                    ? "✦"
                    : activePage === "Watchlist"
                    ? "♡"
                    : "⌕"}
                </div>

                <h3>
                  {activePage === "Recommendations"
                    ? "No recommendations yet"
                    : activePage === "Watchlist"
                    ? "Your watchlist is empty"
                    : "No titles found"}
                </h3>

                <p>
                  {activePage === "Recommendations"
                    ? "Add a few titles to your watchlist to get genre-based recommendations."
                    : activePage === "Watchlist"
                    ? "Save movies and shows to find them here later."
                    : "Try changing your search or category filter."}
                </p>

                {activePage !== "Discover" && (
                  <button
                    className="secondary-button"
                    onClick={() => navigateTo("Discover")}
                  >
                    Explore Content
                  </button>
                )}
              </div>
            )}
        </section>
                {/* Footer */}
        <footer className="app-footer">
          <p>
            © {new Date().getFullYear()} Axlero. All rights reserved.
          </p>
          <p>Your entertainment, all in one place.</p>
        </footer>
      </main>

      {/* Movie Details Modal */}
      {selectedMovie && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedMovie(null)}
        >
          <div
            className="movie-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="modal-poster"
              style={{
                background:
                  selectedMovie.style?.color ||
                  "linear-gradient(135deg, #334155, #0f172a)",
              }}
            >
              {selectedMovie.poster_url ? (
                <img
                  src={selectedMovie.poster_url}
                  alt={selectedMovie.title}
                  className="modal-poster-image"
                />
              ) : (
                <div className="modal-poster-fallback">
                  <span>
                    {selectedMovie.style?.emoji || "🎬"}
                  </span>
                  <h2>{selectedMovie.title}</h2>
                </div>
              )}

              <button
                className="modal-close-button"
                onClick={() => setSelectedMovie(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              <div className="modal-title-row">
                <div>
                  <h2>{selectedMovie.title}</h2>

                  <div className="modal-meta">
                    <span>{selectedMovie.year}</span>
                    <span>•</span>
                    <span>{selectedMovie.type}</span>
                    <span>•</span>
                    <span>{selectedMovie.platform}</span>
                  </div>
                </div>

                <button
                  className={`modal-watchlist-button ${
                    watchlist.some(
                      (id) =>
                        Number(id) === Number(selectedMovie.id)
                    )
                      ? "saved"
                      : ""
                  }`}
                  onClick={() => toggleWatchlist(selectedMovie)}
                  disabled={
                    !token ||
                    updatingMovieId === Number(selectedMovie.id)
                  }
                >
                  {watchlist.some(
                    (id) =>
                      Number(id) === Number(selectedMovie.id)
                  )
                    ? "♥ Saved"
                    : "♡ Add to Watchlist"}
                </button>
              </div>

              <div className="modal-genres">
                {(selectedMovie.genre || selectedMovie.type || "")
                  .split(",")
                  .map((genre) => genre.trim())
                  .filter(Boolean)
                  .map((genre) => (
                    <span
                      className="genre-tag"
                      key={genre}
                    >
                      {genre}
                    </span>
                  ))}
              </div>

              <p className="modal-description">
                {selectedMovie.description ||
                  "No description is available for this title."}
              </p>

              {/* Reviews */}
              <section className="reviews-section">
                <div className="reviews-header">
                  <div>
                    <h3>Reviews & Ratings</h3>
                    <p>
                      Share your thoughts about this title.
                    </p>
                  </div>

                  {reviewSummary && (
                    <div className="review-summary">
                      <span className="review-summary-star">
                        ★
                      </span>
                      <strong>
                        {Number(
                          reviewSummary.average_rating ??
                            reviewSummary.average ??
                            0
                        ).toFixed(1)}
                      </strong>
                      <span>
                        ({reviewSummary.total_reviews ??
                          reviewSummary.count ??
                          reviews.length}
                        )
                      </span>
                    </div>
                  )}
                </div>

                {/* Review Error */}
                {reviewsError && (
                  <div className="error-message">
                    <p>{reviewsError}</p>
                  </div>
                )}

                {/* Review Form */}
                {token ? (
                  <form
                    className="review-form"
                    onSubmit={submitReview}
                  >
                    <label htmlFor="review-rating">
                      Your rating
                    </label>

                    <select
                      id="review-rating"
                      value={reviewRating}
                      onChange={(event) =>
                        setReviewRating(Number(event.target.value))
                      }
                    >
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option
                          key={rating}
                          value={rating}
                        >
                          {rating} {rating === 1 ? "Star" : "Stars"}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="review-text">
                      Your review
                    </label>

                    <textarea
                      id="review-text"
                      rows={3}
                      placeholder="What did you think about this title?"
                      value={reviewText}
                      onChange={(event) =>
                        setReviewText(event.target.value)
                      }
                      required
                    />

                    <div className="review-form-actions">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={
                          reviewSubmitting ||
                          !reviewText.trim()
                        }
                      >
                        {reviewSubmitting
                          ? "Submitting..."
                          : editingReviewId
                          ? "Update Review"
                          : "Submit Review"}
                      </button>

                      {editingReviewId && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingReviewId(null);
                            setReviewText("");
                            setReviewRating(5);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="review-login-notice">
                    Connect your backend account to submit a review.
                  </div>
                )}

                {/* Review List */}
                <div className="review-list">
                  {reviewsLoading ? (
                    <div className="reviews-loading">
                      Loading reviews...
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="reviews-empty">
                      <span>✍</span>
                      <p>
                        No reviews yet. Be the first to review this title.
                      </p>
                    </div>
                  ) : (
                    reviews.map((review) => {
                      const isOwnReview =
                        review.id === myReviewId ||
                        review.is_own_review ||
                        review.is_current_user ||
                        review.own_review;

                      return (
                        <article
                          className="review-card"
                          key={review.id}
                        >
                          <div className="review-card-header">
                            <div>
                              <strong>
                                {review.username ||
                                  review.user_name ||
                                  review.user?.username ||
                                  "User"}
                              </strong>

                              <div className="review-stars">
                                {"★".repeat(
                                  Math.max(
                                    0,
                                    Math.min(
                                      5,
                                      Number(review.rating) || 0
                                    )
                                  )
                                )}
                                {"☆".repeat(
                                  5 -
                                    Math.max(
                                      0,
                                      Math.min(
                                        5,
                                        Number(review.rating) || 0
                                      )
                                    )
                                )}
                              </div>
                            </div>

                            {isOwnReview && token && (
                              <div className="review-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    beginEditReview(review)
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeReview(review.id)
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          <p className="review-comment">
                            {review.comment ||
                              review.text ||
                              "No written comment."}
                          </p>

                          {review.created_at && (
                            <span className="review-date">
                              {new Date(
                                review.created_at
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
        
      )}
    </div>
  );
}

export default App;