import React from "react";
import "./lazy.css";

export default function LazyComponent() {
  return <div className="lazy-box">Lazy component — its CSS is only injected when loaded.</div>;
}
