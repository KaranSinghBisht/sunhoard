import { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { uiText } from "./content/text";
import { Guide } from "./ui/Guide";
import { beginTale, firstVisit, useTale } from "./game/story/tale";
import "./styles.css";

const Live = lazy(() => import("./LiveRoot"));
const Practice = lazy(() => import("./ui/Practice"));

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
createRoot(document.getElementById("root")!).render(<Root />);
