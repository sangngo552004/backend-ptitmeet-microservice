import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

// REPLACE WITH YOUR ACTUAL GOOGLE CLIENT ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
console.log(GOOGLE_CLIENT_ID);
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AuthProvider>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <App />
            </GoogleOAuthProvider>
        </AuthProvider>
    </React.StrictMode>
);
