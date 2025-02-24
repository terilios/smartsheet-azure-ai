import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { SmartsheetProvider } from "./lib/smartsheet-context";
import { FullscreenSheetIdModal } from "./components/smartsheet/fullscreen-sheet-id-modal";
import "./index.css";
import "./styles/sheet.css";
import Home from "./pages/home";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SmartsheetProvider>
        <Router />
        <FullscreenSheetIdModal />
        <Toaster />
      </SmartsheetProvider>
    </QueryClientProvider>
  );
}

export default App;
