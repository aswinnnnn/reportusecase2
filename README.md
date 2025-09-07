# Feedback Report Generator with Firebase Authentication

A web application for generating feedback reports from Excel files with user authentication.

## Features

- **User Authentication**: Sign up and sign in with email and password using Firebase Authentication
- **Report Generation**: Upload Excel files and generate professional feedback reports
- **Question Management**: Add and manage feedback questions
- **Report History**: View and manage previously generated reports
- **Responsive Design**: Modern, clean interface that works on all devices

## Getting Started

### Prerequisites

- A modern web browser
- A Firebase project with Authentication enabled

### Setup

1. **Firebase Configuration**: The app is already configured with a Firebase project. If you need to use your own Firebase project:

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one
   - Enable Authentication with Email/Password provider
   - Get your Firebase configuration
   - Update the `firebaseConfig` object in `script.js`

2. **Run the Application**:
   ```bash
   # Using Python (if installed)
   python -m http.server 8000
   
   # Or using Node.js (if installed)
   npx serve .
   
   # Or simply open index.html in a web browser
   ```

3. **Access the Application**: Open your browser and navigate to `http://localhost:8000`

## Usage

### Authentication

1. **First Time Users**: Click "Sign up" to create a new account
   - Enter your full name
   - Enter your email address
   - Create a password (minimum 6 characters)
   - Confirm your password
   - Click "Sign Up"

2. **Existing Users**: Enter your email and password to sign in

3. **User Display**: Your name (or email for existing users) will be displayed in the header

4. **Logout**: Click the "Logout" button in the top-right corner

### Generating Reports

1. **Upload Excel File**: 
   - Click "Choose File" and select your Excel feedback file
   - Optionally enter a batch name

2. **Select Trainer** (for multi-trainer files):
   - Choose the trainer you want to generate a report for

3. **Enter Trainer Name** (for single-trainer files):
   - Type the trainer's name

4. **Generate Report**: Click "Generate Report" to create and view the report

### Managing Questions

1. Go to the "Manage Questions" tab
2. Add new questions using the input field
3. Delete existing questions using the trash icon

### Viewing Past Reports

1. Go to the "Past Reports" tab
2. View previously generated reports
3. Delete reports you no longer need

## File Format

The Excel file should have the following structure:
- Student information columns (Name, Email, etc.)
- Question rating columns (Excellent, Very Good, Good, Average, Poor)
- Comment columns ("What went well", "What needs improvement")

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Authentication**: Firebase Authentication
- **Database**: Firestore
- **AI Integration**: Google Gemini API for comment summarization
- **File Processing**: SheetJS for Excel file parsing

## Security Notes

- User authentication is required to access the application
- All data is stored securely in Firebase
- Passwords are handled by Firebase Authentication
- The application uses HTTPS in production

## Troubleshooting

- **Authentication Issues**: Make sure Firebase Authentication is enabled in your Firebase project
- **File Upload Issues**: Ensure your Excel file follows the required format
- **Network Issues**: Check your internet connection and Firebase project configuration

## Support

If you encounter any issues, please check the browser console for error messages and ensure your Firebase project is properly configured.
