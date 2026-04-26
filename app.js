const API_BASE_URL = 'https://media2.edu.metropolia.fi/restaurant/api/v1';
const LOCAL_STORAGE_TOKEN = 'uniateriat_token';
const LOCAL_STORAGE_USER = 'uniateriat_user';

let currentUser = null;
let restaurants = [];
let selectedRestaurant = null;
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadRestaurants();
    setupEventListeners();
    checkAuthStatus();
    setupAvatarPreview();
});

function checkAuthStatus() {
    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN);
    const user = localStorage.getItem(LOCAL_STORAGE_USER);

    if (token && user) {
        currentUser = JSON.parse(user);
        updateAuthUI();
    }
}

function initializeApp() {
    populateFilters();
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));

    document.getElementById('loginModalClose').addEventListener('click', () => closeModal('loginModal'));
    document.getElementById('registerModalClose').addEventListener('click', () => closeModal('registerModal'));
    document.getElementById('menuModalClose').addEventListener('click', () => closeModal('menuModal'));
    document.getElementById('profileEditClose').addEventListener('click', () => closeModal('profileEditModal'));

    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('loginModal');
        openModal('registerModal');
    });

    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('registerModal');
        openModal('loginModal');
    });

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('profileEditForm').addEventListener('submit', handleProfileUpdate);

    document.getElementById('regUsername').addEventListener('blur', checkUsernameAvailability);

    document.getElementById('city').addEventListener('change', filterRestaurants);
    document.getElementById('provider').addEventListener('change', filterRestaurants);
    document.getElementById('search').addEventListener('input', filterRestaurants);
    document.getElementById('favoritesBtn').addEventListener('click', toggleFavoritesView);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchMenuTab(e.target.dataset.menu));
    });

    document.getElementById('addFavoriteBtn').addEventListener('click', addFavorite);
    document.getElementById('removeFromFavoritesBtn').addEventListener('click', removeFavorite);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            if (page) navigateToPage(page);
        });
    });

    document.querySelector('.hamburger').addEventListener('click', toggleMobileMenu);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

async function loadRestaurants() {
    try {
        const response = await fetch(`${API_BASE_URL}/restaurants`);
        if (!response.ok) throw new Error('Failed to load restaurants');

        const data = await response.json();
        restaurants = Array.isArray(data) ? data : (data.restaurants || []);

        populateFilters();
        displayRestaurants();
    } catch (error) {
        console.error('Error loading restaurants:', error);
        displayErrorMessage('Ravintolat lataaminen epäonnistui. Yritä myöhemmin uudelleen.');
    }
}

function displayRestaurants(restaurantsToDisplay = null) {
  const grid = document.getElementById('restaurantGrid');
  const dataToDisplay = restaurantsToDisplay || restaurants;

  const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2"></path>
    <path d="M17 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2"></path>
    <path d="M6 9c-1.1 0-2 .9-2 2v11h4V11c0-1.1-.9-2-2-2z"></path>
    <path d="M18 9c-1.1 0-2 .9-2 2v11h4V11c0-1.1-.9-2-2-2z"></path>
    <line x1="9" y1="22" x2="15" y2="22"></line>
  </svg>`;

  if (dataToDisplay.length === 0) {
    grid.innerHTML = '<p class="no-results">Ei ravintaloita löytynyt. Kokeile erilaisia suodattimia.</p>';
    return;
  }

  grid.innerHTML = dataToDisplay.map(restaurant => `
    <article class="restaurant-card ${favorites.includes(restaurant._id) ? 'favorite' : ''}" data-id="${restaurant._id}">
      <div class="card-image">
        <i class="fas fa-utensils"></i>
      </div>
      <div class="card-body">
        <h3>${restaurant.name}</h3>
        <p class="location">${restaurant.city} - ${restaurant.address}</p>
        <p class="menu-today">
          <strong>Puhelin:</strong> ${restaurant.phone || 'N/A'}
        </p>
        <button class="btn btn-primary card-btn" data-id="${restaurant._id}">
          Näytä ruokalista
        </button>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      showMenuModal(id);
    });
  });

  grid.querySelectorAll('.restaurant-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-btn')) return;
      const id = card.dataset.id;
      showMenuModal(id);
    });
  });
}

