import { Switch, Route } from "wouter";
import Home from "./pages/Home";
import ImportSelect from "./pages/ImportSelect";
import CurrentMapping from "./pages/CurrentMapping";
import AIGeneration from "./pages/AIGeneration";
import ReviewRefine from "./pages/ReviewRefine";
import DashboardExport from "./pages/DashboardExport";
import SharedReport from "./pages/SharedReport";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/project/:projectId/import" component={ImportSelect} />
      <Route path="/project/:projectId/mapping" component={CurrentMapping} />
      <Route path="/project/:projectId/generate" component={AIGeneration} />
      <Route path="/project/:projectId/refine" component={ReviewRefine} />
      <Route path="/project/:projectId/dashboard" component={DashboardExport} />
      <Route path="/shared/:code" component={SharedReport} />
      <Route>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Page not found.</p>
        </div>
      </Route>
    </Switch>
  );
}
