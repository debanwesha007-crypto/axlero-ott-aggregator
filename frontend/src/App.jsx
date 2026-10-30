import { useEffect, useMemo, useState } from 'react'
import { getContent } from './api'
import './App.css'

const getMovieStyle = (title = '') => {
  const styles = {
    Interstellar: { emoji: '🚀', color: 'space' },
    Inception: { emoji: '🌃', color: 'dream' },
    'The Office': { emoji: '🏢', color: 'office' },
    'Stranger Things': { emoji: '👾', color: 'stranger' },
    'The Dark Knight': { emoji: '🦇', color: 'knight' },
    'Breaking Bad': { emoji: '🧪', color: 'breaking' },
  }

  return styles[title] || { emoji: '🎬', color: 'space' }
}

function App() {
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [activePage, setActivePage] = useState('Home')
  const [watchlist, setWatchlist] = useState([])
  const [selectedMovie, setSelectedMovie] = useState(null)

  const [token, setToken] = useState(
    () => localStorage.getItem('axlero_token') || '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch real content from the authenticated FastAPI backend.
  useEffect(() => {
    if (!token) {
      setMovies([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false

    async function loadMovies() {
      setLoading(true)
      setError('')

      try {
        const data = await getContent(token)

        if (cancelled) return

        if (!Array.isArray(data)) {
          throw new Error('Unexpected response from the content API.')
        }

        const formattedMovies = data.map((item) => ({
          ...item,
          year: item.release_year,
          platform: item.platform_name || 'Platform unavailable',
          type: item.content_type === 'tv_show' ? 'TV Show' : 'Movie',
          ...getMovieStyle(item.title),
        }))

        setMovies(formattedMovies)
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message.includes('401')
              ? 'Your login session may have expired. Reconnect with a valid access token.'
              : err.message.includes('Failed to fetch')
                ? 'Cannot reach the backend. Make sure FastAPI is running on port 8000.'
                : err.message || 'Unable to load titles.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadMovies()

    return () => {
      cancelled = true
    }
  }, [token])

  const categories = useMemo(() => {
    const genres = movies
      .map((movie) => movie.genre)
      .filter(Boolean)

    return ['All', ...new Set(genres)]
  }, [movies])

  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      const query = search.toLowerCase()

      const matchesSearch =
        movie.title?.toLowerCase().includes(query) ||
        movie.description?.toLowerCase().includes(query) ||
        movie.genre?.toLowerCase().includes(query) ||
        movie.platform?.toLowerCase().includes(query)

      const matchesCategory =
        category === 'All' || movie.genre === category

      const matchesPage =
        activePage !== 'Watchlist' || watchlist.includes(movie.id)

      return matchesSearch && matchesCategory && matchesPage
    })
  }, [movies, search, category, activePage, watchlist])

  const heroMovie = movies.find(
    (movie) => movie.title === 'Interstellar',
  ) || movies[0]

  const connectBackend = () => {
    const enteredToken = window.prompt(
      'Paste the access_token from your successful login response:',
    )

    if (enteredToken?.trim()) {
      const cleanToken = enteredToken
        .trim()
        .replace(/^Bearer\s+/i, '')
        .replace(/^["']|["']$/g, '')

      localStorage.setItem('axlero_token', cleanToken)
      setToken(cleanToken)
    }
  }

  const disconnectBackend = () => {
    localStorage.removeItem('axlero_token')
    setToken('')
    setMovies([])
    setWatchlist([])
    setSelectedMovie(null)
    setError('')
  }

  const toggleWatchlist = (movieId) => {
    setWatchlist((current) =>
      current.includes(movieId)
        ? current.filter((id) => id !== movieId)
        : [...current, movieId],
    )
  }

  const resetFilters = () => {
    setSearch('')
    setCategory('All')
    setActivePage('Home')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#home"
          className="brand"
          onClick={() => setActivePage('Home')}
        >
          <span className="brand-icon">A</span>
          <span>
            axlero<span className="brand-dot">.</span>
          </span>
        </a>

        <div className="sidebar-label">MENU</div>

        <nav className="side-nav">
          <button
            className={
              activePage === 'Home' ? 'nav-item active' : 'nav-item'
            }
            onClick={() => {
              setActivePage('Home')
              setCategory('All')
            }}
          >
            <span>⌂</span> Home
          </button>

          <button
            className={
              activePage === 'Discover'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => setActivePage('Discover')}
          >
            <span>◉</span> Discover
          </button>

          <button
            className={
              activePage === 'Watchlist'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => setActivePage('Watchlist')}
          >
            <span>♡</span> My Watchlist
            <span className="nav-count">{watchlist.length}</span>
          </button>

          <button
            className={
              activePage === 'Recommendations'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => setActivePage('Recommendations')}
          >
            <span>✧</span> For You
          </button>
        </nav>

        <div className="sidebar-label platform-label">
          STREAMING PLATFORMS
        </div>

        <div className="platform-list">
          {[...new Set(movies.map((movie) => movie.platform))]
            .filter((platform) => platform !== 'Platform unavailable')
            .map((platform) => (
              <button
                key={platform}
                onClick={() => {
                  setSearch(platform)
                  setActivePage('Discover')
                }}
              >
                <span
                  className={`platform-symbol ${platform
                    .toLowerCase()
                    .replace(/\s+/g, '-')}`}
                >
                  {platform.charAt(0)}
                </span>
                {platform}
              </button>
            ))}

          {movies.length === 0 && (
            <p className="platform-empty">
              Connect to see available platforms.
            </p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-avatar">U</div>
          <div className="profile-info">
            <strong>Movie Lover</strong>
            <span>{token ? 'Backend connected' : 'Not connected'}</span>
          </div>
          <button
            className="profile-menu"
            title={token ? 'Disconnect backend' : 'Connect backend'}
            onClick={token ? disconnectBackend : connectBackend}
          >
            ···
          </button>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div className="breadcrumb">
            Discover <span>/</span> <strong>{activePage}</strong>
          </div>

          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search movies, shows..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>

          <button
            className="secondary-button"
            onClick={token ? disconnectBackend : connectBackend}
          >
            {token ? 'Disconnect' : 'Connect API'}
          </button>

          <div className="top-avatar">U</div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR ENTERTAINMENT HUB</p>
              <h1>
                Discover your next <span>favorite.</span>
              </h1>
              <p className="welcome-description">
                All your streaming platforms, one place. Find something
                amazing to watch tonight.
              </p>
            </div>

            <div className="welcome-badge">
              <span>✦</span>
              <div>
                <strong>One place.</strong>
                <p>Endless entertainment.</p>
              </div>
            </div>
          </section>

          {!token && (
            <div className="empty-state">
              <span>✧</span>
              <h3>Connect to Axlero</h3>
              <p>
                Connect your authenticated backend to load real titles
                from your database.
              </p>
              <button
                className="primary-button"
                onClick={connectBackend}
              >
                Connect API
              </button>
            </div>
          )}

          {token && loading && (
            <div className="empty-state" role="status">
              <h3>Loading your entertainment...</h3>
              <p>Fetching titles from the Axlero backend.</p>
            </div>
          )}

          {token && error && !loading && (
            <div className="empty-state" role="alert">
              <span>!</span>
              <h3>Could not load titles</h3>
              <p>{error}</p>
              <button
                className="primary-button"
                onClick={connectBackend}
              >
                Reconnect API
              </button>
            </div>
          )}

          {token && !loading && !error && movies.length === 0 && (
            <div className="empty-state">
              <h3>No content available yet</h3>
              <p>
                Your API responded successfully, but there are no titles
                to display.
              </p>
            </div>
          )}

          {token && !loading && !error && movies.length > 0 && (
            <>
              {activePage === 'Home' &&
                !search &&
                category === 'All' &&
                heroMovie && (
                  <section className="hero-banner">
                    <div className="hero-glow"></div>

                    <div className="hero-copy">
                      <div className="hero-tag">
                        <span>✦</span> FROM YOUR CATALOG
                      </div>

                      <p className="hero-subtitle">
                        YOUR NEXT FAVORITE TITLE
                      </p>

                      <h2>{heroMovie.title}</h2>

                      <div className="hero-meta">
                        {heroMovie.year && (
                          <span>{heroMovie.year}</span>
                        )}
                        <span className="hero-genre">
                          {heroMovie.genre || 'Genre unavailable'}
                        </span>
                        <span>{heroMovie.type}</span>
                      </div>

                      <p className="hero-description">
                        {heroMovie.description ||
                          'Explore this title in your Axlero catalog.'}
                      </p>

                      <div className="hero-actions">
                        <button
                          className="primary-button"
                          onClick={() => setSelectedMovie(heroMovie)}
                        >
                          <span>▶</span> Explore title
                        </button>

                        <button
                          className="secondary-button"
                          onClick={() => toggleWatchlist(heroMovie.id)}
                        >
                          {watchlist.includes(heroMovie.id)
                            ? '✓ Added to list'
                            : '+ Watchlist'}
                        </button>
                      </div>
                    </div>

                    <div className="hero-art" aria-label="Title illustration">
                      <div className="planet planet-one"></div>
                      <div className="planet planet-two"></div>
                      <div className="orbit orbit-one"></div>
                      <div className="orbit orbit-two"></div>
                      <div className="hero-emoji">
                        {heroMovie.emoji}
                      </div>
                      <div className="hero-art-caption">
                        DISCOVER SOMETHING NEW
                      </div>
                    </div>

                    <div className="hero-pagination">
                      <span className="pagination-active"></span>
                      <span></span>
                      <span></span>
                    </div>
                  </section>
                )}

              <section className="catalog-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {activePage === 'Watchlist'
                        ? 'YOUR COLLECTION'
                        : activePage === 'Recommendations'
                          ? 'PICKED FOR YOU'
                          : 'YOUR DATABASE CATALOG'}
                    </p>

                    <h2>
                      {activePage === 'Watchlist'
                        ? 'My Watchlist'
                        : activePage === 'Recommendations'
                          ? 'Recommended for you'
                          : activePage === 'Discover'
                            ? 'Discover titles'
                            : 'Trending now'}
                    </h2>
                  </div>

                  <span className="result-count">
                    {filteredMovies.length}{' '}
                    {filteredMovies.length === 1 ? 'title' : 'titles'}
                  </span>
                </div>

                <div className="category-row">
                  {categories.map((item) => (
                    <button
                      key={item}
                      className={
                        category === item
                          ? 'category-chip selected'
                          : 'category-chip'
                      }
                      onClick={() => {
                        setCategory(item)
                        if (activePage === 'Watchlist') {
                          setActivePage('Home')
                        }
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="movie-grid">
                  {filteredMovies.map((movie) => (
                    <article className="movie-card" key={movie.id}>
                      <button
                        className={`movie-poster ${movie.color}`}
                        onClick={() => setSelectedMovie(movie)}
                        aria-label={`View ${movie.title} details`}
                      >
                        <span className="poster-type">{movie.type}</span>
                        <span className="poster-emoji">
                          {movie.emoji}
                        </span>
                        <span className="poster-title">
                          {movie.title}
                        </span>
                        <span className="poster-year">
                          {movie.year || 'Year unavailable'}
                        </span>
                      </button>

                      <button
                        className="card-watchlist"
                        aria-label={`Toggle ${movie.title} watchlist`}
                        onClick={() => toggleWatchlist(movie.id)}
                      >
                        {watchlist.includes(movie.id) ? '♥' : '♡'}
                      </button>

                      <div className="movie-info">
                        <div className="movie-title-row">
                          <h3>{movie.title}</h3>
                          {movie.rating != null && (
                            <span className="movie-rating">
                              ★ {movie.rating}
                            </span>
                          )}
                        </div>

                        <p>
                          {movie.year || 'Year unknown'}
                          <span> · </span>
                          {movie.genre || 'Genre unavailable'}
                        </p>

                        <div className="movie-platform">
                          <span
                            className={`platform-dot ${movie.platform
                              .toLowerCase()
                              .replace(/\s+/g, '-')}`}
                          ></span>
                          {movie.platform}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {filteredMovies.length === 0 && (
                  <div className="empty-state">
                    <span>⌕</span>
                    <h3>No titles found</h3>
                    <p>
                      Try another search or choose a different category.
                    </p>
                    <button
                      className="primary-button"
                      onClick={resetFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="footer">
            <a href="#home" className="footer-brand">
              axlero<span>.</span>
            </a>
            <p>Your entertainment, simplified.</p>
            <span>
              {token ? 'Connected to Axlero API' : 'Connect to load your catalog'}
            </span>
          </footer>
        </div>
      </main>

      {selectedMovie && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedMovie(null)}
          role="presentation"
        >
          <section
            className="details-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedMovie.title} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedMovie(null)}
              aria-label="Close details"
            >
              ×
            </button>

            <div className={`modal-art ${selectedMovie.color}`}>
              <span>{selectedMovie.emoji}</span>
            </div>

            <p className="eyebrow">TITLE DETAILS</p>
            <h2>{selectedMovie.title}</h2>

            <div className="modal-meta">
              {selectedMovie.year && <span>{selectedMovie.year}</span>}
              {selectedMovie.genre && <span>{selectedMovie.genre}</span>}
              <span>{selectedMovie.type}</span>
              {selectedMovie.rating != null && (
                <span>★ {selectedMovie.rating}</span>
              )}
            </div>

            <p className="modal-description">
              {selectedMovie.description ||
                'No description is available for this title yet.'}
            </p>

            <div className="modal-platform">
              Available on <strong>{selectedMovie.platform}</strong>
            </div>

            <button
              className="primary-button modal-action"
              onClick={() => toggleWatchlist(selectedMovie.id)}
            >
              {watchlist.includes(selectedMovie.id)
                ? '✓ In your watchlist'
                : '+ Add to watchlist'}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App