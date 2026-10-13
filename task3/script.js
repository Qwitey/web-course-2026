let tasks = [];

let nextId = 1;

let currentFilter = "all";

const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const counter = document.getElementById("counter");
const filterButtons = document.querySelectorAll(".filter-btn");


function render() {
    todoList.innerHTML = "";

    const visibleTasks = tasks.filter((task) => {
        if (currentFilter === "active") {
            return !task.completed;
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        return true;
    });

    const taskElements = visibleTasks.map((task) => {
        const li = document.createElement("li");
        li.classList.add("todo-item");

        // Определяем цвет состояния
        if (task.completed) {
            li.classList.add("done");
        } else if (task.failed) {
            li.classList.add("failed");
        } else {
            li.classList.add("in-progress");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        const span = document.createElement("span");
        span.textContent = task.text;
        span.classList.add("todo-text");

        if (task.completed) {
            span.classList.add("completed");
        }

        // Кнопки изменения статуса
        const statusButtons = document.createElement("div");
        statusButtons.classList.add("status-buttons");

        const completeButton = document.createElement("button");
        completeButton.textContent = "✓";
        completeButton.type = "button";
        completeButton.classList.add("status-btn");

        const failedButton = document.createElement("button");
        failedButton.textContent = "✕";
        failedButton.type = "button";
        failedButton.classList.add("status-btn");

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Удалить";
        deleteButton.type = "button";
        deleteButton.classList.add("delete-btn");

        // Checkbox
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            task.failed = false;

            render();
        });

        // Выполнено
        completeButton.addEventListener("click", () => {
            task.completed = true;
            task.failed = false;

            render();
        });

        // Провалено
        failedButton.addEventListener("click", () => {
            task.completed = false;
            task.failed = true;

            render();
        });

        // Удаление
        deleteButton.addEventListener("click", () => {
            tasks = tasks.filter((item) => item.id !== task.id);

            render();
        });

        statusButtons.append(completeButton, failedButton);

        li.append(
            checkbox,
            span,
            statusButtons,
            deleteButton
        );

        return li;
    });

    taskElements.forEach((element) => {
        todoList.appendChild(element);
    });

    const activeCount = tasks.filter((task) => !task.completed).length;
    const completedCount = tasks.filter((task) => task.completed).length;

    counter.textContent =
        `Осталось: ${activeCount}, Выполнено: ${completedCount}`;
}


todoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = todoInput.value.trim();

    if (text === "") {
        alert("Введите текст задачи.");
        return;
    }

    const newTask = {
        id: nextId,
        text: text,
        completed: false,
        failed: false
    };

    tasks.push(newTask);

    nextId++;

    todoInput.value = "";

    render();

    todoInput.focus();
});


filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        filterButtons.forEach((btn) => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        render();
    });
});


render();