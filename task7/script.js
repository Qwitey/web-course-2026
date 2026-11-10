// --- Конфигурация и состояние ---
const API_URL = 'https://jsonplaceholder.typicode.com/posts';
const LIMIT = 10; // Количество постов за один запрос
let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;

// Массив для хранения всех загруженных постов (требование ЛР)
let allLoadedPosts = [];

// DOM Элементы
const postsContainer = document.getElementById('posts-container');
const loader = document.getElementById('loader');
const messageEl = document.getElementById('message');
const searchInput = document.getElementById('search-input');
const sentinel = document.getElementById('sentinel');

// --- Функции для работы с UI ---
function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.style.color = isError ? 'red' : 'gray';
    messageEl.classList.remove('hidden');
}

function clearMessage() {
    messageEl.classList.add('hidden');
    messageEl.textContent = '';
}

// Отрисовка карточек на основе переданного массива
function renderPosts(postsToRender) {
    postsContainer.innerHTML = ''; // Очищаем контейнер

    if (postsToRender.length === 0) {
        postsContainer.innerHTML = '<p style="text-align:center; width:100%;">Ничего не найдено</p>';
        return;
    }

    postsToRender.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <h2>${post.title}</h2>
            <p>${post.body}</p>
            <div class="author">Автор ID: ${post.userId}</div>
        `;
        postsContainer.appendChild(card);
    });
}

// --- Основная логика ---

// 1. Загрузка постов (async/await + try/catch)
async function fetchPosts() {
    if (isLoading || !hasMorePosts) return;

    isLoading = true;
    showLoader();
    clearMessage();

    try {
        const response = await fetch(`${API_URL}?_page=${currentPage}&_limit=${LIMIT}`);

        // Проверка на ошибку сети (response.ok)
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const newPosts = await response.json();

        // Если пришло меньше постов, чем LIMIT, значит это конец
        if (newPosts.length < LIMIT) {
            hasMorePosts = false;
            showMessage('Больше постов нет');
        }

        // Добавляем в общий массив
        allLoadedPosts = [...allLoadedPosts, ...newPosts];
        
        // Отрисовываем (с учетом текущего фильтра поиска)
        applyFilterAndRender();

        currentPage++; // Увеличиваем страницу для следующей загрузки
    } catch (error) {
        console.error(error);
        // 7. Обработка ошибки сети
        showMessage('Произошла ошибка при загрузке данных. Проверьте интернет.', true);
    } finally {
        isLoading = false;
        hideLoader();
    }
}

// 2. Фильтрация и отрисовка
function applyFilterAndRender() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    // Фильтруем общий массив по title (без учета регистра)
    const filteredPosts = allLoadedPosts.filter(post => 
        post.title.toLowerCase().includes(searchTerm)
    );

    renderPosts(filteredPosts);

    // Если фильтр не пустой, подсказываем пользователю, что скролл может не работать на отфильтрованных данных
    if (searchTerm && hasMorePosts) {
        // Опционально: можно показать сообщение, что загружены не все посты
    }
}

// 3. Дебаунс для поиска (задержка 300мс)
let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // Фильтрация происходит по УЖЕ загруженным данным на клиенте
        applyFilterAndRender();
    }, 300);
});

// 4. Бесконечный скролл через IntersectionObserver
const observerOptions = {
    root: null, // viewport
    rootMargin: '200px', // Срабатывает за 200px до конца страницы (по заданию)
    threshold: 0
};

const observerCallback = (entries) => {
    const [entry] = entries;
    // Если маркер виден и есть еще посты и не идет загрузка и нет активного поиска
    // (при активном поиске скролл может грузить лишнее, но по заданию фильтр клиентский, 
    // поэтому мы просто грузим новые, а фильтр их скроет)
    if (entry.isIntersecting && hasMorePosts && !isLoading) {
        fetchPosts();
    }
};

const observer = new IntersectionObserver(observerCallback, observerOptions);
observer.observe(sentinel);


// --- Инициализация при загрузке страницы ---
// 1. Подгружаем первую порцию
fetchPosts();