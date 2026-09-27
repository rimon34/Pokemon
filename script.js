// ============================================================================
// CONFIGURATION & STATE
// ============================================================================
const API_BASE = 'https://pokeapi.co/api/v2';
const CACHE = new Map();

const STATE = {
  currentPokemon: null,
  currentMoves: [],
  browseOffset: 0,
  browseLimit: 20,
  browseLoaded: false,
  activeFilter: 'all',
  favorites: JSON.parse(localStorage.getItem('pokemonFavorites')) || [],
  isShiny: false,
  activeAudio: null
};

// Map primary type to hex accent color for dynamic theme engine
const TYPE_COLORS = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  grass: '#7AC74C',
  electric: '#F7D02C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD'
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const randomBtn = document.getElementById('randomBtn');
const chips = document.querySelectorAll('.chip');

const loadingSpinner = document.getElementById('loadingSpinner');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');

const featuredCard = document.getElementById('featuredCard');
const pokemonId = document.getElementById('pokemonId');
const pokemonArtwork = document.getElementById('pokemonArtwork');
const pokemonName = document.getElementById('pokemonName');
const typeBadges = document.getElementById('typeBadges');
const pokemonHeight = document.getElementById('pokemonHeight');
const pokemonWeight = document.getElementById('pokemonWeight');
const pokemonAbilities = document.getElementById('pokemonAbilities');
const statsContainer = document.getElementById('statsContainer');
const favoriteBtn = document.getElementById('favoriteBtn');
const cryBtn = document.getElementById('cryBtn');

const browseGrid = document.getElementById('browseGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// ============================================================================
// API FETCHING & CACHE
// ============================================================================
async function fetchFromAPI(url) {
  if (CACHE.has(url)) return CACHE.get(url);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    CACHE.set(url, data);
    return data;
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw error;
  }
}

async function fetchPokemon(nameOrId) {
  const url = `${API_BASE}/pokemon/${nameOrId.toString().toLowerCase()}`;
  return fetchFromAPI(url);
}

async function fetchPokemonList(limit = 20, offset = 0) {
  const url = `${API_BASE}/pokemon?limit=${limit}&offset=${offset}`;
  return fetchFromAPI(url);
}

async function fetchPokemonByType(type) {
  const url = `${API_BASE}/type/${type.toLowerCase()}`;
  return fetchFromAPI(url);
}

// ============================================================================
// DYNAMIC THEME ENGINE & UI HELPERS
// ============================================================================
function applyDynamicTypeTheme(primaryType) {
  const hexColor = TYPE_COLORS[primaryType] || '#E65100';
  
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const rgbaGlow = `rgba(${r}, ${g}, ${b}, 0.35)`;

  document.documentElement.style.setProperty('--active-type-color', hexColor);
  document.documentElement.style.setProperty('--active-type-glow', rgbaGlow);
}

function playPokemonCry() {
  if (!STATE.currentPokemon) return;

  const cryUrl = STATE.currentPokemon.cries?.latest || STATE.currentPokemon.cries?.legacy;
  
  if (cryUrl) {
    if (STATE.activeAudio) {
      STATE.activeAudio.pause();
    }
    STATE.activeAudio = new Audio(cryUrl);
    STATE.activeAudio.volume = 0.4;
    STATE.activeAudio.play().catch(e => console.log('Audio playback blocked:', e));
  }
}

function getAdjacentPokemonId(currentId, direction) {
  const newId = currentId + direction;
  return Math.max(1, Math.min(newId, 1025));
}

function toggleShinyArtwork() {
  if (!STATE.currentPokemon) return;

  STATE.isShiny = !STATE.isShiny;
  const sprites = STATE.currentPokemon.sprites?.other?.['official-artwork'];
  const artwork = STATE.isShiny ? sprites?.front_shiny : sprites?.front_default;

  if (artwork) {
    pokemonArtwork.src = artwork;
  } else {
    STATE.isShiny = !STATE.isShiny;
  }
}

// ============================================================================
// UI STATE DISPLAY
// ============================================================================
function showLoading() {
  loadingSpinner.style.display = 'block';
  errorContainer.style.display = 'none';
  featuredCard.style.display = 'none';
}

function showError(message) {
  errorContainer.style.display = 'block';
  errorMessage.textContent = message;
  featuredCard.style.display = 'none';
  loadingSpinner.style.display = 'none';
}

function showCard() {
  featuredCard.style.display = 'block';
  errorContainer.style.display = 'none';
  loadingSpinner.style.display = 'none';
}

