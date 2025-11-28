//handling countdown functionality for quiz questions
export class Timer {
    // Constructor initializes the timer with duration and callback functions
    constructor(duration, onTimeUp, onWarning) {
        // Initialize timer properties
        this.duration = duration; // Total duration in seconds
        this.remainingTime = duration; // Time remaining in seconds
        this.onTimeUp = onTimeUp; // Callback function when timer reaches 0
        this.onWarning = onWarning; // Callback function when warning threshold is reached
        this.intervalId = null; // ID for the setInterval function
        this.warningThreshold = 10; // Seconds remaining when warning should trigger
    }

    // Start the countdown timer
    start() {
        // Clear any existing interval to prevent multiple timers running
        this.stop();
        
        // Reset remaining time to the initial duration
        this.remainingTime = this.duration;
        
        // Update the timer display immediately
        this.updateDisplay();
        
        // Set up the interval to update every second (1000ms)
        this.intervalId = setInterval(() => {
            // Decrease remaining time by 1 second
            this.remainingTime--;
            
            // Update the display to show the new time
            this.updateDisplay();
            
            // Check if warning threshold is reached (10 seconds left)
            if (this.remainingTime === this.warningThreshold && this.onWarning) {
                // Call the warning callback function
                this.onWarning();
            }
            
            // Check if time is up (0 seconds left)
            if (this.remainingTime <= 0) {
                // Stop the timer
                this.stop();
                // Call the time up callback function
                if (this.onTimeUp) {
                    this.onTimeUp();
                }
            }
        }, 1000);
    }

    // Stop the countdown timer
    stop() {
        // Check if there's an active interval
        if (this.intervalId) {
            // Clear the interval to stop the timer
            clearInterval(this.intervalId);
            // Reset the interval ID
            this.intervalId = null;
        }
    }

    // Update the timer display elements
    updateDisplay() {
        // Update the timer bar width based on remaining time percentage
        const timerBar = document.getElementById('timer-bar');
        if (timerBar) {
            // Calculate the percentage of time remaining
            const percentage = (this.remainingTime / this.duration) * 100;
            // Set the width of the timer bar
            timerBar.style.width = `${percentage}%`;
            
            // Add warning class if time is running out (10 seconds or less)
            if (this.remainingTime <= this.warningThreshold) {
                timerBar.classList.add('warning');
            } else {
                // Remove warning class if there's more than 10 seconds left
                timerBar.classList.remove('warning');
            }
        }
        
        // Update the timer text to show remaining seconds
        const timerText = document.getElementById('timer-text');
        if (timerText) {
            timerText.textContent = `${this.remainingTime}s`;
        }
    }

    // Reset the timer to its initial state
    reset() {
        // Stop any active timer
        this.stop();
        // Reset remaining time to the initial duration
        this.remainingTime = this.duration;
        // Update the display to show the full duration
        this.updateDisplay();
    }
}