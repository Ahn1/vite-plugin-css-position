import React, { Suspense, lazy, useState } from "react";
import StylesTarget from "../../src/StylesTargetReact";

const LazyComponent = lazy(() => import("./LazyComponent"));

export function App() {
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="styles">
        <StylesTarget />
      </div>
      <span>Test</span>
      <div className="card">
        <button onClick={() => setShow(true)}>Load lazy component</button>
        {show && (
          <Suspense fallback={<span>Loading…</span>}>
            <LazyComponent />
          </Suspense>
        )}
      </div>
    </div>
  );
}