async function showMenuModal(restaurantId) {
    selectedRestaurant = restaurants.find(r => r._id === restaurantId);
    if (!selectedRestaurant) return;

    document.getElementById('menuModalTitle').textContent = selectedRestaurant.name;

    await loadDailyMenu(restaurantId);
    await loadWeeklyMenu(restaurantId);

    const isFavorite = favorites.includes(restaurantId);
    document.getElementById('addFavoriteBtn').style.display = isFavorite ? 'none' : 'block';
    document.getElementById('removeFromFavoritesBtn').style.display = isFavorite ? 'block' : 'none';

    openModal('menuModal');
}

async function loadDailyMenu(restaurantId) {
    try {
        const restaurant = restaurants.find(r => r._id === restaurantId);
        if (!restaurant) throw new Error('Restaurant not found');

        let url = `${API_BASE_URL}/restaurants/daily/${restaurant.companyId}/fi`;
        console.log('Trying daily menu URL:', url);

        let response = await fetch(url);

        if (response.status === 500) {
            console.log('CompanyId failed, trying with _id');
            url = `${API_BASE_URL}/restaurants/daily/${restaurantId}/fi`;
            response = await fetch(url);
        }

        const content = document.getElementById('dailyMenuContent');

        if (!response.ok) {
            console.error('Menu error status:', response.status);
            content.innerHTML = '<p>Tämän ravintolan ruokalista ei ole saatavilla.</p>';
            return;
        }

        const data = await response.json();
        console.log('Daily menu data:', data);

        if (data.courses && data.courses.length > 0) {
            content.innerHTML = data.courses.map(course => `
        <div class="menu-item">
          <div class="menu-item-name">${course.name}</div>
          <div class="menu-item-price">${course.price || 'N/A'}</div>
          <div class="menu-item-diets">${course.diets || 'N/A'}</div>
        </div>
      `).join('');
        } else {
            content.innerHTML = '<p>Ei ruokia saatavilla tänään.</p>';
        }
    } catch (error) {
        console.error('Error loading daily menu:', error);
        document.getElementById('dailyMenuContent').innerHTML = '<p>Ruokalista lataaminen epäonnistui.</p>';
    }
}

async function loadWeeklyMenu(restaurantId) {
    try {
        const restaurant = restaurants.find(r => r._id === restaurantId);
        if (!restaurant) throw new Error('Restaurant not found');

        let url = `${API_BASE_URL}/restaurants/weekly/${restaurant.companyId}/fi`;
        console.log('Trying weekly menu URL:', url);

        let response = await fetch(url);

        if (response.status === 500) {
            console.log('CompanyId failed, trying with _id');
            url = `${API_BASE_URL}/restaurants/weekly/${restaurantId}/fi`;
            response = await fetch(url);
        }

        const content = document.getElementById('weeklyMenuContent');

        if (!response.ok) {
            console.error('Menu error status:', response.status);
            content.innerHTML = '<p>Tämän ravintolan viikon ruokalista ei ole saatavilla.</p>';
            return;
        }

        const data = await response.json();
        console.log('Weekly menu data:', data);

        if (data.days && data.days.length > 0) {
            content.innerHTML = data.days.map(day => {
                let dateObj;
                if (day.date) {
                    dateObj = new Date(day.date);
                    if (isNaN(dateObj.getTime())) {
                        dateObj = new Date();
                    }
                } else {
                    dateObj = new Date();
                }

                const dateString = dateObj.toLocaleDateString('fi-FI', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });

                return `
          <div class="menu-day">
            <div class="menu-day-title">${dateString}</div>
            ${day.courses && day.courses.length > 0 ?
                        day.courses.map(course => `
                <div class="menu-item">
                  <div class="menu-item-name">${course.name}</div>
                  <div class="menu-item-price">${course.price || 'N/A'}</div>
                  <div class="menu-item-diets">${course.diets || 'N/A'}</div>
                </div>
              `).join('')
                        : '<p>Ei ruokia saatavilla.</p>'
                    }
          </div>
        `;
            }).join('');
        } else {
            content.innerHTML = '<p>Viikon ruokalista ei saatavilla.</p>';
        }
    } catch (error) {
        console.error('Error loading weekly menu:', error);
        document.getElementById('weeklyMenuContent').innerHTML = '<p>Ruokalista lataaminen epäonnistui.</p>';
    }
}

function switchMenuTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.menu-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.tab-btn[data-menu="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}MenuContent`).classList.add('active');
}

function populateFilters() {
    const cities = [...new Set(restaurants.map(r => r.city))].sort();
    const providers = [...new Set(restaurants.map(r => r.company))].sort();

    const citySelect = document.getElementById('city');
    const providerSelect = document.getElementById('provider');

    cities.forEach(city => {
        if (city && ![...citySelect.options].some(o => o.value === city)) {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        }
    });

    providers.forEach(provider => {
        if (provider && ![...providerSelect.options].some(o => o.value === provider)) {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = provider;
            providerSelect.appendChild(option);
        }
    });
}

function filterRestaurants() {
    const city = document.getElementById('city').value;
    const provider = document.getElementById('provider').value;
    const search = document.getElementById('search').value.toLowerCase();

    const filtered = restaurants.filter(r => {
        const matchesCity = !city || r.city === city;
        const matchesProvider = !provider || r.company === provider;
        const matchesSearch = !search || r.name.toLowerCase().includes(search);

        return matchesCity && matchesProvider && matchesSearch;
    });

    displayRestaurants(filtered);
}

function addFavorite() {
    if (!selectedRestaurant) return;

    if (!favorites.includes(selectedRestaurant._id)) {
        favorites.push(selectedRestaurant._id);
        localStorage.setItem('favorites', JSON.stringify(favorites));

        const card = document.querySelector(`.restaurant-card[data-id="${selectedRestaurant._id}"]`);
        if (card) card.classList.add('favorite');

        document.getElementById('addFavoriteBtn').style.display = 'none';
        document.getElementById('removeFromFavoritesBtn').style.display = 'block';

        updateFavoriteCount();
    }
}

function removeFavorite() {
    if (!selectedRestaurant) return;

    favorites = favorites.filter(id => id !== selectedRestaurant._id);
    localStorage.setItem('favorites', JSON.stringify(favorites));

    const card = document.querySelector(`.restaurant-card[data-id="${selectedRestaurant._id}"]`);
    if (card) card.classList.remove('favorite');

    document.getElementById('addFavoriteBtn').style.display = 'block';
    document.getElementById('removeFromFavoritesBtn').style.display = 'none';

    updateFavoriteCount();
}

function updateFavoriteCount() {
    document.getElementById('favoriteCount').textContent = favorites.length;
}

