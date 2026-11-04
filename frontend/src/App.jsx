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
  getMe,
  loginUser,
} from "./api";

import "./App.css";

// --------------------------------------------------
// Helpers
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

const getResponseItems = (response, keys = []) => {
  if (Array.isArray(response)) {
    return response;
  }

  for (const key of keys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }

  return [];
};

const getWatchlistId = (item) => {
  if (item && typeof item === "object") {
    return item.content_id ?? item.id ?? null;
  }

  return item ?? null;
};

const sameId = (first, second) => {
  if (first == null || second == null) {
    return false;
  }

  return String(first) === String(second);
};

const getErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.detail ||
    error?.message ||
    fallback
  );
};

// --------------------------------------------------
// Main App
// --------------------------------------------------

function App() {
  // Navigation
  const [activePage, setActivePage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All");

  // Content and search
  const [movies, setMovies] = useState([]);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  // Backend status
  const [backendConnected, setBackendConnected] = useState(false);

  // Authentication
  const [token, setToken] = useState(
    () => localStorage.getItem("axlero_token") || ""
  );
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // User profile
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Content loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Watchlist
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState("");
  const [updatingMovieId, setUpdatingMovieId] = useState(null);

  // Selected movie
  const [selectedMovie, setSelectedMovie] = useState(null);

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
  // Load user profile
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!token) {
        setProfile(null);
        setProfileError("");
        setProfileLoading(false);
        setBackendConnected(false);
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError("");

        const response = await getMe(token);

        if (!cancelled) {
          setProfile(response);
          setBackendConnected(true);
        }
      } catch (err) {
        if (!cancelled) {
          setProfile(null);
          setBackendConnected(false);
          setProfileError(
            getErrorMessage(err, "Failed to load profile.")
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // --------------------------------------------------
  // Load content
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      if (!token) {
        setMovies([]);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await getContent(token);
        const content = getResponseItems(response, ["items", "content"]);

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
            getErrorMessage(err, "Failed to load content.")
          );
          setMovies([]);
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
        setWatchlistLoading(false);
        setWatchlistError("");
        return;
      }

      try {
        setWatchlistLoading(true);
        setWatchlistError("");

        const response = await getWatchlist(token);
        const items = getResponseItems(response, [
          "items",
          "watchlist",
        ]);

        const ids = items
          .map(getWatchlistId)
          .filter((id) => id != null);

        if (!cancelled) {
          setWatchlist(ids);
        }
      } catch (err) {
        if (!cancelled) {
          setWatchlistError(
            getErrorMessage(err, "Failed to load watchlist.")
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

        const [reviewsResponse, summaryResponse, myReviewsResponse] =
          await Promise.all([
            getReviews(token, selectedMovie.id),
            getReviewSummary(token, selectedMovie.id),
            getMyReviews(token),
          ]);

        const reviewItems = getResponseItems(reviewsResponse, [
          "reviews",
          "items",
        ]);

        const myReviews = getResponseItems(myReviewsResponse, [
          "reviews",
          "items",
        ]);

        const ownReview = myReviews.find((review) =>
          sameId(review.content_id, selectedMovie.id)
        );

        if (!cancelled) {
          setReviews(reviewItems);
          setReviewSummary(summaryResponse);
          setMyReviewId(ownReview?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setReviewsError(
            getErrorMessage(err, "Failed to load reviews.")
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
    if (!selectedMovie || !token) {
      return;
    }

    try {
      setReviewsLoading(true);
      setReviewsError("");

      const [reviewsResponse, summaryResponse, myReviewsResponse] =
        await Promise.all([
          getReviews(token, selectedMovie.id),
          getReviewSummary(token, selectedMovie.id),
          getMyReviews(token),
        ]);

      const reviewItems = getResponseItems(reviewsResponse, [
        "reviews",
        "items",
      ]);

      const myReviews = getResponseItems(myReviewsResponse, [
        "reviews",
        "items",
      ]);

      const ownReview = myReviews.find((review) =>
        sameId(review.content_id, selectedMovie.id)
      );

      setReviews(reviewItems);
      setReviewSummary(summaryResponse);
      setMyReviewId(ownReview?.id ?? null);
    } catch (err) {
      setReviewsError(
        getErrorMessage(err, "Failed to refresh reviews.")
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

    if (!selectedMovie || !token) {
      setReviewsError("Please sign in to submit a review.");
      return;
    }

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
        getErrorMessage(err, "Failed to submit review.")
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  // --------------------------------------------------
  // Delete review
  // --------------------------------------------------

  const removeReview = async (reviewId) => {
    if (!reviewId || !token) {
      return;
    }

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
        getErrorMessage(err, "Failed to delete review.")
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
    const uniqueCategories = new Set();

    movies.forEach((movie) => {
      const rawCategory = movie.category || movie.genre || "";

      String(rawCategory)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => uniqueCategories.add(item));
    });

    return ["All", ...Array.from(uniqueCategories)];
  }, [movies]);

  // --------------------------------------------------
  // Filter content
  // --------------------------------------------------

  const filteredMovies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return movies.filter((movie) => {
      const title = String(movie.title || "").toLowerCase();
      const platform = String(
        movie.platform_name || movie.platform || ""
      ).toLowerCase();

      const rawCategory = movie.category || movie.genre || "";

      const movieCategories = String(rawCategory)
        .split(",")
        .map((item) => item.trim());

      const matchesSearch =
        !normalizedSearch ||
        title.includes(normalizedSearch) ||
        platform.includes(normalizedSearch);

      const matchesCategory =
        activeCategory === "All" ||
        movieCategories.includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [movies, search, activeCategory]);

  // --------------------------------------------------
  // Recommendations and hero
  // --------------------------------------------------

  const recommendedMovies = useMemo(() => {
    return movies.slice(0, 6);
  }, [movies]);

  const heroMovie = useMemo(() => {
    return (
      movies.find(
        (movie) => movie.backdrop_url || movie.poster_url
      ) || movies[0]
    );
  }, [movies]);

  // --------------------------------------------------
  // Login
  // --------------------------------------------------

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const data = await loginUser(
        loginEmail.trim(),
        loginPassword
      );

      const accessToken = data?.access_token;

      if (!accessToken) {
        throw new Error(
          "Login response did not contain an access token."
        );
      }

      localStorage.setItem("axlero_token", accessToken);
      setToken(accessToken);

      const userProfile = await getMe(accessToken);

      setProfile(userProfile);
      setBackendConnected(true);
      setShowLogin(false);
      setLoginPassword("");
      setProfileError("");
    } catch (err) {
      localStorage.removeItem("axlero_token");
      setToken("");
      setProfile(null);
      setBackendConnected(false);

      setError(
        getErrorMessage(err, "Login failed. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Backend connection
  // --------------------------------------------------

  const connectBackend = async () => {
    if (!token) {
      setError("Please sign in first to connect your backend.");
      setBackendConnected(false);
      setShowLogin(true);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const userProfile = await getMe(token);

      setProfile(userProfile);
      setBackendConnected(true);
    } catch (err) {
      setBackendConnected(false);
      setError(
        getErrorMessage(
          err,
          "Unable to connect to the backend. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const disconnectBackend = () => {
    localStorage.removeItem("axlero_token");

    setToken("");
    setProfile(null);
    setBackendConnected(false);
    setWatchlist([]);
    setReviews([]);
    setReviewSummary(null);
    setMyReviewId(null);
    setShowLogin(false);
  };

  // --------------------------------------------------
  // Watchlist toggle
  // --------------------------------------------------

  const toggleWatchlist = async (movie) => {
    if (!token) {
      setWatchlistError(
        "Please sign in to manage your watchlist."
      );
      setShowLogin(true);
      return;
    }

    const movieId = movie.id;

    if (movieId == null) {
      setWatchlistError("This title does not have a valid ID.");
      return;
    }

    const isSaved = watchlist.some((item) =>
      sameId(getWatchlistId(item), movieId)
    );

    setUpdatingMovieId(movieId);
    setWatchlistError("");

    try {
      if (isSaved) {
        await removeFromWatchlist(token, movieId);

        setWatchlist((previous) =>
          previous.filter(
            (item) => !sameId(getWatchlistId(item), movieId)
          )
        );
      } else {
        await addToWatchlist(token, movieId);

        setWatchlist((previous) => {
          const alreadySaved = previous.some((item) =>
            sameId(getWatchlistId(item), movieId)
          );

          return alreadySaved
            ? previous
            : [...previous, movieId];
        });
      }
    } catch (err) {
      setWatchlistError(
        getErrorMessage(err, "Could not update your watchlist.")
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
    setSearch("");
    setActiveCategory("All");
  };

  const pageTitle = {
    home: "Discover",
    browse: "Explore Movies & Shows",
    watchlist: "My Watchlist",
    profile: "My Profile",
  }[activePage] || "Discover";

  const watchlistMovies = useMemo(() => {
    return watchlist
      .map((item) => {
        const id = getWatchlistId(item);

        return movies.find((movie) => sameId(movie.id, id));
      })
      .filter(Boolean);
  }, [watchlist, movies]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">A</div>
          <span className="brand-name">Axlero</span>
        </div>

        <div className="sidebar-label">MENU</div>

        <nav className="side-nav">
          <button
            className={`nav-item ${
              activePage === "home" ? "active" : ""
            }`}
            onClick={() => navigateTo("home")}
          >
            <span className="nav-icon">⌂</span>
            <span>Home</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "browse" ? "active" : ""
            }`}
            onClick={() => navigateTo("browse")}
          >
            <span className="nav-icon">▦</span>
            <span>Browse</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "watchlist" ? "active" : ""
            }`}
            onClick={() => navigateTo("watchlist")}
          >
            <span className="nav-icon">♡</span>
            <span>My Watchlist</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "profile" ? "active" : ""
            }`}
            onClick={() => navigateTo("profile")}
          >
            <span className="nav-icon">♙</span>
            <span>Profile</span>
          </button>
        </nav>

        <div className="sidebar-label">STREAMING PLATFORMS</div>

        <div className="platform-list">
          {[
            "Netflix",
            "Prime Video",
            "Disney+",
            "Hulu",
            "Apple TV+",
          ].map((platform) => (
            <button
              key={platform}
              className="platform-item"
              onClick={() => {
                setSearch(platform);
                setActivePage("browse");
              }}
            >
              <span className="platform-dot" />
              <span>{platform}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="connection-status">
            <span
              className={`status-dot ${
                backendConnected ? "connected" : "disconnected"
              }`}
            />

            <span>
              {backendConnected
                ? "Backend connected"
                : "Backend disconnected"}
            </span>
          </div>

          {backendConnected ? (
            <button
              className="sidebar-action"
              onClick={disconnectBackend}
            >
              Disconnect
            </button>
          ) : (
            <button
              className="sidebar-action"
              onClick={() => setShowLogin(true)}
              disabled={loading}
            >
              Sign in
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-eyebrow">
              AXLERO STREAMING
            </span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <span className="search-icon">⌕</span>

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search movies, shows..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <span className="search-shortcut">⌘ K</span>
            </div>

            <button
              className="profile-button"
              onClick={() => navigateTo("profile")}
              title="Open profile"
            >
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="welcome-eyebrow">
                YOUR ENTERTAINMENT, UNIFIED
              </p>

              <h2>
                Welcome back
                {profile?.name ? `, ${profile.name}` : ""}!
              </h2>

              <p className="welcome-subtitle">
                Find your next favorite movie or show.
              </p>
            </div>

            <div className="welcome-badge">
              <span className="welcome-badge-icon">✦</span>
              <span>One place. Every platform.</span>
            </div>
          </section>

          {showLogin && !token && (
            <section className="backend-notice login-notice">
              <form onSubmit={handleLogin}>
                <h3>Sign in to Axlero</h3>

                <label htmlFor="axlero-login-email">
                  Email
                </label>

                <input
                  id="axlero-login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) =>
                    setLoginEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />

                <label htmlFor="axlero-login-password">
                  Password
                </label>

                <input
                  id="axlero-login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) =>
                    setLoginPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="submit"
                  className="primary-button"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowLogin(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </form>
            </section>
          )}

          {!backendConnected && (
            <section className="backend-notice">
              <div>
                <strong>
                  Connect to your Axlero backend
                </strong>

                <p>
                  Sign in and connect to load your personal
                  watchlist and reviews.
                </p>
              </div>

              <button
                onClick={() => setShowLogin(true)}
                disabled={loading}
                className="primary-button"
              >
                Sign in
              </button>
            </section>
          )}

          {activePage === "profile" ? (
            <section className="profile-section">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">ACCOUNT</p>
                  <h2>My Profile</h2>
                </div>
              </div>

              <div className="profile-card">
                <div className="profile-avatar">
                  {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>

                <div className="profile-details">
                  <h3>{profile?.name || "Guest User"}</h3>

                  <p>
                    {profile?.email ||
                      "Connect to view your account details."}
                  </p>

                  <span className="profile-status">
                    {profileLoading
                      ? "Loading profile..."
                      : backendConnected
                      ? "Connected"
                      : "Not connected"}
                  </span>

                  {profileError && (
                    <p className="inline-error">{profileError}</p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <>
              {activePage === "home" && heroMovie && (
                <section className="hero-banner">
                  <div className="hero-glow" />

                  <div className="hero-copy">
                    <span className="hero-kicker">
                      FEATURED DISCOVERY
                    </span>

                    <h2>{heroMovie.title}</h2>

                    <p>
                      {heroMovie.description ||
                        "Discover something unforgettable to watch today."}
                    </p>

                    <div className="hero-actions">
                      <button
                        className="primary-button"
                        onClick={() =>
                          setSelectedMovie(heroMovie)
                        }
                      >
                        <span>▶</span> View Details
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          toggleWatchlist(heroMovie)
                        }
                      >
                        <span>＋</span> Add to Watchlist
                      </button>
                    </div>
                  </div>

                  <div className="hero-art">
                    {heroMovie.backdrop_url ||
                    heroMovie.poster_url ? (
                      <img
                        src={
                          heroMovie.backdrop_url ||
                          heroMovie.poster_url
                        }
                        alt={heroMovie.title}
                      />
                    ) : (
                      <div className="hero-art-fallback">
                        {getMovieStyle(heroMovie.title).emoji}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {error && (
                <div className="error-message">
                  <span>!</span>
                  <p>{error}</p>

                  <button onClick={() => setError("")}>
                    Dismiss
                  </button>
                </div>
              )}

              {watchlistError && (
                <div className="error-message">
                  <span>!</span>
                  <p>{watchlistError}</p>

                  <button
                    onClick={() => setWatchlistError("")}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <section className="catalog-section">
                <div className="section-heading">
                  <div>
                    <p className="section-eyebrow">
                      {activePage === "watchlist"
                        ? "YOUR SAVED TITLES"
                        : activePage === "browse"
                        ? "EXPLORE THE COLLECTION"
                        : "PICK UP SOMETHING NEW"}
                    </p>

                    <h2>
                      {activePage === "watchlist"
                        ? "My Watchlist"
                        : activePage === "browse"
                        ? "Browse Catalog"
                        : "Trending Now"}
                    </h2>
                  </div>

                  <span className="result-count">
                    {activePage === "watchlist"
                      ? watchlist.length
                      : filteredMovies.length}{" "}
                    titles
                  </span>
                </div>

                {activePage !== "watchlist" && (
                  <div className="category-row">
                    {categories.map((categoryItem) => (
                      <button
                        key={categoryItem}
                        className={`category-chip ${
                          activeCategory === categoryItem
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCategory(categoryItem)
                        }
                      >
                        {categoryItem}
                      </button>
                    ))}
                  </div>
                )}

                {activePage === "watchlist" &&
                  watchlistError && (
                    <p className="inline-error">
                      {watchlistError}
                    </p>
                  )}

                {loading && (
                  <p className="review-message">
                    Loading catalog...
                  </p>
                )}

                {activePage === "watchlist" &&
                  watchlistLoading && (
                    <p className="review-message">
                      Loading watchlist...
                    </p>
                  )}

                <div className="movie-grid">
                  {(activePage === "watchlist"
                    ? watchlistMovies
                    : filteredMovies
                  ).map((movie) => {
                    const movieStyle = getMovieStyle(movie.title);

                    const isInWatchlist = watchlist.some(
                      (item) =>
                        sameId(getWatchlistId(item), movie.id)
                    );

                    return (
                      <article
                        className="movie-card"
                        key={movie.id}
                      >
                        <button
                          className="movie-poster"
                          onClick={() =>
                            setSelectedMovie(movie)
                          }
                        >
                          {movie.poster_url ? (
                            <img
                              src={movie.poster_url}
                              alt={movie.title}
                              className="poster-image"
                            />
                          ) : (
                            <div
                              className="poster-fallback"
                              style={{
                                background: movieStyle.color,
                              }}
                            >
                              <span className="poster-emoji">
                                {movieStyle.emoji}
                              </span>

                              <span className="poster-title">
                                {movie.title}
                              </span>
                            </div>
                          )}

                          <span className="poster-type">
                            {movie.category ||
                              movie.genre ||
                              "MOVIE"}
                          </span>
                        </button>

                        <button
                          className={`card-watchlist ${
                            isInWatchlist ? "saved" : ""
                          }`}
                          onClick={() =>
                            toggleWatchlist(movie)
                          }
                          disabled={
                            updatingMovieId === movie.id
                          }
                          title={
                            isInWatchlist
                              ? "Remove from watchlist"
                              : "Add to watchlist"
                          }
                        >
                          {updatingMovieId === movie.id
                            ? "…"
                            : isInWatchlist
                            ? "♥"
                            : "♡"}
                        </button>

                        <div className="movie-info">
                          <div className="movie-title-row">
                            <h3 className="movie-title">
                              {movie.title}
                            </h3>

                            <span className="movie-year">
                              {movie.release_year ||
                                movie.year ||
                                ""}
                            </span>
                          </div>

                          <div className="movie-meta">
                            <span className="movie-platform">
                              {movie.platform_name ||
                                movie.platform ||
                                "Streaming"}
                            </span>

                            {movie.rating && (
                              <span className="movie-rating">
                                ★ {movie.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {(activePage === "watchlist"
                  ? watchlistMovies.length === 0 &&
                    !watchlistLoading
                  : filteredMovies.length === 0 &&
                    !loading) && (
                  <div className="empty-state">
                    <div className="empty-state-icon">✦</div>

                    <h3>
                      {activePage === "watchlist"
                        ? "Your watchlist is empty"
                        : "No titles found"}
                    </h3>

                    <p>
                      {activePage === "watchlist"
                        ? "Save movies and shows here to find them later."
                        : "Try another search or select a different category."}
                    </p>

                    {activePage === "watchlist" && (
                      <button
                        className="primary-button"
                        onClick={() => navigateTo("browse")}
                      >
                        Explore Catalog
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="footer">
            <span>
              © {new Date().getFullYear()} Axlero
            </span>

            <span>Discover. Save. Stream.</span>
          </footer>
        </div>
      </main>

      {selectedMovie && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedMovie(null)}
        >
          <div
            className="details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedMovie(null)}
              aria-label="Close details"
            >
              ×
            </button>

            <div className="modal-art">
              {selectedMovie.poster_url ? (
                <img
                  src={selectedMovie.poster_url}
                  alt={selectedMovie.title}
                />
              ) : (
                <div className="modal-art-fallback">
                  {getMovieStyle(selectedMovie.title).emoji}
                </div>
              )}
            </div>

            <div className="modal-body">
              <p className="section-eyebrow">
                MOVIE DETAILS
              </p>

              <h2>{selectedMovie.title}</h2>

              <div className="modal-meta">
                <span>
                  {selectedMovie.release_year ||
                    selectedMovie.year ||
                    "Release year unknown"}
                </span>

                <span>
                  {selectedMovie.platform_name ||
                    selectedMovie.platform ||
                    "Streaming"}
                </span>

                <span>
                  {selectedMovie.category ||
                    selectedMovie.genre ||
                    "Movie"}
                </span>
              </div>

              <p className="modal-description">
                {selectedMovie.description ||
                  "No description is available for this title yet."}
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  toggleWatchlist(selectedMovie)
                }
                disabled={
                  updatingMovieId === selectedMovie.id
                }
              >
                {updatingMovieId === selectedMovie.id
                  ? "Updating..."
                  : watchlist.some((item) =>
                      sameId(
                        getWatchlistId(item),
                        selectedMovie.id
                      )
                    )
                  ? "♥ Remove from Watchlist"
                  : "♡ Add to Watchlist"}
              </button>

              <section className="reviews-section">
                <div className="section-heading">
                  <div>
                    <p className="section-eyebrow">
                      COMMUNITY
                    </p>

                    <h3>Reviews</h3>
                  </div>

                  {reviewSummary && (
                    <span className="result-count">
                      {reviewSummary.average_rating != null
                        ? `★ ${reviewSummary.average_rating}`
                        : "No rating yet"}
                    </span>
                  )}
                </div>

                {reviewsLoading ? (
                  <p className="review-message">
                    Loading reviews...
                  </p>
                ) : reviewsError ? (
                  <p className="inline-error">
                    {reviewsError}
                  </p>
                ) : reviews.length === 0 ? (
                  <p className="review-message">
                    No reviews yet. Be the first to share
                    your thoughts.
                  </p>
                ) : (
                  <div className="review-list">
                    {reviews.map((review) => {
                      const isOwnReview =
                        sameId(
                          review.user_id,
                          profile?.id
                        ) ||
                        sameId(review.id, myReviewId);

                      return (
                        <article
                          className="review-card"
                          key={review.id}
                        >
                          <div className="review-card-heading">
                            <strong>
                              {review.user_name ||
                                review.username ||
                                "User"}
                            </strong>

                            <span>
                              {"★".repeat(
                                Number(review.rating) || 0
                              )}
                            </span>
                          </div>

                          <p>
                            {review.review_text ||
                              review.comment ||
                              ""}
                          </p>

                          {isOwnReview && (
                            <div className="review-actions">
                              <button
                                onClick={() =>
                                  beginEditReview(review)
                                }
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  removeReview(review.id)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                {!token && (
                  <p className="review-message">
                    Please sign in to write or manage reviews.
                  </p>
                )}

                <form
                  className="review-form"
                  onSubmit={submitReview}
                >
                  <h4>
                    {editingReviewId
                      ? "Edit your review"
                      : "Write a review"}
                  </h4>

                  <label htmlFor="review-rating">
                    Rating
                  </label>

                  <select
                    id="review-rating"
                    value={reviewRating}
                    onChange={(event) =>
                      setReviewRating(
                        Number(event.target.value)
                      )
                    }
                    disabled={!token || reviewSubmitting}
                  >
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option
                        key={rating}
                        value={rating}
                      >
                        {rating}{" "}
                        {rating === 1 ? "star" : "stars"}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="review-text">
                    Your review
                  </label>

                  <textarea
                    id="review-text"
                    value={reviewText}
                    onChange={(event) =>
                      setReviewText(event.target.value)
                    }
                    placeholder="What did you think about this title?"
                    rows={3}
                    disabled={!token || reviewSubmitting}
                  />

                  <div className="review-form-actions">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={!token || reviewSubmitting}
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
                        disabled={reviewSubmitting}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;