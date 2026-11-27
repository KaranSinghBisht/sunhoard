import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { uiText } from "./content/text";
import { Guide } from "./ui/Guide";
import { beginTale, firstVisit, useTale } from "./game/story/tale";
import "./styles.css";
import "./windows.css";
import "./roll.css";
import "./fight.css";

const Live = lazy(() => import("./LiveRoot"));
const Practice = lazy(() => import("./ui/Practice"));

/** A lazy chunk can fail to load on a flaky network or after a redeploy; say so instead of going blank. */
class LoadGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app" role="alert">
        <p>{uiText("loadFailed")}</p>
        <button type="button" onClick={() => window.location.reload()}>
          {uiText("reload")}
        </button>
      </main>
    );
  }
}

function Root() {
  const [mode, setMode] = useState<"title" | "practice" | "live">("title");
  const exit = () => setMode("title");
  function begin(retell: boolean) {
    if (retell || (firstVisit() && useTale.getState().arrivals === 0)) beginTale();
    setMode("live");
  }
  return <Suspense fallback={<main className="app" role="status">{uiText("gameLoading")}</main>}>
    {mode === "title" && <Guide onBegin={begin} canRetell onPractice={() => setMode("practice")} />}
    {mode === "practice" && <Practice onExit={exit} />}
    {mode === "live" && <Live onExit={exit} />}
  </Suspense>;
}
createRoot(document.getElementById("root")!).render(
  <LoadGuard>
    <Root />
  </LoadGuard>,
);
