import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { SmartsheetProvider } from "./lib/smartsheet-context";
import { AuthProvider } from "./lib/auth-context";
import { FullscreenSheetIdModal } from "./components/smartsheet/fullscreen-sheet-id-modal";
import "./index.css";
import "./styles/sheet.css";
import "./styles/chat.css";
import Home from "./pages/home";
import NotFound from "./pages/not-found";
import { ErrorBoundary, useErrorFallback } from "./components/ui/error-boundary";
import { NotificationListener } from "./components/ui/notification";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Create a custom error fallback for the root error boundary
  const appErrorFallback = useErrorFallback(
    "Application Error",
    "Something went wrong with the application. Please refresh the page to try again."
  );
  
  return (
    <ErrorBoundary fallback={appErrorFallback} componentName="App">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SmartsheetProvider>
            <Router />
            <FullscreenSheetIdModal />
            <NotificationListener />
            <Toaster />
          </SmartsheetProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