let viewingFavoritesOnly = false;
function toggleFavoritesView() {
    viewingFavoritesOnly = !viewingFavoritesOnly;

    if (viewingFavoritesOnly) {
        const favoriteRestaurants = restaurants.filter(r => favorites.includes(r._id));
        displayRestaurants(favoriteRestaurants);
        document.getElementById('favoritesBtn').classList.add('active');
    } else {
        filterRestaurants();
        document.getElementById('favoritesBtn').classList.remove('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Kirjautuminen epäonnistui');
        }

        localStorage.setItem(LOCAL_STORAGE_TOKEN, data.token);
        localStorage.setItem(LOCAL_STORAGE_USER, JSON.stringify(data.data));
        currentUser = data.data;

        updateAuthUI();
        closeModal('loginModal');
        document.getElementById('loginForm').reset();
        errorDiv.classList.remove('show');

    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    const errorDiv = document.getElementById('registerError');

    if (password !== password2) {
        errorDiv.textContent = 'Salasanat eivät täsmää';
        errorDiv.classList.add('show');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Rekisteröityminen epäonnistui');
        }

        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const loginData = await loginResponse.json();

        if (loginResponse.ok) {
            localStorage.setItem(LOCAL_STORAGE_TOKEN, loginData.token);
            localStorage.setItem(LOCAL_STORAGE_USER, JSON.stringify(loginData.data));
            currentUser = loginData.data;

            updateAuthUI();
            closeModal('registerModal');
            document.getElementById('registerForm').reset();
            errorDiv.classList.remove('show');
        }

    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

async function checkUsernameAvailability() {
    const username = document.getElementById('regUsername').value;
    const checkDiv = document.getElementById('usernameCheck');

    if (username.length < 3) {
        checkDiv.textContent = '';
        checkDiv.classList.remove('available', 'taken');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/available/${username}`);
        const data = await response.json();

        if (data.available) {
            checkDiv.textContent = 'Käyttäjänimi on saatavilla';
            checkDiv.classList.add('available');
            checkDiv.classList.remove('taken');
        } else {
            checkDiv.textContent = 'Käyttäjänimi on varattu';
            checkDiv.classList.add('taken');
            checkDiv.classList.remove('available');
        }
    } catch (error) {
        console.error('Error checking username:', error);
    }
}

function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');

    if (currentUser) {
        authButtons.innerHTML = `
      <button class="btn btn-outline" id="profileBtn">Profiili</button>
      <button class="btn btn-primary" id="logoutBtn">Kirjaudu ulos</button>
    `;

        document.getElementById('profileBtn').addEventListener('click', () => navigateToPage('profile'));
        document.getElementById('logoutBtn').addEventListener('click', logout);
    } else {
        authButtons.innerHTML = `
      <button class="btn btn-outline" id="loginBtn">Kirjaudu sisään</button>
      <button class="btn btn-primary" id="registerBtn">Rekisteröidy</button>
    `;

        document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
        document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
    }

    updateFavoriteCount();
}

function logout() {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_USER);
    currentUser = null;
    updateAuthUI();
    navigateToPage('restaurants');
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN);
    if (!token) return;

    const username = document.getElementById('editUsername').value;
    const email = document.getElementById('editEmail').value;
    const password = document.getElementById('editPassword').value;
    const avatarFile = document.getElementById('avatarUpload').files[0];
    const errorDiv = document.getElementById('profileEditError');

    try {
        let updateData = { username, email };
        if (password) {
            updateData.password = password;
        }

        console.log('Updating user info:', updateData);

        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Profiilin päivittäminen epäonnistui');
        }

        const data = await response.json();
        console.log('User updated:', data);

        if (avatarFile) {
            console.log('Avatar file found, uploading:', avatarFile.name, avatarFile.type, avatarFile.size);

            if (avatarFile.size > 5 * 1024 * 1024) {
                throw new Error('Kuva on liian suuri. Maksimi koko on 5MB.');
            }

            if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif'].includes(avatarFile.type)) {
                throw new Error('Tuetut formaatit: PNG, JPG, GIF');
            }

            const formData = new FormData();
            formData.append('avatar', avatarFile);

            console.log('Sending avatar to:', `${API_BASE_URL}/users/avatar`);

            const avatarResponse = await fetch(`${API_BASE_URL}/users/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            console.log('Avatar response status:', avatarResponse.status);
            const avatarData = await avatarResponse.json();
            console.log('Avatar response data:', avatarData);

            if (avatarResponse.ok) {
                if (avatarData.data && avatarData.data.avatar) {
                    currentUser.avatar = avatarData.data.avatar;
                    console.log('Avatar URL set to:', currentUser.avatar);
                }
            } else {
                console.warn('Avatar upload failed but continuing:', avatarData);
            }
        }

        currentUser = { ...currentUser, username, email };
        localStorage.setItem(LOCAL_STORAGE_USER, JSON.stringify(currentUser));

        closeModal('profileEditModal');
        document.getElementById('profileEditForm').reset();
        document.getElementById('avatarPreview').innerHTML = '';
        errorDiv.classList.remove('show');

        alert('Profiili päivitetty onnistuneesti!');

        navigateToPage('profile');

    } catch (error) {
        console.error('Profile update error:', error);
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

function navigateToPage(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) link.classList.add('active');
    });

    document.querySelectorAll('#mainContent section').forEach(section => {
        section.style.display = 'none';
    });

    if (page === 'restaurants') {
        document.getElementById('restaurantsPage').style.display = 'block';
    } else if (page === 'map') {
        document.getElementById('mapPage').style.display = 'block';
        initializeMap();
    } else if (page === 'profile') {
        if (!currentUser) {
            openModal('loginModal');
            return;
        }
        document.getElementById('profilePage').style.display = 'block';
        displayProfile();
    }

    toggleMobileMenu(false);
    window.scrollTo(0, 0);
}

