
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getContent,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from './api'
import './App.css'

function getMovieStyle(title = '') {
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
  const searchInputRef = useRef(null)

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
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistError, setWatchlistError] = useState('')
  const [updatingMovieId, setUpdatingMovieId] = useState(null)

  // Load content from the backend
  useEffect(() => {
    if (!token) {
      setMovies([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false

    async function loadContent() {
      setLoading(true)
      setError('')

      try {
        const data = await getContent(token)

        if (!Array.isArray(data)) {
          throw new Error('Unexpected response from the content API.')
        }

        if (!cancelled) {
          setMovies(
            data.map((item) => ({
              ...item,
              year: item.release_year,
              platform: item.platform_name || 'Unknown platform',
              type: item.content_type || 'Movie',
              ...getMovieStyle(item.title),
            })),
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load content.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadContent()

    return () => {
      cancelled = true
    }
  }, [token])

  // Load the user's watchlist
  useEffect(() => {
    if (!token) {
      setWatchlist([])
      setWatchlistError('')
      setWatchlistLoading(false)
      return
    }

    let cancelled = false

    async function loadWatchlist() {
      setWatchlistLoading(true)
      setWatchlistError('')

      try {
        const data = await getWatchlist(token)

        if (!Array.isArray(data)) {
          throw new Error('Unexpected response from the watchlist API.')
        }

        if (!cancelled) {
          setWatchlist(data.map((item) => item.id))
        }
      } catch (err) {
        if (!cancelled) {
          setWatchlistError(err.message || 'Unable to load your watchlist.')
        }
      } finally {
        if (!cancelled) setWatchlistLoading(false)
      }
    }

    loadWatchlist()

    return () => {
      cancelled = true
    }
  }, [token])

  // Focus the search field with Ctrl + K or Cmd + K
  useEffect(() => {
    function handleSearchShortcut(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)

    return () => {
      window.removeEventListener('keydown', handleSearchShortcut)
    }
  }, [])

  const categories = useMemo(() => {
    const genres = movies
      .flatMap((movie) =>
        (movie.genre || '')
          .split(',')
          .map((genre) => genre.trim())
          .filter(Boolean),
      )

    return ['All', ...new Set(genres)]
  }, [movies])

  const filteredMovies = useMemo(() => {
    const query = search.trim().toLowerCase()

    return movies.filter((movie) => {
      const searchableText = [
        movie.title,
        movie.description,
        movie.platform,
        movie.genre,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !query || searchableText.includes(query)

      const genres = (movie.genre || '')
        .split(',')
        .map((genre) => genre.trim().toLowerCase())

      const matchesCategory =
        category === 'All' || genres.includes(category.toLowerCase())

      const matchesPage =
        activePage !== 'Watchlist' || watchlist.includes(movie.id)

      return matchesSearch && matchesCategory && matchesPage
    })
  }, [movies, search, category, activePage, watchlist])

  const heroMovie =
    movies.find((movie) => movie.title === 'Interstellar') || movies[0]

  function connectBackend() {
    const enteredToken = window.prompt(
      'Paste your JWT access token from the backend:',
    )

    if (!enteredToken?.trim()) return

    const cleanToken = enteredToken.trim().replace(/^Bearer\s+/i, '')

    localStorage.setItem('axlero_token', cleanToken)
    setToken(cleanToken)
    setSearch('')
    setCategory('All')
    setError('')
    setWatchlistError('')
  }

  function disconnectBackend() {
    localStorage.removeItem('axlero_token')
    setToken('')
    setMovies([])
    setWatchlist([])
    setSelectedMovie(null)
    setSearch('')
    setCategory('All')
    setError('')
    setWatchlistError('')
  }

  async function toggleWatchlist(movieId) {
    if (!token) {
      setWatchlistError('Connect to the backend before editing your watchlist.')
      return
    }

    if (updatingMovieId !== null) return

    const alreadySaved = watchlist.includes(movieId)

    setUpdatingMovieId(movieId)
    setWatchlistError('')

    try {
      if (alreadySaved) {
        await removeFromWatchlist(token, movieId)
        setWatchlist((current) => current.filter((id) => id !== movieId))
      } else {
        await addToWatchlist(token, movieId)
        setWatchlist((current) =>
          current.includes(movieId) ? current : [...current, movieId],
        )
      }
    } catch (err) {
      setWatchlistError(err.message || 'Unable to update your watchlist.')
    } finally {
      setUpdatingMovieId(null)
    }
  }

  function navigateTo(page) {
    setActivePage(page)
    setSearch('')
    setCategory('All')
    setSelectedMovie(null)
  }

  const pageTitle =
    activePage === 'Watchlist'
      ? 'My Watchlist'
      : activePage === 'Discover'
        ? 'Discover Content'
        : activePage === 'Recommendations'
          ? 'Explore For You'
          : 'Popular on Axlero'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigateTo('Home')}>
          <span className="brand-icon">A</span>
          <span>axlero<span className="brand-dot">.</span></span>
        </button>

        <p className="sidebar-label">MENU</p>

        <nav className="side-nav" aria-label="Main navigation">
          {[
            ['Home', '⌂'],
            ['Discover', '⌕'],
            ['Watchlist', '♡'],
            ['Recommendations', '✧'],
          ].map(([page, icon]) => (
            <button
              key={page}
              className={`nav-item ${activePage === page ? 'active' : ''}`}
              onClick={() => navigateTo(page)}
            >
              <span>{icon}</span>
              <span>{page}</span>
              {page === 'Watchlist' && watchlist.length > 0 && (
                <span className="nav-count">{watchlist.length}</span>
              )}
            </button>
          ))}
        </nav>

        <p className="sidebar-label platform-label">STREAMING SERVICES</p>

        <div className="platform-list">
          {[
            ['Netflix', 'netflix'],
            ['Prime Video', 'prime'],
            ['Disney+', 'disney'],
            ['Max', 'max'],
          ].map(([name, className]) => (
            <button
              key={name}
              onClick={() => {
                setSearch(name)
                setActivePage('Discover')
              }}
            >
              <span className={`platform-symbol ${className}`}>
                {name === 'Netflix'
                  ? 'N'
                  : name === 'Prime Video'
                    ? 'P'
                    : name === 'Disney+'
                      ? 'D'
                      : 'M'}
              </span>
              {name}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-avatar">A</div>
          <div className="profile-info">
            <strong>Axlero User</strong>
            <span>{token ? 'Connected' : 'Guest mode'}</span>
          </div>
          <button
            className="profile-menu"
            onClick={token ? disconnectBackend : connectBackend}
            title={token ? 'Disconnect API' : 'Connect API'}
          >
            ⋯
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activePage}</strong>
          </div>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              ref={searchInputRef}
              placeholder="Search movies, shows..."
              aria-label="Search movies, shows, genres, and streaming platforms"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            )}

            <kbd>⌘ K</kbd>
          </label>

          <button
            className="notification-button"
            title="Watchlist"
            onClick={() => navigateTo('Watchlist')}
          >
            ♡
            {watchlist.length > 0 && <span />}
          </button>
          <button
            className="top-avatar"
            onClick={token ? disconnectBackend : connectBackend}
            title={token ? 'Disconnect backend' : 'Connect backend'}
          >
            A
          </button>
        </header>

        <main className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR ENTERTAINMENT UNIVERSE</p>
              <h1>
                Welcome back<span>.</span>
              </h1>
              <p className="welcome-description">
                Discover, track, and organize your streaming world in one place.
              </p>
            </div>

            <div className="welcome-badge">
              <span>✦</span>
              <div>
                <strong>{movies.length} titles</strong>
                <p>in your universe</p>
              </div>
            </div>
          </section>

          {!token && (
            <section className="empty-state">
              <span>↗</span>
              <h3>Connect your streaming universe</h3>
              <p>
                Connect to the backend to load titles and save your watchlist.
              </p>
              <button className="primary-button" onClick={connectBackend}>
                Connect API
              </button>
            </section>
          )}

          {activePage === 'Home' && heroMovie && (
            <section className="hero-banner">
              <div className="hero-glow" />

              <div className="hero-copy">
                <div className="hero-tag">
                  <span>✦</span> FEATURED TITLE
                </div>

                <p className="hero-subtitle">
                  {heroMovie.platform} <span>•</span> {heroMovie.type}
                </p>

                <h2>{heroMovie.title}</h2>

                <div className="hero-meta">
                  {heroMovie.year && <span>{heroMovie.year}</span>}
                  <span className="hero-genre">
                    {heroMovie.genre || heroMovie.type}
                  </span>
                </div>

                <p className="hero-description">
                  {heroMovie.description ||
                    'Discover your next favourite story on Axlero.'}
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => setSelectedMovie(heroMovie)}
                  >
                    ▶ View Details
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => toggleWatchlist(heroMovie.id)}
                    disabled={updatingMovieId === heroMovie.id}
                  >
                    {watchlist.includes(heroMovie.id)
                      ? '✓ In Watchlist'
                      : '+ My Watchlist'}
                  </button>
                </div>
              </div>

              <div className="hero-art" aria-hidden="true">
                <div className="planet planet-one" />
                <div className="planet planet-two" />
                <div className="orbit" />
                <div className="orbit orbit-two" />
                <span className="hero-emoji">{heroMovie.emoji}</span>
                <span className="hero-art-caption">A WORLD OF STORIES</span>
              </div>

              <div className="hero-pagination">
                <span className="pagination-active" />
                <span />
                <span />
              </div>
            </section>
          )}

          {error && (
            <div className="empty-state" role="alert">
              <span>!</span>
              <h3>Unable to load content</h3>
              <p>{error}</p>
              {(error.includes('401') || error.toLowerCase().includes('token')) && (
                <button className="primary-button" onClick={connectBackend}>
                  Enter Token Again
                </button>
              )}
            </div>
          )}

          {watchlistError && (
            <div className="empty-state" role="alert">
              <span>!</span>
              <h3>Watchlist update failed</h3>
              <p>{watchlistError}</p>
            </div>
          )}

          {(loading || watchlistLoading) && (
            <p className="status-message" role="status">
              {loading ? 'Loading content from backend...' : 'Loading watchlist...'}
            </p>
          )}

          <section className="catalog-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">STREAMING, SIMPLIFIED</p>
                <h2>{pageTitle}</h2>
              </div>
              <span className="result-count">
                {filteredMovies.length} titles
              </span>
            </div>

            <div className="category-row" aria-label="Filter by genre">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`category-chip ${category === item ? 'selected' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {!loading && filteredMovies.length > 0 && (
              <div className="movie-grid">
                {filteredMovies.map((movie) => {
                  const saved = watchlist.includes(movie.id)
                  const updating = updatingMovieId === movie.id

                  return (
                    <article className="movie-card" key={movie.id}>
                      <button
                        className={`movie-poster ${movie.color}`}
                        onClick={() => setSelectedMovie(movie)}
                        aria-label={`View details for ${movie.title}`}
                      >
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            loading="lazy"
                          />
                        ) : (
                          <>
                            <span className="poster-type">{movie.type}</span>
                            <span className="poster-emoji">{movie.emoji}</span>
                            <span className="poster-title">{movie.title}</span>
                            <span className="poster-year">
                              {movie.year || ''}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        className={`card-watchlist ${saved ? 'saved' : ''}`}
                        onClick={() => toggleWatchlist(movie.id)}
                        disabled={updating}
                        aria-label={
                          saved
                            ? `Remove ${movie.title} from watchlist`
                            : `Add ${movie.title} to watchlist`
                        }
                        title={saved ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        {updating ? '…' : saved ? '♥' : '♡'}
                      </button>

                      <div className="movie-info">
                        <div className="movie-title-row">
                          <h3>{movie.title}</h3>
                          <span className="movie-rating">
                            {movie.year || '—'}
                          </span>
                        </div>

                        <p>
                          {movie.genre || 'Genre not specified'}
                          <span>•</span>
                          {movie.type}
                        </p>

                        <div className="movie-platform">
                          <span
                            className={`platform-dot ${
                              movie.platform.toLowerCase().includes('netflix')
                                ? 'netflix'
                                : movie.platform.toLowerCase().includes('prime')
                                  ? 'prime-video'
                                  : movie.platform.toLowerCase().includes('max')
                                    ? 'max'
                                    : ''
                            }`}
                          />
                          {movie.platform}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {!loading && token && filteredMovies.length === 0 && !error && (
              <div className="empty-state">
                <span>{activePage === 'Watchlist' ? '♡' : '⌕'}</span>
                <h3>
                  {activePage === 'Watchlist'
                    ? 'Your watchlist is empty'
                    : movies.length === 0
                      ? 'No content available'
                      : 'No matching titles'}
                </h3>
                <p>
                  {activePage === 'Watchlist'
                    ? 'Save movies and shows with the heart button to find them here.'
                    : movies.length === 0
                      ? 'Your backend is connected, but it has not returned any titles.'
                      : 'Try another search term or choose a different genre.'}
                </p>
                {activePage === 'Watchlist' && (
                  <button
                    className="primary-button"
                    onClick={() => navigateTo('Discover')}
                  >
                    Discover Content
                  </button>
                )}
              </div>
            )}
          </section>

          <footer className="footer">
            <div className="footer-brand">
              axlero<span>.</span>
            </div>
            <p>Your streaming world, all in one place.</p>
            <span>Axlero OTT Aggregator</span>
          </footer>
        </main>
      </div>

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
            aria-labelledby="modal-title"
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
              {selectedMovie.poster_url ? (
                <img src={selectedMovie.poster_url} alt="" />
              ) : (
                <span>{selectedMovie.emoji}</span>
              )}
            </div>

            <h2 id="modal-title">{selectedMovie.title}</h2>

            <div className="modal-meta">
              {selectedMovie.year && <span>{selectedMovie.year}</span>}
              <span>{selectedMovie.type}</span>
              {selectedMovie.genre && <span>{selectedMovie.genre}</span>}
            </div>

            <p className="modal-description">
              {selectedMovie.description ||
                'No description is available for this title yet.'}
            </p>

            <div className="modal-platform">
              <span>Available on</span>
              <strong>{selectedMovie.platform}</strong>
            </div>

            <button
              className="primary-button modal-action"
              onClick={() => toggleWatchlist(selectedMovie.id)}
              disabled={updatingMovieId === selectedMovie.id}
            >
              {updatingMovieId === selectedMovie.id
                ? 'Updating...'
                : watchlist.includes(selectedMovie.id)
                  ? 'Remove from Watchlist'
                  : 'Add to Watchlist'}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
