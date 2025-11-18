# Klang Telugu Association - Backend Deployment Guide

## 📁 Project Structure
```
kta-backend/
├── server.js           # Main server file
├── package.json        # Dependencies
├── .env               # Environment variables
├── .gitignore         # Git ignore file
├── README.md          # This file
├── data/              # Data storage (auto-created)
│   ├── users.json
│   ├── events.json
│   ├── gallery.json
│   ├── messages.json
│   └── registrations.json
└── public/            # Your HTML files go here
    ├── index.html
    ├── about.html
    ├── events.html
    ├── gallery.html
    ├── donate.html
    ├── contact.html
    └── admin.html
```

## 🚀 Deploy to Render

### Step 1: Prepare Your Files
1. Create a new folder called `kta-backend`
2. Add these files:
   - `package.json`
   - `server.js`
   - `.env`
   - `.gitignore`
3. Create a `public` folder
4. Put ALL your HTML files inside the `public` folder

### Step 2: Push to GitHub
```bash
cd kta-backend
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 3: Deploy on Render
1. Go to https://render.com
2. Sign up/Login
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Fill in the details:
   - **Name**: kta-backend
   - **Region**: Singapore (closest to Malaysia)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

6. Add Environment Variables:
   - Click "Advanced" → "Add Environment Variable"
   - Key: `JWT_SECRET`
   - Value: `kta-super-secret-key-change-this-in-production-2025`

7. Click "Create Web Service"
8. Wait 5-10 minutes for deployment

### Step 4: Your Website URL
After deployment, Render gives you a URL like:
`https://kta-backend.onrender.com`

This is your live website!

## 🔐 Default Admin Account
- **Email**: abhinav.reddivari@gmail.com
- **Password**: admin123
- **IMPORTANT**: Change the password after first login!

## 📝 API Endpoints

### Authentication
- POST `/api/auth/signup` - Create account
- POST `/api/auth/signin` - Login
- GET `/api/auth/me` - Get current user (requires token)

### Events
- GET `/api/events` - Get all events
- POST `/api/events` - Create event (admin)
- PUT `/api/events/:id` - Update event (admin)
- DELETE `/api/events/:id` - Delete event (admin)
- POST `/api/events/:id/register` - Register for event (authenticated)

### Gallery
- GET `/api/gallery` - Get all photos
- POST `/api/gallery` - Add photo (admin)
- DELETE `/api/gallery/:id` - Delete photo (admin)

### Contact Messages
- POST `/api/contact` - Submit message
- GET `/api/contact` - Get all messages (admin)
- PUT `/api/contact/:id/read` - Mark as read (admin)
- DELETE `/api/contact/:id` - Delete message (admin)

### Users (Admin Only)
- GET `/api/users` - Get all users
- POST `/api/users/grant-admin` - Grant admin access
- POST `/api/users/revoke-admin` - Revoke admin access
- DELETE `/api/users/:email` - Delete user

### Stats (Admin Only)
- GET `/api/stats` - Get dashboard statistics

## 🔧 Local Development
```bash
npm install
npm run dev
```
Visit: http://localhost:3000

## ⚠️ Important Notes
1. Free tier on Render goes to sleep after 15 minutes of inactivity
2. First request after sleep takes 30-60 seconds to wake up
3. Data persists in JSON files on Render's disk
4. For production, consider upgrading to paid plan or use a real database

## 🆘 Troubleshooting
- If site is slow, it's waking up from sleep
- Check Render logs for errors
- Make sure all HTML files are in `public` folder
- Verify environment variables are set correctly

## 📞 Support
Contact: abhinav.reddivari@gmail.com