// ============================================================================
// RENDER CARD & STATS
// ============================================================================
function renderStats(stats) {
  statsContainer.innerHTML = '';
  const displayNames = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
  const classNames = ['stat-hp', 'stat-atk', 'stat-def', 'stat-spatk', 'stat-spdef', 'stat-speed'];

  stats.forEach((stat, index) => {
    const baseStat = stat.base_stat;
    const percentage = Math.min((baseStat / 150) * 100, 100);

    const statItem = document.createElement('div');
    statItem.className = 'stat-item';
    statItem.innerHTML = `
      <span class="stat-label">${displayNames[index]}</span>
      <div class="stat-bar">
        <div class="stat-fill ${classNames[index]}" style="--stat-percentage: ${percentage}%"></div>
      </div>
      <span class="stat-value">${baseStat}</span>
    `;
    statsContainer.appendChild(statItem);
  });
}

function renderTypeBadges(types) {
  typeBadges.innerHTML = '';
  types.forEach(typeObj => {
    const typeName = typeObj.type.name;
    const badge = document.createElement('span');
    badge.className = `type-badge ${typeName}`;
    badge.textContent = typeName;
    typeBadges.appendChild(badge);
  });
}

function renderCard(pokemon) {
  STATE.currentPokemon = pokemon;
  STATE.isShiny = false;

  const primaryType = pokemon.types[0]?.type?.name || 'normal';
  applyDynamicTypeTheme(primaryType);

  const id = pokemon.id.toString().padStart(4, '0');
  pokemonId.textContent = `#${id}`;

  const artwork = pokemon.sprites?.other?.['official-artwork']?.front_default 
    || pokemon.sprites?.front_default 
    || 'https://via.placeholder.com/400x400?text=No+Image';
  pokemonArtwork.src = artwork;
  pokemonArtwork.alt = pokemon.name;

  pokemonName.textContent = pokemon.name;
  renderTypeBadges(pokemon.types);

  pokemonHeight.textContent = `${(pokemon.height / 10).toFixed(1)} m`;
  pokemonWeight.textContent = `${(pokemon.weight / 10).toFixed(1)} kg`;

  const abilities = pokemon.abilities.map(a => a.ability.name).join(', ');
  pokemonAbilities.textContent = abilities || 'N/A';

  renderStats(pokemon.stats);
  updateFavoriteBtn();
  updateNavigationButtons();

  showCard();
  playPokemonCry();
  scrollToCard();
}

function updateNavigationButtons() {
  if (!STATE.currentPokemon) return;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.disabled = STATE.currentPokemon.id <= 1;
  if (nextBtn) nextBtn.disabled = STATE.currentPokemon.id >= 1025;
}

function scrollToCard() {
  const cardTop = featuredCard.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: cardTop - 100, behavior: 'smooth' });
}

// ============================================================================
// FAVORITE SYSTEM
// ============================================================================
function updateFavoriteBtn() {
  if (!STATE.currentPokemon) return;
  const isFavorite = STATE.favorites.includes(STATE.currentPokemon.id);
  favoriteBtn.classList.toggle('active', isFavorite);
}

function toggleFavorite() {
  if (!STATE.currentPokemon) return;
  const pokemonId = STATE.currentPokemon.id;
  const index = STATE.favorites.indexOf(pokemonId);

  if (index > -1) {
    STATE.favorites.splice(index, 1);
  } else {
    STATE.favorites.push(pokemonId);
  }

  updateFavoriteBtn();
  localStorage.setItem('pokemonFavorites', JSON.stringify(STATE.favorites));
}