function displayProfile() {
    const content = document.getElementById('profileContent');

    let avatarHTML = 'P';
    if (currentUser.avatar) {
        const avatarUrl = currentUser.avatar.startsWith('http')
            ? currentUser.avatar
            : `${API_BASE_URL.replace('/api/v1', '')}/uploads/${currentUser.avatar}`;

        avatarHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }

    content.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar">
          ${avatarHTML}
        </div>
        <div class="profile-info">
          <h2>${currentUser.username}</h2>
          <p class="profile-email">${currentUser.email}</p>
          ${currentUser.favouriteRestaurant ? `
            <div class="profile-favorite">
              <h3>Suosikkiravintola</h3>
              <p>${restaurants.find(r => r._id === currentUser.favouriteRestaurant)?.name || 'N/A'}</p>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="profile-actions">
        <button class="btn btn-outline" id="editProfileBtn">Muokkaa profiilia</button>
        <button class="btn btn-outline" id="deleteAccountBtn">Poista tili</button>
      </div>

      <div class="profile-logout">
        <button class="btn btn-outline" id="logoutBtn2">Kirjaudu ulos</button>
      </div>
    </div>
  `;

    document.getElementById('editProfileBtn').addEventListener('click', openProfileEdit);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
    document.getElementById('logoutBtn2').addEventListener('click', logout);
}

function openProfileEdit() {
    document.getElementById('editUsername').value = currentUser.username;
    document.getElementById('editEmail').value = currentUser.email;
    openModal('profileEditModal');
}

async function deleteAccount() {
    if (!confirm('Oletko varma, että haluat poistaa tilisi? Tätä ei voi kumota.')) {
        return;
    }

    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN);
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Tilin poistaminen epäonnistui');
        }

        logout();
        alert('Tili poistettiin onnistuneesti');

    } catch (error) {
        alert('Virhe: ' + error.message);
    }
}

