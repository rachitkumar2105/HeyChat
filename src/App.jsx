import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import ProfileSettings from './pages/ProfileSettings';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile-setup" element={<ProfileSetup />} />
                <Route path="/settings" element={<ProfileSettings />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/" element={<Navigate to="/auth" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
