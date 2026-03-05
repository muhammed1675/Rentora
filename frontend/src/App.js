import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";

// Pages
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import PropertyDetails from "./pages/PropertyDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import BuyTokens from "./pages/BuyTokens";
import AgentDashboard from "./pages/AgentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import BecomeAgent from "./pages/BecomeAgent";
import PaymentCallback from "./pages/PaymentCallback";
import TermsAndPolicies from "./pages/TermsAndPolicies";
import Contact from "./pages/Contact";
import { Compare } from './pages/Compare';

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

function AppRoutes() {
  return (
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
        path="/buy-tokens"
        element={
          <ProtectedRoute>
            <Layout><BuyTokens /></Layout>
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
      <Route path="/terms" element={<Layout><TermsAndPolicies /></Layout>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
