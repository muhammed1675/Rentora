import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { VerifyGateProvider } from "./components/VerifyGateDialog";
import { supabase } from "./lib/supabase";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import { initializeAnalytics, trackPageView } from "./lib/analytics";

// Pages
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import PropertyDetails from "./pages/PropertyDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AgentDashboard from "./pages/AgentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import BecomeAgent from "./pages/BecomeAgent";
import PaymentCallback from "./pages/PaymentCallback";
import { PolicyPage } from "./pages/PolicyPage";
import Contact from "./pages/Contact";
import { Compare } from './pages/Compare';
import { AuthCallback } from './pages/AuthCallback';
import { NotFound } from './pages/NotFound';
import { About } from './pages/About';
import { FAQ } from './pages/FAQ';
import Notifications from './pages/Notifications';
import VerifyAccount from './pages/VerifyAccount';
import Advertise from './pages/Advertise';

// Protected Route wrapper. Browsing is always allowed for everyone —
// verification is enforced at the specific action, not at the route
// level (see components/VerifyGateDialog.jsx). This wrapper only
// checks sign-in and role.
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Gate for the invite-only /become-agent page. No public entry point
// links here — a valid, unused, unexpired invite code is required in
// the URL. Without one this renders as a plain "Not found", identical
// to any wrong URL, so the page can't be guessed or probed. A signed-
// out visitor is sent to login and back to this same invite link.
function AgentInviteGate({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // checking | valid | invalid

  const code = new URLSearchParams(location.search).get('invite');

  useEffect(() => {
    let mounted = true;
    if (!code) { setStatus('invalid'); return; }
    if (!isAuthenticated) return; // wait for the login redirect below
    supabase.rpc('check_agent_invite', { p_code: code })
      .then(({ data, error }) => {
        if (!mounted) return;
        setStatus(!error && data === true ? 'valid' : 'invalid');
      })
      .catch(() => { if (mounted) setStatus('invalid'); });
    return () => { mounted = false; };
  }, [code, isAuthenticated]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!code || status === 'invalid') {
    return <Layout><NotFound /></Layout>;
  }

  if (status === 'checking') return null;

  return children;
}

function TrackPageViews() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location]);

  return null;
}

// Tapping a push notification (see public/sw.js 'notificationclick') posts
// {type:'notification-click', link} to this tab if one is already open, so
// we navigate inside the SPA instead of a full page reload to that link.
function PushClickListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data?.type === 'notification-click' && event.data.link) {
        navigate(event.data.link);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  return null;
}

function AppRoutes() {
  return (
    <VerifyGateProvider>
      <TrackPageViews />
      <PushClickListener />
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Layout><Home /></Layout>} />
      <Route path="/browse" element={<Layout><Browse /></Layout>} />
      <Route path="/property/:id" element={<Layout><PropertyDetails /></Layout>} />
      <Route path="/login" element={<Layout><Login /></Layout>} />
      <Route path="/register" element={<Layout><Register /></Layout>} />
      <Route path="/payment/callback" element={<Layout><PaymentCallback /></Layout>} />
      <Route path="/contact" element={<Layout><Contact /></Layout>} />
      <Route path="/compare" element={<Layout><Compare /></Layout>} />
      <Route path="/auth/callback" element={<Layout><AuthCallback /></Layout>} />
      <Route path="/advertise" element={<Layout><Advertise /></Layout>} />

      {/* Student verification — reachable any time, never forces browsing */}
      <Route
        path="/verify-account"
        element={
          <ProtectedRoute>
            <Layout><VerifyAccount /></Layout>
          </ProtectedRoute>
        }
      />



      {/* Protected Routes - Any authenticated user */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout><Profile /></Layout>
          </ProtectedRoute>
        }
      />
      {/* Invite-only agent application. Not linked from anywhere in the
          UI, excluded from the sitemap, disallowed in robots.txt and
          noindexed — see BecomeAgent.jsx. */}
      <Route
        path="/become-agent"
        element={
          <AgentInviteGate>
            <Layout><BecomeAgent /></Layout>
          </AgentInviteGate>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Layout><Notifications /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Agent Routes — also reachable by a plain 'user' who applied,
          in a read-only "explore" state until approved (see
          AgentDashboard.jsx). */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute allowedRoles={['user', 'agent', 'admin']}>
            <Layout><AgentDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Legal */}
      <Route path="/terms" element={<Layout><PolicyPage sectionId="terms" /></Layout>} />
      <Route path="/privacy" element={<Layout><PolicyPage sectionId="privacy" /></Layout>} />
      <Route path="/refund" element={<Layout><PolicyPage sectionId="refund" /></Layout>} />
      <Route path="/disclaimer" element={<Layout><PolicyPage sectionId="disclaimer" /></Layout>} />

      {/* Info Pages */}
      <Route path="/about" element={<Layout><About /></Layout>} />
      <Route path="/faq" element={<Layout><FAQ /></Layout>} />

      {/* Catch all */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
    </VerifyGateProvider>

  );
}

function App() {
  useEffect(() => {
    // Initialize Analytics on app load
    initializeAnalytics();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-center" expand toastOptions={{ style: { maxWidth: '92vw' } }} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;