function initializeMap() {
  const mapContainer = document.getElementById('map');
  
  if (restaurants.length === 0) {
    mapContainer.innerHTML = '<p style="padding: 20px;">Ravintolat ladataan...</p>';
    return;
  }

  if (mapContainer._leaflet_id) {
    mapContainer._leaflet_id = null;
  }
  mapContainer.innerHTML = '';

  const map = L.map('map').setView([63.5, 25.5], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  let nearestRestaurant = null;
  let nearestDistance = Infinity;
  let userLocation = null;

  const purpleIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAzNiIgZmlsbD0iIzVjMmQ5MSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjM2Ij48cGF0aCBkPSJNMTIgMEM2LjUgMCAyIDQuNSAyIDEwYzAgNyAxMCAyNSAxMCAyNXMxMC0xOCAxMC0yNWMwLTUuNS00LjUtMTAtMTAtMTB6TTEyIDE0Yy0yLjIgMC00LTEuOC00LTRzMS44LTQgNC00IDQgMS44IDQgNGMwIDIuMi0xLjggNC00IDR6Ii8+PC9zdmc+',
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48]
  });

  const highlightedIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAzNiIgZmlsbD0iIzhhNWNmNiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjQ4Ij48cGF0aCBkPSJNMTIgMEM2LjUgMCAyIDQuNSAyIDEwYzAgNyAxMCAyNSAxMCAyNXMxMC0xOCAxMC0yNWMwLTUuNS00LjUtMTAtMTAtMTB6TTEyIDE0Yy0yLjIgMC00LTEuOC00LTRzMS44LTQgNC00IDQgMS44IDQgNGMwIDIuMi0xLjggNC00IDR6Ii8+PC9zdmc+',
    iconSize: [40, 56],
    iconAnchor: [20, 56],
    popupAnchor: [0, -56],
    shadowUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0iI2ZiYmYyNCIgb3BhY2l0eT0iMC4zIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIvPjwvc3ZnPg==',
    shadowSize: [32, 32],
    shadowAnchor: [16, 16]
  });

  function setMapMarkers() {
    restaurants.forEach(restaurant => {
      if (restaurant.location && restaurant.location.coordinates) {
        const isNearest = nearestRestaurant && restaurant._id === nearestRestaurant._id;
        const icon = isNearest ? highlightedIcon : purpleIcon;
        
        const marker = L.marker([restaurant.location.coordinates[1], restaurant.location.coordinates[0]], {
          icon: icon
        }).addTo(map);

        const popupContent = `
          <div style="min-width: 200px; font-size: 14px;">
            <h3 style="margin: 0 0 8px 0; color: #5c2d91; font-size: 16px;">${restaurant.name}</h3>
            <p style="margin: 4px 0;">${restaurant.address}</p>
            <p style="margin: 4px 0;">${restaurant.postalCode} ${restaurant.city}</p>
            <p style="margin: 4px 0;">Tel: ${restaurant.phone || 'N/A'}</p>
            <p style="margin: 4px 0;">${restaurant.company}</p>
            ${isNearest ? '<p style="margin: 8px 0; color: #07a102; font-weight: bold;">Lähinnä sinua</p>' : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
      }
    });
  }

  function displayNearestInfo() {
    const mapSection = document.getElementById('mapPage');
    let infoBox = mapSection.querySelector('.nearest-info-box');
    
    if (!infoBox) {
      infoBox = document.createElement('div');
      infoBox.className = 'nearest-info-box';
      mapSection.insertBefore(infoBox, mapSection.querySelector('.map-container'));
    }

    if (nearestRestaurant) {
      infoBox.style.cssText = `
        background: white;
        padding: 16px;
        margin-bottom: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(92, 45, 145, 0.15);
        border-left: 4px solid #5c2d91;
      `;
      infoBox.innerHTML = `
        <p style="margin: 0; font-weight: 700; color: #5c2d91; font-size: 16px;">Lähin ravintola on korostettu</p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #555;">${nearestRestaurant.name}</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #888;">${nearestRestaurant.city}</p>
      `;
    }
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      userLocation = [position.coords.latitude, position.coords.longitude];
      
      L.circleMarker(userLocation, {
        radius: 10,
        fillColor: '#5c2d91',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map).bindPopup('Sinun sijainti');

      restaurants.forEach(r => {
        if (r.location && r.location.coordinates) {
          const distance = Math.sqrt(
            Math.pow(userLocation[0] - r.location.coordinates[1], 2) +
            Math.pow(userLocation[1] - r.location.coordinates[0], 2)
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestRestaurant = r;
          }
        }
      });

      map.setView(userLocation, 10);
      setMapMarkers();
      displayNearestInfo();
    }, () => {
      console.log('Geolocation not available, showing all restaurants');
      setMapMarkers();
    });
  } else {
    setMapMarkers();
  }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleMobileMenu(state = null) {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');

    if (state === null) {
        navbar.classList.toggle('mobile-menu-open');
        hamburger.classList.toggle('active');
    } else if (state === false) {
        navbar.classList.remove('mobile-menu-open');
        hamburger.classList.remove('active');
    }
}

function displayErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 16px 20px;
    border-radius: 6px;
    z-index: 300;
  `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
}

function setupAvatarPreview() {
    setTimeout(() => {
        const avatarInput = document.getElementById('avatarUpload');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        document.getElementById('avatarPreview').innerHTML =
                            `<img src="${event.target.result}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }, 500);
}