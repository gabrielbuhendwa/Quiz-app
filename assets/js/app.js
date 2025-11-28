// Main application logic for the Quiz App

import { questions } from './questions.js';
import { Timer } from './timer.js';

// QuizApp class to manage the entire quiz flow
class QuizApp {
    constructor() {
        // Initialize quiz state variables
        this.currentQuestionIndex = 0; // Index of the current question
        this.score = 0; // User's score
        this.userAnswers = []; // Array to store user's answers
        this.questionStartTime = null; // Timestamp when the current question started
        this.totalTime = 0; // Total time spent on the quiz
        this.questionTimes = []; // Array to store time spent on each question
        this.timer = null; // Timer instance for the current question
        
        // User information
        this.userName = ''; // User's name
        this.userEmail = ''; // User's email
        
        // DOM elements - references to HTML elements we'll interact with
        this.startScreen = document.getElementById('start-screen');
        this.quizScreen = document.getElementById('quiz-screen');
        this.endScreen = document.getElementById('end-screen');
        this.exitScreen = document.getElementById('exit-screen');
        this.reportScreen = document.getElementById('report-screen');
        
        // Initialize the app
        this.init();
    }

    // Initialize the app by setting up event listeners and checking for saved progress
    init() {
        // Set up event listeners for user interactions
        this.setupEventListeners();
        
        // Check for saved progress in localStorage
        this.loadSavedProgress();
        
        // Show the start screen by default
        this.showScreen('start-screen');
    }

    // Set up all event listeners for the app
    setupEventListeners() {
        // Start form submission event
        document.getElementById('user-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startQuiz();
        });
        
        // Next button click event
        document.getElementById('next-btn').addEventListener('click', () => {
            this.nextQuestion();
        });
        
        // Exit button click event
        document.getElementById('exit-btn').addEventListener('click', () => {
            this.exitQuiz();
        });
        
        // See report button click event
        document.getElementById('see-report-btn').addEventListener('click', () => {
            this.showReport();
        });
        
        // Home button click event (from end screen)
        document.getElementById('home-btn').addEventListener('click', () => {
            this.goHome();
        });
        
        // Home button click event (from exit screen)
        document.getElementById('home-from-exit-btn').addEventListener('click', () => {
            this.goHome();
        });
        
