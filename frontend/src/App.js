import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import SupportChatbot from "./components/SupportChatbot";
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
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';
import { NotFound } from './pages/NotFound';
import { About } from './pages/About';
import { FAQ } from './pages/FAQ';
import { AgentRequirements } from './pages/AgentRequirements';
import Notifications from './pages/Notifications';

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function TrackPageViews() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <TrackPageViews />
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
      <Route path="/reset-password" element={<Layout><ResetPassword /></Layout>} />
      <Route path="/auth/callback" element={<Layout><AuthCallback /></Layout>} />

      {/* Protected Routes - Any authenticated user */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout><Profile /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/become-agent"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <Layout><BecomeAgent /></Layout>
          </ProtectedRoute>
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

      {/* Agent Routes */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute allowedRoles={['agent', 'admin']}>
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
      <Route path="/agent-requirements" element={<Layout><AgentRequirements /></Layout>} />

      {/* Catch all */}
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
    </>
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
        <SupportChatbot />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