// ============================================================================
// 3D CARD TILT EFFECT
// ============================================================================
featuredCard.addEventListener('mousemove', (e) => {
  const rect = featuredCard.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const rotateX = ((y - centerY) / centerY) * -10;
  const rotateY = ((x - centerX) / centerX) * 10;

  featuredCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

featuredCard.addEventListener('mouseleave', () => {
  featuredCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
});

// ============================================================================
// BROWSE GRID & TYPE FILTERING
// ============================================================================
async function createGridCard(pokemonDetails) {
  const card = document.createElement('div');
  card.className = 'browse-card';
  
  const typeNames = pokemonDetails.types.map(t => t.type.name).join(' ');
  card.setAttribute('data-types', typeNames);

  const primaryType = pokemonDetails.types[0]?.type?.name || 'normal';
  const paddedId = pokemonDetails.id.toString().padStart(4, '0');
  const artwork = pokemonDetails.sprites?.other?.['official-artwork']?.front_default || pokemonDetails.sprites?.front_default;

  card.innerHTML = `
    <div class="browse-card-image">
      <img src="${artwork}" alt="${pokemonDetails.name}">
    </div>
    <div class="browse-card-name">${pokemonDetails.name}</div>
    <div class="browse-card-id">#${paddedId}</div>
    <div class="type-badges" style="margin-top:0.5rem;">
      <span class="type-badge ${primaryType}">${primaryType}</span>
    </div>
  `;

  card.addEventListener('click', () => renderCard(pokemonDetails));
  return card;
}

async function loadBrowseGrid() {
  try {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';

    const data = await fetchPokemonList(STATE.browseLimit, STATE.browseOffset);
    
    // Fetch individual details so we have full type information
    const detailsPromises = data.results.map(item => fetchPokemon(item.name));
    const pokemonDetailsList = await Promise.all(detailsPromises);

    for (const details of pokemonDetailsList) {
      const card = await createGridCard(details);
      browseGrid.appendChild(card);
    }

    STATE.browseOffset += STATE.browseLimit;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More Pokémon';
    loadMoreBtn.style.display = 'block';

    applyCurrentFilter();
  } catch (error) {
    console.error('Browse Grid Error:', error);
    loadMoreBtn.textContent = 'Error Loading More';
  }
}

async function filterGridByType(selectedType) {
  STATE.activeFilter = selectedType;

  if (selectedType === 'all') {
    applyCurrentFilter();
    loadMoreBtn.style.display = 'block';
    return;
  }

  applyDynamicTypeTheme(selectedType);

  // If cards matching this type are already loaded, show them
  let hasMatchingInGrid = false;
  const cards = browseGrid.querySelectorAll('.browse-card');

  cards.forEach(card => {
    const cardTypes = card.getAttribute('data-types') || '';
    if (cardTypes.includes(selectedType)) {
      card.style.display = 'block';
      hasMatchingInGrid = true;
    } else {
      card.style.display = 'none';
    }
  });

  // If none or very few show up, fetch directly from PokéAPI type endpoint
  if (!hasMatchingInGrid) {
    try {
      loadMoreBtn.style.display = 'none';
      const typeData = await fetchPokemonByType(selectedType);
      const targetPokemon = typeData.pokemon.slice(0, 20);

      const detailsPromises = targetPokemon.map(p => fetchPokemon(p.pokemon.name));
      const detailsList = await Promise.all(detailsPromises);

      detailsList.forEach(async (details) => {
        const card = await createGridCard(details);
        browseGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to fetch type category:', err);
    }
  }
}

function applyCurrentFilter() {
  const cards = browseGrid.querySelectorAll('.browse-card');
  cards.forEach(card => {
    if (STATE.activeFilter === 'all') {
      card.style.display = 'block';
    } else {
      const cardTypes = card.getAttribute('data-types') || '';
      card.style.display = cardTypes.includes(STATE.activeFilter) ? 'block' : 'none';
    }
  });
}

// Filter Bar Handler
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const filterType = btn.dataset.type;
    filterGridByType(filterType);
  });
});

// ============================================================================
// SEARCH & EVENT LISTENERS
// ============================================================================
async function searchPokemon(query) {
  if (!query.toString().trim()) {
    showError('Please enter a Pokémon name or ID.');
    return;
  }

  showLoading();

  try {
    const pokemon = await fetchPokemon(query);
    renderCard(pokemon);
  } catch (error) {
    showError(`Pokémon not found: "${query}". Try another search!`);
  }
}

function handleSearch() {
  const query = searchInput.value.trim();
  searchPokemon(query);
}

function updateClearButton() {
  clearSearchBtn.style.display = searchInput.value.trim() ? 'flex' : 'none';
}

searchBtn.addEventListener('click', handleSearch);

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

searchInput.addEventListener('input', updateClearButton);

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
});

randomBtn.addEventListener('click', () => {
  const randomId = Math.floor(Math.random() * 1025) + 1;
  searchPokemon(randomId.toString());
});

chips.forEach(chip => {
  if (chip.dataset.pokemon) {
    chip.addEventListener('click', () => {
      searchInput.value = chip.dataset.pokemon;
      searchPokemon(chip.dataset.pokemon);
    });
  }
});

favoriteBtn.addEventListener('click', toggleFavorite);
cryBtn.addEventListener('click', playPokemonCry);

const shinyBtn = document.getElementById('shinyBtn');
if (shinyBtn) shinyBtn.addEventListener('click', toggleShinyArtwork);

const prevBtn = document.getElementById('prevBtn');
if (prevBtn) prevBtn.addEventListener('click', () => {
  if (STATE.currentPokemon) {
    searchPokemon(getAdjacentPokemonId(STATE.currentPokemon.id, -1));
  }
});

const nextBtn = document.getElementById('nextBtn');
if (nextBtn) nextBtn.addEventListener('click', () => {
  if (STATE.currentPokemon) {
    searchPokemon(getAdjacentPokemonId(STATE.currentPokemon.id, 1));
  }
});

loadMoreBtn.addEventListener('click', loadBrowseGrid);

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadBrowseGrid();
});