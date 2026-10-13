// Состояние игры
let secretNumber = "";
let attempts = 0;
let history = [];
let gameOver = false;


// Получаем элементы страницы
const guessInput = document.getElementById("guessInput");
const checkButton = document.getElementById("checkButton");
const newGameButton = document.getElementById("newGameButton");

const message = document.getElementById("message");
const attemptsCount = document.getElementById("attemptsCount");
const historyList = document.getElementById("historyList");


// --------------------------------------------------
// Генерация загаданного числа
// --------------------------------------------------

function generateSecretNumber() {
    const digits = [];

    while (digits.length < 4) {
        const digit = Math.floor(Math.random() * 10).toString();

        if (!digits.includes(digit)) {
            digits.push(digit);
        }
    }

    return digits.join("");
}


// --------------------------------------------------
// Проверка введённого числа
// --------------------------------------------------

function validateGuess(guess) {
    if (!/^\d{4}$/.test(guess)) {
        return "Введите ровно 4 цифры.";
    }

    const uniqueDigits = new Set(guess);

    if (uniqueDigits.size !== 4) {
        return "Все 4 цифры должны быть разными.";
    }

    return "";
}


// --------------------------------------------------
// Подсчёт быков и коров
// --------------------------------------------------

function calculateBullsAndCows(secret, guess) {
    let bulls = 0;
    let cows = 0;

    for (let i = 0; i < 4; i++) {
        if (guess[i] === secret[i]) {
            bulls++;
        } else if (secret.includes(guess[i])) {
            cows++;
        }
    }

    return {
        bulls: bulls,
        cows: cows
    };
}


// --------------------------------------------------
// Отрисовка истории
// --------------------------------------------------

function render() {
    historyList.innerHTML = "";

    history.forEach((attempt) => {
        const li = document.createElement("li");
        li.classList.add("history-item");

        const guess = document.createElement("span");
        guess.classList.add("guess");
        guess.textContent = attempt.guess;

        const result = document.createElement("span");
        result.classList.add("result");
        result.textContent =
            `${attempt.bulls} бык(ов), ${attempt.cows} коров(ы)`;

        li.append(guess, result);

        historyList.appendChild(li);
    });

    attemptsCount.textContent = attempts;
}


// --------------------------------------------------
// Проверка попытки
// --------------------------------------------------

function checkGuess() {
    if (gameOver) {
        return;
    }

    const guess = guessInput.value.trim();

    const validationError = validateGuess(guess);

    if (validationError !== "") {
        message.textContent = validationError;
        message.className = "message error";
        return;
    }

    const result = calculateBullsAndCows(secretNumber, guess);

    attempts++;

    history.push({
        guess: guess,
        bulls: result.bulls,
        cows: result.cows
    });

    render();

    guessInput.value = "";
    guessInput.focus();

    if (result.bulls === 4) {
        gameOver = true;

        message.textContent =
            `Победа! Угадано за ${attempts} попыток.`;

        message.className = "message success";

        guessInput.disabled = true;
        checkButton.disabled = true;
    } else {
        message.textContent =
            `${result.bulls} бык(ов), ${result.cows} коров(ы).`;

        message.className = "message";
    }
}


// --------------------------------------------------
// Новая игра
// --------------------------------------------------

function startNewGame() {
    secretNumber = generateSecretNumber();

    attempts = 0;
    history = [];
    gameOver = false;

    guessInput.value = "";
    guessInput.disabled = false;

    checkButton.disabled = false;

    message.textContent = "";
    message.className = "message";

    render();

    guessInput.focus();

    console.log("Загаданное число:", secretNumber);
}


// --------------------------------------------------
// Обработчики событий
// --------------------------------------------------

checkButton.addEventListener("click", checkGuess);

newGameButton.addEventListener("click", startNewGame);

guessInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        checkGuess();
    }
});


// Запуск игры при загрузке страницы
startNewGame();