        // Home button click event (from report screen)
        document.getElementById('home-from-report-btn').addEventListener('click', () => {
            this.goHome();
        });
    }

    // Start the quiz after user submits the form
    startQuiz() {
        // Get user information from form inputs
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        
        // Validate inputs to ensure they're not empty
        if (!nameInput.value.trim() || !emailInput.value.trim()) {
            alert('Please enter both name and email.');
            return;
        }
        
        // Save user information
        this.userName = nameInput.value.trim();
        this.userEmail = emailInput.value.trim();
        
        // Save user information to localStorage for persistence
        localStorage.setItem('quizUserName', this.userName);
        localStorage.setItem('quizUserEmail', this.userEmail);
        
        // Reset quiz state variables
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.totalTime = 0;
        this.questionTimes = [];
        
        // Show the quiz screen
        this.showScreen('quiz-screen');
        
        // Display user information at the top of the quiz
        document.getElementById('user-name').textContent = this.userName;
        document.getElementById('user-email').textContent = this.userEmail;
        
        // Load the first question
        this.loadQuestion();
    }

    // Load a question and display it
    loadQuestion() {
        // Check if we've reached the end of the quiz
        if (this.currentQuestionIndex >= questions.length) {
            // End the quiz if all questions have been answered
            this.endQuiz();
            return;
        }
        
        // Get the current question object from the questions array
        const currentQuestion = questions[this.currentQuestionIndex];
        
        // Update question counter display
        document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
        
        // Display the question text
        document.getElementById('question-text').textContent = currentQuestion.question;
        
        // Create and display the options for the current question
        const optionsContainer = document.getElementById('options-container');
        // Clear any existing options
        optionsContainer.innerHTML = '';
        
        // Loop through each option for the current question
        currentQuestion.options.forEach((option, index) => {
            // Create a container div for the option
            const optionElement = document.createElement('div');
            optionElement.className = 'option';
            optionElement.dataset.index = index;
            
            // Create a radio button input element
            const radioElement = document.createElement('input');
            radioElement.type = 'radio';
            radioElement.name = 'answer';
            radioElement.id = `option-${index}`;
            radioElement.value = index;
            
            // Create a custom radio button visual element
            const radioCustom = document.createElement('div');
            radioCustom.className = 'radio-custom';
            
            // Create a span element for the option text
            const optionText = document.createElement('span');
            optionText.className = 'option-text';
            optionText.textContent = option;
            
            // Add all elements to the option container
            optionElement.appendChild(radioElement);
            optionElement.appendChild(radioCustom);
            optionElement.appendChild(optionText);
            
            // Add click event to select the option when clicked
            optionElement.addEventListener('click', () => {
                this.selectOption(index);
            });
            
            // Add the option to the options container
            optionsContainer.appendChild(optionElement);
        });
        
        // Disable the next button until an option is selected
        document.getElementById('next-btn').disabled = true;
        
        // Start the timer for this question
        this.startTimer();
        
        // Record the start time for this question
        this.questionStartTime = Date.now();
    }

    // Select an option for the current question
    selectOption(index) {
        // Remove the 'selected' class from all options
        document.querySelectorAll('.option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add the 'selected' class to the clicked option
        const selectedOption = document.querySelector(`.option[data-index="${index}"]`);
        selectedOption.classList.add('selected');
        
        // Check the radio button for the selected option
        document.getElementById(`option-${index}`).checked = true;
        
        // Enable the next button now that an option is selected
        document.getElementById('next-btn').disabled = false;
        
        // Show feedback animation (briefly) to indicate if the answer is correct or incorrect
        this.showFeedback(index);
    }

    // Show feedback animation for the selected answer
    showFeedback(selectedIndex) {
        // Get the current question object
        const currentQuestion = questions[this.currentQuestionIndex];
        // Check if the selected answer is correct
        const isCorrect = selectedIndex === currentQuestion.correctAnswer;
        
        // Get the selected option element
        const selectedOption = document.querySelector(`.option[data-index="${selectedIndex}"]`);
        
        // Add the appropriate animation class based on whether the answer is correct
        if (isCorrect) {
            selectedOption.classList.add('correct-animation');
            // Remove the animation class after the animation completes
            setTimeout(() => {
                selectedOption.classList.remove('correct-animation');
            }, 500);
        } else {
            selectedOption.classList.add('incorrect-animation');
            // Remove the animation class after the animation completes
            setTimeout(() => {
                selectedOption.classList.remove('incorrect-animation');
            }, 500);
        }
    }

    // Start the timer for the current question
    startTimer() {
        // Stop any existing timer
        if (this.timer) {
            this.timer.stop();
        }
        
        // Create a new timer with 50 seconds duration
        this.timer = new Timer(
            50, // Duration in seconds
            () => {
                // Callback function when time is up
                this.handleTimeUp();
            },
            () => {
                // Callback function when warning threshold is reached (10 seconds)
                this.handleTimeWarning();
            }
        );
        
        // Start the timer
        this.timer.start();
    }

    // Handle when time is up for a question
    handleTimeUp() {
        // Automatically move to the next question
        this.nextQuestion();
    }

    // Handle when time warning is triggered (10 seconds left)
    handleTimeWarning() {
        // The timer bar color change is handled in the timer class
    }

    // Move to the next question
    nextQuestion() {
        // Stop the timer for the current question
        if (this.timer) {
            this.timer.stop();
        }
        
        // Calculate time spent on this question
        if (this.questionStartTime) {
            const timeSpent = Math.round((Date.now() - this.questionStartTime) / 1000);
            this.questionTimes.push(timeSpent);
            this.totalTime += timeSpent;
        }
        
        // Get the selected answer for the current question
        const selectedOption = document.querySelector('input[name="answer"]:checked');
        
        // Check if an answer was selected
        if (selectedOption) {
            // Get the index of the selected answer
            const selectedIndex = parseInt(selectedOption.value);
            const currentQuestion = questions[this.currentQuestionIndex];
            // Check if the selected answer is correct
            const isCorrect = selectedIndex === currentQuestion.correctAnswer;
            
            // Save the user's answer
            this.userAnswers.push({
                questionId: currentQuestion.id,
                selectedAnswer: selectedIndex,
                isCorrect: isCorrect
            });
            
            // Update score if the answer is correct
            if (isCorrect) {
                this.score++;
            }
        } else {
            // No answer was selected, save as unanswered
            this.userAnswers.push({
                questionId: questions[this.currentQuestionIndex].id,
                selectedAnswer: null,
                isCorrect: false
            });
        }
        
        // Save progress to localStorage
        this.saveProgress();
        
        // Move to the next question
        this.currentQuestionIndex++;
        
        // Load the next question
        this.loadQuestion();
    }

// Exit the quiz early
exitQuiz() {
    // Stop the timer
    if (this.timer) {
        this.timer.stop();
    }
    
    // Calculate time spent on the current question
    if (this.questionStartTime) {
        const timeSpent = Math.round((Date.now() - this.questionStartTime) / 1000);
        this.questionTimes.push(timeSpent);
        this.totalTime += timeSpent;
    }
    
    // Get the selected answer for the current question
    const selectedOption = document.querySelector('input[name="answer"]:checked');
    
    // Check if an answer was selected
    if (selectedOption) {
        // Get the index of the selected answer
        const selectedIndex = parseInt(selectedOption.value);
        const currentQuestion = questions[this.currentQuestionIndex];
        // Check if the selected answer is correct
        const isCorrect = selectedIndex === currentQuestion.correctAnswer;
        
        // Save the user's answer
        this.userAnswers.push({
            questionId: currentQuestion.id,
            selectedAnswer: selectedIndex,
            isCorrect: isCorrect
        });
        
        // Update score if the answer is correct
        if (isCorrect) {
            this.score++;
        }
    }
    // If no answer was selected, we don't save anything for this question
    
    // Show the exit screen
    this.showExitScreen();
    
    // Clear saved progress
    this.clearSavedProgress();
}

    // Show the exit screen with partial results
    showExitScreen() {
        // Calculate the number of questions answered
        const questionsAnswered = this.userAnswers.length;
    
        // Update the exit score text
        document.getElementById('exit-score-text').textContent = `${this.score}/${questionsAnswered}`;
    
        // Show the exit screen
        this.showScreen('exit-screen');
    
        // No report button is shown for users who exit early
    }

    // End the quiz and show the final results
    endQuiz() {
        // Show the end screen
        this.showScreen('end-screen');
        
        // Update the final score
        document.getElementById('final-score').textContent = `${this.score}/${questions.length}`;
        
        // Determine if the user passed or failed (8 out of 15 is passing)
        const passed = this.score >= 8;
        const scoreCircle = document.getElementById('score-circle');
        
        // Set the background color of the score circle based on pass/fail
        if (passed) {
            scoreCircle.style.backgroundColor = 'var(--success-color)';
        } else {
            scoreCircle.style.backgroundColor = 'var(--danger-color)';
        }
        
        // Calculate and display analytics
        this.displayAnalytics();
        
        // Clear saved progress
        this.clearSavedProgress();
    }

    // Calculate and display analytics
    displayAnalytics() {
        const analyticsContainer = document.getElementById('analytics');
        
        // Calculate percentage correct
        const percentageCorrect = Math.round((this.score / questions.length) * 100);
        
        // Calculate average time per question
        const averageTime = this.questionTimes.length > 0 
            ? Math.round(this.totalTime / this.questionTimes.length) 
            : 0;
        
        // Create analytics HTML
        analyticsContainer.innerHTML = `
            <p>You answered <strong>${percentageCorrect}%</strong> correctly.</p>
            <p>Average time per question: <strong>${averageTime}s</strong></p>
            <p>Total time: <strong>${this.formatTime(this.totalTime)}</strong></p>
        `;
    }

    // Format time in seconds to a more readable format
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

// Show the report page with all questions and answers
showReport() {
    // Show the report screen
    this.showScreen('report-screen');
    
    // Update the score in the report
    document.getElementById('report-score').textContent = `${this.score}/${questions.length}`;
    
    // Determine if the user passed or failed (8 out of 15 is passing)
    const passed = this.score >= 8;
    const scoreCircle = document.getElementById('report-score-circle');
    
    // Set the background color of the score circle based on pass/fail
    if (passed) {
        scoreCircle.style.backgroundColor = 'var(--success-color)';
    } else {
        scoreCircle.style.backgroundColor = 'var(--danger-color)';
    }
    
    // Calculate and display stats
    const percentageCorrect = Math.round((this.score / questions.length) * 100);
    const averageTime = this.questionTimes.length > 0 
        ? Math.round(this.totalTime / this.questionTimes.length) 
        : 0;
    
    document.getElementById('report-stats').innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${percentageCorrect}%</div>
            <div class="stat-label">Correct</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${averageTime}s</div>
            <div class="stat-label">Avg. Time</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${this.formatTime(this.totalTime)}</div>
            <div class="stat-label">Total Time</div>
        </div>
    `;
    
    // Display all questions with answers
    const questionsReview = document.getElementById('questions-review');
    questionsReview.innerHTML = '';
    
    questions.forEach((question, index) => {
        // Find the user's answer for this question
        const userAnswer = this.userAnswers.find(a => a.questionId === question.id);
        const isCorrect = userAnswer ? userAnswer.isCorrect : false;
        const selectedAnswerIndex = userAnswer ? userAnswer.selectedAnswer : null;
        const wasAnswered = userAnswer && userAnswer.selectedAnswer !== null;
        
        // Create a container for the question review
        const questionReview = document.createElement('div');
        questionReview.className = 'question-review';
        
        // Add the question text
        const questionText = document.createElement('h3');
        questionText.textContent = `Question ${index + 1}: ${question.question}`;
        questionReview.appendChild(questionText);
        
        // Create a container for the options review
        const optionsReview = document.createElement('div');
        optionsReview.className = 'options-review';
        
        // Loop through each option for the question
        question.options.forEach((option, optionIndex) => {
            // Create a container for the option review
            const optionReview = document.createElement('div');
            optionReview.className = 'option-review';
            
            // Check if this is the correct answer
            if (optionIndex === question.correctAnswer) {
                optionReview.classList.add('correct-answer');
                
                // Add a badge to indicate this is the correct answer
                const correctBadge = document.createElement('span');
                correctBadge.className = 'badge correct';
                correctBadge.textContent = 'Correct';
                optionReview.appendChild(correctBadge);
            } 
            // If this option was selected by the user
            else if (selectedAnswerIndex === optionIndex) {
                optionReview.classList.add('user-answer');
                optionReview.classList.add('incorrect-answer');
                
                // Add a badge to indicate this was the user's answer
                const userBadge = document.createElement('span');
                userBadge.className = 'badge your-answer';
                userBadge.textContent = 'False';
                optionReview.appendChild(userBadge);
            }
            // If the question wasn't answered and this isn't the correct answer
            else if (!wasAnswered && optionIndex !== question.correctAnswer) {
                optionReview.classList.add('incorrect-answer');
            }
            
            // Add the option label (A, B, C, D)
            const optionLabel = document.createElement('span');
            optionLabel.className = 'label';
            optionLabel.textContent = `${String.fromCharCode(65 + optionIndex)}. `;
            
            // Add the option text
            const optionValue = document.createElement('span');
            optionValue.textContent = option;
            
            optionReview.appendChild(optionLabel);
            optionReview.appendChild(optionValue);
            
            optionsReview.appendChild(optionReview);
        });
        
        questionReview.appendChild(optionsReview);
        questionsReview.appendChild(questionReview);
    });
}

    // Go back to the home screen (start screen)
    goHome() {
        // Stop any running timer
        if (this.timer) {
            this.timer.stop();
        }
        
        // Reset quiz state variables
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.totalTime = 0;
        this.questionTimes = [];
        
        // Clear the form inputs
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        
        // Show the start screen
        this.showScreen('start-screen');
        
        // Clear saved progress
        this.clearSavedProgress();
    }

    // Show a specific screen
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show the requested screen
        document.getElementById(screenId).classList.add('active');
    }

    // Save quiz progress to localStorage
    saveProgress() {
        const progressData = {
            currentQuestionIndex: this.currentQuestionIndex,
            score: this.score,
            userAnswers: this.userAnswers,
            totalTime: this.totalTime,
            questionTimes: this.questionTimes,
            userName: this.userName,
            userEmail: this.userEmail
        };
        
        localStorage.setItem('quizProgress', JSON.stringify(progressData));
    }

    // Load saved progress from localStorage
    loadSavedProgress() {
        const savedProgress = localStorage.getItem('quizProgress');
        
        if (savedProgress) {
            const progressData = JSON.parse(savedProgress);
            
            // Check if the user wants to resume the quiz
            const shouldResume = confirm('You have a saved quiz in progress. Would you like to resume?');
            
            if (shouldResume) {
                // Restore quiz state
                this.currentQuestionIndex = progressData.currentQuestionIndex;
                this.score = progressData.score;
                this.userAnswers = progressData.userAnswers;
                this.totalTime = progressData.totalTime;
                this.questionTimes = progressData.questionTimes;
                this.userName = progressData.userName;
                this.userEmail = progressData.userEmail;
                
                // Show quiz screen
                this.showScreen('quiz-screen');
                
                // Display user information
                document.getElementById('user-name').textContent = this.userName;
                document.getElementById('user-email').textContent = this.userEmail;
                
                // Load the current question
                this.loadQuestion();
            }
        }
    }

    // Clear saved progress from localStorage
    clearSavedProgress() {
        localStorage.removeItem('quizProgress');
    }
}

// Initialize the quiz app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});